import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrapeUrl } from '../scraper'

describe('scrapeUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls Jina reader with the target URL and returns markdown', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Pricing\n\nEnterprise: $99/mo'),
    })

    const result = await scrapeUrl('https://example.com/pricing')

    expect(fetch).toHaveBeenCalledWith(
      'https://r.jina.ai/https://example.com/pricing',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'text/markdown' }),
      })
    )
    expect(result).toBe('# Pricing\n\nEnterprise: $99/mo')
  })

  it('throws an error when Jina returns a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    await expect(scrapeUrl('https://example.com')).rejects.toThrow('Scrape failed: 429')
  })
})
