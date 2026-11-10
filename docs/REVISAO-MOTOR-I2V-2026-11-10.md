# Revisão verificável do motor I2V — 2026-11-10 (Central 6D)

## Estado inspecionado
- `integracoes/video-i2v-adapter.mjs`: contrato de solicitação e consulta de jobs, sem inferência, rede ou GPU. Implementado no repositório; **não** é motor de animação.
- `testes/video-i2v-adapter.test.mjs`: testes com backend simulado; arquivo presente, **execução no GitHub Actions não comprovada nesta revisão**.
- `.github/workflows/test-video-i2v.yml`: workflow de testes Node presente; status de execução não verificado.
- `docs/CENTRAL-6D-CONTINUIDADE.md`: checkpoint preserva prioridade do vídeo Shopee, fidelidade ao vestido e proibição de gastos não autorizados.
- **Nenhuma inferência real, vídeo comercial final, publicação ou custo de GPU foi confirmado.**

## Alternativas técnicas (fontes oficiais consultadas em 2026-11-10)
| Motor | Capacidades e exigências | Licença e risco | Decisão |
|---|---|---|---|
| HunyuanVideo-1.5 | I2V, variante 480p destilada; documentação oficial informa mínimo de 14 GB VRAM com offloading. Possui integração Diffusers/ComfyUI. | Tencent Hunyuan Community License; revisão comercial e territorial obrigatória. | Primeiro candidato para ensaio curto, **não selecionado definitivamente**. |
| LTX-2.5 (repositório LTX-2) | Pipeline de texto/imagem para vídeo com áudio; README oficial informa download de cerca de 66 GiB para exemplo e caminho DFR de maior custo computacional. | Repositório de código Apache-2.0, mas há arquivos de licença específicos de modelos/versões; aceitar termos dos pesos antes de uso. | Alternativa para comparar áudio/vídeo, sujeito a GPU, licença e custos. |

Fontes: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5 ; https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/main/LICENSE ; https://github.com/Lightricks/LTX-2 ; https://github.com/Lightricks/LTX-2/blob/main/LICENSE-2_x

## Referência de preço, sem contratação
Tabela pública Runpod atualizada em **2026-11-04**: Pods RTX A5000 24 GB **US$ 0,27/h**, RTX 4090 24 GB **US$ 0,89/h** e RTX A6000 48 GB **US$ 0,59/h**, conforme configuração exibida. Valores podem variar por modalidade/região/disponibilidade, e armazenamento, inicialização, download de pesos, impostos e eventuais serviços adicionais podem aumentar o total. **Custo por vídeo não calculável sem benchmark de inferência real**. Fonte: https://www.runpod.io/pricing . Nenhum serviço contratado.

## Critérios de aceite antes de publicar
1. Usar fotos privadas/autorizadas do **vestido anunciado**; não adicionar ao GitHub público.
2. Produzir clipe I2V real com movimento corporal contínuo (caminhada, giro), sem slideshow/zoom como substituto.
3. Conferir quadros de frente, lateral e costas: **fenda frontal**, **costas fechadas**, **laço traseiro** e identidade visual do produto; rejeitar deformação, troca de tecido/cor ou anatomia.
4. Testar consistência entre clipes, exportação vertical 9:16, duração total de 15 s e áudio licenciado.
5. Somente aprovar publicação após inspeção humana e autorização comercial.

## Integração e próximos passos
- Front-end estático ADL Mídia -> backend privado autenticado -> fila de jobs -> worker GPU I2V -> armazenamento privado temporário -> inspeção e aprovação -> exportação. Nunca expor token de API no navegador.
- Antes de alugar GPU: inventariar hardware já disponível; confirmar termos dos pesos, limite de custos e política de dados; aprovar orçamento.
- Rodar `node --test testes/video-i2v-adapter.test.mjs` no GitHub Actions e verificar logs; em seguida implementar testes de falha/timeout e adaptador de backend privado, sem alegar que isso produz vídeo.
- **Esta revisão é documental e de código; não houve benchmark, instalação de modelo ou teste visual do vestido.**
