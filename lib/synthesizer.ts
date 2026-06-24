import Groq from 'groq-sdk'
import type { Competitor } from './supabase/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface RawSignal {
  competitor_id: string
  competitor_name: string
  source_type: 'website' | 'news'
  raw_content: string
  url: string
}

export interface JudgedSignal extends RawSignal {
  is_meaningful: boolean
  category: string
}

export interface StructuredObservation {
  competitor_id: string
  competitor_name: string
  what_changed: string
  evidence: string
  category: string
  severity: 'high' | 'medium' | 'low'
}

export interface BriefingResultItem {
  competitor_name: string
  competitor_id: string
  observation: string
  interpretation: string
  category: string
  severity: 'high' | 'medium' | 'low'
}

export interface BriefingResult {
  executive_summary: string
  items: BriefingResultItem[]
}

// ── Layer 1: Signal Judge ──────────────────────────────────────────────────

export async function judgeSignals(signals: RawSignal[]): Promise<JudgedSignal[]> {
  if (signals.length === 0) return []

  const BATCH = 8
  const results: JudgedSignal[] = []
  for (let i = 0; i < signals.length; i += BATCH) {
    const batch = signals.slice(i, i + BATCH)
    const judged = await judgeSignalBatch(batch)
    results.push(...judged)
  }
  return results
}

async function judgeSignalBatch(signals: RawSignal[]): Promise<JudgedSignal[]> {
  const prompt = `You are a competitive intelligence analyst. Determine if each signal is meaningful.

${signals.map((s, i) =>
  `[${i}] Company: ${s.competitor_name} | Type: ${s.source_type}
Content: ${s.raw_content.slice(0, 600)}`
).join('\n\n')}

Respond with JSON: {"signals": [{"is_meaningful": boolean, "category": "pricing"|"product"|"hiring"|"news"|"positioning"|"other"}]}
One entry per signal, same order. Meaningful = shows pricing changes, new features, strategic news, or hiring patterns. Not meaningful = generic marketing, boilerplate, unchanged content.`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  let parsed: { signals: Array<{ is_meaningful: boolean; category: string }> }
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    parsed = { signals: signals.map(() => ({ is_meaningful: false, category: 'other' })) }
  }

  return signals.map((s, i) => ({
    ...s,
    is_meaningful: parsed.signals?.[i]?.is_meaningful ?? false,
    category: parsed.signals?.[i]?.category ?? 'other',
  }))
}

// ── Layer 2: Extract Observations ─────────────────────────────────────────

export async function extractObservations(
  signals: JudgedSignal[],
  competitors: Competitor[]
): Promise<StructuredObservation[]> {
  if (signals.length === 0) return []

  const meaningful = signals.filter(s => s.is_meaningful)
  if (meaningful.length === 0) return []

  const prompt = `You are a competitive intelligence analyst. Extract factual observations from these signals.

${meaningful.map(s =>
  `Company: ${s.competitor_name} | Category: ${s.category}
Content: ${s.raw_content.slice(0, 800)}`
).join('\n\n---\n\n')}

Respond with JSON: {"observations": [{"competitor_name": string, "what_changed": string, "evidence": string, "category": string, "severity": "high"|"medium"|"low"}]}
- what_changed: factual 1-2 sentence description, no interpretation
- evidence: direct quote from content
- severity: high=major strategic shift, medium=notable change, low=minor update`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  let parsed: { observations: Array<{ competitor_name: string; what_changed: string; evidence: string; category: string; severity: 'high' | 'medium' | 'low' }> }
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    return []
  }

  // Build a name→competitor map for quick lookup
  const competitorByName = new Map(competitors.map(c => [c.name, c]))

  return (parsed.observations ?? []).map((obs, i) => {
    // Try to match by competitor_name from the LLM response; fall back to
    // the signal that was at the same index (or the first meaningful signal)
    const name = obs.competitor_name ?? meaningful[i]?.competitor_name ?? meaningful[0]?.competitor_name
    const competitor = name ? competitorByName.get(name) : undefined
    return {
      competitor_id: competitor?.id ?? meaningful[i]?.competitor_id ?? '',
      competitor_name: name ?? '',
      what_changed: obs.what_changed,
      evidence: obs.evidence,
      category: obs.category,
      severity: obs.severity,
    }
  }).filter(o => o.competitor_id !== '')
}

// ── Layer 3: Strategic Interpretation ─────────────────────────────────────

export async function generateBriefing(
  observations: StructuredObservation[],
  competitors: Competitor[]
): Promise<BriefingResult> {
  if (observations.length === 0) {
    return {
      executive_summary: 'No significant competitive signals detected this period.',
      items: [],
    }
  }

  const prompt = `You are a senior competitive intelligence analyst. Generate a strategic briefing.

Observations:
${observations.map(o =>
  `${o.competitor_name} [${o.category}, ${o.severity}]: ${o.what_changed}
Evidence: ${o.evidence}`
).join('\n\n')}

Respond with JSON: {"executive_summary": string, "items": [{"competitor_name": string, "observation": string, "interpretation": string, "category": string, "severity": "high"|"medium"|"low"}]}

- executive_summary: 2-3 sentences, cross-competitor synthesis with strategic implications
- observation: factual (what changed, from the data above)
- interpretation: bold strategic inference — WHY this likely happened, what it signals, what your company should do. Go beyond description: "This likely means X, possibly because Y, which suggests Z."
- Include ALL competitors from the observations`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  let parsed: { executive_summary: string; items: Array<{ competitor_name: string; observation: string; interpretation: string; category: string; severity: 'high' | 'medium' | 'low' }> }
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    return {
      executive_summary: 'Failed to generate briefing summary.',
      items: [],
    }
  }

  return {
    executive_summary: parsed.executive_summary ?? '',
    items: (parsed.items ?? []).map(item => {
      const competitor = competitors.find(c => c.name === item.competitor_name)
      return {
        competitor_name: item.competitor_name,
        competitor_id: competitor?.id ?? '',
        observation: item.observation,
        interpretation: item.interpretation,
        category: item.category,
        severity: item.severity,
      }
    }),
  }
}
