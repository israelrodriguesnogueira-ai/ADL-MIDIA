# ADL Mídia

Estúdio web de planejamento e geração experimental de vídeos curtos em português.

## Código encontrado
- `index.html`: painel de projetos com armazenamento local e exportação de roteiros
- `gerador.html`: geração de vídeo vertical em canvas, até seis cenas, imagem de fundo local, exportação MP4/WebM conforme suporte do navegador
- Não há integração de voz, música ou publicação automática nesta versão

## Implantação
A Cloudflare indica uma aplicação `adl-midia`, conectada à branch `main`, com comando `npx wrangler deploy`. É necessário verificar o build e a compatibilidade antes de atualizar a produção. **Não publicar a branch de desenvolvimento sem testar.**

## Melhorias em desenvolvimento
- Título do projeto visível no vídeo exportado
- Testar navegadores móveis e desktop
- Verificar suporte e resultado da exportação MP4/WebM
- Planejar legendas, narração e trilhas com direitos de uso

## Teste manual
1. Abrir `gerador.html` em navegador que suporte MediaRecorder e canvas.captureStream
2. Alterar título e frases; escolher imagem de fundo opcional
3. Gerar vídeo, conferir título, frases e enquadramento vertical
4. Confirmar duração, reprodução, áudio ausente e extensão real do arquivo
5. Testar também sem imagem e com texto longo

## Política de custos
Priorizar soluções gratuitas; não contratar serviços sem autorização.
