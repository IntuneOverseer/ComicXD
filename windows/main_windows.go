//go:build windows

// ComicXD para Windows: janela própria (WebView2) que abre o leitor ComicXD.
//
//   - Janela redimensionável, lembra tamanho/posição/maximizada.
//   - Tela cheia: F11 ou Alt+Enter (os mesmos sai da tela cheia).
//   - Portátil: biblioteca e progresso ficam em "ComicXD-dados", ao lado do .exe.
//   - Instalado (arquivo "instalado.txt" ao lado do .exe): %LOCALAPPDATA%\ComicXD.
//   - O leitor roda em https://comicxd.local/ (origem fixa, para o navegador
//     embutido guardar a biblioteca sempre no mesmo lugar).
package main

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

//go:embed index.html
var paginaHTML []byte

// versaoApp é trocada na compilação (-ldflags "-X main.versaoApp=...").
var versaoApp = "0.70-teste1"

const (
	tituloJanela = "ComicXD"
	hostVirtual  = "comicxd.local"
	urlInicial   = "https://" + hostVirtual + "/index.html"
	urlRuntime   = "https://go.microsoft.com/fwlink/p/?LinkId=2124703" // instalador oficial do WebView2 Runtime
	iconeID      = 2                                                   // ID do grupo de ícones gerado pelo rsrc (conferido no .exe)
)

// ---------- API do Windows ----------

type point struct{ X, Y int32 }
type rect struct{ Left, Top, Right, Bottom int32 }
type windowPlacement struct {
	Length, Flags, ShowCmd uint32
	PtMin, PtMax           point
	Normal                 rect
}
type monitorInfo struct {
	Size          uint32
	Monitor, Work rect
	Flags         uint32
}

var (
	user32               = windows.NewLazySystemDLL("user32.dll")
	pGetWindowPlacement  = user32.NewProc("GetWindowPlacement")
	pSetWindowPlacement  = user32.NewProc("SetWindowPlacement")
	pGetWindowLongPtr    = user32.NewProc("GetWindowLongPtrW")
	pSetWindowLongPtr    = user32.NewProc("SetWindowLongPtrW")
	pSetWindowPos        = user32.NewProc("SetWindowPos")
	pMonitorFromWindow   = user32.NewProc("MonitorFromWindow")
	pGetMonitorInfo      = user32.NewProc("GetMonitorInfoW")
	pEnumDisplayMonitors = user32.NewProc("EnumDisplayMonitors")
	pGetSystemMetrics    = user32.NewProc("GetSystemMetrics")
	pFindWindow          = user32.NewProc("FindWindowW")
	pShowWindow          = user32.NewProc("ShowWindow")
	pSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	pIsIconic            = user32.NewProc("IsIconic")
	pGetKeyState         = user32.NewProc("GetKeyState")
	pMessageBox          = user32.NewProc("MessageBoxW")
	pLoadImage           = user32.NewProc("LoadImageW")
	pSendMessage         = user32.NewProc("SendMessageW")
)

const (
	wsOverlappedWindow = 0x00CF0000
	swpNoSize          = 0x0001
	swpNoMove          = 0x0002
	swpNoZOrder        = 0x0004
	swpNoOwnerZOrder   = 0x0200
	swpFrameChanged    = 0x0020
	swShowNormal       = 1
	swShowMinimized    = 2
	swShowMaximized    = 3
	swRestore          = 9
	wpfRestoreToMax    = 0x0002
	monitorNearest     = 2
	smCxScreen         = 0
	smCyScreen         = 1
	vkMenu             = 0x12
	vkControl          = 0x11
	vkF5               = 0x74
	vkF7               = 0x76
	vkLeft             = 0x25
	vkRight            = 0x27
	vkBrowserBack      = 0xA6
	vkBrowserForward   = 0xA7
	vkBrowserRefresh   = 0xA8
	vkBrowserHome      = 0xAC
	wmSetIcon          = 0x0080
	imageIcon          = 1
	lrDefaultSize      = 0x0040
	mbOK               = 0x00000000
	mbYesNo            = 0x00000004
	mbIconError        = 0x00000010
	mbIconInfo         = 0x00000040
	idYes              = 6
)

var gwlStyle = ^uintptr(15) // GWL_STYLE = -16

