# Central 6D — checkpoint operacional (2026-11-10, 18:29 BRT)

## Finalidade
Registro de continuidade de projetos. Não é transcrição integral do ChatGPT nem sincronização automática. Este repositório é público: não inserir conversas privadas, credenciais, dados pessoais ou imagens de clientes.

## Estado confirmado
- ADL Mídia: gerador.html exporta vídeo vertical de texto via canvas/MediaRecorder, até seis cenas, 540x960, 15 FPS, com fundo opcional. O código atual **não** gera narração, música, animação realista de pessoa ou publicação automática.
- Teste recebido: adl-midia-1794345693291.mp4. Relato de análise anterior: MP4 vertical exportado, mas sem faixa de áudio e sem imagens cinematográficas. Preservar o original fora do GitHub.
- SHOEEP-GESTAO: repositório contém somente README.md no momento da verificação; motor de vídeo para Shopee **não está confirmado como funcional**.
- ADL Auto: projeto separado, não alterar neste ciclo.

## Requisitos do vídeo Shopee
- Produto: o mesmo vestido anunciado; usar fotos originais autorizadas, sem modificar características do produto.
- Vídeo vertical de 15 s; apresentação de frente, lateral e costas, giro natural; realismo e profundidade; evitar deformações; áudio/trilha licenciados.
- Versão anterior foi preferida pelo usuário à versão posterior com distorções. Nenhuma versão final aprovada ou publicada está confirmada.

## Prioridades e próximos passos
1. Corrigir e validar o motor ADL Mídia (imagem, áudio, sincronização e exportação), mantendo compatibilidade móvel.
2. Separar o pipeline de vídeo de produto Shopee do protótipo de texto; testar com as fotos originais e validar visualmente antes de publicar.
3. Criar registro estruturado de decisões, testes e pendências por projeto; eventual armazenamento integral de conversas exige mecanismo autorizado de exportação/sincronização, banco privado, controle de acesso e backups. GitHub público NÃO deve guardar histórico integral de conversas.
4. Não contratar serviços pagos sem autorização. Não afirmar implantação/funcionamento sem teste real.

## Procedimento de retomada
Ao iniciar nova conversa, consultar este checkpoint e o código atual, verificar alterações recentes e confirmar o próximo passo. Atualizar o checkpoint após cada etapa concluída. Este processo é manual até ser automatizado e não substitui o histórico original do chat.

## Diretriz aprovada — criação evolutiva (2026-11-10)
- Priorizar módulos próprios, reutilização responsável de código aberto e aperfeiçoamento incremental, respeitando licenças e atribuições exigidas.
- Antes de propor gastos, avaliar soluções gratuitas e infraestrutura existente; nenhum serviço pago sem autorização expressa.
- A autonomia autorizada abrange pesquisa, planejamento, documentação, código e testes seguros no escopo dos projetos; operações destrutivas, divulgação de dados, publicação comercial e despesas exigem validação específica.
- Diferenciar rigorosamente **proposto**, **implementado**, **testado** e **publicado**. Não descrever tarefas agendadas como execução contínua de desenvolvimento sem evidência.
- Prioridade operacional: vídeo de vestido Shopee de 15 segundos, preservando o produto original (costas fechadas, laço do cinto atrás e fenda frontal), movimento contínuo, realismo e áudio com presença.
- Próxima etapa verificável: inspecionar o gerador atual, elaborar melhoria incremental de áudio/exportação e validar em ambiente de teste antes de alterar o fluxo principal; avaliar motor de vídeo realista aberto separadamente, considerando custo de computação.

## Esclarecimento sobre investimentos (2026-11-10, 18:59 BRT)
- A expressão **sem despesas não aprovadas** não significa proibição permanente de investimentos. Priorizar recursos próprios, gratuitos e abertos, mas apresentar opções pagas quando houver vantagem técnica ou econômica demonstrável.
- Antes de qualquer contratação, informar custo inicial, custo recorrente, limites, riscos, alternativa gratuita e benefício esperado. A decisão e autorização do gasto pertencem ao responsável pelo projeto.
- Resultados verificáveis significam registrar o que foi implementado, o que foi realmente testado e o que permanece pendente; uma gravação no GitHub, isoladamente, não prova funcionamento no navegador.
- Em 10/11 foi criado `experimentos/trilha-original.js` como módulo experimental de áudio; ainda não integrado nem testado em navegador.

## Diretriz de continuidade evolutiva — animação de personagem (2026-11-10)
- A prioridade atual não é produzir mais apresentações de fotos: é implementar ou integrar um **motor de vídeo realista** que anime uma modelo virtual usando o vestido preto **fiel às imagens originais**, com movimentos corporais naturais como no demonstrativo `1000500932.mp4`.
- Requisitos de produto: 15 segundos, vertical; modelo caminhando, mudando postura, girando e mostrando frente, lateral e costas; costas fechadas, fenda frontal e laço traseiro preservados; áudio com presença profissional.
- **Critério de não regressão:** não apresentar zoom, pan, slideshow ou animação geométrica como substituto de atuação realista. Tais recursos continuam úteis para testes de exportação, mas não satisfazem o vídeo comercial desejado.
- **Critério de verificação:** separar pesquisa, protótipo, integração, teste visual com as fotos reais, exportação validada e aprovação comercial. Nenhuma fase pode ser descrita como concluída sem evidência.
- **Motor ainda não implementado:** investigar modelos de vídeo aberto e serviços de inferência; estimar necessidade de GPU, licença, limitações de uso comercial, proteção de imagens e custos antes de qualquer decisão.
- A autonomia autorizada permite pesquisa, documentação, desenvolvimento e testes seguros; **não permite despesas sem autorização expressa**.
- As estimativas de esforço de investigação (30–60 min), integração experimental (2–4 h) e testes (4–8 h) são hipóteses de planejamento, não execução contínua garantida nem prazo fechado.
