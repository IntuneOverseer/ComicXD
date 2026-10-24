# Componentes de terceiros / Third-party components

O código próprio do ComicXD é MIT (ver `LICENSE`). Os itens abaixo estão embutidos no HTML final e mantêm suas próprias licenças.

| Componente | Versão | Licença | Uso |
|---|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) (pdfjs-dist) | 6.4.299 | Apache-2.0 | Ler PDF |
| [JSZip](https://stuk.github.io/jszip/) (+ pako, core-js) | 3.10.1 | MIT ou GPL-3.0 (dupla; usamos MIT) | Ler CBZ/ZIP |
| [node-unrar-js](https://github.com/YuJianrong/node-unrar.js) (WASM) | 2.0.2 | MIT (wrapper) + licença do código-fonte UnRAR | Ler CBR/RAR (somente extração) |
| [Trystero](https://github.com/dmotz/trystero) (estratégia torrent) | 0.26.0 | MIT | Chat P2P (opcional) |
| [OpenCV.js](https://opencv.org/) | – | Apache-2.0 | Análise de páginas do modo guiado |

> Antes de publicar: confira as versões/licenças exatas no seu `node_modules` / arquivos originais. Os números acima vieram dos `package.json` usados no build.

## Rede / Network

- Leitura, biblioteca e análise acontecem **no aparelho**. Nenhum arquivo seu é enviado a servidor.
- O **chat P2P** (opcional) usa trackers públicos WebTorrent apenas para os usuários se encontrarem (`tracker.openwebtorrent.com`, `tracker.webtorrent.dev`, `tracker.btorrent.xyz`, `tracker.files.fm`) e STUN (`stun.cloudflare.com`). Esses servidores veem IP e o nome da sala. Sem usar o chat, nada disso é acessado.
- Nenhuma conta, nenhum analytics, nenhum anúncio.

## Origem das ideias

Apps como Tachiyomi/Mihon, Kindle, WEBTOON e leitores de quadrinhos foram apenas **estudados como referência de comportamento**. Nenhum código ou arte deles foi copiado. O ComicXD **não inclui nem baixa quadrinhos**: você abre os seus próprios arquivos.
