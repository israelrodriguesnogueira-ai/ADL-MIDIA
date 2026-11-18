// Comandos naturais restritos, sem IA externa ou efeitos colaterais.
// Apenas a sintaxe explicita abaixo e convertida em execucao local.
export function interpretarComandoLocal(comando) {
 if(typeof comando!=="string" || comando.length>3000) return null;
 const match=/^\s*(?:crie|criar|gere|gerar)\s+(?:um\s+)?(?:documento|arquivo de texto)\s+(?:chamado|intitulado)\s+["“]?([^"”:\n]{1,120})["”]?\s+(?:com\s+(?:o\s+)?texto|contendo)\s*:\s*([\s\S]+?)\s*$/i.exec(comando);
 if(!match) return null;
 const titulo=match[1].trim();
 const conteudo=match[2].trim();
 if(!titulo||!conteudo) return null;
 return {acao:"criar_texto",titulo,conteudo};
}
