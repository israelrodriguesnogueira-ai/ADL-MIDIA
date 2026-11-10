# Integração segura do gerador ADL Mídia

## Estado atual
Este diretório contém um **protótipo independente** de linha do tempo e legendas SRT. Não renderiza vídeo, não baixa imagens e não sintetiza áudio. Não foi implantado na Cloudflare.

## Fluxo proposto
1. Receber roteiro em português e separar em cenas com duração estimada.
2. Associar cada cena a uma imagem local/licenciada. Se ausente, preservar o fundo existente.
3. Obter áudio de narração pt-BR masculina **somente quando houver mecanismo disponível**; se o mecanismo não fornecer timestamps, solicitar alinhamento ou marcar legendas como aproximadas.
4. Calcular transições crossfade e gerar SRT com timestamps reais quando disponíveis.
5. Renderizar no motor existente, sem substituí-lo, e exportar MP4 vertical.
6. Validar arquivo reproduzível, áudio presente, legendas dentro da área segura e consumo de memória no celular.

## Bloqueio
A branch main não contém o código-fonte do Worker publicado. Antes da integração, confirmar origem do deploy em Cloudflare, salvar cópia recuperável e obter os arquivos reais. **Não publicar este protótipo isolado**.

## Testes
`node prototype/video-pipeline.test.mjs`
A automação do GitHub foi adicionada; verificar o resultado da execução em Actions antes de declarar aprovação.

## Critérios
Sem serviços pagos ou mudanças de faturamento sem aprovação. Tratar falhas de imagem/voz/exportação com mensagens e fallback, preservando o gerador atual.
