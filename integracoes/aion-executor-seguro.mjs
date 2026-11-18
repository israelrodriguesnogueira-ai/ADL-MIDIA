import { identificarOperador, respostaSemExecutor } from "./ion-roteador-operadores.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const tarefas = Object.freeze({
  "verificar-runtime": { comando: process.execPath, argumentos: ["--version"], operador: "desenvolvimento" },
  "testar-sistema": { comando: process.execPath, argumentos: ["--test", "testes/video-i2v-adapter.test.mjs"], operador: "desenvolvimento" },
  "diagnosticar-operadores": { comando: process.execPath, argumentos: ["scripts/aion-supervisor.mjs"], operador: "desenvolvimento" },
});
/** Executor deliberadamente limitado: nenhuma entrada do usuário vira shell, URL ou caminho. */
export async function executarTarefa({ tarefa, comando = "", aprovado = false } = {}) {
  const roteamento = identificarOperador(comando || tarefa || "");
  if (!Object.hasOwn(tarefas, tarefa)) return { ...respostaSemExecutor(roteamento), erro: "Tarefa não autorizada no catálogo." };
  if (!aprovado) return { status: "aguardando_aprovacao", tarefa, mensagem: "Confirme a execução da tarefa permitida." };
  const definicao = tarefas[tarefa];
  try {
    const { stdout, stderr } = await exec(definicao.comando, definicao.argumentos, {
      cwd: root, timeout: 120000, maxBuffer: 1000000, env: { ...process.env, AION_MONITORAR_SITE: "0" }
    });
    return { status: "executado", tarefa, operador: definicao.operador, saida: stdout.slice(-12000), avisos: stderr.slice(-3000) };
  } catch (erro) {
    return { status: "falhou", tarefa, mensagem: String(erro.message).slice(0,1000) };
  }
}
