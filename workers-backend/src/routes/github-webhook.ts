import { Hono } from 'hono'
import type { Env } from '../types'
import {
  verifyWebhookSignature,
  findOpenPR,
  createPR,
  postPRComment,
  mergePR,
  addLabel,
  getPRCommits,
} from '../lib/github'

export const githubWebhookRoutes = new Hono<Env>()

interface PushEvent {
  ref: string
  repository: { full_name: string }
  head_commit: { id: string; message: string } | null
  commits: { id: string; message: string }[]
}

interface ReviewReport {
  compile: { success: boolean; errors: string[] }
  review: { issues: { severity: string; file: string; line: number; message: string }[]; summary: string }
  changelog: string
}

githubWebhookRoutes.post('/', async (c) => {
  const signature = c.req.header('X-Hub-Signature-256') || ''
  const event = c.req.header('X-GitHub-Event') || ''
  const body = await c.req.text()

  // 验证签名
  const valid = await verifyWebhookSignature(c.env.GITHUB_WEBHOOK_SECRET, body, signature)
  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // 只处理 push 事件
  if (event !== 'push') {
    return c.json({ message: 'Ignored event: ' + event }, 200)
  }

  const payload = JSON.parse(body) as PushEvent
  const branch = payload.ref.replace('refs/heads/', '')
  const repo = payload.repository.full_name

  // 忽略 master 分支的 push
  if (branch === 'master' || branch === 'main') {
    return c.json({ message: 'Ignored push to ' + branch }, 200)
  }

  // 异步处理，立即返回 202
  c.executionCtx.waitUntil(handleReview(c.env, repo, branch))

  return c.json({ message: 'Review triggered', repo, branch }, 202)
})

async function handleReview(env: Env['Bindings'], repo: string, branch: string) {
  try {
    const token = env.GITHUB_TOKEN

    // 1. 查找或创建 PR
    let pr = await findOpenPR(token, repo, branch)
    let prNumber: number
    if (pr) {
      prNumber = pr.number
    } else {
      prNumber = await createPR(token, repo, branch, 'master', `Auto PR: ${branch}`)
    }

    // 2. 获取 commits 用于 changelog
    const commits = await getPRCommits(token, repo, prNumber)
    const commitMessages = commits.map(c => `${c.sha.slice(0, 7)} ${c.message}`).join('\n')

    // 3. 调度 Container 执行 review
    const container = env.CODE_REVIEW_CONTAINER.get(
      env.CODE_REVIEW_CONTAINER.idFromName('code-reviewer')
    )

    const reviewResponse = await container.fetch('http://container/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_url: `https://x-access-token:${token}@github.com/${repo}.git`,
        branch,
        base_branch: 'master',
        commit_messages: commitMessages,
        openai_api_key: env.OPENAI_API_KEY,
      }),
    })

    if (!reviewResponse.ok) {
      const errText = await reviewResponse.text()
      await postPRComment(token, repo, prNumber, `## ❌ Review 失败\n\n容器执行出错：\n\`\`\`\n${errText}\n\`\`\``)
      return
    }

    const report = await reviewResponse.json() as ReviewReport

    // 4. 生成报告 Markdown
    const markdown = formatReport(report)

    // 5. 写回 PR comment
    await postPRComment(token, repo, prNumber, markdown)

    // 6. 决定是否自动合并
    const hasCritical = report.review.issues.some(i => i.severity === 'critical')
    if (!report.compile.success || hasCritical) {
      await addLabel(token, repo, prNumber, 'needs-fix')
    } else {
      const merged = await mergePR(token, repo, prNumber)
      if (!merged) {
        await postPRComment(token, repo, prNumber, '⚠️ 自动合并失败，请手动处理。')
      }
    }
  } catch (err) {
    console.error('Review process error:', err)
  }
}

function formatReport(report: ReviewReport): string {
  const lines: string[] = []

  lines.push('## 🔍 自动 Review 报告\n')

  // 编译检查
  const compileIcon = report.compile.success ? '✅' : '❌'
  lines.push(`### 编译检查 ${compileIcon}`)
  if (report.compile.errors.length > 0) {
    lines.push('```')
    lines.push(report.compile.errors.join('\n'))
    lines.push('```')
  } else {
    lines.push('> 编译通过，无错误')
  }
  lines.push('')

  // Code Review
  lines.push('### Code Review')
  if (report.review.issues.length > 0) {
    lines.push('| 严重度 | 文件 | 说明 |')
    lines.push('|--------|------|------|')
    for (const issue of report.review.issues) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'
      const location = issue.line > 0 ? `${issue.file}:${issue.line}` : issue.file
      lines.push(`| ${icon} ${issue.severity} | ${location} | ${issue.message} |`)
    }
  } else {
    lines.push('> 未发现问题')
  }
  lines.push('')

  // 总结
  lines.push('### 总结')
  lines.push(report.review.summary)
  lines.push('')

  // Changelog
  if (report.changelog) {
    lines.push('---\n')
    lines.push('## 📋 Changelog')
    lines.push(report.changelog)
    lines.push('')
  }

  lines.push('---')
  lines.push('*自动生成 by Code Review Bot*')

  return lines.join('\n')
}