func tamanhoDe[T any]() uint32 { var z T; return uint32(unsafe.Sizeof(z)) }

func caixaMensagem(titulo, texto string, flags uintptr) int {
	t, _ := windows.UTF16PtrFromString(texto)
	c, _ := windows.UTF16PtrFromString(titulo)
	r, _, _ := pMessageBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), flags)
	return int(r)
}

func abrirExterno(url string) {
	_ = windows.ShellExecute(0, windows.StringToUTF16Ptr("open"), windows.StringToUTF16Ptr(url), nil, nil, swShowNormal)
}

// ---------- telas ----------

var (
	telasMu  sync.Mutex
	telasAcc []Rect
	telasCb  uintptr
	telasOne sync.Once
)

func listarTelas() []Rect {
	telasMu.Lock()
	defer telasMu.Unlock()
	telasAcc = nil
	telasOne.Do(func() {
		telasCb = windows.NewCallback(func(hmon, hdc, lprc, lparam uintptr) uintptr {
			r := (*rect)(unsafe.Pointer(lprc))
			telasAcc = append(telasAcc, Rect{r.Left, r.Top, r.Right, r.Bottom})
			return 1
		})
	})
	_, _, _ = pEnumDisplayMonitors.Call(0, 0, telasCb, 0)
	out := append([]Rect(nil), telasAcc...)
	// a tela principal é a que tem origem em (0,0): vai para a frente
	for i, t := range out {
		if t.L == 0 && t.T == 0 {
			out[0], out[i] = out[i], out[0]
			break
		}
	}
	return out
}

// ---------- janela ----------

type app struct {
	hwnd        uintptr
	cheia       atomic.Bool
	antes       windowPlacement
	estiloAntes uintptr
	arqEstado   string
}

func (a *app) entrarTelaCheia() {
	if a.cheia.Load() {
		return
	}
	var wp windowPlacement
	wp.Length = tamanhoDe[windowPlacement]()
	if r, _, _ := pGetWindowPlacement.Call(a.hwnd, uintptr(unsafe.Pointer(&wp))); r == 0 {
		return
	}
	hmon, _, _ := pMonitorFromWindow.Call(a.hwnd, monitorNearest)
	var mi monitorInfo
	mi.Size = tamanhoDe[monitorInfo]()
	if r, _, _ := pGetMonitorInfo.Call(hmon, uintptr(unsafe.Pointer(&mi))); r == 0 {
		return
	}
	a.antes = wp
	estilo, _, _ := pGetWindowLongPtr.Call(a.hwnd, gwlStyle)
	a.estiloAntes = estilo
	a.cheia.Store(true)
	_, _, _ = pSetWindowLongPtr.Call(a.hwnd, gwlStyle, estilo&^wsOverlappedWindow)
	_, _, _ = pSetWindowPos.Call(a.hwnd, 0,
		uintptr(mi.Monitor.Left), uintptr(mi.Monitor.Top),
		uintptr(mi.Monitor.Right-mi.Monitor.Left), uintptr(mi.Monitor.Bottom-mi.Monitor.Top),
		swpNoOwnerZOrder|swpFrameChanged)
}

func (a *app) sairTelaCheia() {
	if !a.cheia.Load() {
		return
	}
	_, _, _ = pSetWindowLongPtr.Call(a.hwnd, gwlStyle, a.estiloAntes)
	_, _, _ = pSetWindowPlacement.Call(a.hwnd, uintptr(unsafe.Pointer(&a.antes)))
	_, _, _ = pSetWindowPos.Call(a.hwnd, 0, 0, 0, 0, 0,
		swpNoMove|swpNoSize|swpNoZOrder|swpNoOwnerZOrder|swpFrameChanged)
	// só agora libera o vigia: antes disso a janela ainda tem a geometria da tela cheia
	a.cheia.Store(false)
}

func (a *app) lerEstado() (Estado, bool) {
	var wp windowPlacement
	wp.Length = tamanhoDe[windowPlacement]()
	if r, _, _ := pGetWindowPlacement.Call(a.hwnd, uintptr(unsafe.Pointer(&wp))); r == 0 {
		return Estado{}, false
	}
	max := wp.ShowCmd == swShowMaximized || (wp.ShowCmd == swShowMinimized && wp.Flags&wpfRestoreToMax != 0)
	n := Rect{wp.Normal.Left, wp.Normal.Top, wp.Normal.Right, wp.Normal.Bottom}
	if n.W() < LarguraMinima || n.H() < AlturaMinima {
		return Estado{}, false
	}
	return Estado{Janela: &n, Maximizada: max}, true
}

