# AION — cinco pilares de homologação (19/11/2026)

Este documento fixa o escopo de entrega. **Testes unitários aprovados não significam homologação de produção.** Não declarar AION pronto sem evidências reais de cada critério.

| Pilar | Evidência exigida para aprovação | Situação verificada |
| --- | --- | --- |
| 1. Autenticação | Login Google do proprietário na interface publicada, sessão válida e rejeição comprovada de terceiros; nenhuma chave de API no navegador | PENDENTE: Worker experimental usa Bearer estático; integração com `ion-validacao` não comprovada |
| 2. Interface | Envio de texto e voz do Galaxy e iPhone chega ao executor, com retorno e interface estável | PENDENTE: interface e executor experimental não conectados em produção |
| 3. Execução remota | Comando autenticado dispara GitHub Actions, acompanha execução e trata erros, sem alegar conclusão antecipada | PARCIAL: endpoints implementados e testados com simulações; dispatch remoto desativado por padrão |
| 4. Arquivos | Fluxo real cria MP4, confirma artefato, disponibiliza download protegido, reproduz vídeo e áudio | PARCIAL: renderização gráfica em GitHub Actions comprovada; Worker não homologado end-to-end; vestido 3D realista não entregue |
| 5. Homologação | Teste ponta a ponta no domínio publicado e em Galaxy/iPhone, incluindo falhas e recuperação | PENDENTE: não há evidência de homologação final |

## Diagnóstico de causa raiz

1. **Ambientes separados:** `ion-validacao` (login), `ion-motor-worker.mjs` (executor experimental), interface e GitHub Actions não formam um fluxo publicado e autenticado único.
2. **Falso positivo de testes:** mocks e CI verificam contratos locais, não credenciais, implantação, navegador e renderização real no mesmo caminho.
3. **Escopo de mídia diferente:** MP4 gráfico de demonstração não equivale a vestido 3D giratório cinematográfico.
4. **Credenciais e custos:** não ativar `AION_RENDER_DISPATCH_ENABLED`, tokens, provedores pagos ou R2 sem verificação de segurança e autorização específica para eventual cobrança.

## Regra de execução

- Corrigir primeiro a ligação segura do proprietário ao executor, sem expor `ION_API_ACCESS_TOKEN` ou `AION_GITHUB_DISPATCH_TOKEN` ao cliente.
- Em seguida executar um teste integrado **com evidência verificável**: login → comando → workflow → status → artefato → reprodução no dispositivo.
- Cada falha deve registrar causa, teste que a reproduz, correção, resultado e link da execução. Não repetir ajustes sem confirmar a causa.
- Só marcar um pilar como APROVADO após evidência end-to-end. Não aumentar a contagem de pilares.
- Manter custo adicional contratado em zero; considerar limites de uso gratuito de GitHub Actions/Cloudflare.

## Referências verificadas
- GitHub Actions renderizador gráfico: https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/44540404122
- CI PR #90: https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/44556358154
- Correções PRs #87–#90 integradas à branch principal.
