# Changelog

## 0.69.1 — Windows
- Novo: **ComicXD para Windows**, o mesmo leitor da 0.69 (nada mudou dentro dele) numa janela própria. Dois formatos: `portable.exe` (um arquivo, sem instalar; dados na pasta `ComicXD-dados` ao lado) e `Setup.exe` (instala só para o usuário, sem administrador; atalho no Menu Iniciar, desinstalador em "Aplicativos instalados"; `/S` para instalar em silêncio).
- Janela redimensionável que lembra tamanho, posição e maximizada. Tela cheia com F11, Alt+Enter ou a tecla F do leitor; Esc sai sem sair da HQ.
- Links externos abrem no navegador do Windows; soltar arquivo na janela não faz o leitor navegar; F5, Ctrl+R/O/U/P/S e Alt+←/→ desligados. Uma janela por pasta de dados.
- Os executáveis não são assinados digitalmente: o SmartScreen pode avisar na primeira vez (alerta de reputação, não é vírus). Guia: `docs/WINDOWS.md`. Código: pasta `windows/`.
- Sem mudança no Android/APK (continua na 0.69).
- EN: **ComicXD for Windows** (same 0.69 reader in its own resizable window): single-file portable `.exe` and a per-user `Setup.exe` (no admin). Fullscreen with F11 / Alt+Enter / the reader's F key. Unsigned, so SmartScreen may warn on first run (reputation warning, not malware). No Android change.

