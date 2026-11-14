# ION — Tradutor de áudio e vídeo (proposta)

## Objetivo
Traduzir para português brasileiro o conteúdo que o proprietário estiver ouvindo ou assistindo, com legendas e opção de fala sintetizada. Não declarar tradução simultânea operacional antes de teste real.

## Etapas técnicas
1. Captura consentida: microfone ou arquivo fornecido pelo proprietário. Captura do áudio de outros aplicativos depende de permissões e limitações do Android/iOS/navegador.
2. Identificação do idioma e reconhecimento de fala, preferencialmente em processamento local quando viável.
3. Tradução textual por modelo local ou serviço expressamente aprovado; não ativar serviços pagos automaticamente.
4. Legendas com marcações de tempo, opção de voz em pt-BR e controles de volume.
5. Testes de atraso, precisão, consentimento, consumo de bateria, isolamento de dados e funcionamento em dispositivos autorizados.

## Regras
- Nenhuma gravação, transmissão ou armazenamento em segundo plano sem consentimento explícito.
- Não armazenar áudio privado por padrão. Não incluir credenciais em frontend ou logs.
- Não prometer captura irrestrita de áudio de outros apps.
- Priorizar opções gratuitas e respeitar licenças.

## Aceitação
Teste de vídeo/áudio estrangeiro autorizado pelo usuário com legenda pt-BR, opção de leitura em voz, tempo de resposta medido e confirmação de que a captura foi interrompida quando solicitado.

Status: requisitos registrados; implementação, conexão ao ION e testes pendentes.
