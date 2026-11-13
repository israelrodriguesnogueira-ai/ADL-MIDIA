# ION / Aion — Critérios oficiais de aceitação (v1)

**Status deste documento:** especificação aprovada para implementação; NÃO representa comprovação de funcionalidades.
**Princípio:** nenhuma funcionalidade é considerada pronta apenas porque existe código, tela, agendamento ou monitoramento HTTP.

## Estados obrigatórios
- **Planejado:** requisito registrado, sem implementação comprovada.
- **Implementado:** código versionado, com configuração e documentação.
- **Em teste:** testes automatizados e/ou operacionais em andamento.
- **Validado:** testes passaram, com evidência reproduzível, data, versão, ambiente e responsável.
- **Operacional:** validado em produção e observado em execuções reais.
- **Bloqueado:** falha ou dependência impede aceitação.
- **Não verificado:** evidências insuficientes; não presumir sucesso.

## Requisitos transversais de aceitação
| ID | Requisito | Evidência mínima para validar |
| --- | --- | --- |
| A01 | Autenticação exclusiva do proprietário | Login Google válido funciona; conta diferente é recusada; tokens inválidos são recusados; sem 503; logs sem credenciais |
| A02 | Coordenação central Aion | Aion recebe uma tarefa, atribui a um operador, acompanha execução e apresenta resultado e erro |
| A03 | Persistência e retomada | Tarefa e histórico persistem após fechar navegador, trocar dispositivo e reiniciar Worker; sem execução duplicada |
| A04 | Execução contínua | Agendamento/evento funciona com o chat fechado, com registro de início, fim, falhas e tentativas; limites de serviços explicitados |
| A05 | Segurança | Autorização por ação, menor privilégio, auditoria, tratamento de erros e bloqueio de operações não autorizadas |
| A06 | Multidispositivo | Acesso autenticado e continuidade testados no navegador móvel e desktop; integrações de relógio/óculos exigem testes próprios |
| A07 | Custos | Nenhum serviço pago, compra, anúncio ou consumo adicional cobrado sem autorização explícita |
| A08 | Observabilidade | Painel mostra último sucesso, última falha, versão, operador, tarefa, duração e evidência verificável |
| A09 | Testes de regressão | Testes automatizados para fluxos críticos e teste real de produção após implantação |
| A10 | Governança de mudanças | Alterações propostas em branch/PR, testes antes do deploy, rollback e aprovação para mudanças sensíveis |

## Operadores iniciais (sete)
Cada operador precisa ter: identidade e escopo documentados; interface de execução real; pelo menos uma tarefa ponta a ponta; teste positivo e negativo; logs sem segredos; resultado inspecionável; recuperação de falha; integração com coordenador central.

| ID | Operador | Prova de funcionamento requerida |
| --- | --- | --- |
| OP01 | Financeiro | Coletar dados datados de fonte identificada, gerar análise e hipótese registrada antes do resultado, avaliar depois; sem operar dinheiro sem aprovação |
| OP02 | Mídia | Receber roteiro, produzir artefato reproduzível, validar imagens/áudio/legendas/exportação e fornecer arquivo acessível |
| OP03 | Segurança | Detectar evento de teste, registrar alerta, bloquear tentativa não autorizada e preservar auditoria |
| OP04 | Monitoramento | Verificar serviço e operação autenticada separadamente, detectar falha, alertar e registrar recuperação |
| OP05 | Integrações | Conectar serviço/dispositivo autorizado, executar comando de teste, demonstrar revogação e limites |
| OP06 | Operações | Executar tarefa agendada, registrar estado persistente, retomar após falha e evitar duplicação |
| OP07 | Desenvolvimento e Inovação | Receber problema, pesquisar fontes, gerar proposta/protótipo, executar testes, avaliar riscos, custo e utilidade social |

## Expansão: criação de novos operadores
- Aion identifica lacuna e verifica reutilização de operador existente.
- Produz especificação, escopo, permissões mínimas, código em branch isolada e testes.
- Executa testes em ambiente de desenvolvimento, sem credenciais de produção.
- Solicita autorização explícita do proprietário antes de ativar em produção.
- Registra versão, auditoria, plano de reversão e avaliação posterior.
- Nenhum operador pode conceder a si próprio permissões, modificar a política de aprovação ou contornar controles.

## Evidência obrigatória por teste
`ID | data UTC | commit/versão | ambiente | operador | cenário | esperado | observado | resultado | link de log/artefato (sem segredo) | responsável`

## Critério de liberação geral
O ION só recebe o status **PRONTO PARA USO COMPLETO** quando A01–A10 estiverem validados, OP01–OP07 estiverem operacionais e houver teste de tarefa real coordenada pelo Aion com o usuário desconectado, seguido de recuperação de histórico em outro dispositivo.

**Status inicial (2026-11-13):** requisitos registrados; login Google com erro 503 reportado; monitoramento HTTP básico testado, sem comprovação do login; operação dos sete operadores e autonomia contínua não verificadas. Não marcar como operacional sem novas evidências.