## 0.69
- Tela inicial: novo cartão "Novidades" ao lado das dicas, com as melhorias da versão, versões anteriores e erros conhecidos (abre e fecha, sem sair do app). Erros: e-mail ou Issues do GitHub. Cartão do zoom com mais detalhes.
- App Android: ao abrir, avisa se há versão nova no GitHub e pergunta "Baixar agora? Sim/Não". Sim abre o download do APK no navegador; Não pergunta de novo na próxima abertura (e ao voltar para o app, depois de 3 minutos). A instalação continua manual (um toque).
- Biblioteca: ao mover um título, aparecem todas as categorias (Marvel, DC Comics, Mangá, Webtoon, Manhua, Manhwa). Novo botão "Selecionar": marque vários títulos ou "Selecionar tudo" e mova todos de uma vez para a categoria escolhida.
- Biblioteca: corrigido HQ adicionada pela biblioteca entrar como mangá (abria sem a preparação da leitura guiada). Ao adicionar, escolha "Adicionar como: HQ / Mangá"; títulos já adicionados errado podem ser movidos para Marvel/DC pelo menu.
- Efeitos de virar página: agora também funcionam com zoom (HQ e mangá), não só em página inteira.
- Gestos: passar página ficou mais responsivo em HQ e mangá — o deslize curto (a partir de ~32 px, ~22 px se for rápido) agora vale, e um toque com o dedo levemente tremido (até 18 px) conta como toque.
- Vertical das HQs: o fundo da página (preto, cinza ou branco, em Aa) agora funciona também nas HQs. Os filtros "Cores da página" (preto e branco, forte, preto/branco/sangue) também valem no Vertical das HQs.
- Leitor: o título da HQ na barra de cima agora aparece por completo (quebra em até 2 linhas e a letra se ajusta sozinha ao tamanho da tela, em tablet e celular). Em telas estreitas os botões da barra ficam só com o ícone.
- Trava de leitura: o gesto ou botão "voltar" do aparelho não tira mais você da leitura (HQ, mangá, vertical ou webtoon). Para sair, toque no centro e use "Biblioteca". Um aviso curto lembra disso. O voltar continua fechando o menu, a grade de páginas e o chat.
- Cores da página, "Preto, branco e sangue" (antes "Preto, branco e vermelho"): estilo das HQs "Preto, Branco & Sangue" da Marvel. Papel branco, tinta preta, cinzas preservados e vermelho de sangue com destaque, só onde a HQ tem vermelho. Vale na página inteira, guiada e Vertical.
- Tela inicial: o fundo do cartão "Continuar lendo" agora mostra a capa mais nítida (a arte abaixo do título), em vez de um borrão quase invisível. Vale para HQ e Mangá.
- PDFs: proteção na hora de importar/abrir. PDF vazio, cortado (download incompleto) ou que não é PDF é recusado com mensagem clara, e um PDF que demora demais para abrir não trava mais o app. PDFs muito grandes (100 MB ou mais) agora são lidos por partes, sem carregar o arquivo inteiro na memória.
- Marcar quadros (HQs): novo botão ✎ no menu. Circule cada quadro com o dedo, na ordem de leitura, e o número aparece sozinho; a leitura guiada daquela HQ passa a seguir as suas marcas (as páginas sem marca continuam automáticas). Salva sozinho, apaga quadro tocando no número, e "Voltar HQ ao original" desfaz tudo quando quiser. O arquivo da HQ não é alterado. O botão só fica ativo no modo Guiado (apagado em Página inteira e Vertical).
- Lupa: perto das bordas da tela ela agora mostra o que está fora do quadro (balão cortado no canto): quanto mais o dedo chega na borda, mais a lupa se desloca para dentro da página escondida, e nunca mostra vazio além da borda da página. No centro da tela nada mudou.
- Lupa (leitura guiada): segure o dedo na tela (ou o botão do mouse parado) e um círculo mostra a página inteira ampliada embaixo do dedo, para ler balões e textos cortados pelo quadro. Pode ser desligada em Aa.
- Leitura guiada: o contorno do quadro cortava arte preta grossa (cabelo, sombras) encostada na borda; agora corta menos e mostra o quadro inteiro. As HQs já lidas são preparadas de novo uma vez na próxima abertura.
- Leitura guiada: quadro maior que a tela não perde mais um pedaço. Antes, o último trecho do quadro (a borda, às vezes quase um terço de um quadro largo) podia não aparecer em nenhum passo; agora o leitor confere o que ficou de fora e acrescenta um passo quando sobra arte (fundo liso e frestas pequenas continuam sem passo extra). Em quadros grandes divididos em vários passos, a ordem agora é linha por linha (de cima para baixo, esquerda para a direita), e não mais coluna por coluna. Vale em todos os tamanhos de letra (A− / A+). As HQs já lidas são preparadas de novo uma vez na próxima abertura.
- Leitura guiada: o tamanho de letra padrão agora é a Letra 5 (A+ 5). Quem já escolheu outro tamanho mantém o que escolheu.
- Home screen: new "What's new" card next to the tips, with this version's improvements, previous versions and known issues (expands and collapses, without leaving the app). Bugs: email or GitHub Issues. Zoom card with more details.
- Android app: on launch, it checks GitHub for a newer version and asks "Download now? Yes/No". Yes opens the APK download in the browser; No asks again next launch (and when you come back to the app after 3 minutes). Installing is still a manual tap.
- Library: moving a title now shows every category (Marvel, DC Comics, Manga, Webtoon, Manhua, Manhwa). New "Select" button: pick several titles or "Select all" and move them all at once to the chosen category.
- Library: fixed comics added from the library being stored as manga (they opened without guided-reading preparation). When adding, choose "Add as: Comics / Manga"; titles added wrongly can be moved to Marvel/DC from the menu.
- Page-turn effects: now also work while zoomed in (comics and manga), not only on full page.
- Gestures: page turning is more responsive in comics and manga — short swipes (from ~32 px, ~22 px if fast) now count, and a tap with a slightly shaky finger (up to 18 px) counts as a tap.
- Comics Vertical mode: the page background (black, gray or white, in Aa) now also works for comics. The "Page colors" filters (black & white, strong, black/white/blood) also apply in Comics Vertical mode.
- Reader: the comic title in the top bar now shows in full (wraps to up to 2 lines and the text size adjusts itself to the screen, on tablet and phone). On narrow screens the top-bar buttons show only their icon.
- Reading lock: the device's "back" gesture or button no longer takes you out of reading (comics, manga, vertical or webtoon). To leave, tap the center and use "Library". A short notice reminds you. Back still closes the menu, the page grid and the chat.
- Page colors, "Black, white and blood" (formerly "Black, white and red"): in the style of Marvel's "Black, White & Blood" comics. White paper, black ink, preserved grays and a blood-red highlight, only where the comic has red. Works in full page, guided and Vertical.
- Home screen: the "Continue reading" card background now shows the cover more clearly (the art below the title) instead of an almost invisible blur. Works for comics and manga.
- PDFs: protection when importing/opening. An empty, cut-off (incomplete download) or non-PDF file is refused with a clear message, and a PDF that takes too long to open no longer freezes the app. Very large PDFs (100 MB or more) are now read in parts, without loading the whole file into memory.
- Mark panels (comics): new ✎ button in the menu. Circle each panel with your finger, in reading order, and the number appears by itself; guided reading for that comic then follows your marks (pages without marks stay automatic). Saves automatically, tap a number to delete that panel, and "Restore comic to original" undoes everything whenever you want. The comic file itself is not changed. The button is only active in Guided mode (dimmed in Full page and Vertical).
- Magnifier: near the screen edges it now shows what lies outside the panel (a balloon cut off at the corner): the closer your finger gets to the edge, the more the magnifier shifts toward the hidden part of the page, and it never shows empty space past the page edge. Nothing changed in the middle of the screen.
- Magnifier (guided reading): hold your finger on the screen (or the mouse button, without moving) and a circle shows the whole page enlarged under your finger, to read balloons and text cropped by the panel. It can be turned off in Aa.
- Guided reading: the panel outline was cutting thick black art (hair, shadows) touching the panel border; it now cuts less and shows the whole panel. Comics you already read are prepared again once the next time you open them.
- Guided reading: a panel bigger than the screen no longer loses a piece. Before, the last part of the panel (the edge, sometimes almost a third of a wide panel) could be left out of every step; now the reader checks what was left out and adds a step when there is art left (plain background and tiny slivers still get no extra step). In large panels split into several steps, the order is now row by row (top to bottom, left to right) instead of column by column. Works at every text size (A− / A+). Comics you already read are prepared again once the next time you open them.
- Guided reading: the default text size is now Letter 5 (A+ 5). If you already picked another size, it stays as you chose.

