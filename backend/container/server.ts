import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const exec = promisify(execFile)
const PORT = 4000
const WORKSPACE = '/workspace'

// Simple async mutex to prevent concurrent git operations
let reviewLock = false
const waitForLock = () => new Promise<void>((resolve) => {
  const check = () => {
    if (!reviewLock) { reviewLock = true; resolve() }
    else { setTimeout(check, 1000) }
  }
  check()
})
const releaseLock = () => { reviewLock = false }

interface ReviewRequest {
  github_token: string
  github_repo: string
  pr_number: number
  pr_branch: string
  base_branch: string
  commit_messages: string
  openai_api_key: string
  openai_base_url: string
  openai_model: string
  ai_api_key: string
  ai_base_url: string
  ai_model: string
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function postPRComment(token: string, repo: string, prNumber: number, body: string) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'tasklist-code-reviewer',
    },
    body: JSON.stringify({ body }),
  })
  if (!res.ok) {
    console.error('Post comment failed:', res.status, await res.text())
  }
}

async function mergePR(token: string, repo: string, prNumber: number): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'tasklist-code-reviewer',
    },
    body: JSON.stringify({ merge_method: 'merge' }),
  })
  return res.ok
}

async function addLabel(token: string, repo: string, prNumber: number, label: string) {
  await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/labels`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'tasklist-code-reviewer',
    },
    body: JSON.stringify({ labels: [label] }),
  })
}

// --- Git helpers ---

// NOTE: 仅用 repo 名称作为目录，不同 owner 下同名仓库会冲突。
// 当前为单仓库场景，无此风险。如需支持多仓库，改用 `${owner}/${repo}` 路径。
function repoDir(repo: string): string {
  return `${WORKSPACE}/${repo.split('/')[1]}`
}

async function ensureRepo(token: string, repo: string): Promise<string> {
  const dir = repoDir(repo)
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`

  if (existsSync(`${dir}/.git`)) {
    console.log('[git] Repo exists, fetching...')
    await exec('git', ['remote', 'set-url', 'origin', cloneUrl], { cwd: dir })
    await exec('git', ['fetch', '--all', '--prune'], { cwd: dir })
  } else {
    console.log('[git] Cloning repo...')
    await exec('git', ['clone', cloneUrl, dir])
  }
  return dir
}

async function checkoutPR(dir: string, prBranch: string, baseBranch: string): Promise<void> {
  await exec('git', ['checkout', baseBranch], { cwd: dir })
  await exec('git', ['reset', '--hard', `origin/${baseBranch}`], { cwd: dir })
  await exec('git', ['checkout', prBranch], { cwd: dir })
  await exec('git', ['reset', '--hard', `origin/${prBranch}`], { cwd: dir })
}

// --- Codex CLI ---

async function runCodexReview(dir: string, openaiApiKey: string, openaiBaseUrl: string, model: string, baseBranch: string): Promise<string> {
  const prompt =
    `You are a code reviewer for a personal project. Your task is READ-ONLY review. ` +
    `IMPORTANT: Do NOT modify any files, do NOT create commits, do NOT push code. Only read and analyze. ` +
    `Run git diff ${baseBranch}...HEAD to see the changes. ` +
    'You may read source files to understand context, but NEVER write or edit any file. ' +
    'Context: This is a personal single-repo project running on Cloudflare Workers with an internal container. ' +
    'Review standards:\n' +
    '- Critical: ONLY real bugs that will cause runtime errors, data loss, or broken functionality\n' +
    '- Warning: Performance issues, code quality concerns worth noting\n' +
    '- Info: Style suggestions, potential improvements, architectural trade-offs\n' +
    '- Do NOT mark security hardening suggestions (like token handling, lock mechanisms) as critical in this internal/personal context\n' +
    '- Do NOT mark design trade-offs or single-use-case limitations as critical\n' +
    'Provide a structured review: 1) Summary, 2) Critical issues, 3) Warnings, 4) Suggestions. Write in Chinese. Format as Markdown. ' +
    'At the very end, output exactly one verdict on its own line:\n' +
    'VERDICT: PASS\n' +
    'VERDICT: FAIL\n' +
    'Use FAIL only if there are real bugs that will cause runtime errors or data loss. ' +
    'PASS for everything else including warnings and suggestions.'

  try {
    // Write Codex config with custom provider (force HTTP, no websocket)
    const codexHome = '/root/.codex'
    if (!existsSync(codexHome)) mkdirSync(codexHome, { recursive: true })
    writeFileSync(`${codexHome}/config.toml`, [
      `model = "${model}"`,
      `model_provider = "proxy"`,
      ``,
      `[model_providers.proxy]`,
      `name = "Custom Proxy"`,
      `base_url = "${openaiBaseUrl}"`,
      `env_key = "OPENAI_API_KEY"`,
      `supports_websockets = false`,
    ].join('\n'))

    const codexOutput = await new Promise<string>((resolve, reject) => {
      const args = ['exec', '--full-auto', '-C', dir, prompt]
      const child = spawn('codex', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CODEX_HOME: codexHome, OPENAI_API_KEY: openaiApiKey },
        timeout: 300_000,
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      child.on('close', (code) => {
        if (code === 0) resolve(stdout || stderr || 'Codex produced no output')
        else reject(new Error(`Codex exited with code ${code}\nstderr: ${stderr}`))
      })
      child.on('error', reject)
    })

    return codexOutput
  } finally {
    // Discard any changes Codex might have made
    await exec('git', ['checkout', '.'], { cwd: dir }).catch(() => {})
    await exec('git', ['clean', '-fd'], { cwd: dir }).catch(() => {})
  }
}

