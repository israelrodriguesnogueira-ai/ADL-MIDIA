# ADL — memória operacional e continuidade ativa (protótipo)

Este diretório é o ponto de verdade **versionado** para estado operacional; não é uma memória cognitiva ou um agente autônomo permanente.

## Estado
- `estado.json`: projetos, bloqueios, próximo passo e verificações. Atualizar **somente após evidência** de execução; nunca marcar renderização como iniciada sem job ID real.
- `verificar_estado.py`: validador offline, apenas biblioteca padrão do Python; falha se dados críticos faltarem.
- `.github/workflows/adl-verificacao.yml`: verificação agendada (GitHub Actions), somente leitura, sem chaves e sem implantação. Relatório aparece no resumo do workflow.

## Segurança
Não inserir tokens do Claude, Cloudflare ou qualquer segredo em arquivos, logs ou frontend. Claude não é, por si, um motor de geração de vídeo. Não acionar APIs pagas sem aprovação explícita. Testar na branch antes de considerar mesclagem.

## Integração futura
1. Escolher provedor image-to-video e verificar cotas/custos/licença.
2. Guardar credenciais em segredos do serviço, nunca no navegador ou Git.
3. Adicionar endpoint autenticado que retorna job_id e status real (queued/running/completed/failed).
4. Validar resultado do vestido contra fotos do anúncio; rejeitar costas abertas.
5. Só publicar após revisão e testes de Android, áudio e formato.
