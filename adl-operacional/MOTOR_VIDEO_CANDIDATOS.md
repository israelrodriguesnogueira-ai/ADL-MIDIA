# Motor de vídeo — pesquisa inicial (2026-11-10)

## Candidato prioritário para experimento: Wan 2.2 Image-to-Video via NiftyVid
- Demo: https://igorcsis.github.io/nifty-vid/
- Código aberto: https://github.com/IgorCSIS/nifty-vid
- Fluxo descrito: foto + prompt -> vídeo MP4; frontend estático e proxy Cloudflare Worker para Space público Hugging Face.
- Limite declarado: 4,5 segundos por geração; para vídeo Shopee de 15 s, seriam necessários pelo menos quatro clipes e montagem posterior, com cuidado com continuidade visual.
- Limitações: fila compartilhada, disponibilidade não garantida, possível mudança da API, direitos/privacidade do conteúdo a verificar. Não presumir que seja motor estável de produção.

## Alternativa experimental
- Wan2.Video https://wan2.video/pt informa acesso a demos públicas de image-to-video, com fila e quotas variáveis; não é garantia de API de produção.
- Wan Animate https://wan2.video/wan-animate-demo aceita imagem de personagem + vídeo de movimento; potencialmente mais relevante para preservar pose, mas depende de serviços terceiros e cotas.

## Teste de aceitação antes de integrar
1. Confirmar disponibilidade real e condições de uso comercial de cada serviço.
2. Gerar **somente uma cena de teste** a partir de foto real do anúncio, com movimentos discretos, sem custo e sem expor segredos.
3. Verificar que costas do vestido estão fechadas, fenda apenas na frente, cinto e laço corretos, sem distorções.
4. Se aprovado, criar outras cenas, unir em MP4 vertical de 15 s, trilha original e testar Android.
5. Integração no ADL Mídia deve manter credenciais apenas no servidor, com job_id e estados reais. Não executar custos sem autorização.

## Situação verificada
Pesquisa e registro técnico realizados. **Nenhum job de geração foi iniciado** e não foi comprovada integração funcional do motor. O ambiente local tem FFmpeg, mas não GPU de geração nem diffusers; portanto FFmpeg não cria novos movimentos realistas do vestido.