func (a *app) aplicarEstado(e Estado) {
	if e.Janela == nil {
		return
	}
	r, _ := ajustarRetangulo(*e.Janela, listarTelas())
	cmd := uint32(swShowNormal)
	if e.Maximizada {
		cmd = swShowMaximized
	}
	wp := windowPlacement{ShowCmd: cmd, Normal: rect{r.L, r.T, r.R, r.B}}
	wp.Length = tamanhoDe[windowPlacement]()
	_, _, _ = pSetWindowPlacement.Call(a.hwnd, uintptr(unsafe.Pointer(&wp)))
}

// vigiarJanela grava o estado quando muda (no máximo a cada ~1 s).
func (a *app) vigiarJanela(parar <-chan struct{}) {
	var ultimo Estado
	t := time.NewTicker(1200 * time.Millisecond)
	defer t.Stop()
	for {
		select {
		case <-parar:
			return
		case <-t.C:
		}
		if a.cheia.Load() {
			continue
		}
		e, ok := a.lerEstado()
		if !ok {
			continue
		}
		if ultimo.Janela != nil && *ultimo.Janela == *e.Janela && ultimo.Maximizada == e.Maximizada {
			continue
		}
		if err := salvarEstado(a.arqEstado, e); err != nil {
			log.Printf("não consegui gravar o estado da janela: %v", err)
			continue
		}
		ultimo = e
	}
}

func teclaApertada(vk uintptr) bool {
	r, _, _ := pGetKeyState.Call(vk)
	return int16(r) < 0
}

// teclado devolve true quando a tecla foi tratada aqui (e não deve chegar à página).
// F11 e Alt+Enter NÃO são tratados aqui: passam para a página, que aciona a tela
// cheia do próprio leitor; a janela acompanha pelo evento "fullscreenchange".
func (a *app) teclado(vk uint) bool {
	alt := teclaApertada(vkMenu)
	ctrl := teclaApertada(vkControl)
	switch {
	// teclas de navegador que tirariam o leitor da tela ou recarregariam a página
	case vk == vkF5, vk == vkF7,
		vk == vkBrowserBack, vk == vkBrowserForward, vk == vkBrowserRefresh, vk == vkBrowserHome,
		alt && (vk == vkLeft || vk == vkRight),
		ctrl && (vk == 'R' || vk == 'O' || vk == 'U' || vk == 'P' || vk == 'S'):
		return true
	}
	return false
}

// ---------- preparo ----------

// prepararPagina grava o leitor embutido em <dados>\app\index.html (só quando muda).
func prepararPagina(dados string) (string, error) {
	dir := filepath.Join(dados, "app")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	soma := sha256.Sum256(paginaHTML)
	hexa := hex.EncodeToString(soma[:])
	destino := filepath.Join(dir, "index.html")
	marca := destino + ".sha256"
	if b, err := os.ReadFile(marca); err == nil && strings.TrimSpace(string(b)) == hexa {
		if st, err := os.Stat(destino); err == nil && st.Size() == int64(len(paginaHTML)) {
			return dir, nil
		}
	}
	tmp := destino + ".tmp"
	if err := os.WriteFile(tmp, paginaHTML, 0o644); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, destino); err != nil {
		return "", err
	}
	if err := os.WriteFile(marca, []byte(hexa), 0o644); err != nil {
		return "", err
	}
	return dir, nil
}

func abrirLog(dados string) {
	p := filepath.Join(dados, "ComicXD.log")
	if st, err := os.Stat(p); err == nil && st.Size() > 1<<20 {
		_ = os.Rename(p, p+".antigo")
	}
	if f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		log.SetOutput(f)
	}
	log.SetFlags(log.LstdFlags)
}

