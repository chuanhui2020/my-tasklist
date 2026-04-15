import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { execSync } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'

const PORT = 4000
const WORK_DIR = '/tmp/repo'

interface ReviewRequest {
  repo_url: string
  branch: string
  base_branch: string
  commit_messages: string
  openai_api_key: string
}

interface ReviewReport {
  compile: { success: boolean; errors: string[] }
  review: { issues: { severity: string; file: string; line: number; message: string }[]; summary: string }
  changelog: string
}

function run(cmd: string, cwd?: string): { stdout: string; success: boolean } {
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024 })
    return { stdout, success: true }
  } catch (err: any) {
    return { stdout: err.stdout || err.stderr || err.message, success: false }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function handleReview(params: ReviewRequest): Promise<ReviewReport> {
  // 清理上次残留
  if (existsSync(WORK_DIR)) {
    rmSync(WORK_DIR, { recursive: true, force: true })
  }

  // 1. Clone 仓库
  const cloneResult = run(`git clone --depth=50 --branch ${params.branch} ${params.repo_url} ${WORK_DIR}`)
  if (!cloneResult.success) {
    return {
      compile: { success: false, errors: [`git clone failed: ${cloneResult.stdout}`] },
      review: { issues: [], summary: 'Clone 失败，无法执行 review' },
      changelog: '',
    }
  }

  // 2. 安装依赖（检测项目类型）
  const hasPackageJson = existsSync(`${WORK_DIR}/package.json`)
  if (hasPackageJson) {
    run('npm install --ignore-scripts', WORK_DIR)
  }

  // 检查是否有前后端子目录
  const subDirs = ['workers-backend', 'frontend']
  for (const dir of subDirs) {
    if (existsSync(`${WORK_DIR}/${dir}/package.json`)) {
      run('npm install --ignore-scripts', `${WORK_DIR}/${dir}`)
    }
  }

  // 3. 编译检查
  const compileErrors: string[] = []
  let compileSuccess = true

  // 检查 workers-backend
  if (existsSync(`${WORK_DIR}/workers-backend/tsconfig.json`)) {
    const tscResult = run('npx tsc --noEmit 2>&1', `${WORK_DIR}/workers-backend`)
    if (!tscResult.success) {
      compileSuccess = false
      compileErrors.push('=== workers-backend ===', tscResult.stdout)
    }
  }

  // 检查根目录
  if (existsSync(`${WORK_DIR}/tsconfig.json`)) {
    const tscResult = run('npx tsc --noEmit 2>&1', WORK_DIR)
    if (!tscResult.success) {
      compileSuccess = false
      compileErrors.push('=== root ===', tscResult.stdout)
    }
  }

  // 4. 获取 diff
  const diffResult = run(`git diff origin/${params.base_branch}...HEAD -- . ':!package-lock.json' ':!node_modules'`, WORK_DIR)
  const diff = diffResult.stdout.slice(0, 15000) // 限制大小

  // 5. Codex CLI code review
  let reviewResult: { issues: { severity: string; file: string; line: number; message: string }[]; summary: string }

  try {
    // 设置 OPENAI_API_KEY 环境变量
    process.env.OPENAI_API_KEY = params.openai_api_key

    const reviewPrompt = `You are a code reviewer. Analyze the following git diff and provide a review in JSON format.

Return ONLY valid JSON with this structure:
{
  "issues": [
    {"severity": "critical|warning|info", "file": "path/to/file", "line": 0, "message": "description"}
  ],
  "summary": "overall assessment in Chinese"
}

Rules:
- severity "critical": bugs, security issues, data loss risks
- severity "warning": code quality, performance, maintainability
- severity "info": style, suggestions
- Write summary and messages in Chinese
- If no issues found, return empty issues array

Git diff:
${diff}`

    // 尝试用 codex CLI
    const codexResult = run(
      `codex --approval-mode full-auto --quiet -p "${reviewPrompt.replace(/"/g, '\\"')}"`,
      WORK_DIR
    )

    if (codexResult.success) {
      // 尝试从输出中提取 JSON
      const jsonMatch = codexResult.stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        reviewResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON in codex output')
      }
    } else {
      throw new Error('Codex CLI failed, falling back to API')
    }
  } catch {
    // 降级：直接调用 OpenAI API
    reviewResult = await callOpenAIForReview(params.openai_api_key, diff)
  }

  // 6. 生成 Changelog
  let changelog = ''
  try {
    const changelogPrompt = `Based on these git commit messages, generate a changelog in Chinese using Keep a Changelog format (Added/Fixed/Changed sections). Only include relevant sections.

Commit messages:
${params.commit_messages}

Return ONLY the changelog content in Markdown, no JSON wrapping.`

    changelog = await callOpenAIChat(params.openai_api_key, changelogPrompt)
  } catch {
    // 降级：直接用 commit messages
    changelog = params.commit_messages
      .split('\n')
      .map(line => `- ${line}`)
      .join('\n')
  }

  // 清理
  rmSync(WORK_DIR, { recursive: true, force: true })

  return {
    compile: { success: compileSuccess, errors: compileErrors },
    review: reviewResult,
    changelog,
  }
}

async function callOpenAIForReview(apiKey: string, diff: string) {
  const prompt = `You are a code reviewer. Analyze the following git diff and provide a review in JSON format.

Return ONLY valid JSON with this structure:
{
  "issues": [
    {"severity": "critical|warning|info", "file": "path/to/file", "line": 0, "message": "description"}
  ],
  "summary": "overall assessment in Chinese"
}

Rules:
- severity "critical": bugs, security issues, data loss risks
- severity "warning": code quality, performance, maintainability
- severity "info": style, suggestions
- Write summary and messages in Chinese
- If no issues found, return empty issues array

Git diff:
${diff}`

  const result = await callOpenAIChat(apiKey, prompt)
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return { issues: [], summary: 'Review 解析失败' }
}

async function callOpenAIChat(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && req.url === '/review') {
    try {
      const body = await readBody(req)
      const params = JSON.parse(body) as ReviewRequest
      const report = await handleReview(params)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(report))
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`Code review container listening on port ${PORT}`)
})
