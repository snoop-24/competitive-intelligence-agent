export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: 'text/markdown',
      'X-Return-Format': 'markdown',
    },
  })
  if (!response.ok) throw new Error(`Scrape failed: ${response.status}`)
  return response.text()
}