func jaAberto(dados string) (liberar func(), outraInstancia bool) {
	soma := sha256.Sum256([]byte(strings.ToLower(dados)))
	nome := `Local\ComicXD.` + hex.EncodeToString(soma[:4])
	h, err := windows.CreateMutex(nil, false, windows.StringToUTF16Ptr(nome))
	if err == windows.ERROR_ALREADY_EXISTS {
		if h != 0 {
			_ = windows.CloseHandle(h)
		}
		return func() {}, true
	}
	if err != nil {
		return func() {}, false // não conseguiu criar o mutex: segue sem trava
	}
	return func() { _ = windows.CloseHandle(h) }, false
}

func trazerJanelaExistente() {
	cls, _ := windows.UTF16PtrFromString("webview")
	tit, _ := windows.UTF16PtrFromString(tituloJanela)
	h, _, _ := pFindWindow.Call(uintptr(unsafe.Pointer(cls)), uintptr(unsafe.Pointer(tit)))
	if h == 0 {
		return
	}
	if ic, _, _ := pIsIconic.Call(h); ic != 0 {
		_, _, _ = pShowWindow.Call(h, swRestore)
	}
	_, _, _ = pSetForegroundWindow.Call(h)
}

// Script injetado em todas as páginas: links externos abrem no navegador do
// Windows e soltar um arquivo na janela não faz o leitor navegar para ele.
const scriptShell = `(function(){
  if (window.__cxdShell) return; window.__cxdShell = 1;
  var own = location.origin;
  function ext(u){ try{ var x = new URL(u, location.href);
    return ((x.protocol==='http:'||x.protocol==='https:') && x.origin!==own) ? x.href : null; }catch(e){ return null; } }
  // links externos abrem no navegador do Windows
  document.addEventListener('click', function(e){
    if (e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u = ext(a.getAttribute('href'));
    if (u && window.comicxdAbrirExterno){ e.preventDefault(); window.comicxdAbrirExterno(u); }
  }, true);
  var wo = window.open;
  window.open = function(u){
    var x = u ? ext(u) : null;
    if (x && window.comicxdAbrirExterno){ window.comicxdAbrirExterno(x); return null; }
    return wo.apply(window, arguments);
  };
  // soltar um arquivo na janela não faz o leitor navegar para ele
  ['dragover','drop'].forEach(function(n){
    window.addEventListener(n, function(e){
      var t = e.dataTransfer && e.dataTransfer.types ? Array.prototype.slice.call(e.dataTransfer.types) : [];
      if (t.indexOf('Files') >= 0) e.preventDefault();
    }, true);
  });
  // tela cheia: F11 / Alt+Enter usam a tela cheia do próprio leitor
  function alternarFS(){
    try{
      if (document.fullscreenElement) document.exitFullscreen().catch(function(){});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(function(){});
    }catch(e){}
  }
  var ultSaida = 0;
  document.addEventListener('keydown', function(e){
    if (e.key === 'F11' || (e.key === 'Enter' && e.altKey)){ e.preventDefault(); e.stopPropagation(); alternarFS(); return; }
    if (e.key === 'Escape'){
      if (document.fullscreenElement){ e.stopImmediatePropagation(); document.exitFullscreen().catch(function(){}); }
      else if (Date.now() - ultSaida < 400){ e.stopImmediatePropagation(); } // Esc que acabou de sair da tela cheia não volta à biblioteca
    }
  }, true);
  // a janela do Windows acompanha a tela cheia da página
  document.addEventListener('fullscreenchange', function(){
    var on = !!document.fullscreenElement;
    if (!on) ultSaida = Date.now();
    if (window.comicxdJanelaCheia) window.comicxdJanelaCheia(on);
  });
  window.ComicXDDesktop = { versao: %q, telaCheia: alternarFS };
})();`

func init() { runtime.LockOSThread() } // a janela precisa viver numa única thread

