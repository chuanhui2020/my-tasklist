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
  getPRDiff,
} from '../lib/github'

export const githubWebhookRoutes = new Hono<Env>()

interface PushEvent {
  ref: string
  repository: { full_name: string }
  head_commit: { id: string; message: string } | null
  commits: { id: string; message: string }[]
}

// 测试端点
githubWebhookRoutes.get('/test', async (c) => {
  try {
    const env = c.env
    const token = env.GITHUB_TOKEN
    const repo = 'chuanhui2020/my-tasklist'
    const branch = 'dev'

    const pr = await findOpenPR(token, repo, branch)
    if (!pr) {
      return c.json({ error: 'No open PR found for dev' }, 404)
    }

    const commits = await getPRCommits(token, repo, pr.number)
    const commitMessages = commits.map(cm => `${cm.sha.slice(0, 7)} ${cm.message}`).join('\n')
    const diff = await getPRDiff(token, repo, pr.number)

    const container = env.CODE_REVIEW_CONTAINER.get(
      env.CODE_REVIEW_CONTAINER.idFromName('code-reviewer')
    )

    const res = await container.fetch('http://container/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diff: diff.slice(0, 15000),
        commit_messages: commitMessages,
        ai_api_key: env.AI_API_KEY,
        ai_base_url: env.AI_BASE_URL,
        ai_model: env.AI_MODEL,
        github_token: token,
        github_repo: repo,
        pr_number: pr.number,
      }),
    })

    const text = await res.text()
    return c.json({ status: res.status, body: text })
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, 500)
  }
})

githubWebhookRoutes.post('/', async (c) => {
  const signature = c.req.header('X-Hub-Signature-256') || ''
  const event = c.req.header('X-GitHub-Event') || ''
  const body = await c.req.text()

  const valid = await verifyWebhookSignature(c.env.GITHUB_WEBHOOK_SECRET, body, signature)
  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  if (event !== 'push') {
    return c.json({ message: 'Ignored event: ' + event }, 200)
  }

  const payload = JSON.parse(body) as PushEvent
  const branch = payload.ref.replace('refs/heads/', '')
  const repo = payload.repository.full_name

  if (branch === 'master' || branch === 'main') {
    return c.json({ message: 'Ignored push to ' + branch }, 200)
  }

  c.executionCtx.waitUntil(dispatchReview(c.env, repo, branch))

  return c.json({ message: 'Review triggered', repo, branch }, 202)
})

async function dispatchReview(env: Env['Bindings'], repo: string, branch: string) {
  const token = env.GITHUB_TOKEN

  try {
    // 1. 查找或创建 PR
    let pr = await findOpenPR(token, repo, branch)
    let prNumber: number
    if (pr) {
      prNumber = pr.number
    } else {
      prNumber = await createPR(token, repo, branch, 'master', `Auto PR: ${branch}`)
    }

    // 2. 获取 commits 和 diff
    const commits = await getPRCommits(token, repo, prNumber)
    const commitMessages = commits.map(c => `${c.sha.slice(0, 7)} ${c.message}`).join('\n')
    const diff = await getPRDiff(token, repo, prNumber)

    // 3. 发送给容器（容器立即返回 202，异步执行 review 并直接写 GitHub）
    const container = env.CODE_REVIEW_CONTAINER.get(
      env.CODE_REVIEW_CONTAINER.idFromName('code-reviewer')
    )

    await container.fetch('http://container/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diff: diff.slice(0, 15000),
        commit_messages: commitMessages,
        ai_api_key: env.AI_API_KEY,
        ai_base_url: env.AI_BASE_URL,
        ai_model: env.AI_MODEL,
        github_token: token,
        github_repo: repo,
        pr_number: prNumber,
      }),
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[review] Dispatch error:', errMsg)
    try {
      const pr = await findOpenPR(token, repo, branch)
      if (pr) {
        await postPRComment(token, repo, pr.number, `## ❌ Review 调度失败\n\n\`\`\`\n${errMsg}\n\`\`\``)
      }
    } catch { /* ignore */ }
  }
}
