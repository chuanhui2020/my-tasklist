export async function callAI(
  env: { AI_API_KEY: string; AI_BASE_URL: string; AI_MODEL: string },
  messages: { role: string; content: string | { type: string; [key: string]: unknown }[] }[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const { temperature = 0.7, max_tokens = 2000 } = options

  const response = await fetch(`${env.AI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      temperature,
      max_tokens,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('AI API error:', response.status, text)
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

export async function generateImage(
  env: { AI_API_KEY: string; AI_BASE_URL: string },
  prompt: string,
  options: { size?: string; quality?: string } = {}
): Promise<Uint8Array | null> {
  const { size = '1024x1024', quality = 'low' } = options

  const response = await fetch(`${env.AI_BASE_URL}/v1/images/generations`, {
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
  })

  if (!response.ok) {
    console.error('Image API error:', response.status, await response.text())
    return null
  }

  const data = await response.json() as { data: { b64_json: string }[] }
  const b64 = data.data?.[0]?.b64_json
  if (!b64) return null

  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
