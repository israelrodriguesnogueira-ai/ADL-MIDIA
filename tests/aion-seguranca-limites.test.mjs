import test from 'node:test';
import assert from 'node:assert/strict';
import { executarLocal } from '../integracoes/ion-executor-local.mjs';
import worker from '../integracoes/ion-motor-worker.mjs';

const endpoint = 'https://preview.invalid/api/executar-local';
async function request(path, options = {}, env = {}) {
  return worker.fetch(new Request('https://preview.invalid' + path, options), env);
}

test('sem token configurado: negar mesmo com Authorization fornecido', async () => {
  const response = await request('/api/executar-local', {
    method: 'POST', headers: { authorization: 'Bearer arbitrario' }
  });
  assert.equal(response.status, 401);
});

test('token incorreto: negar comando', async () => {
  const response = await request('/api/comando', {
    method: 'POST', headers: { authorization: 'Bearer incorreto' }
  }, { ION_API_ACCESS_TOKEN: 'token-de-teste' });
  assert.equal(response.status, 401);
});

test('token correto: aceitar somente capacidade local autorizada', async () => {
  const response = await request('/api/executar-local', {
    method: 'POST',
    headers: { authorization: 'Bearer token-de-teste', 'content-type': 'application/json' },
    body: JSON.stringify({ acao: 'capacidades' })
  }, { ION_API_ACCESS_TOKEN: 'token-de-teste' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'concluido');
  assert.ok(!data.capacidades.includes('gerar_video'));
});

test('JSON inválido retorna 400 sem executar', async () => {
  const response = await request('/api/executar-local', {
    method: 'POST',
    headers: { authorization: 'Bearer token-de-teste' },
    body: '{'
  }, { ION_API_ACCESS_TOKEN: 'token-de-teste' });
  assert.equal(response.status, 400);
});

test('payload maior que 16 KB retorna 413', async () => {
  const response = await request('/api/executar-local', {
    method: 'POST',
    headers: { authorization: 'Bearer token-de-teste' },
    body: JSON.stringify({ acao: 'criar_texto', titulo: 'teste', conteudo: 'x'.repeat(17000) })
  }, { ION_API_ACCESS_TOKEN: 'token-de-teste' });
  assert.equal(response.status, 413);
});

test('comando desconhecido nao pode executar shell', () => {
  assert.equal(executarLocal({ acao: 'shell', comando: 'echo teste' }).status, 'nao_suportado');
});

test('metadados invalidos de diagnostico sao rejeitados', () => {
  const r = executarLocal({ acao: 'diagnosticar_falha', componente: '../segredo', codigoErro: 'E1', fase: 'teste' });
  assert.equal(r.status, 'erro');
});

test('estado experimental nao deve declarar operadores externos conectados', () => {
  const r = executarLocal({ acao: 'estado_operadores' });
  assert.equal(r.escopo, 'executor_local_experimental');
  assert.ok(r.operadores.filter(o => o.nome !== 'desenvolvimento').every(o => o.estado === 'nao_conectado'));
});

test('health nao equivale a autenticacao nem prova IA ativa', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.motor, 'experimental');
  assert.equal(data.iaConfigurada, false);
});