## 0.67
- HQs, efeito "livro" (e os outros de virar página): menos engasgo no final do efeito. As páginas vizinhas agora são enviadas para a placa de vídeo uma de cada vez, em fatias e só com a tela parada, em vez de todas juntas logo depois do efeito.
- Comics, "book" page-turn effect (and the other page-turn effects): less stutter at the end of the effect. Neighbor pages are now sent to the GPU one at a time, in slices and only while the screen is still, instead of all at once right after the effect.

## 0.66
- Tela inicial do app (APK): sem a barra de rolagem do lado direito ao rolar (agora também a barra nativa do Android é desligada no app).
- Mangá, "Página inteira" com zoom: ao passar para a próxima página, a leitura começa pelo canto superior direito (Mangá) ou superior esquerdo (Ocidental), na ordem de leitura de cada modo. As HQs ficam como estavam.
- App home screen (APK): no scroll bar on the right side while scrolling (the native Android scroll bar is now turned off in the app too).
- Manga, "Full page" with zoom: when moving to the next page, reading starts at the top-right corner (Manga) or top-left (Western), following each mode's reading order. Comics stay as they were.

## 0.64
- HQs no modo Vertical: a rolagem entre as páginas ficou fluida, sem as travadinhas. O cálculo do "Cortar bordas" agora roda em segundo plano (fora da tela principal) e as páginas são preparadas um pouco antes de aparecer.
- Comics in Vertical mode: scrolling between pages is now smooth, without the small freezes. The "Trim borders" calculation now runs in the background and pages are prepared slightly before they appear.

## 0.63
- HQs: o "Cortar bordas" agora detecta melhor as margens (brancas, pretas ou de scanner), mesmo quando cada lado tem uma cor diferente. Funciona em "Página inteira" e em "Vertical". O Mangá continua com o corte de antes.
- Comics: "Trim borders" now detects margins better (white, black or scanner borders), even when each side has a different color. Works in "Full page" and "Vertical". Manga keeps the previous trimming.

