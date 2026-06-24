import { Resend } from 'resend'
import type { BriefingItem, Competitor, Briefing } from './supabase/types'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendBriefingEmail({
  to,
  briefing,
  items,
  competitors,
}: {
  to: string
  briefing: Briefing
  items: BriefingItem[]
  competitors: Competitor[]
}) {
  const sortedItems = [...items].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  const itemsHtml = sortedItems.map(item => {
    const competitor = competitors.find(c => c.id === item.competitor_id)
    const severityColor = { high: '#dc2626', medium: '#d97706', low: '#6b7280' }[item.severity]
    return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <strong style="font-size:14px;">${competitor?.name ?? 'Unknown'}</strong>
          <span style="font-size:12px;color:${severityColor};text-transform:capitalize;">${item.severity} · ${item.category}</span>
        </div>
        <p style="font-size:14px;color:#374151;margin:0 0 8px;">${item.observation}</p>
        <div style="background:#eff6ff;border-radius:6px;padding:12px;">
          <p style="font-size:12px;color:#3b82f6;font-weight:600;text-transform:uppercase;margin:0 0 4px;">Strategic interpretation</p>
          <p style="font-size:14px;color:#1e40af;margin:0;">${item.interpretation}</p>
        </div>
      </div>
    `
  }).join('')

  const date = new Date(briefing.generated_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  await resend.emails.send({
    from: 'Competitive Intelligence <onboarding@resend.dev>',
    to,
    subject: `Competitive Briefing — ${date}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">Competitive Briefing</h1>
        <p style="font-size:14px;color:#6b7280;margin-bottom:24px;">${date}</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="font-size:12px;color:#3b82f6;font-weight:600;text-transform:uppercase;margin:0 0 4px;">Executive Summary</p>
          <p style="font-size:15px;color:#1e3a8a;margin:0;">${briefing.executive_summary ?? ''}</p>
        </div>
        <h2 style="font-size:14px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">${sortedItems.length} Findings</h2>
        ${itemsHtml}
      </div>
    `,
  })
}
