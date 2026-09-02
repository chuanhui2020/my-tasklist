export class AIError extends Error {
  status?: number
  detail?: string
  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'AIError'
    this.status = status
    this.detail = detail
  }
}

export async function callAI(
  env: { AI_API_KEY: string; AI_BASE_URL: string; AI_IMAGE_BASE_URL?: string; AI_MODEL: string },
  messages: { role: string; content: string | { type: string; [key: string]: unknown }[] }[],
  options: { max_completion_tokens?: number; deadlineMs?: number; direct?: boolean; model?: string } = {}
): Promise<string> {
  // gpt-5.x 是推理模型：
  // - 只认 max_completion_tokens（max_tokens 已废弃且不兼容），且该额度是「推理 token + 可见输出」合计，
  //   给少了会把预算全烧在推理上、content 返回空，所以各调用方要按「期望输出 + 推理余量」给值
  // - 不支持 temperature，传了会被忽略或直接 400，故不再下发
  const { max_completion_tokens = 4000, deadlineMs = 170000, direct = false, model } = options
  // direct=true 走灰云直连 api-direct（DNS-only，nginx proxy_read_timeout 180s），
  // 绕过橙云 api.ch-tools.org 的 ~100s 边缘超时。视觉识别（gpt-5.6 OCR）常 >100s，必须直连。
  const baseUrl = direct ? (env.AI_IMAGE_BASE_URL || env.AI_BASE_URL) : env.AI_BASE_URL
  const usedModel = model || env.AI_MODEL

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deadlineMs)
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: usedModel,
        messages,
        max_completion_tokens,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('AI API error:', response.status, text.slice(0, 500))
      throw new AIError(`AI API error: ${response.status}`, response.status, text.slice(0, 200))
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[]
      usage?: { completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } }
    }
    const choice = data.choices?.[0]
    const content = choice?.message?.content || ''
    // 空内容/截断是推理模型典型故障（预算被推理吃光），把预算账单打进日志，省得靠猜
    if (!content || choice?.finish_reason === 'length') {
      console.warn('AI empty or truncated output:', JSON.stringify({
        model: usedModel,
        finish_reason: choice?.finish_reason,
        max_completion_tokens,
        completion_tokens: data.usage?.completion_tokens,
        reasoning_tokens: data.usage?.completion_tokens_details?.reasoning_tokens,
      }))
    }
    return content
  } catch (e) {
    if (e instanceof AIError) throw e
    const aborted = String(e).toLowerCase().includes('abort')
    console.error('AI API exception:', String(e).slice(0, 200))
    throw new AIError(aborted ? `AI 超时（${Math.round(deadlineMs / 1000)}s）` : 'AI 调用异常', undefined, String(e).slice(0, 200))
  } finally {
    clearTimeout(timer)
  }
}

export async function generateImage(
  env: { AI_API_KEY: string; AI_BASE_URL: string; AI_IMAGE_BASE_URL?: string },
  prompt: string,
  options: { size?: string; quality?: string; deadlineMs?: number; retries?: number } = {}
): Promise<Uint8Array | null> {
  const { size = '1024x1024', quality = 'low', deadlineMs = 190000, retries = 1 } = options
  // 生图走灰云直连域名（api-direct），绕过 api.ch-tools.org 橙云的 ~100s 边缘超时；
  // 生图常达 ~200s，必须直连源站。消费者侧 15min wall-time 足够等待。
  const baseUrl = env.AI_IMAGE_BASE_URL || env.AI_BASE_URL
  // 总时间预算：单次生图整体封顶 deadlineMs（含重试）。生图常达 ~200s，调用方应传足够值
  const deadline = Date.now() + deadlineMs

  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 5000) break // 预算耗尽 → 不再重试（这样重试只在快速失败后发生）
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)
    try {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt,
          n: 1,
          size,
          quality,
          response_format: 'b64_json',
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        console.error('Image API error:', response.status, (await response.text()).slice(0, 300))
        if (response.status >= 500 && attempt < retries) continue // 5xx/524 抖动 → 重试
        return null
      }

      const data = await response.json() as { data?: { b64_json?: string; url?: string }[] }
      const item = data.data?.[0]
      if (item?.b64_json) return base64ToBytes(item.b64_json)
      if (item?.url) { // 兼容代理返回 url 而非 b64 的情况
        const imgResp = await fetch(item.url, { signal: controller.signal })
        if (!imgResp.ok) {
          console.error('Image download error:', imgResp.status)
          return null
        }
        return new Uint8Array(await imgResp.arrayBuffer())
      }
      console.error('Image API: no b64_json/url in response', JSON.stringify(data).slice(0, 200))
      return null
    } catch (e) {
      console.error('Image API exception:', String(e).slice(0, 200))
      if (attempt < retries) continue
      return null
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