// --- AI Chat (for changelog) ---

async function callAIChat(apiKey: string, baseUrl: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API error: ${res.status} ${text}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

// --- Review orchestration ---

async function handleReview(params: ReviewRequest): Promise<void> {
  const { github_token, github_repo, pr_number, pr_branch, base_branch } = params

  await waitForLock()
  try {
    console.log('[container] Ensuring repo clone...')
    const dir = await ensureRepo(github_token, github_repo)

    console.log('[container] Checking out PR branch...')
    await checkoutPR(dir, pr_branch, base_branch)

    console.log('[container] Running Codex review...')
    let codexOutput: string
    let reviewFailed = false
    try {
      codexOutput = await runCodexReview(dir, params.openai_api_key, params.openai_base_url, params.openai_model, base_branch)
    } catch (err: any) {
      reviewFailed = true
      codexOutput = `Codex review failed: ${err.message}\nstderr: ${err.stderr || 'none'}`
    }

    console.log('[container] Generating changelog...')
    let changelog = ''
    try {
      changelog = await callAIChat(params.ai_api_key, params.ai_base_url, params.ai_model,
        `Based on these git commit messages, generate a changelog in Chinese using Keep a Changelog format (Added/Fixed/Changed sections). Only include relevant sections.\n\nCommit messages:\n${params.commit_messages}\n\nReturn ONLY the changelog content in Markdown.`)
    } catch {
      changelog = params.commit_messages.split('\n').map(line => `- ${line}`).join('\n')
    }

    const markdown = formatReport(codexOutput, changelog)

    console.log('[container] Posting comment...')
    await postPRComment(github_token, github_repo, pr_number, markdown)

    // Auto-merge decision based on VERDICT line
    const verdictMatch = codexOutput.match(/^VERDICT:\s*(PASS|FAIL)\s*$/m)
    const verdict = verdictMatch ? verdictMatch[1] : null
    const hasBlocker = reviewFailed || verdict === 'FAIL' || !verdict
    if (hasBlocker) {
      await addLabel(github_token, github_repo, pr_number, 'needs-fix')
    } else {
      const merged = await mergePR(github_token, github_repo, pr_number)
      if (!merged) {
        await postPRComment(github_token, github_repo, pr_number, '⚠️ 自动合并失败，请手动处理。')
      }
    }

    console.log('[container] Review complete!')
  } catch (err: any) {
    const errMsg = err.message || String(err)
    console.error('[container] Error:', errMsg)
    await postPRComment(github_token, github_repo, pr_number,
      `## ❌ Review 流程出错\n\n\`\`\`\n${errMsg}\n\`\`\``)
  } finally {
    releaseLock()
  }
}

function formatReport(codexOutput: string, changelog: string): string {
  const lines: string[] = []
  lines.push('## 🔍 Codex AI Review 报告\n')
  lines.push('### Code Review')
  lines.push(codexOutput)
  lines.push('')

  if (changelog) {
    lines.push('---\n')
    lines.push('### 📋 Changelog')
    lines.push(changelog)
    lines.push('')
  }

  lines.push('---')
  lines.push('*自动生成 by Codex Code Review Bot*')
  return lines.join('\n')
}

// --- HTTP Server ---

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && req.url === '/review') {
    try {
      const body = await readBody(req)
      const params = JSON.parse(body) as ReviewRequest

      if (!params.github_token || !params.github_repo || !params.pr_number ||
          !params.pr_branch || !params.base_branch || !params.openai_api_key) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields' }))
        return
      }

      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'Review started' }))

      handleReview(params).catch(err => {
        console.error('[container] Unhandled review error:', err)
      })
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', version: '2.0.0' }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`Code review container (Codex) listening on port ${PORT}`)
})
