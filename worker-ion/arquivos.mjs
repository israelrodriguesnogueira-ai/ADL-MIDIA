const LIMITE_BYTES = 8 * 1024 * 1024;
const FORMATOS = new Map([["video/mp4", "mp4"], ["video/webm", "webm"]]);
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function arquivosDoDono(request, bucket, id) {
  const metodo = id ? "GET" : "POST";
  if (request.method !== metodo) {
    return new Response(null, { status: 405, headers: { ...headers, Allow: metodo } });
  }
  if (!bucket) return Response.json({ erro: "Armazenamento privado ainda não configurado." }, { status: 503, headers });
  if (id) {
    const objeto = await bucket.get("midia/" + id);
    if (!objeto) return Response.json({ erro: "Arquivo não encontrado." }, { status: 404, headers });
    const tipo = objeto.httpMetadata?.contentType;
    const extensao = FORMATOS.get(tipo);
    if (!extensao) return Response.json({ erro: "Formato indisponível." }, { status: 415, headers });
    return new Response(objeto.body, { headers: {
      ...headers, "Content-Type": tipo, "Content-Disposition": 'attachment; filename="aion.' + extensao + '"',
    } });
  }
  const tipo = request.headers.get("Content-Type");
  const extensao = FORMATOS.get(tipo);
  if (!extensao) return Response.json({ erro: "Envie um vídeo MP4 ou WebM." }, { status: 415, headers });
  if (Number(request.headers.get("Content-Length")) > LIMITE_BYTES) {
    return Response.json({ erro: "O limite de armazenamento por vídeo é de 8 MiB." }, { status: 413, headers });
  }
  const leitor = request.body?.getReader();
  if (!leitor) return Response.json({ erro: "Arquivo vazio." }, { status: 400, headers });
  const partes = [];
  let tamanho = 0;
  while (true) {
    const { value, done } = await leitor.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > LIMITE_BYTES) {
      await leitor.cancel();
      return Response.json({ erro: "O limite de armazenamento por vídeo é de 8 MiB." }, { status: 413, headers });
    }
    partes.push(value);
  }
  if (!tamanho) return Response.json({ erro: "Arquivo vazio." }, { status: 400, headers });
  const identificador = crypto.randomUUID();
  const dados = await new Blob(partes).arrayBuffer();
  await bucket.put("midia/" + identificador, dados, { httpMetadata: { contentType: tipo } });
  return Response.json({ id: identificador, caminho: "/?arquivo=" + identificador }, { status: 201, headers });
}
