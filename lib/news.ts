import { XMLParser } from 'fast-xml-parser'

export interface NewsItem {
  title: string
  link: string
  description: string
  pubDate: string
}

export async function fetchNews(companyName: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(companyName)
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`News fetch failed: ${response.status}`)

  const xml = await response.text()
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(xml)
  const rawItems = parsed?.rss?.channel?.item ?? []
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems]

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  return items
    .filter((item: any) => new Date(item.pubDate).getTime() > sevenDaysAgo)
    .map((item: any) => ({
      title: String(item.title ?? ''),
      link: String(item.link ?? ''),
      description: String(item.description ?? ''),
      pubDate: String(item.pubDate ?? ''),
    }))
    .slice(0, 10)
}
