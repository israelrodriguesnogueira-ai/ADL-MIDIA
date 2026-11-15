function executarNoWorker() {
  const publicar = self.postMessage.bind(self);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const saida = [];
  let tamanho = 0;
  function formatar(valor) {
    if (typeof valor === "string") return valor;
    try { return JSON.stringify(valor) ?? String(valor); }
    catch { return String(valor); }
  }
  function escrever(...valores) {
    if (tamanho >= 12000) return;
    const linha = valores.map(formatar).join(" ").slice(0, 12000 - tamanho);
    saida.push(linha);
    tamanho += linha.length + 1;
  }
  const console = { log: escrever, info: escrever, warn: escrever, error: escrever, debug: escrever };
  self.addEventListener("message", async ({ data: codigo }) => {
    try {
      const resultado = await new AsyncFunction("console", '"use strict";\n' + codigo)(console);
      if (resultado !== undefined) escrever(resultado);
      publicar(saida.join("\n") || "Execução concluída sem saída.");
    } catch (erro) {
      publicar([...saida, "Erro: " + String(erro).slice(0, 1000)].join("\n"));
    }
  }, { once: true });
}

function receberCodigo(fonteWorker) {
  window.addEventListener("message", event => {
    if (event.source !== parent || typeof event.data !== "string" || event.data.length > 12000) return;
    const responder = texto => parent.postMessage(texto, "*");
    const url = URL.createObjectURL(new Blob([fonteWorker], { type: "text/javascript" }));
    let worker;
    try {
      worker = new Worker(url);
    } catch {
      URL.revokeObjectURL(url);
      responder("O navegador não conseguiu iniciar o executor.");
      return;
    }
    const encerrar = texto => {
      clearTimeout(prazo);
      worker.terminate();
      URL.revokeObjectURL(url);
      responder(texto);
    };
    const prazo = setTimeout(() => encerrar("Tempo limite de execução atingido."), 5000);
    worker.onmessage = ({ data }) => {
      if (typeof data === "string") encerrar(data.slice(0, 14000));
    };
    worker.onerror = () => encerrar("O navegador não conseguiu executar o código.");
    worker.postMessage(event.data);
  }, { once: true });
}

export function paginaExecutor() {
  const fonteWorker = "(" + executarNoWorker.toString() + ")()";
  return new Response("<!doctype html><meta charset=utf-8><script>(" + receberCodigo.toString()
    + ")(" + JSON.stringify(fonteWorker) + ")</script>", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:",
    },
  });
}