## 0.62
- Voltar para a biblioteca: o botão "‹ Biblioteca" e o botão voltar do Android agora levam para a biblioteca (HQ e mangá), não mais para a tela inicial.
- HQs: novo botão fixo "Cortar bordas" na barra de baixo (✂). Funciona em "Página inteira" e em "Vertical". No modo Guiado, ao tocar nele aparece só um aviso de que não vale ali. Sem mensagem na tela o tempo todo.
- Celular: o cartão "Como ler" ficou compacto e rola, com o botão "Entendi" sempre visível; o aviso "Fim da leitura" ganhou margem nos botões.
- HQs no tablet: a barra de baixo agora é igual à do mangá (modos numa linha, botões na linha de baixo), nada sai da tela.
- Celular: com o cartão "Como ler" aberto, o menu de baixo fica escondido para o botão "Entendi" nunca ser coberto.
- Back to library: the "‹ Library" button and the Android back button now go to the library (comics and manga), not the home screen.
- Comics: new fixed "Trim borders" button (✂) in the bottom bar. Works in "Full page" and "Vertical". In Guided mode, tapping it only shows a note that it doesn't apply there. No on-screen message all the time.
- Phones: the "How to read" card is compact and scrolls, with the "Got it" button always visible; the "End of reading" dialog now has margins around its buttons.
- Comics on tablets: the bottom bar now matches the manga bar (modes on one row, buttons on the next), so nothing runs off-screen.
- Phones: while the "How to read" card is open, the bottom menu is hidden so the "Got it" button is never covered.

## 0.60
- Mangá e Ocidental: o zoom agora funciona como na "página inteira" da HQ. Pinça ou dois toques para dar zoom, arrastar para mover, e o zoom vale para as próximas páginas. Ao chegar na borda da página, deslizar passa para a seguinte.
- Vertical (mangá e também nas HQs, com botão novo): rolagem contínua com todas as páginas emendadas, como o Webtoon, e o zoom é você quem define (pinça, dois toques ou Ctrl + roda). O zoom fica salvo. Sem efeito de virar página.
- Efeitos de virar página ficam no Mangá, no Ocidental e na "página inteira" da HQ (sem efeito com zoom ativo). Vertical e Webtoon não têm efeito.
- Webtoon continua como estava. O zoom do mangá é guardado separado do zoom da HQ.
- Manga & Western: zoom now works like the HQ "full page" mode. Pinch or double-tap to zoom, drag to move, and the zoom carries to the next pages. At the page edge, swiping goes to the next page.
- Vertical (manga, and now comics too with a new button): continuous scroll with all pages joined, like Webtoon, and you set the zoom (pinch, double-tap or Ctrl + wheel). The zoom is saved. No page-turn effects.
- Page-turn effects stay in Manga, Western and the comics "full page" mode (none while zoomed). Vertical and Webtoon have no effects.
- Webtoon is unchanged. Manga zoom is stored separately from HQ zoom.
- Smoother Vertical zoom: double-tap now animates and pinch no longer re-lays out the pages while your fingers move (only when you let go).
## 0.57
- Chat no celular: o teclado virtual não cobre mais o campo de digitação nem as últimas mensagens (a tela encolhe quando o teclado abre).
- Chat on phones: the on-screen keyboard no longer covers the text box or the latest messages (the screen shrinks when the keyboard opens).
## 0.56
- Interface ajustada para celular: botões e títulos não passam mais da borda da tela (biblioteca, leitor, painel de modos, barra superior).
- Painel de modos (Mangá/Ocidental/Vertical/Webtoon) em grade 2×2 no celular.
## 0.55
- Aviso de fim de leitura (HQ, mangá, webtoon) com botão para voltar à **biblioteca**.
- Ordem de leitura do modo guiado melhorada (ordenação por relação entre quadros).
## 0.54
- Zoom de "página inteira" vale também para páginas duplas e carrega para a próxima página.
## 0.53
- Biblioteca: categorias **Marvel** e **DC Comics** (no lugar da aba HQ), depois Mangá, Webtoon, Manhua, Manhwa.
## 0.46–0.52
- Abertura de webtoon (PDF) bem mais confiável: medidas antes de abrir, páginas altas fatiadas, fila priorizada, novas tentativas limitadas.
## ≤ 0.44
- Leitor de HQ com modo guiado (OpenCV), mangá, CBZ/CBR/PDF, chat P2P, temas e idiomas PT/EN/日本語/한국어.
