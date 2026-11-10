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
