import { setTimeout as wait } from "node:timers/promises";
import { createVideoAdapter } from "./video-i2v-adapter.mjs";

export async function produzirVideo({
  backend,
  pedido,
  revisar,
  signal,
  maxTentativas = 2,
  intervaloMs = 2_000,
  prazoMs = 180_000,
}) {
  if (typeof revisar !== "function") {
    throw new TypeError("Informe a função de revisão do vídeo.");
  }
  if (!Number.isSafeInteger(maxTentativas) || maxTentativas < 1) {
    throw new RangeError("Informe um limite positivo de tentativas.");
  }

  const prazo = AbortSignal.timeout(prazoMs);
  const controle = signal ? AbortSignal.any([signal, prazo]) : prazo;
  if (typeof backend?.submitJob !== "function" || typeof backend?.getJob !== "function") {
    throw new TypeError("Informe um motor com submitJob e getJob.");
  }
  const adapter = createVideoAdapter({
    submitJob: request => backend.submitJob(request, { signal: controle }),
    getJob: jobId => backend.getJob(jobId, { signal: controle }),
  });
  const tentativas = [];
  let motionPrompt = pedido.motionPrompt;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    controle.throwIfAborted();
    let job = await adapter.submit({ ...pedido, motionPrompt });
    while (job.status === "queued" || job.status === "running") {
      await wait(intervaloMs, undefined, { signal: controle });
      job = await adapter.status(job.jobId);
    }
    controle.throwIfAborted();

    if (job.status === "failed") {
      tentativas.push({ jobId: job.jobId, status: "falha_na_geracao" });
      return { status: "falha_na_geracao", tentativas };
    }

    const revisao = await revisar({
      outputAssetId: job.outputAssetId,
      pedido,
      tentativa,
      signal: controle,
    });
    controle.throwIfAborted();

    if (typeof revisao?.aprovado !== "boolean") {
      throw new TypeError("A revisão precisa informar se o vídeo foi aprovado.");
    }
    const status = revisao.aprovado ? "aprovado" : "reprovado";
    tentativas.push({ jobId: job.jobId, status, motivo: revisao.motivo });
    if (revisao.aprovado) {
      return { status, outputAssetId: job.outputAssetId, tentativas };
    }
    if (typeof revisao.motionPromptCorrigido !== "string" ||
        !revisao.motionPromptCorrigido.trim()) {
      break;
    }
    motionPrompt = revisao.motionPromptCorrigido;
  }

  return { status: "revisao_pendente", tentativas };
}
