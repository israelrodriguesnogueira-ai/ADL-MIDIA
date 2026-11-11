import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const report = process.argv[2] ?? resolve(root, "relatorio/diagnostico.md");
const env = process.env;
const ok = detail => ({ status: "Verificado", detail });
const waiting = detail => ({ status: "Pendente", detail });

async function exists(path) {
  try {
    await access(resolve(root, path));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function execute(file, args) {
  return run(file, args, { cwd: root, timeout: 150_000, maxBuffer: 256_000 });
}

const operators = {
  "Central 6D": async () => {
    await Promise.all(["index.html", "gerador.html", "integracoes/video-i2v-adapter.mjs"]
      .map(path => access(resolve(root, path))));
    await execute(process.execPath, ["--test", "testes/video-i2v-adapter.test.mjs"]);
    return ok("Estrutura e teste simulado do adaptador de vídeo aprovados.");
  },
  "Shopee": async () => {
    if (!env.AION_VIDEO_SHOPEE) {
      return waiting("Fornecer o arquivo candidato e confirmar o link do anúncio.");
    }
    if (!await exists("scripts/validar-exportacao.py")) {
      return waiting("O verificador de vídeo da PR #10 precisa estar presente.");
    }
    await execute("python3", ["scripts/validar-exportacao.py",
      resolve(env.AION_VIDEO_SHOPEE), "--exigir-audio"]);
    return ok("Arquivo vertical 9:16 decodificado com faixa de áudio. Revisão visual e publicação seguem pendentes.");
  },
  "Tradução no Android": async () => {
    if (!env.AION_PROJETO_ANDROID) {
      return waiting("Fornecer o ZIP do projeto e testar tradução e voz no Galaxy Note 20.");
    }
    const { stdout } = await execute("unzip", ["-Z1", resolve(env.AION_PROJETO_ANDROID)]);
    const entries = stdout.split(/\r?\n/);
    if (!entries.some(path => path.endsWith("/TranslateActivity.java"))
        || !entries.some(path => path.endsWith("/src/phone/AndroidManifest.xml"))) {
      throw new Error("O ZIP não contém a atividade e o manifesto do tradutor.");
    }
    return waiting("Código do tradutor localizado no ZIP. Compilação e teste no Galaxy ainda pendentes.");
  },
  "Controle do dono": async () => {
    if (!await exists("testes/ion-controle-dono.test.mjs")) {
      return waiting("A integração do controle de dono está na PR #11.");
    }
    await execute(process.execPath, ["--test", "testes/ion-controle-dono.test.mjs"]);
    return waiting("Testes simulados aprovados. Falta conectar a autenticação online.");
  },
  "Financeiro": async () =>
    waiting("Aguardando fontes de mercado e dados autorizados de receitas e custos."),
  "Monitoramento": async () => {
    if (env.AION_MONITORAR_SITE !== "1") {
      return waiting("A consulta ao endereço público está desativada nesta execução.");
    }
    const response = await fetch("https://adl-midia.israelrodriguesnogueira.workers.dev/", {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`O endereço retornou HTTP ${response.status}.`);
    return ok(`O endereço público respondeu HTTP ${response.status}. Exportação não verificada.`);
  },
};

const started = new Date().toISOString();
const names = Object.keys(operators);
const results = await Promise.allSettled(names.map(name => operators[name]()));
const lines = ["# Aion · Central 6D", "", `Execução UTC: ${started}`, ""];
if (env.GITHUB_SHA && /^[a-f0-9]{40}$/i.test(env.GITHUB_SHA)) {
  lines.push(`Commit: ${env.GITHUB_SHA}`, "");
}
for (const [index, result] of results.entries()) {
  if (result.status === "rejected") {
    const code = result.reason?.code;
    const detail = code === "ENOENT"
      ? "Um arquivo ou ferramenta necessária não está disponível."
      : "A verificação falhou. Consulte a saída local para diagnosticar.";
    console.error(names[index], result.reason?.message);
    lines.push(`- **${names[index]} · Falhou.** ${detail}`);
    process.exitCode = 1;
    continue;
  }
  const { status, detail } = result.value;
  lines.push(`- **${names[index]} · ${status}.** ${detail}`);
}

await mkdir(resolve(report, ".."), { recursive: true });
await writeFile(report, lines.join("\n") + "\n");
console.log(lines.join("\n"));