func main() {
	var pastaDadosFlag, finalDesinst, feedTeste string
	var desinst, depurar, semAtualizar bool
	fs := flag.NewFlagSet("ComicXD", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.StringVar(&pastaDadosFlag, "dados", "", "pasta de dados (padrão: automática)")
	fs.BoolVar(&desinst, "desinstalar", false, "desinstalar (só instalação feita pelo instalador)")
	fs.StringVar(&finalDesinst, "desinstalar-final", "", "uso interno do desinstalador")
	fs.BoolVar(&depurar, "depurar", false, "liga as ferramentas de desenvolvedor (F12 / clique direito > Inspecionar)")
	fs.BoolVar(&semAtualizar, "sem-atualizar", false, "não procura versões novas")
	fs.StringVar(&feedTeste, "feed", "", "uso em testes: arquivo JSON local no lugar do GitHub")
	_ = fs.Parse(os.Args[1:]) // argumento desconhecido (ex.: caminho de arquivo) é ignorado por enquanto

	exe, err := os.Executable()
	if err != nil {
		caixaMensagem("ComicXD", "Não consegui descobrir onde o ComicXD está.\n"+err.Error(), mbOK|mbIconError)
		return
	}
	pastaExe := filepath.Dir(exe)

	if finalDesinst != "" {
		concluirDesinstalacao(finalDesinst)
		return
	}
	if desinst {
		iniciarDesinstalacao(pastaExe)
		return
	}
	_ = os.Remove(exe + ".old") // sobra de uma atualização feita com o app aberto

	dados := pastaDadosFlag
	portatil := false
	if dados == "" {
		_, errInst := os.Stat(filepath.Join(pastaExe, "instalado.txt"))
		dados, portatil = escolherPastaDados(pastaExe, os.Getenv("LOCALAPPDATA"), errInst == nil, pastaGravavel)
	}
	if err := os.MkdirAll(dados, 0o755); err != nil {
		caixaMensagem("ComicXD", "Não consegui criar a pasta de dados:\n"+dados+"\n\n"+err.Error(), mbOK|mbIconError)
		return
	}
	abrirLog(dados)
	log.Printf("=== ComicXD %s | exe=%s | dados=%s | portátil=%v | depurar=%v", versaoApp, exe, dados, portatil, depurar)

	defer func() {
		if r := recover(); r != nil {
			log.Printf("ERRO FATAL: %v", r)
			caixaMensagem("ComicXD", fmt.Sprintf("O ComicXD encontrou um erro e vai fechar.\n\n%v\n\nDetalhes em:\n%s", r, filepath.Join(dados, "ComicXD.log")), mbOK|mbIconError)
		}
	}()

	// registrado ANTES de "liberar": roda depois dele (defers são LIFO), já com a instância única liberada
	defer reabrirSeAtualizado(argsSemFeed(os.Args[1:]))
	liberar, outra := jaAberto(dados)
	defer liberar()
	if outra {
		log.Printf("já existe uma janela aberta; trazendo para a frente")
		trazerJanelaExistente()
		return
	}

	pastaPagina, err := prepararPagina(dados)
	if err != nil {
		log.Printf("preparar página: %v", err)
		caixaMensagem("ComicXD", "Não consegui preparar os arquivos do leitor em:\n"+dados+"\n\n"+err.Error(), mbOK|mbIconError)
		return
	}

	arqEstado := filepath.Join(dados, "janela.json")
	est := carregarEstado(arqEstado)

	telaW, _, _ := pGetSystemMetrics.Call(smCxScreen)
	telaH, _, _ := pGetSystemMetrics.Call(smCyScreen)
	largura, altura := tamanhoPadrao(int32(telaW), int32(telaH))
	if est.Janela != nil {
		largura, altura = est.Janela.W(), est.Janela.H()
	}

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     depurar,
		AutoFocus: true,
		DataPath:  filepath.Join(dados, "WebView2"),
		WindowOptions: webview2.WindowOptions{
			Title:  tituloJanela,
			Width:  uint(largura),
			Height: uint(altura),
			IconId: iconeID,
			Center: est.Janela == nil,
		},
	})
	if w == nil {
		log.Printf("WebView2 indisponível (NewWithOptions devolveu nil)")
		if caixaMensagem("ComicXD", "O ComicXD precisa do componente \"Microsoft Edge WebView2 Runtime\", que não foi encontrado neste computador.\n\n"+
			"Ele é gratuito e oficial da Microsoft. Abrir a página de download agora?", mbYesNo|mbIconInfo) == idYes {
			abrirExterno(urlRuntime)
		}
		return
	}
	defer w.Destroy()

	a := &app{hwnd: uintptr(w.Window()), arqEstado: arqEstado}
	colocarIcone(a.hwnd)
	a.aplicarEstado(est)

	motor := webview2.Chromium(w)
	if motor == nil {
		log.Printf("não consegui acessar o motor do WebView2")
		caixaMensagem("ComicXD", "Falha ao iniciar o navegador embutido.", mbOK|mbIconError)
		return
	}
	configurarMotor(motor)

	// origem fixa https://comicxd.local/ -> pasta <dados>\app
	v3 := motor.GetICoreWebView2_3()
	if v3 == nil {
		log.Printf("WebView2 Runtime antigo (sem ICoreWebView2_3)")
		if caixaMensagem("ComicXD", "A versão do \"Microsoft Edge WebView2 Runtime\" deste computador é antiga demais.\n\nAbrir a página de download da versão atual?", mbYesNo|mbIconInfo) == idYes {
			abrirExterno(urlRuntime)
		}
		return
	}
	if hr, err := v3.MapearHost(hostVirtual, pastaPagina, edge.COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW); err != nil || hr < 0 {
		log.Printf("mapeamento do host virtual falhou: hresult=0x%08X err=%v", uint32(hr), err)
		caixaMensagem("ComicXD", fmt.Sprintf("Não consegui abrir o leitor (erro 0x%08X).\n\nDetalhes em:\n%s", uint32(hr), filepath.Join(dados, "ComicXD.log")), mbOK|mbIconError)
		return
	}
	log.Printf("leitor mapeado: %s -> %s", urlInicial, pastaPagina)

	w.SetSize(LarguraMinima, AlturaMinima, webview2.HintMin)
	motor.AcceleratorKeyCallback = a.teclado

	_ = w.Bind("comicxdAbrirExterno", func(url string) bool {
		if strings.HasPrefix(url, "https://") || strings.HasPrefix(url, "http://") {
			abrirExterno(url)
			return true
		}
		return false
	})
	_ = w.Bind("comicxdJanelaCheia", func(ligar bool) {
		if ligar {
			a.entrarTelaCheia()
		} else {
			a.sairTelaCheia()
		}
	})
	w.Init(fmt.Sprintf(scriptShell, versaoApp))

	parar := make(chan struct{})
	go a.vigiarJanela(parar)
	iniciarAtualizacao(w, opcoesAtualizacao{dados: dados, exe: exe, pastaExe: pastaExe, feed: feedTeste, desligado: semAtualizar, argsReabrir: os.Args[1:]})

	w.Navigate(urlInicial)
	w.Run()

	close(parar)
	log.Printf("encerrado normalmente")
}

