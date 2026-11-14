import { identificarOperador } from "./ion-roteador-operadores.mjs";

/**
 * Núcleo de coordenação ION. Sem credenciais, rede, pagamentos ou execução implícita.
 * Adaptadores reais devem ser registrados explicitamente pelo proprietário.
 */
export function criarNucleoION({ executores = {}, autorizacao = () => false } = {}) {
  const permitidos = new Set(["financeiro","desenvolvimento","cientifico","midia","shopee","geral"]);
  return {
    capacidades() {
      return [...permitidos].map(operador => ({operador, disponivel:typeof executores[operador]==="function"}));
    },
    async processar(comando, contexto = {}) {
      const rota = identificarOperador(comando);
      if(rota.erro) return {status:"entrada_invalida", operador:"entrada", erro:rota.erro};
      const operador = rota.operador;
      const executor = executores[operador];
      if(typeof executor !== "function") return {status:"sem_executor", operador, executado:false, mensagem:"Operador identificado, mas não há executor conectado."};
      const tarefa={operador, comando, contexto};
      if(contexto.acaoSensivel && !autorizacao(tarefa)) return {status:"autorizacao_necessaria", operador, executado:false};
      try {
        const resultado=await executor(tarefa);
        if(!resultado || resultado.status!=="concluido" || !resultado.evidencia) {
          return {status:"nao_comprovado", operador, executado:false, detalhe:"O executor não apresentou conclusão com evidência."};
        }
        return {status:"concluido", operador, executado:true, resultado:resultado.resultado, evidencia:resultado.evidencia};
      } catch {
        return {status:"erro_execucao", operador, executado:false, mensagem:"O executor falhou; consulte os logs protegidos."};
      }
    }
  };
}
