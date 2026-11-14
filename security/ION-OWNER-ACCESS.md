# ION — baseline de segurança pessoal

Este documento descreve requisitos de implantação. **Não comprova que os controles já estejam ativos em produção.**

## Requisitos obrigatórios
1. Identidade única do proprietário verificada por provedor de autenticação confiável, com MFA; não confiar apenas em um campo de e-mail fornecido pelo navegador.
2. Conferir assinatura, emissor, público, expiração e identificador imutável do usuário em cada sessão. O e-mail autorizado deve ser comparado após normalização e sem espaços acidentais.
3. Negar acesso por padrão a toda API privada, incluindo endpoints de operadores, dados financeiros, arquivos, comandos e histórico. A interface de login pode ser pública; dados e ações não.
4. Sessões individuais por aparelho, cookies Secure/HttpOnly/SameSite quando aplicáveis, expiração e revogação; nunca usar token fixo embutido no JavaScript.
5. Segredos exclusivamente em Cloudflare Secrets ou GitHub Actions Secrets, conforme a execução. Nunca registrar segredos, tokens ou dados financeiros nos logs.
6. Nenhuma execução financeira real, publicação, exclusão, alteração de permissões ou despesa sem política explícita de autorização; modo simulado por padrão.
7. Pesquisas, invenções, modelos financeiros e artefatos proprietários somente em armazenamento privado com controle de acesso. Não publicar em repositório público, logs públicos ou artefatos de CI.
8. Verificar licenças e procedência antes de incorporar código público; preservar avisos e atribuições exigidos.
9. Aplicar limites de requisição, validação de entradas, trilha de auditoria sem dados sensíveis e resposta segura a erros.
10. Testar autenticação em Android, iPhone, notebook e integração do relógio separadamente; não presumir suporte ao relógio.

## Critérios de aceite
- GET /verificar-acesso sem sessão retorna 401 ou 403 e não vaza dados.
- Cada rota privada retorna 401/403 sem sessão; uma página HTML pública não é prova de acesso privado.
- Sessão de usuário diferente do proprietário é recusada.
- Sessão expirada/revogada é recusada.
- Sessão válida do proprietário funciona e acessa apenas as capacidades autorizadas.
- Uma falha de identidade ou indisponibilidade do provedor resulta em bloqueio, não em acesso livre.
- Nenhum segredo aparece em resposta, repositório, artefato ou log.
- Operações financeiras reais e ações irreversíveis exigem autorização específica.

## Estado
Checklist de requisitos adicionado à ramificação de segurança. Implementação e validação no Worker Cloudflare **pendentes** até revisão do código efetivamente implantado e das configurações de autenticação.
