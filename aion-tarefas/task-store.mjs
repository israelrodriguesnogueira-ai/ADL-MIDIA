// Persistencia de tarefas para Cloudflare D1. Este modulo nao publica rotas.
// O chamador DEVE validar a sessao do proprietario no servidor antes de passar ownerSubject.
const STATUSES = new Set(['queued','running','completed','failed','cancelled']);
const KINDS = new Set(['media','audio','translation','analysis','code']);
function owner(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9:_-]{4,160}$/.test(value)) throw new TypeError('owner_subject_invalido');
  return value;
}
function database(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('binding_d1_ausente');
  return db;
}
export async function enqueueTask(db, { ownerSubject, kind, payload, idempotencyKey }) {
  owner(ownerSubject); database(db);
  if (!KINDS.has(kind)) throw new TypeError('tipo_invalido');
  if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9:_-]{8,128}$/.test(idempotencyKey)) throw new TypeError('idempotencia_invalida');
  const json = JSON.stringify(payload);
  if (!json || json.length > 16_384) throw new TypeError('payload_invalido');
  const id = crypto.randomUUID();
  await db.prepare('INSERT OR IGNORE INTO aion_tasks (id,owner_subject,kind,payload_json,idempotency_key) VALUES (?,?,?,?,?)')
    .bind(id, ownerSubject, kind, json, idempotencyKey).run();
  return db.prepare('SELECT id,kind,status,created_at,updated_at FROM aion_tasks WHERE owner_subject=? AND idempotency_key=?')
    .bind(ownerSubject, idempotencyKey).first();
}
export async function getTask(db, ownerSubject, taskId) {
  owner(ownerSubject); database(db);
  if (typeof taskId !== 'string' || !/^[a-f0-9-]{36}$/i.test(taskId)) return null;
  return db.prepare('SELECT id,kind,status,result_json,error_code,created_at,updated_at FROM aion_tasks WHERE owner_subject=? AND id=?')
    .bind(ownerSubject, taskId).first();
}
export async function listTasks(db, ownerSubject, limit=20) {
  owner(ownerSubject); database(db);
  const n = Math.max(1, Math.min(50, Number.isInteger(limit) ? limit : 20));
  const result = await db.prepare('SELECT id,kind,status,created_at,updated_at FROM aion_tasks WHERE owner_subject=? ORDER BY created_at DESC LIMIT ?')
    .bind(ownerSubject,n).all();
  return result.results ?? [];
}
export async function transitionTask(db, {ownerSubject,taskId,from,to,result=null,errorCode=null}) {
  owner(ownerSubject); database(db);
  if (!STATUSES.has(from) || !STATUSES.has(to)) throw new TypeError('estado_invalido');
  const allowed = {queued:['running','cancelled'],running:['completed','failed','cancelled'],completed:[],failed:[],cancelled:[]};
  if (!allowed[from].includes(to)) throw new TypeError('transicao_invalida');
  const resultJson = result == null ? null : JSON.stringify(result);
  if (resultJson && resultJson.length > 16_384) throw new TypeError('resultado_muito_grande');
  const response = await db.prepare("UPDATE aion_tasks SET status=?,result_json=?,error_code=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND owner_subject=? AND status=?")
    .bind(to,resultJson,errorCode,taskId,ownerSubject,from).run();
  return (response.meta?.changes ?? 0) === 1;
}
