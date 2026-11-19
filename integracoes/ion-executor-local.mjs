// ION - executor local deterministico, sem chamadas externas.
// Tarefas do proprietario e diagnosticos tecnicos permanecem separados.
const resultado = (artefato) => ({status:"concluido",artefato,execucao:"local",custoAdicional:0});
const textoValido = (s,max) => typeof s === "string" && !!s.trim() && s.length <= max;
export function executarLocal(pedido) {
  if (!pedido || typeof pedido !== "object" || Array.isArray(pedido)) return {status:"erro",erro:"Pedido invalido"};
  if (pedido.acao === "capacidades") return {
    status:"concluido",capacidades:["capacidades","estado_operadores","criar_texto","criar_markdown","diagnosticar_falha","criar_roteiro_video"],
    limites:["sem execucao de shell","sem publicacao","sem operacoes financeiras","sem custos externos"]
  };
  if (pedido.acao === "estado_operadores") {
    // Estado das capacidades do executor experimental, não da implantação de produção.
    const operadores = [
      {nome:"desenvolvimento",estado:"parcial",capacidades:["criar_texto","criar_markdown","diagnosticar_falha"]},
      {nome:"midia",estado:"parcial",capacidades:["criar_roteiro_video"]},
      {nome:"financeiro",estado:"nao_conectado",capacidades:[]},
      {nome:"cientifico",estado:"nao_conectado",capacidades:[]},
      {nome:"shopee",estado:"nao_conectado",capacidades:[]}
    ];
    return {status:"concluido",escopo:"executor_local_experimental",operadores,
      custoAdicional:0,observacao:"Não representa disponibilidade ou implantação do AION em produção."};
  }
  if (pedido.acao === "criar_roteiro_video") {
    if (!textoValido(pedido.produto,120) || !Number.isInteger(pedido.duracaoSegundos) ||
        pedido.duracaoSegundos < 5 || pedido.duracaoSegundos > 60)
      return {status:"erro",erro:"Produto ou duracao invalidos"};
    const produto=pedido.produto.trim().replace(/[\\r\\n]/g," ");
    const duracao=pedido.duracaoSegundos;
    const roteiro={tipo:"roteiro_video",produto,duracaoSegundos:duracao,formato:"vertical 9:16",
      cenas:[{inicio:0,fim:Math.floor(duracao/3),acao:"Mostrar frente do produto"},
             {inicio:Math.floor(duracao/3),fim:Math.floor(2*duracao/3),acao:"Mostrar lateral e detalhes"},
             {inicio:Math.floor(2*duracao/3),fim:duracao,acao:"Mostrar costas e finalizar"}],
      renderizado:false,observacao:"Roteiro local gerado; nenhum video ou audio foi renderizado."};
    return {...resultado({nome:"ion-roteiro-video.json",tipo:"application/json; charset=utf-8",
      conteudo:JSON.stringify(roteiro,null,2)}),operador:"midia",renderizado:false};
  }
  if (pedido.acao === "criar_texto") {
    if (!textoValido(pedido.titulo,120) || typeof pedido.conteudo !== "string" || pedido.conteudo.length > 12000)
      return {status:"erro",erro:"Titulo ou conteudo invalido"};
    return resultado({nome:"ion-documento.txt",tipo:"text/plain; charset=utf-8",conteudo:pedido.titulo.trim()+"\n\n"+pedido.conteudo});
  }
  if (pedido.acao === "criar_markdown") {
    if (!textoValido(pedido.titulo,120) || typeof pedido.conteudo !== "string" || pedido.conteudo.length > 12000)
      return {status:"erro",erro:"Titulo ou conteudo invalido"};
    const titulo=pedido.titulo.trim().replace(/[\r\n#]/g," ").trim();
    return resultado({nome:"ion-documento.md",tipo:"text/markdown; charset=utf-8",conteudo:"# "+titulo+"\n\n"+pedido.conteudo});
  }
  if (pedido.acao === "diagnosticar_falha") {
    // Aceita apenas metadados tecnicos declarados; nao persiste conversas, anexos ou prompts.
    if (!textoValido(pedido.componente,80) || !textoValido(pedido.codigoErro,80) ||
        !/^[a-zA-Z0-9_.-]+$/.test(pedido.componente) || !/^[a-zA-Z0-9_.-]+$/.test(pedido.codigoErro) ||
        !["teste","integracao","implantacao"].includes(pedido.fase))
      return {status:"erro",erro:"Metadados tecnicos invalidos"};
    const diagnostico = {
      tipo:"diagnostico_tecnico",componente:pedido.componente,codigoErro:pedido.codigoErro,
      fase:pedido.fase,estado:"pendente_de_correcao",implantado:false,
      proximaAcao:"Investigar causa, corrigir em branch isolada, executar testes e validar antes de implantar"
    };
    return {...resultado({nome:"ion-diagnostico.json",tipo:"application/json; charset=utf-8",conteudo:JSON.stringify(diagnostico,null,2)}),diagnostico};
  }
  return {status:"nao_suportado",erro:"Executor nao autorizado"};
}
