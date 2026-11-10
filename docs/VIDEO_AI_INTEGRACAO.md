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
