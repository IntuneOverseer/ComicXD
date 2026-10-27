# ComicXD para Windows / ComicXD for Windows

**PT-BR** · [English below](#english)

O ComicXD agora tem programa para Windows: o mesmo leitor do site e do APK, numa janela própria que você pode redimensionar, com tela cheia. Nada mudou dentro do leitor (é o da versão 0.70).

## Requisitos
- Windows 10 ou 11, 64 bits.
- *Microsoft Edge WebView2 Runtime*: já vem no Windows 11 e no Windows 10 atualizado. Se faltar, o ComicXD avisa e oferece o download oficial da Microsoft.

## Qual baixar
Na página de [Releases](../../../releases) (versão **0.70.1 — Windows**):

| Arquivo | Para quê |
|---|---|
| `ComicXD-0.70.1-Windows-portable.exe` | **Portátil**: um arquivo só, sem instalar. Biblioteca e progresso ficam na pasta `ComicXD-dados`, criada ao lado do `.exe` (dá para levar em pendrive). Se a pasta do `.exe` não aceitar gravação, usa `%LOCALAPPDATA%\ComicXD`. |
| `ComicXD-0.70.1-Windows-Setup.exe` | **Instalador**: instala só para o seu usuário (**não pede administrador**) em `%LOCALAPPDATA%\Programs\ComicXD`, cria atalho no Menu Iniciar (e na Área de Trabalho, se você quiser) e aparece em *Configurações > Aplicativos instalados* para desinstalar. Dados em `%LOCALAPPDATA%\ComicXD`. |
| `SHA256.txt` | Impressões digitais dos arquivos, para você conferir o download. |
| `AVISOS-DE-TERCEIROS.txt` | Licenças dos componentes que vão dentro do programa. |

## Como instalar
**Portátil:** baixe o `portable.exe`, coloque numa pasta sua (ex.: `Documentos\ComicXD`) e dê dois cliques.

**Instalador:** baixe o `Setup.exe`, dê dois cliques, responda as duas perguntas e pronto. Para instalar em silêncio: `ComicXD-0.70.1-Windows-Setup.exe /S` (atalho só no Menu Iniciar).
Para atualizar, rode o `Setup.exe` da versão nova por cima: a biblioteca é mantida.
Para desinstalar: *Configurações > Aplicativos > Aplicativos instalados > ComicXD > Desinstalar*. O desinstalador pergunta se você também quer apagar a biblioteca e o progresso (o padrão é **manter**).

## Atalhos de teclado
- **F11** ou **Alt+Enter**: tela cheia (a janela fica sem bordas e o leitor esconde as barras). A tecla **F** do leitor faz o mesmo.
- **Esc**: sai da tela cheia (não tira você da leitura).
- O resto é igual ao leitor (setas, espaço, roda do mouse, **Ctrl + roda** para zoom do leitor).
- Desligadas de propósito, para não tirar o leitor da tela: F5, Ctrl+R, Ctrl+O, Ctrl+U, Ctrl+P, Ctrl+S, Alt+← e Alt+→.

## ⚠ "O Windows protegeu o computador" (SmartScreen)
Na primeira vez, o Windows pode mostrar uma tela azul dizendo **"O Windows protegeu o computador"** e que o aplicativo "não é reconhecido". **Isso é esperado e não significa que o ComicXD é um vírus.**

**Por que aparece:** o Microsoft Defender SmartScreen é um filtro de **reputação**: ele avisa sobre qualquer programa novo, com poucos downloads ou **sem assinatura digital**. O ComicXD é um projeto gratuito e open source, e uma assinatura digital de código custa dinheiro todos os anos. Não é uma detecção de malware: é um alerta preventivo (um falso alarme, no caso). Nos testes do autor, o antivírus não detectou nada.

**Como abrir:**
1. Na tela azul, clique em **Mais informações**.
2. Clique em **Executar assim mesmo**.

Dica: se preferir, antes de abrir clique com o botão direito no arquivo baixado > **Propriedades** > marque **Desbloquear** > **OK**.

**Como ter certeza de que o arquivo é o original:**
- Baixe somente da página oficial de [Releases](../../../releases) deste repositório.
- Confira a impressão digital. No PowerShell, na pasta do download:
  ```powershell
  Get-FileHash .\ComicXD-0.70.1-Windows-Setup.exe -Algorithm SHA256
  ```
  O valor deve ser igual ao do `SHA256.txt` da Release.
- O código-fonte está nesta pasta (`windows/`) e o build é reproduzível: quem compilar com o `build.sh` obtém os mesmos arquivos.

**Computador de empresa/escola:** se o aviso não tiver o botão "Executar assim mesmo" ou o programa for bloqueado, é uma política do administrador (AppLocker, WDAC ou antivírus corporativo). Peça liberação ao TI; não tente burlar.

## Onde ficam meus dados / como fazer backup
- **Portátil:** pasta `ComicXD-dados`, ao lado do `.exe`. Para mudar de PC, copie a pasta inteira junto com o `.exe`.
- **Instalado:** `%LOCALAPPDATA%\ComicXD` (cole no Explorador de Arquivos).
- Os dois modos são separados: a biblioteca do portátil não aparece no instalado (e vice-versa). Não há migração automática ainda.
- Seus arquivos de quadrinhos **não são copiados**: o ComicXD guarda o que precisa para abrir de novo (como no navegador e no APK).

## Problemas comuns
| Sintoma | O que fazer |
|---|---|
| Avisa do "WebView2 Runtime" | Aceite o download oficial da Microsoft (gratuito) e abra de novo. |
| O antivírus bloqueou o `.exe` | O programa carrega o componente `WebView2Loader` (da Microsoft) de dentro de si. Se algum antivírus estranhar, copie `WebView2Loader.dll` (x64) para a **mesma pasta do `.exe`**: ele passa a usá-lo direto do disco. O arquivo está em `windows/third_party/go-webview2/webviewloader/sdk/x64/`. |
| A janela abriu fora da tela | Feche e abra de novo: se o monitor mudou, o ComicXD recentraliza sozinho. |
| Quer ver o que aconteceu | Veja `ComicXD.log` na pasta de dados (o instalador grava `%TEMP%\ComicXD-Setup.log`). Para ferramentas de desenvolvedor: `ComicXD.exe --depurar` (F12 / clique direito > Inspecionar). |
| Abrir o programa de novo só traz a janela | Normal: só existe uma janela por pasta de dados. |

## O que ainda não tem
- Não é assinado digitalmente (veja o aviso do SmartScreen acima).
- Ainda não abre CBZ/CBR/PDF com duplo clique ou "Abrir com": use **Escolher arquivo** dentro do leitor.
- Só Windows 64 bits.

## Compilar
Veja [`windows/README.md`](../windows/README.md).

---

## English

ComicXD now has a **Windows app**: the same reader as the website and the APK, in its own resizable window with fullscreen. Nothing changed inside the reader (it is version 0.70).

**Requirements:** Windows 10/11 x64 and the *Microsoft Edge WebView2 Runtime* (built into Windows 11 and up-to-date Windows 10; the app offers the official download if it is missing).

**Which one:** on the [Releases](../../../releases) page (**0.70.1 — Windows**):
- `ComicXD-0.70.1-Windows-portable.exe`: single file, no install; library and progress live in `ComicXD-dados` next to the `.exe` (falls back to `%LOCALAPPDATA%\ComicXD` if that folder is read-only).
- `ComicXD-0.70.1-Windows-Setup.exe`: per-user install (**no admin rights**), Start Menu shortcut (optional Desktop shortcut), listed in *Settings > Apps > Installed apps*. Data in `%LOCALAPPDATA%\ComicXD`. Silent install: `Setup.exe /S`. Run a newer Setup over the old one to update (your library is kept). The uninstaller asks whether to also delete your library (default: keep).
- `SHA256.txt` and `AVISOS-DE-TERCEIROS.txt` (third-party licenses).

**Keys:** F11 / Alt+Enter = fullscreen (the reader's own **F** key does the same), Esc leaves fullscreen. F5, Ctrl+R/O/U/P/S and Alt+←/→ are disabled on purpose.

**⚠ "Windows protected your PC" (SmartScreen).** On first run Windows may say the app is not recognized. **This is expected and it does not mean ComicXD is malware.** SmartScreen is a *reputation* filter: it warns about any new, little-downloaded or **unsigned** program, and code-signing certificates cost money every year, which this free open-source project does not have. It is a precautionary warning (a false alarm), not a malware detection; in the author's tests the antivirus flagged nothing.
To open it: click **More info**, then **Run anyway** (or right-click the file > Properties > **Unblock** > OK before opening).
To verify the file: download only from this repository's Releases and compare `Get-FileHash <file> -Algorithm SHA256` with `SHA256.txt`. The source is in `windows/` and the build is reproducible.
On a work/school PC, if "Run anyway" is missing or the app is blocked, it is an administrator policy (AppLocker/WDAC/corporate antivirus): ask your IT.

**Troubleshooting:** logs are in `ComicXD.log` inside the data folder (`%TEMP%\ComicXD-Setup.log` for the installer); `ComicXD.exe --depurar` enables DevTools. If an antivirus dislikes the in-memory WebView2 loader, copy `WebView2Loader.dll` (x64, from `windows/third_party/go-webview2/webviewloader/sdk/x64/`) next to the `.exe`.

**Not yet:** code signing; "Open with"/double-click for CBZ/CBR/PDF (use *Choose file* in the reader); 32-bit/ARM builds.
