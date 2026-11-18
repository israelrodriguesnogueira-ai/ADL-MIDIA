// Comandos naturais restritos, sem IA externa ou efeitos colaterais.
// Apenas a sintaxe explicita abaixo e convertida em execucao local.
export function interpretarComandoLocal(comando) {
 if(typeof comando!=="string" || comando.length>3000) return null;
 const match=/^\s*(?:crie|criar|gere|gerar)\s+(?:um\s+)?(?:documento|arquivo de texto)\s+(?:chamado|intitulado)\s+["“]?([^"”:\n]{1,120})["”]?\s+(?:com\s+(?:o\s+)?texto|contendo)\s*:\s*([\s\S]+?)\s*$/i.exec(comando);
 if(!match) {
  const md=/^\s*(?:crie|criar|gere|gerar)\s+(?:um\s+)?(?:documento markdown|arquivo markdown)\s+(?:chamado|intitulado)\s+["“]?([^"”:\n]{1,120})["”]?\s+(?:com\s+(?:o\s+)?texto|contendo)\s*:\s*([\s\S]+?)\s*$/i.exec(comando);
  if(!md) return null;
  return {acao:"criar_markdown",titulo:md[1].trim(),conteudo:md[2].trim()};
 }
 const titulo=match[1].trim();
 const conteudo=match[2].trim();
 if(!titulo||!conteudo) return null;
 return {acao:"criar_texto",titulo,conteudo};
}
