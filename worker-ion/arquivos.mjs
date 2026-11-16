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
  const dados = await lerVideo(request);
  if (dados instanceof Response) return dados;
  const identificador = crypto.randomUUID();
  await bucket.put("midia/" + identificador, dados, { httpMetadata: { contentType: tipo } });
  return Response.json({ id: identificador, caminho: "/?arquivo=" + identificador }, { status: 201, headers });
}

async function lerVideo(request) {
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
  return new Blob(partes).arrayBuffer();
}

async function hashToken(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function reservarVideo3D(bucket) {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID() + crypto.randomUUID();
  await bucket.put("render/" + id, await hashToken(token), {
    customMetadata: { expira: String(Date.now() + 15 * 60 * 1000) },
  });
  return { id, token };
}

export async function receberVideo3D(request, bucket, id) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const token = request.headers.get("Authorization")?.match(/^Bearer ([0-9a-f-]{72})$/)?.[1];
  if (!token || !bucket) return new Response(null, { status: 403 });
  const reserva = await bucket.get("render/" + id);
  if (!reserva || !(Number(reserva.customMetadata?.expira) > Date.now())
      || await reserva.text() !== await hashToken(token)) return new Response(null, { status: 403 });
  if (request.headers.get("Content-Type") !== "video/mp4") return new Response(null, { status: 415 });
  const dados = await lerVideo(request);
  if (dados instanceof Response) return dados;
  const gravado = await bucket.put("midia/" + id, dados, {
    onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "video/mp4" },
  });
  await bucket.delete("render/" + id);
  return new Response(null, { status: gravado ? 201 : 409 });
}
