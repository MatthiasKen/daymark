import { neon } from '@neondatabase/serverless';
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL in .env.local before running migrations.'); process.exit(1); }
const sql = neon(url);
await sql`CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
)`;
await sql`CREATE INDEX IF NOT EXISTS idx_tasks_visitor_id ON tasks(visitor_id)`;
await sql`CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
)`;
await sql`CREATE INDEX IF NOT EXISTS idx_notes_visitor_id ON notes(visitor_id)`;
console.log('Database tables ready.');
