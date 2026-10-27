# ComicXD para Windows / ComicXD for Windows

**PT-BR** — O mesmo leitor do site e do APK, agora como programa de Windows: janela própria,
redimensionável, com tela cheia (**F11**, **Alt+Enter**, tecla **F** do leitor, **Esc** para sair).
Dois formatos:

| Arquivo | Para quê |
|---|---|
| `ComicXD-<versão>-Windows-portable.exe` | Um só arquivo, sem instalar. Biblioteca e progresso ficam na pasta `ComicXD-dados`, ao lado do `.exe` (dá para levar em pendrive). |
| `ComicXD-<versão>-Windows-Setup.exe` | Instala só para o seu usuário (sem administrador), cria atalho no Menu Iniciar (e, se quiser, na Área de Trabalho) e aparece em *Aplicativos instalados* para desinstalar. Dados em `%LOCALAPPDATA%\ComicXD`. `Setup.exe /S` instala em silêncio. |

Requisitos: Windows 10 ou 11 (64 bits) com o *Microsoft Edge WebView2 Runtime* (já vem no Windows 11 e no
Windows 10 atualizado; se faltar, o programa avisa e oferece o download oficial).

Os executáveis **não são assinados digitalmente**: o Windows SmartScreen pode mostrar "O Windows protegeu o
computador" → *Mais informações* → *Executar assim mesmo*. Confira o `SHA256.txt` da Release se quiser.

**EN** — The same reader as the website and the APK, as a native Windows window (resizable, fullscreen with
F11 / Alt+Enter / the reader's own **F** key, **Esc** to leave). Two builds: a single-file *portable* `.exe`
(data in `ComicXD-dados` next to it) and a per-user *Setup* (no admin rights, Start Menu shortcut, listed in
*Installed apps*; `Setup.exe /S` for a silent install). Needs Windows 10/11 x64 and the WebView2 Runtime.
The executables are not code-signed, so SmartScreen may warn on first run.

## Como funciona
- O leitor (o mesmo `ComicXD-pc.html` da Release) vai **dentro** do `.exe`. Ele é gravado em `<dados>\app` e
  aberto em `https://comicxd.local/` por *mapeamento de host virtual* do WebView2: nada escuta em porta de
  rede, e a origem fixa faz o navegador embutido guardar a biblioteca sempre no mesmo lugar.
- A janela lembra tamanho, posição e se estava maximizada (`janela.json`). Se o monitor mudou, ela reaparece
  centralizada.
- Tela cheia: a janela acompanha o `fullscreenchange` da página (o leitor entra no modo imersivo sozinho).
- Links externos abrem no navegador do Windows; soltar um arquivo na janela não faz o leitor navegar para ele.
- Teclas de navegador que tirariam o leitor da tela (F5, Ctrl+R/O/U/P/S, Alt+←/→) ficam desligadas.
- Só uma janela por pasta de dados (abrir de novo traz a janela existente para a frente).
- Log: `ComicXD.log` na pasta de dados (instalador: `%TEMP%\ComicXD-Setup.log`). `ComicXD.exe --depurar`
  liga F12 / clique direito > Inspecionar.
- Antivírus implicando com o carregamento em memória do `WebView2Loader`? Coloque o `WebView2Loader.dll`
  (x64, do SDK do WebView2, em `third_party/go-webview2/webviewloader/sdk/x64`) ao lado do `.exe`: ele passa
  a ser usado direto do disco.

## Compilar
```bash
go install github.com/akavel/rsrc@v0.10.2
./build.sh 0.70            # usa ../dist/ComicXD-pc.html
```
Cruza para Windows a partir de Linux/macOS (Go puro, sem cgo). A biblioteca `go-webview2` está copiada em
`third_party/` (licença MIT) com **dois arquivos acrescentados** (`expose_comicxd.go`, `pkg/edge/comicxd_extra.go`);
nenhum arquivo original foi alterado.

## Estrutura
```
estado.go / estado_test.go   lógica pura: estado da janela, pasta de dados (testada)
seguranca*.go                trava do desinstalador (só apaga a pasta registrada pelo instalador)
main_windows.go              janela, tela cheia, teclas, integração com o leitor
desinstalar_windows.go       --desinstalar (roda de uma cópia em %TEMP%)
internal/inst/               atalhos, registro de desinstalação
setup/                       instalador (embute o programa compactado)
rsrc/                        ícone e manifestos (DPI por monitor, sem elevação)
third_party/go-webview2/     biblioteca (MIT) + WebView2Loader (BSD-3, Microsoft)
```
