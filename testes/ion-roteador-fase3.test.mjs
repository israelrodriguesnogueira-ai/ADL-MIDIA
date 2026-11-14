import test from "node:test";
import assert from "node:assert/strict";
import { classificarComando, planejarExecucao } from "../integracoes/ion-roteador-fase3.mjs";
test("pedido de imagem não é redirecionado para vídeo", () => {
  assert.equal(classificarComando("Crie uma imagem de uma carteira digital").tipo, "imagem");
});
test("vídeo narrado vai ao motor de vídeo", () => {
  assert.equal(classificarComando("Crie um vídeo de trânsito com narração").tipo, "video");
});
test("negação não executa criação", () => {
  assert.notEqual(classificarComando("Não crie um vídeo").tipo, "video");
});
test("motor ausente não afirma execução", () => {
  assert.equal(planejarExecucao("Crie uma imagem", {}).estado, "indisponivel");
});
test("executor disponível exige autorização posterior", () => {
  assert.equal(planejarExecucao("Crie uma imagem", { "motor-imagem": true }).estado, "pronto_para_autorizacao");
});
