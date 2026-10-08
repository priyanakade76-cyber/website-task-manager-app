-- ====================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR TASK MANAGER
-- Complete migration from MongoDB / Mongoose collections to PostgreSQL
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing tables if needed (in reverse dependency order)
-- DROP TABLE IF EXISTS activities CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS task_notes CASCADE;
-- DROP TABLE IF EXISTS tasks CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 3. Trigger Function for Automatic `updated_at` Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- TABLE 1: USERS
-- ====================================================================
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

-- ====================================================================
-- TABLE 2: CATEGORIES
-- ====================================================================
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

-- ====================================================================
-- TABLE 3: TASKS
-- ====================================================================
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

-- ====================================================================
-- TABLE 4: TASK NOTES (Subdocuments in MongoDB converted to Relational)
-- ====================================================================
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

-- ====================================================================
-- TABLE 5: ACTIVITIES (Audit & History Log)
-- ====================================================================
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

-- ====================================================================
-- TABLE 6: NOTIFICATIONS
-- ====================================================================
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

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Optional for Direct API Access / Service Role bypasses RLS
-- ====================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow full access for backend service role key
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

-- End of Supabase PostgreSQL Schema

