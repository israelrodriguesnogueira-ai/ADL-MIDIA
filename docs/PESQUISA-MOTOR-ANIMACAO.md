# Pesquisa inicial — motor de animação realista (2026-11-10)

**Estado: pesquisa documental; nenhum modelo instalado, nenhuma inferência realizada e nenhum gasto contratado.**

## Requisitos da Central 6D
- Image-to-video com **pessoa caminhando e girando**; vestido preto idêntico às fotografias (fenda frontal, costas fechadas, laço traseiro).
- Clipes curtos podem ser concatenados para 15 s, mas precisam de consistência de personagem/roupa e inspeção quadro a quadro.
- Integração em serviço de GPU separado do front-end estático GitHub Pages. **Não** executar inferência pesada diretamente no navegador do celular.

## Alternativas documentadas em fontes oficiais
1. **HunyuanVideo-1.5** — código I2V e pesos públicos; documentação informa GPU NVIDIA/CUDA e mínimo de **14 GB VRAM com offloading**, Linux e Python >= 3.10. Há versão 480p I2V com destilação de passos. Fonte: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5 . **Candidato inicial para protótipo**, condicionado a revisão da licença e hardware.
2. **LTX-Video / LTX-2.x** — suporte a image-to-video, condicionamento por múltiplos quadros e geração de áudio/vídeo; o aplicativo LTX Desktop documenta recomendação de **24 GB VRAM** NVIDIA e 32 GB RAM para geração local. Fontes: https://github.com/Lightricks/LTX-Video e https://github.com/Lightricks/LTX-Desktop . Rever licença de cada versão/modelo antes de uso comercial.
3. **HunyuanVideo original** — demanda muito maior: documentação informa **45–60 GB VRAM** para resoluções e durações exemplificadas; menos adequado como primeira implantação econômica. Fonte: https://github.com/Tencent-Hunyuan/HunyuanVideo .

## Decisão preliminar
- **Priorizar análise de HunyuanVideo-1.5 I2V** como prova de conceito por menor exigência documentada de VRAM, não como seleção definitiva.
- Conferir licenças do código e dos pesos, permissões comerciais e política de processamento de imagens antes de qualquer integração.
- Validar disponibilidade real de GPU ou opção gratuita confiável; Cloudflare Pages/GitHub Pages hospedam a interface, **não substituem GPU de inferência**.
- Preparar um adaptador de jobs com estados `queued/running/succeeded/failed`, armazenamento privado temporário, autenticação e tratamento de erros. Não embutir chaves de API no front-end público.
- Testar primeiro clipe de poucos segundos com fotos autorizadas, comparar fenda/costas/laço e movimento. Só então ampliar para 15 s e adicionar áudio profissional.

## Pendências
- Licenças específicas dos modelos/weights; inventário de hardware; provedor de execução; custo e limite; teste real de geração; aprovação do usuário antes de despesa.
