import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock groq-sdk before importing synthesizer
const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { judgeSignals, extractObservations, generateBriefing, type RawSignal } from '../synthesizer'
import type { Competitor } from '../supabase/types'

const mockCompetitor: Competitor = {
  id: 'comp-1',
  workspace_id: 'ws-1',
  name: 'Notion',
  website_url: 'https://notion.so/pricing',
  description: null,
  created_at: new Date().toISOString(),
}

const mockSignal: RawSignal = {
  competitor_id: 'comp-1',
  competitor_name: 'Notion',
  source_type: 'website',
  raw_content: 'Enterprise plan now $16/seat/month, down from $20',
  url: 'https://notion.so/pricing',
}

function groqResponse(content: string) {
  return { choices: [{ message: { content } }] }
}

describe('judgeSignals', () => {
  it('returns empty array for empty input', async () => {
    const result = await judgeSignals([])
    expect(result).toEqual([])
  })

  it('marks signals as meaningful when Groq says so', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({ signals: [{ is_meaningful: true, category: 'pricing' }] }))
    )
    const result = await judgeSignals([mockSignal])
    expect(result[0].is_meaningful).toBe(true)
    expect(result[0].category).toBe('pricing')
  })

  it('marks signals as not meaningful when Groq says so', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({ signals: [{ is_meaningful: false, category: 'other' }] }))
    )
    const result = await judgeSignals([mockSignal])
    expect(result[0].is_meaningful).toBe(false)
  })
})

describe('extractObservations', () => {
  it('returns empty array when no meaningful signals', async () => {
    const result = await extractObservations([], [mockCompetitor])
    expect(result).toEqual([])
  })

  it('extracts structured observations from meaningful signals', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({
        observations: [{
          what_changed: 'Enterprise pricing dropped from $20 to $16 per seat',
          evidence: 'Enterprise plan now $16/seat/month, down from $20',
          category: 'pricing',
          severity: 'high',
        }]
      }))
    )
    const judged = [{ ...mockSignal, is_meaningful: true, category: 'pricing' }]
    const result = await extractObservations(judged, [mockCompetitor])
    expect(result[0].what_changed).toContain('pricing')
    expect(result[0].severity).toBe('high')
    expect(result[0].competitor_id).toBe('comp-1')
  })
})

describe('generateBriefing', () => {
  it('returns executive summary and items', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({
        executive_summary: 'Notion cut enterprise pricing — likely a competitive response.',
        items: [{
          competitor_name: 'Notion',
          observation: 'Dropped enterprise from $20 to $16/seat',
          interpretation: 'Likely responding to Coda and Linear undercutting on price.',
          category: 'pricing',
          severity: 'high',
        }]
      }))
    )
    const obs = [{
      competitor_id: 'comp-1',
      competitor_name: 'Notion',
      what_changed: 'Dropped enterprise from $20 to $16/seat',
      evidence: 'Enterprise plan now $16/seat/month',
      category: 'pricing',
      severity: 'high' as const,
    }]
    const result = await generateBriefing(obs, [mockCompetitor])
    expect(result.executive_summary).toContain('Notion')
    expect(result.items[0].competitor_id).toBe('comp-1')
    expect(result.items[0].interpretation).toBeTruthy()
  })
})
