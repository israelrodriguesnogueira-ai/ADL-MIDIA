# Integração de vídeo por IA — preparação

Status: planejamento técnico em branch isolada. Nenhuma API de geração de vídeo está conectada e nenhuma cobrança foi autorizada.

## Objetivo inicial
Gerar anúncio vertical de 15 segundos (9:16) do vestido curto de alfaiataria preto com faixa de cinto, utilizando fotos reais como referência. Preservar a aparência da modelo aprovada, a fenda frontal, as costas inteiriças (sem abertura) e o laço formado exclusivamente pelo cinto. Evitar distorções e alterações no produto.

## Sequência proposta
1. Selecionar fornecedor de image-to-video com API, documentação, condições comerciais e uso de imagens de referência.
2. Testar fidelidade ao produto em trechos curtos, especialmente frente, lateral e costas, antes de compor 15 segundos.
3. Implementar integração somente no servidor, com segredo em ambiente seguro; nunca no HTML do navegador ou no GitHub.
4. Criar fluxo de job assíncrono (solicitar, consultar estado, receber resultado), limites de consumo, tratamento de falhas e confirmação explícita antes de qualquer uso pago.
5. Revisar vídeo final em dispositivo móvel, exportar MP4 vertical e só então liberar publicação.

## Estado atual confirmado
- GitHub: repositório ADL-MIDIA, branch de produção main.
- Cloudflare: capturas indicam implantação de main via npx wrangler deploy.
- gerador.html atual: canvas e MediaRecorder com imagens/textos, não geração de movimento por IA.
- Não inserir tokens existentes em arquivos, issues, mensagens ou commits.
- Não modificar main até integração e testes serem aprovados.

## Critérios de aceitação
- 1080x1920 desejado, 15 segundos, MP4.
- Mesma modelo e cenário de referência; detalhes do vestido fiéis ao anúncio.
- Frente, lateral e costas apresentadas com transições naturais, sem deformações.
- Trilha com licença adequada e volume equilibrado, se aprovada.
- Falhas e custos exibidos com clareza antes da execução.


## Referência visual aprovada em 10/11/2026
O usuário enviou um vídeo de referência de movimento (arquivo recebido na conversa) e confirmou que esse é o padrão desejado de linguagem visual e qualidade comercial. **A referência serve para movimento e cinematografia, não para trocar a peça anunciada.**

### Critérios obrigatórios de aceite do anúncio
- Duração-alvo de 15 segundos, vertical 9:16.
- Modelo com movimento corporal convincente, mudança natural de postura e dos braços, giro suave para mostrar frente, lateral e costas.
- Alternância equilibrada entre corpo inteiro, plano médio e detalhes; iluminação com profundidade realista.
- Vestido preto original fiel às fotos fornecidas: alças finas, amarração na cintura, fenda frontal lateral, costas fechadas com zíper e sem fenda traseira.
- Não adicionar mangas, babados, decotes diferentes, comprimento alterado ou detalhes inventados.
- Proibir distorções entre quadros: mãos, corpo, costuras, tecido e cenário devem manter continuidade.
- Áudio comercial discreto e licenciado/original; evitar trilhas genéricas vazias ou músicas de terceiros sem direitos.
- Validar exportação e reprodução no celular; registrar limitações de ferramentas gratuitas antes de prometer geração realista.

### Plano temporal sugerido (ajustável)
- 0–4 s: frente, movimento suave e destaque do caimento.
- 4–8 s: giro lateral, detalhe da amarração e fenda frontal.
- 8–12 s: giro mostrando costas e zíper, sem fenda traseira.
- 12–15 s: retorno a pose de destaque e encerramento limpo.

**Situação:** critérios registrados; integração de IA para movimento realista ainda não implementada. Nenhum gasto autorizado.
