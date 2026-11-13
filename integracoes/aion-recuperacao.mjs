import { sign, verify } from "node:crypto";

/**
 * Assina os bytes de uma cópia antes do envio à base de recuperação.
 * A chave privada Ed25519 deve ficar com o serviço que produz as cópias.
 */
export function signRecoverySnapshot(snapshot, privateKey) {
  if (!Buffer.isBuffer(snapshot) || snapshot.length === 0
      || privateKey?.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
    throw new TypeError("Forneça uma cópia não vazia e uma chave privada Ed25519.");
  }

  return sign(null, snapshot, privateKey);
}

/**
 * Entrega uma cópia dos bytes verificados para a etapa de restauração.
 * A chave pública deve vir da configuração confiável do ambiente de recuperação.
 */
export function verifyRecoverySnapshot(snapshot, signature, trustedPublicKey) {
  if (!Buffer.isBuffer(snapshot) || snapshot.length === 0
      || !Buffer.isBuffer(signature) || signature.length !== 64
      || trustedPublicKey?.type !== "public" || trustedPublicKey.asymmetricKeyType !== "ed25519") {
    throw new TypeError("Cópia, assinatura ou chave pública inválida.");
  }

  const verifiedSnapshot = Buffer.from(snapshot);
  if (!verify(null, verifiedSnapshot, trustedPublicKey, signature)) {
    throw new Error("A assinatura da cópia de recuperação não confere.");
  }

  return verifiedSnapshot;
}
