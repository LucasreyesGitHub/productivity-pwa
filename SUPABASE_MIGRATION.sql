-- ══════════════════════════════════════════════════════════════
-- Mi Espacio — v5 Schema Migration
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Actualizar tabla tasks ─────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'persistent' CHECK (task_type IN ('daily','persistent')),
  ADD COLUMN IF NOT EXISTS due_date  DATE,
  ADD COLUMN IF NOT EXISTS category  TEXT,
  ADD COLUMN IF NOT EXISTS goal_id   UUID;

-- ── 2. Tabla habits ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  frequency    TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  days_of_week INTEGER[],
  color        TEXT DEFAULT '#5b5bd6',
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habits: user owns rows"
  ON habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Tabla habit_completions ────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_completions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id   UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  UNIQUE (habit_id, date)
);

ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habit_completions: user owns rows"
  ON habit_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Tabla goals ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  why           TEXT,
  category      TEXT NOT NULL DEFAULT 'personal'
                CHECK (category IN ('finanzas','salud','estudio','personal','carrera','negocios','relaciones')),
  target_value  NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  unit          TEXT,
  deadline      DATE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: user owns rows"
  ON goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Tabla milestones ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  completed    BOOLEAN DEFAULT false,
  target_value NUMERIC,
  sort_order   INTEGER DEFAULT 0
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones: user owns rows"
  ON milestones FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 6. Realtime (opcional) ────────────────────────────────────
-- Activar en: Supabase Dashboard → Database → Replication
-- Tablas a agregar al realtime: habits, habit_completions, goals, milestones
