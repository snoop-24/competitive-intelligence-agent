export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Competitor {
  id: string
  workspace_id: string
  name: string
  website_url: string
  description: string | null
  created_at: string
}

export interface Signal {
  id: string
  competitor_id: string
  source_type: 'website' | 'news'
  raw_content: string
  url: string
  fetched_at: string
  is_meaningful: boolean | null
}

export interface Briefing {
  id: string
  workspace_id: string
  generated_at: string
  status: 'generating' | 'complete' | 'error'
  executive_summary: string | null
}

export interface BriefingItem {
  id: string
  briefing_id: string
  competitor_id: string
  category: string
  observation: string
  interpretation: string
  severity: 'high' | 'medium' | 'low'
  source_urls: string[]
}
