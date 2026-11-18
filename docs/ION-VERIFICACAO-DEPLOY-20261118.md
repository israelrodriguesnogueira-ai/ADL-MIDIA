# ION — verificação da origem de implantação

Estado: **não confirmado**. Não implantar o motor experimental na produção até validar os itens abaixo.

## Evidência no repositório
- `integracoes/ion-motor-worker.mjs` é um motor experimental, não um ponto de entrada de produção comprovado.
- `integracoes/ion-executor-local.mjs` foi incorporado à `main` no PR #65.
- `.github/workflows/monitor-ion.yml` monitora a URL pública; não faz deploy.
- Não foi encontrada configuração Wrangler de deploy no repositório na revisão de 18/11/2026.

## Conferência necessária no painel Cloudflare
1. Abrir **Workers & Pages → ion-validacao → Settings / Builds & deployments**.
2. Anotar o repositório conectado, branch, comando de build, diretório raiz e última implantação. **Não copiar segredos ou tokens para issues/prints**.
3. Confirmar se a implantação é manual, Git-integrada ou por API e se há versão anterior recuperável.
4. Conferir o nome do Worker, rotas e variáveis **apenas pelos nomes**, sem revelar valores.
5. Em ambiente de teste isolado, validar `GET /health`, `POST /api/executar-local` sem token (401), com token de teste e `POST /api/comando` legado.
6. Confirmar que a autenticação do proprietário permanece intacta; só então aprovar implantação gradual.
7. Após publicar, verificar logs, respostas HTTP e rollback. Não inferir implantação a partir de merge.

## Custos e segurança
- Não criar plano pago, chave de API paga, domínio ou recurso cobrado.
- Não habilitar `AI_ENABLED` nem cadastrar `AI_API_KEY` por padrão.
- Não executar comandos arbitrários, pagamentos, negociações ou publicação externa.
- Em caso de dúvida sobre origem do Worker, **parar antes do deploy**.

## Critério de conclusão
Somente marcar produção como concluída quando houver ID de implantação Cloudflare, testes HTTP autenticados e não autenticados, evidência de funcionamento do executor e rollback documentado.
