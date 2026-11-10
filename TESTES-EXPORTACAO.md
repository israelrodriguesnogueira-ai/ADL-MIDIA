# Plano de validação — ADL Mídia

Branch: `feature/cinematic-audio-export`. **Não publicar em produção até validar.**

## Testes obrigatórios

- [ ] Abrir `gerador.html` em servidor HTTPS, em desktop Chrome/Edge.
- [ ] Selecionar 3 imagens diferentes, 3 cenas de texto, narração e trilha própria/licenciada.
- [ ] Gerar vídeo 9:16; conferir se imagens mudam entre cenas e legendas são legíveis.
- [ ] Reproduzir arquivo exportado em player independente; confirmar voz audível e trilha em volume inferior à voz.
- [ ] Conferir duração, integridade do arquivo e compatibilidade MP4/WebM.
- [ ] Repetir em Safari/iPhone. Verificar se `MediaRecorder`, `canvas.captureStream` e `AudioContext` estão disponíveis.
- [ ] Testar ausência de arquivos, arquivos inválidos, áudio incompatível, permissões de reprodução e falha de gravação.
- [ ] Testar orientação e layout em celular.
- [ ] Guardar a referência à implantação Cloudflare atual para rollback antes de merge.

## Limitações atuais

A versão implementada **não gera imagens ou narração por IA**: o usuário fornece arquivos locais. Navegadores podem não suportar mixagem de áudio no contêiner de vídeo escolhido. O código ainda não foi testado em dispositivos reais. `main` e a produção permanecem sem alterações.

## Critério para publicar

Somente após reprodução confirmada do arquivo final com imagens, voz e música e identificação do procedimento de rollback. Sem ativar serviços pagos.
