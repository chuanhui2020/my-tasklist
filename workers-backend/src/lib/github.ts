const GITHUB_API = 'https://api.github.com'

function headers(token: string) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tasklist-code-reviewer',
  }
}

export async function findOpenPR(token: string, repo: string, head: string): Promise<{ number: number; title: string } | null> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/pulls?state=open&head=${repo.split('/')[0]}:${head}`, {
    headers: headers(token),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const prs = await res.json() as { number: number; title: string }[]
  return prs[0] || null
}

export async function createPR(token: string, repo: string, head: string, base: string, title: string): Promise<number> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/pulls`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ title, head, base }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Create PR failed: ${res.status} ${text}`)
  }
  const pr = await res.json() as { number: number }
  return pr.number
}

export async function postPRComment(token: string, repo: string, prNumber: number, body: string): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ body }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Post comment failed: ${res.status} ${text}`)
  }
}

export async function mergePR(token: string, repo: string, prNumber: number): Promise<boolean> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ merge_method: 'squash' }),
  })
  return res.ok
}

export async function addLabel(token: string, repo: string, prNumber: number, label: string): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/issues/${prNumber}/labels`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ labels: [label] }),
  })
  if (!res.ok) {
    console.error(`Add label failed: ${res.status}`)
  }
}

export async function getPRCommits(token: string, repo: string, prNumber: number): Promise<{ sha: string; message: string }[]> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}/commits`, {
    headers: headers(token),
  })
  if (!res.ok) throw new Error(`Get commits failed: ${res.status}`)
  const commits = await res.json() as { sha: string; commit: { message: string } }[]
  return commits.map(c => ({ sha: c.sha, message: c.commit.message }))
}

export async function verifyWebhookSignature(secret: string, payload: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const expected = 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return expected === signature
}
