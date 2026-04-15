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
