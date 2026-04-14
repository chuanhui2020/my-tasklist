import { createServer, IncomingMessage, ServerResponse } from 'node:http'

const PORT = 4000

interface ReviewRequest {
  diff: string
  commit_messages: string
  ai_api_key: string
  ai_base_url: string
  ai_model: string
  github_token: string
  github_repo: string
  pr_number: number
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
    body: JSON.stringify({ merge_method: 'squash' }),
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

async function handleReview(params: ReviewRequest): Promise<void> {
  const { github_token, github_repo, pr_number } = params

  try {
    // 1. AI Code Review
    console.log('[container] Running AI review...')
    let reviewResult: { issues: { severity: string; file: string; line: number; message: string }[]; summary: string }
    let reviewFailed = false
    try {
      reviewResult = await callAIForReview(params.ai_api_key, params.ai_base_url, params.ai_model, params.diff)
    } catch (err: any) {
      reviewFailed = true
      reviewResult = { issues: [], summary: `AI Review 调用失败: ${err.message}` }
    }

    // 2. 生成 Changelog
    console.log('[container] Generating changelog...')
    let changelog = ''
    try {
      changelog = await callAIChat(params.ai_api_key, params.ai_base_url, params.ai_model,
        `Based on these git commit messages, generate a changelog in Chinese using Keep a Changelog format (Added/Fixed/Changed sections). Only include relevant sections.\n\nCommit messages:\n${params.commit_messages}\n\nReturn ONLY the changelog content in Markdown.`)
    } catch {
      changelog = params.commit_messages.split('\n').map(line => `- ${line}`).join('\n')
    }

    // 3. 格式化报告
    const markdown = formatReport(reviewResult, changelog)

    // 4. 写回 PR comment
    console.log('[container] Posting comment...')
    await postPRComment(github_token, github_repo, pr_number, markdown)

    // 5. 自动合并决策：review 失败、有 critical 或 warning 都不合并
    const hasCritical = reviewResult.issues.some(i => i.severity === 'critical')
    const hasWarning = reviewResult.issues.some(i => i.severity === 'warning')
    if (reviewFailed || hasCritical || hasWarning) {
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
  }
}

function formatReport(review: { issues: { severity: string; file: string; line: number; message: string }[]; summary: string }, changelog: string): string {
  const lines: string[] = []
  lines.push('## 🔍 自动 Review 报告\n')

  lines.push('### Code Review')
  if (review.issues.length > 0) {
    lines.push('| 严重度 | 文件 | 说明 |')
    lines.push('|--------|------|------|')
    for (const issue of review.issues) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'
      const location = issue.line > 0 ? `${issue.file}:${issue.line}` : issue.file
      lines.push(`| ${icon} ${issue.severity} | ${location} | ${issue.message} |`)
    }
  } else {
    lines.push('> 未发现问题')
  }
  lines.push('')

  lines.push('### 总结')
  lines.push(review.summary)
  lines.push('')

  if (changelog) {
    lines.push('---\n')
    lines.push('## 📋 Changelog')
    lines.push(changelog)
    lines.push('')
  }

  lines.push('---')
  lines.push('*自动生成 by Code Review Bot*')
  return lines.join('\n')
}

async function callAIForReview(apiKey: string, baseUrl: string, model: string, diff: string) {
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

  const result = await callAIChat(apiKey, baseUrl, model, prompt)
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return { issues: [], summary: 'Review 解析失败' }
}

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

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && req.url === '/review') {
    try {
      const body = await readBody(req)
      const params = JSON.parse(body) as ReviewRequest

      // 参数校验
      if (!params.github_token || !params.github_repo || !params.pr_number || !params.ai_base_url || !params.ai_api_key || !params.diff) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields' }))
        return
      }

      // 立即返回 202，异步执行
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
    res.end(JSON.stringify({ status: 'ok' }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`Code review container listening on port ${PORT}`)
})
