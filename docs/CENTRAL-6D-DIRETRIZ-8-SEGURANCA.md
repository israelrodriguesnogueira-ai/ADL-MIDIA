# Central 6D — Diretriz 8: soberania do proprietário e segurança

Estado: política arquitetural proposta pelo proprietário em 2026-11-11; controles técnicos ainda dependem de implantação e validação. Não confundir este documento com garantia de segurança.

## Princípios
1. O proprietário humano controla a concessão e revogação de privilégios administrativos. A identidade deve ser verificada por mecanismos fortes, não apenas por texto ou voz no chat.
2. Automações e assistentes operam com menor privilégio possível e credenciais próprias, de curta duração quando possível. Nenhum agente pode promover a si próprio a administrador.
3. Alterações em identidade, permissões, segredos, regras de proteção, faturamento e exclusão irreversível exigem aprovação explícita do proprietário em canal autenticado, fora da automação.
4. Tentativas de acesso indevido devem ser negadas por padrão, registradas e notificadas. O monitoramento não substitui autenticação e controles do provedor.
5. Preservar histórico com logs auditáveis, cópias de segurança protegidas, recuperação testada e proteção contra alteração/exclusão.
6. Respeitar o modelo de permissões dos provedores GitHub, Cloudflare e demais serviços; não prometer exclusividade absoluta ou invulnerabilidade.

## Plano de implantação verificável
- Inventariar administradores, colaboradores, tokens, apps instalados, chaves e fluxos de deploy, sem expor segredos.
- Ativar autenticação multifator forte (preferencialmente passkeys/chaves físicas) e códigos de recuperação guardados fora do repositório.
- Proteger branch principal com revisão, checks obrigatórios e restrição de force-push/exclusão, conforme recursos disponíveis.
- Configurar ambientes de produção com aprovação manual do proprietário para deploys de risco.
- Separar token de leitura de credenciais de escrita; reduzir permissions de GitHub Actions e revisar dependências.
- Ativar alertas de segurança, auditoria e backups independentes com teste de restauração.
- Testar tentativas de alteração não autorizada em ambiente de ensaio antes de declarar qualquer controle efetivo.

## Limites
A diretriz não impede, por si só, invasões ou alteração de permissões. Não há garantia de que nenhuma outra pessoa jamais obtenha acesso. Não registrar senhas, tokens, dados pessoais sensíveis ou segredos neste repositório público.
