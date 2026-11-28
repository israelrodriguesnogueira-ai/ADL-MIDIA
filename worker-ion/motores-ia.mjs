const MOTORES = {
  conversa: ["@cf/zai-org/glm-4.7-flash", "@cf/google/gemma-4-26b-a4b-it", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
  proposta: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/zai-org/glm-4.7-flash"],
  visao: ["@cf/google/gemma-4-26b-a4b-it", "@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.2-11b-vision-instruct"],
  transcricao: ["@cf/openai/whisper-large-v3-turbo"],
};

export function limiteCompartilhado(erro) {
  return /(?:quota|daily limit|daily allocation|neurons)/i.test(String(erro?.message))
    || (Number(erro?.code) !== 3040 && (Number(erro?.status) === 429
      || /rate limit/i.test(String(erro?.message))));
}

export async function executarMotor(ia, tarefa, entrada, aceitar, { prazoMs, prazoPorModeloMs } = {}) {
  const fim = prazoMs == null ? Infinity : Date.now() + prazoMs;
  let ultimoErro;
  for (const modelo of MOTORES[tarefa]) {
    const restante = Math.min(fim - Date.now(), prazoPorModeloMs ?? Infinity);
    if (restante <= 0) throw new DOMException("Prazo total da inferência atingido.", "TimeoutError");
    const prazo = Number.isFinite(restante) ? AbortSignal.timeout(restante) : null;
    let cancelar;
    try {
      const dados = typeof entrada === "function" ? entrada(modelo) : entrada;
      const chamada = ia.run(modelo, dados);
      const resposta = prazo ? await Promise.race([chamada, new Promise((_, reject) => {
        cancelar = () => reject(prazo.reason);
        prazo.addEventListener("abort", cancelar, { once: true });
      })]) : await chamada;
      const conteudo = resposta?.response ?? resposta?.choices?.[0]?.message?.content ?? resposta?.text;
      const resultado = aceitar(conteudo);
      if (resultado != null) return resultado;
      ultimoErro = new Error("O motor devolveu um resultado inválido.");
    } catch (erro) {
      if (limiteCompartilhado(erro)) throw erro;
      ultimoErro = erro;
    } finally {
      if (cancelar) prazo.removeEventListener("abort", cancelar);
    }
  }
  throw ultimoErro;
}
