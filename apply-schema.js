/**
 * Apply schema using Supabase pg connection string endpoint
 */
require('dotenv').config();
const https = require('https');

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const PROJECT_REF = 'zdxuppyzbmokskyyvnek';

// The entire schema as a single statement batch (most reliable approach)
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    profile_image TEXT DEFAULT '',
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
    notification_settings JSONB DEFAULT '{"emailAlerts": true, "browserAlerts": true, "dueSoonHours": 24}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'fa-folder',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_categories_user_name UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

CREATE OR REPLACE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(30) DEFAULT 'Todo' CHECK (status IN ('Todo', 'In Progress', 'Completed', 'Archived')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category_name VARCHAR(50) DEFAULT 'General',
    category_color VARCHAR(20) DEFAULT '#6366f1',
    tags JSONB DEFAULT '[]'::jsonb,
    due_date TIMESTAMPTZ DEFAULT NULL,
    due_time VARCHAR(10) DEFAULT '12:00',
    reminder_time INTEGER DEFAULT 30,
    estimated_time INTEGER DEFAULT 0,
    actual_time INTEGER DEFAULT 0,
    recurring JSONB DEFAULT '{"isRecurring": false, "frequency": "None", "intervalDays": 1, "nextOccurrence": null}'::jsonb,
    is_archived BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    pomodoro_sessions INTEGER DEFAULT 0,
    task_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(user_id, task_order);

CREATE OR REPLACE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS task_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);

CREATE OR REPLACE TRIGGER trg_task_notes_updated_at
    BEFORE UPDATE ON task_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    task_title VARCHAR(255) DEFAULT '',
    action VARCHAR(50) NOT NULL,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_task_id ON activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

CREATE OR REPLACE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on users" ON users;
DROP POLICY IF EXISTS "Service role full access on categories" ON categories;
DROP POLICY IF EXISTS "Service role full access on tasks" ON tasks;
DROP POLICY IF EXISTS "Service role full access on task_notes" ON task_notes;
DROP POLICY IF EXISTS "Service role full access on activities" ON activities;
DROP POLICY IF EXISTS "Service role full access on notifications" ON notifications;

CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access on categories" ON categories FOR ALL USING (true);
CREATE POLICY "Service role full access on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Service role full access on task_notes" ON task_notes FOR ALL USING (true);
CREATE POLICY "Service role full access on activities" ON activities FOR ALL USING (true);
CREATE POLICY "Service role full access on notifications" ON notifications FOR ALL USING (true);
`;

const post = (hostname, path, body, headers = {}) => new Promise((resolve, reject) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const opts = {
    hostname,
    port: 443,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      ...headers
    }
  };
  const req = https.request(opts, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      let parsed = d;
      try { parsed = JSON.parse(d); } catch (e) {}
      resolve({ status: res.statusCode, body: parsed, raw: d });
    });
  });
  req.on('error', reject);
  req.write(payload);
  req.end();
});

const main = async () => {
  console.log('\n🔧 Applying Supabase PostgreSQL Schema via pg endpoint...\n');

  // Try the Supabase pg (SQL over HTTP) endpoint - available on paid plans
  // and sometimes accessible with the service_role key
  const endpoints = [
    {
      name: 'Management API SQL',
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: { query: SCHEMA_SQL }
    },
    {
      name: 'PostgREST RPC exec_sql',
      hostname: `${PROJECT_REF}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: { sql: SCHEMA_SQL }
    }
  ];

  for (const ep of endpoints) {
    console.log(`Trying: ${ep.name}...`);
    try {
      const res = await post(ep.hostname, ep.path, ep.body, ep.headers);
      console.log(`  Status: ${res.status}`);
      const bodyStr = typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2);
      console.log(`  Response: ${bodyStr.slice(0, 300)}`);

      if (res.status === 200 || res.status === 201 || res.status === 204) {
        console.log('\n✅ Schema applied successfully!\n');
        return;
      }
    } catch (err) {
      console.log(`  Network error: ${err.message}`);
    }
    console.log('');
  }

  console.log('⚠️  Automatic SQL execution not available (Management API requires personal access token).');
  console.log('\n📋 MANUAL STEPS (takes ~30 seconds):');
  console.log('  1. Go to: https://supabase.com/dashboard/project/zdxuppyzbmokskyyvnek/sql/new');
  console.log('  2. Open the file: supabase-schema.sql');
  console.log('  3. Copy ALL its contents and paste into the SQL Editor');
  console.log('  4. Click the "Run" button');
  console.log('  5. Come back and the server will auto-connect!\n');
  console.log('The file is at: c:\\Users\\ENET30\\TASK MANAGER\\supabase-schema.sql\n');
};

main().catch(console.error);
