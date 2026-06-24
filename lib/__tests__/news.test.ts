import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchNews } from '../news'

const recentDate = new Date().toUTCString()
const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toUTCString()

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <title>Notion raises $100M Series C</title>
      <link>https://techcrunch.com/notion-series-c</link>
      <description>Notion announced a major funding round.</description>
      <pubDate>${recentDate}</pubDate>
    </item>
    <item>
      <title>Old Notion news from last month</title>
      <link>https://techcrunch.com/old</link>
      <description>Stale news item.</description>
      <pubDate>${oldDate}</pubDate>
    </item>
  </channel>
</rss>`

describe('fetchNews', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_RSS),
    })
  })

  it('builds the correct Google News RSS URL for the company name', async () => {
    await fetchNews('Notion')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('news.google.com/rss/search?q=Notion')
    )
  })

  it('returns only news items from the last 7 days', async () => {
    const items = await fetchNews('Notion')
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Notion raises $100M Series C')
  })

  it('maps items to the NewsItem shape', async () => {
    const items = await fetchNews('Notion')
    expect(items[0]).toMatchObject({
      title: expect.any(String),
      link: expect.any(String),
      description: expect.any(String),
      pubDate: expect.any(String),
    })
  })

  it('throws when RSS fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchNews('Notion')).rejects.toThrow('News fetch failed: 500')
  })
})
