const prefixo = "/aion-voz/";
const cdn = "https://cdn.jsdelivr.net";
const pacote = cdn + "/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm";
const origemModelos = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main";
const modelo = "/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx";
const recursos = new Map([
  ["piper.mjs", [pacote, "text/javascript; charset=utf-8"]],
  ["modelos" + modelo, [origemModelos + modelo, "application/octet-stream"]],
  ["modelos" + modelo + ".json", [origemModelos + modelo + ".json", "application/json"]],
]);

export async function servirVozFaber(request, path) {
  if (!path.startsWith(prefixo)) return null;
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const nome = path.slice(prefixo.length);
  const recurso = recursos.get(nome);
  if (!recurso) return new Response(null, { status: 404 });
  try {
    const [url, tipo] = recurso;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!upstream.ok || !upstream.body) return new Response(null, { status: 502 });
    const headers = new Headers({
      "Content-Type": tipo, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400",
    });
    if (nome === "piper.mjs") {
      const modulo = await upstream.text();
      if (!modulo.includes(origemModelos) || !modulo.includes('import("/npm/')) {
        return new Response(null, { status: 502 });
      }
      return new Response(modulo.replace(origemModelos, prefixo + "modelos")
        .replaceAll('"https://huggingface.co"', '"' + prefixo + 'modelos"')
        .replaceAll('import("/npm/', 'import("' + cdn + '/npm/'), { headers });
    }
    const tamanho = upstream.headers.get("Content-Length");
    if (tamanho && !upstream.headers.has("Content-Encoding")) headers.set("Content-Length", tamanho);
    return new Response(upstream.body, { headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}