func configurarMotor(m *edge.Chromium) {
	st, err := m.GetSettings()
	if err != nil || st == nil {
		log.Printf("settings indisponíveis: %v", err)
		return
	}
	// somente propriedades da interface base do WebView2 (seguras em qualquer versão)
	if err := st.PutIsZoomControlEnabled(false); err != nil {
		log.Printf("zoom: %v", err)
	}
	if err := st.PutIsStatusBarEnabled(false); err != nil {
		log.Printf("barra de status: %v", err)
	}
}

// colocarIcone força o ícone da janela/barra de tarefas a partir do recurso do .exe.
func colocarIcone(hwnd uintptr) {
	var hinst windows.Handle
	if err := windows.GetModuleHandleEx(0, nil, &hinst); err != nil || hinst == 0 {
		return
	}
	grande, _, _ := pLoadImage.Call(uintptr(hinst), iconeID, imageIcon, 0, 0, lrDefaultSize)
	pequeno, _, _ := pLoadImage.Call(uintptr(hinst), iconeID, imageIcon, 16, 16, 0)
	if grande != 0 {
		_, _, _ = pSendMessage.Call(hwnd, wmSetIcon, 1, grande)
	}
	if pequeno != 0 {
		_, _, _ = pSendMessage.Call(hwnd, wmSetIcon, 0, pequeno)
	}
}

// argsSemFeed repassa os argumentos ao reabrir, menos o --feed (só de teste).
func argsSemFeed(args []string) []string {
	var r []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--feed" || a == "-feed" {
			i++
			continue
		}
		if strings.HasPrefix(a, "--feed=") || strings.HasPrefix(a, "-feed=") {
			continue
		}
		r = append(r, a)
	}
	return r
}
