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

export async function sendHighSeverityAlert({
  to,
  items,
  competitors,
}: {
  to: string
  items: BriefingItem[]
  competitors: Competitor[]
}) {
  const itemsHtml = items.map(item => {
    const competitor = competitors.find(c => c.id === item.competitor_id)
    return `
      <div style="border-left:4px solid #dc2626;padding:12px 16px;margin-bottom:12px;background:#fff5f5;border-radius:0 8px 8px 0;">
        <strong style="font-size:14px;color:#111827;">${competitor?.name ?? 'Unknown'}</strong>
        <span style="font-size:12px;color:#dc2626;margin-left:8px;text-transform:capitalize;">${item.category}</span>
        <p style="font-size:14px;color:#374151;margin:8px 0;">${item.observation}</p>
        <p style="font-size:13px;color:#7c3aed;font-style:italic;">${item.interpretation}</p>
      </div>
    `
  }).join('')

  const competitorNames = [...new Set(items.map(i => competitors.find(c => c.id === i.competitor_id)?.name ?? 'Unknown'))].join(', ')

  await resend.emails.send({
    from: 'IntelAgent Alerts <onboarding@resend.dev>',
    to,
    subject: `🚨 Urgent competitive signal: ${competitorNames}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:18px;font-weight:700;color:#dc2626;margin-bottom:4px;">High-Priority Alert</h1>
        <p style="font-size:14px;color:#6b7280;margin-bottom:20px;">${items.length} urgent signal${items.length !== 1 ? 's' : ''} detected</p>
        ${itemsHtml}
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;">View your full briefing in <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/briefings" style="color:#4f46e5;">IntelAgent</a></p>
      </div>
    `,
  })
}
