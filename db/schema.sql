-- workspaces: one per user (v1 has no team invites)
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

-- competitors tracked by a workspace
CREATE TABLE competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  website_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON competitors
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- raw scraped content and news items
CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('website', 'news')),
  raw_content text NOT NULL,
  url text NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  is_meaningful boolean
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON signals
  FOR ALL USING (
    competitor_id IN (
      SELECT c.id FROM competitors c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- one briefing per generation run
CREATE TABLE briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  generated_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'complete', 'error')),
  executive_summary text
);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON briefings
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- individual insight cards inside a briefing
CREATE TABLE briefing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  category text NOT NULL,
  observation text NOT NULL,
  interpretation text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  source_urls text[] DEFAULT '{}'
);

ALTER TABLE briefing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON briefing_items
  FOR ALL USING (
    briefing_id IN (
      SELECT id FROM briefings WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- v2: change detection
ALTER TABLE signals ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS signals_competitor_hash ON signals(competitor_id, content_hash);

-- v2: news deduplication
CREATE TABLE IF NOT EXISTS processed_news_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, url)
);
ALTER TABLE processed_news_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON processed_news_urls
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
