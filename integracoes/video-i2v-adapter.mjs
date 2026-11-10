/**
 * Central 6D: contrato de integração para um futuro motor image-to-video.
 * Sem rede, GPU, credenciais ou serviço contratado. Não é um motor gerador.
 * O backend privado deverá implementar submitJob e getJob.
 */
export const JOB_STATES = Object.freeze(["queued", "running", "succeeded", "failed"]);

export function validateVideoRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Solicitação inválida.");
  const { durationSeconds, aspectRatio, sourceAssetId, motionPrompt } = input;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 15) {
    throw new RangeError("Duração deve ser de 1 a 15 segundos.");
  }
  if (aspectRatio !== "9:16") throw new RangeError("Formato permitido: 9:16.");
  if (typeof sourceAssetId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(sourceAssetId)) {
    throw new TypeError("Identificador privado da imagem inválido.");
  }
  if (typeof motionPrompt !== "string" || !motionPrompt.trim() || motionPrompt.length > 1000) {
    throw new TypeError("Descrição de movimento inválida.");
  }
  return Object.freeze({
    durationSeconds,
    aspectRatio,
    sourceAssetId,
    motionPrompt: motionPrompt.trim(),
    preserveProduct: true,
    commercialPublishingAllowed: false
  });
}

export function validateJobStatus(job) {
  if (!job || typeof job !== "object" || !JOB_STATES.includes(job.status)) {
    throw new TypeError("Estado de processamento inválido.");
  }
  if (typeof job.jobId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(job.jobId)) {
    throw new TypeError("Identificador de job inválido.");
  }
  if (job.status === "succeeded" && typeof job.outputAssetId !== "string") {
    throw new TypeError("Job concluído sem identificador de saída.");
  }
  return job;
}

export function createVideoAdapter(backend) {
  if (!backend || typeof backend.submitJob !== "function" || typeof backend.getJob !== "function") {
    throw new TypeError("Backend precisa implementar submitJob e getJob.");
  }
  return Object.freeze({
    async submit(input) {
      const request = validateVideoRequest(input);
      return validateJobStatus(await backend.submitJob(request));
    },
    async status(jobId) {
      if (typeof jobId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(jobId)) {
        throw new TypeError("Identificador de job inválido.");
      }
      return validateJobStatus(await backend.getJob(jobId));
    }
  });
}
