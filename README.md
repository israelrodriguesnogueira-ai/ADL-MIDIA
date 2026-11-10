# ADL Mídia

Projeto web de criação e produção de vídeos curtos para YouTube Shorts e redes sociais.

## Objetivos
- Roteiros em português brasileiro, com temas de fé, superação, automotivo e curiosidades
- Formato vertical 9:16
- Imagens de fundo locais e legendas
- Pré-visualização e exportação de vídeo
- Narração e trilha sonora quando houver recursos e licenças adequados

## Infraestrutura verificada em 10/11/2026
- Repositório GitHub: `israelrodriguesnogueira-ai/ADL-MIDIA`
- Aplicativo Cloudflare Workers e Pages instalado com acesso aos repositórios
- Aplicação `adl-midia` aparece no painel Cloudflare, com endereço `https://adl-midia.israelrodriguesnogueira.workers.dev`
- O painel mostra uma referência a uma alteração para permitir imagem de fundo local
- Um vídeo de demonstração do gerador foi apresentado pelo proprietário

## Atenção: origem do código de produção pendente
O repositório `ADL-MIDIA`, na branch principal consultada em 10/11/2026, não possui ainda o código-fonte da interface. Portanto, **não presumir** que a aplicação atualmente publicada na Cloudflare utiliza esta branch ou este repositório como origem.

Antes de qualquer implantação:
1. Conferir em Cloudflare > Workers & Pages > adl-midia > Settings/Builds & deployments o repositório, branch e comando de build associados.
2. Identificar e preservar a versão que está funcionando.
3. Obter os arquivos de origem reais e executar testes locais.
4. Implementar melhorias incrementais e validar exportação 9:16.
5. Publicar somente após confirmar a integração correta e o resultado dos testes.

## Diretrizes
Priorizar soluções gratuitas. Não contratar serviços ou alterar configurações de cobrança sem autorização. Não substituir o Worker publicado sem verificar sua origem e ter uma versão recuperável.
