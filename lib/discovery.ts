import Groq from 'groq-sdk'

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function discoverCompanyWebsite(companyName: string): Promise<string> {
  try {
    const groq = getGroq()
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `What is the official website URL for the company "${companyName}"? Reply with only the base URL (e.g. https://notion.so). No explanation, no punctuation, just the URL.`,
      }],
      temperature: 0,
      max_tokens: 50,
    })

    const raw = (res.choices[0]?.message?.content ?? '').trim().replace(/\.$/, '')
    const normalized = raw.startsWith('http') ? raw : `https://${raw}`
    const parsed = new URL(normalized)
    return parsed.origin
  } catch {
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
    return `https://www.${slug}.com`
  }
}
