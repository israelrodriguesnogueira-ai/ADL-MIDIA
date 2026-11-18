-- D1: fila persistente de tarefas do Aion. Aplicar somente após configurar o binding.
CREATE TABLE IF NOT EXISTS aion_tasks (
  id TEXT PRIMARY KEY,
  owner_subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
  result_json TEXT,
  error_code TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(owner_subject, idempotency_key)
);
CREATE INDEX IF NOT EXISTS aion_tasks_owner_created ON aion_tasks(owner_subject, created_at DESC);
CREATE INDEX IF NOT EXISTS aion_tasks_status_created ON aion_tasks(status, created_at);
