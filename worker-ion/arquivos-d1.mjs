// Mantém cada objeto abaixo do limite de 2 MB por linha do D1.
export const LIMITE_ARQUIVO_D1 = 1_500_000;

export function arquivosEmD1(db) {
  return {
    async infoDaTarefa(id) {
      const midia = "midia/" + id;
      return db.prepare(
        "SELECT chave, tipo, expira FROM arquivos_ion WHERE chave IN (?, ?) ORDER BY chave LIMIT 1"
      ).bind(midia, "render/" + id).first();
    },
    async get(key) {
      const row = await db.prepare(
        "SELECT dados, tipo, expira FROM arquivos_ion WHERE chave = ?"
      ).bind(key).first();
      if (!row) return null;
      return {
        body: new Uint8Array(row.dados),
        text: async () => new TextDecoder().decode(new Uint8Array(row.dados)),
        httpMetadata: { contentType: row.tipo },
        customMetadata: { expira: row.expira },
      };
    },
    async put(key, data, options) {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data).buffer : data;
      const tipo = options.httpMetadata?.contentType ?? null;
      const expira = options.customMetadata?.expira ?? null;
      const query = options.onlyIf
        ? "INSERT INTO arquivos_ion (chave, dados, tipo, expira) VALUES (?, ?, ?, ?) ON CONFLICT(chave) DO NOTHING"
        : "INSERT INTO arquivos_ion (chave, dados, tipo, expira) VALUES (?, ?, ?, ?)";
      const result = await db.prepare(query).bind(key, bytes, tipo, expira).run();
      return result.meta.changes === 1 ? { key } : null;
    },
    async delete(key) {
      await db.prepare("DELETE FROM arquivos_ion WHERE chave = ?").bind(key).run();
    },
  };
}
