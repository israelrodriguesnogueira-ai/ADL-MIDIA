// Protocolo de confirmação de comandos dos dispositivos do proprietário.
// Não abre conexão nem prova presença do Galaxy: deve ser integrado às rotas autenticadas.
export const COMMAND_STATES = Object.freeze({
  queued: 'queued', delivered: 'delivered', running: 'running',
  completed: 'completed', failed: 'failed', expired: 'expired'
});
const allowed = {
  queued: ['delivered','expired'], delivered: ['running','failed','expired'],
  running: ['completed','failed','expired'], completed: [], failed: [], expired: []
};
export function validateDeviceReceipt(receipt, expected) {
  if (!receipt || typeof receipt !== 'object') throw new TypeError('recibo_ausente');
  if (!expected || typeof expected !== 'object') throw new TypeError('comando_ausente');
  for (const field of ['commandId','deviceId','nonce']) {
    if (typeof expected[field] !== 'string' || receipt[field] !== expected[field])
      throw new TypeError('recibo_nao_corresponde_ao_comando');
  }
  if (!allowed[expected.status]?.includes(receipt.status))
    throw new TypeError('transicao_invalida');
  if (typeof receipt.receivedAt !== 'string' ||
      !Number.isFinite(Date.parse(receipt.receivedAt)))
    throw new TypeError('horario_invalido');
  if (Math.abs(Date.now() - Date.parse(receipt.receivedAt)) > 5 * 60 * 1000)
    throw new TypeError('recibo_fora_da_janela');
  if (receipt.status === 'completed' &&
      (!receipt.evidence || typeof receipt.evidence !== 'object' ||
       typeof receipt.evidence.kind !== 'string'))
    throw new TypeError('conclusao_sem_evidencia');
  return {
    commandId: receipt.commandId,
    deviceId: receipt.deviceId,
    status: receipt.status,
    receivedAt: receipt.receivedAt,
    evidence: receipt.status === 'completed' ? receipt.evidence : null
  };
}
export function deviceFreshness(lastSeenAt, now = Date.now(), maxAgeMs = 90000) {
  const time = Date.parse(lastSeenAt);
  if (!Number.isFinite(time) || time > now + 30000 || now - time > maxAgeMs)
    return 'sem_dados_atuais';
  return 'conexao_recente';
}
