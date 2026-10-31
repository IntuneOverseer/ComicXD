//go:build windows

package main

// Cola do atualizador com o Windows: pergunta ao usuário, aplica (portable ou
// instalado) e reinicia o app. A lógica de decisão e verificação está em
// atualizar.go (testada em Linux).

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"comicxd-windows/internal/inst"

	webview2 "github.com/jchv/go-webview2"
)

const (
	arqUltimaConsulta = "ultima-consulta-atualizacao.txt"
	arqSemAtualizar   = "sem-atualizar.txt"
	arqUltimaOferta   = "ultima-oferta-atualizacao.txt" // versão cuja janela de pergunta já foi mostrada
	paginaReleases    = "https://github.com/IntuneOverseer/ComicXD/releases"
)

// reiniciarExe é preenchido quando uma atualização foi aplicada: depois que a
// janela fechar e o "mutex" de instância única for liberado, main() reabre o app.
var reiniciarExe atomic.Value // string

// Atualização encontrada e ainda não aplicada: o leitor mostra o botão fixo no topo enquanto houver.
var (
	pendMu    sync.Mutex
	pendUpd   *Atualizacao
	pendBusca fonteFn
	pendOpts  opcoesAtualizacao
	pendWV    webview2.WebView
	aplicando atomic.Bool
)

func versaoPendente() string {
	pendMu.Lock()
	defer pendMu.Unlock()
	if pendUpd == nil {
		return ""
	}
	return pendUpd.Versao
}

type opcoesAtualizacao struct {
	dados, exe, pastaExe string
	feed                 string // só para teste: JSON local
	desligado            bool   // --sem-atualizar
	argsReabrir          []string
}

func (o opcoesAtualizacao) instaladoNoPadrao() bool {
	if _, err := os.Stat(filepath.Join(o.pastaExe, inst.NomeMarca)); err != nil {
		return false
	}
	return strings.EqualFold(filepath.Clean(o.pastaExe), filepath.Clean(inst.PastaInstalacaoPadrao()))
}

// iniciarAtualizacao roda em segundo plano: nunca trava nem derruba o app.
func iniciarAtualizacao(w webview2.WebView, o opcoesAtualizacao) {
	// O leitor pergunta "há versão nova?" e, ao clicar no botão, pede para atualizar agora.
	// (os dois voltam na hora: o que demora roda em outra goroutine)
	_ = w.Bind("comicxdAtualizacao", func() string { return versaoPendente() })
	_ = w.Bind("comicxdAtualizarAgora", func() {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("atualizador: erro inesperado no botão: %v", r)
				}
			}()
			ofertarEAplicar()
		}()
	})
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("atualizador: erro inesperado: %v", r)
			}
		}()
		_ = os.RemoveAll(filepath.Join(o.dados, "atualizacao")) // sobra de atualização anterior
		if o.desligado {
			log.Printf("atualizador: desligado por --sem-atualizar")
			return
		}
		if _, err := os.Stat(filepath.Join(o.dados, arqSemAtualizar)); err == nil {
			log.Printf("atualizador: desligado pelo arquivo %s", arqSemAtualizar)
			return
		}
		time.Sleep(6 * time.Second) // deixa a janela abrir primeiro
		rodarAtualizacao(w, o)
		// app deixado aberto por horas: confere de novo de tempos em tempos (a pergunta só volta se for versão nova)
		for {
			time.Sleep(30 * time.Minute)
			rodarAtualizacao(w, o)
		}
	}()
}

func rodarAtualizacao(w webview2.WebView, o opcoesAtualizacao) {
	arqUlt := filepath.Join(o.dados, arqUltimaConsulta)
	if o.feed == "" && !deveConsultar(arqUlt, time.Now()) {
		log.Printf("atualizador: consulta recente, nada a fazer")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var rels []release
	var busca fonteFn
	hostOK := hostPermitido
	var err error
	if o.feed != "" {
		rels, err = lerFeedTeste(o.feed)
		busca = fonteLocal(filepath.Dir(o.feed))
		hostOK = func(string) bool { return true }
		log.Printf("atualizador: MODO TESTE, feed=%s", o.feed)
	} else {
		cli := novoClienteHTTP(hostPermitidoRedirect)
		rels, err = buscarReleases(ctx, cli, urlReleases)
		busca = fonteHTTP(cli)
	}
	if err != nil {
		log.Printf("atualizador: não consegui consultar as versões: %v", err)
		return // sem internet etc.: silencioso, tenta de novo na próxima abertura
	}
	if o.feed == "" {
		marcarConsulta(arqUlt, time.Now())
	}
	u := escolherAtualizacao(rels, versaoApp, hostOK)
	if u == nil {
		log.Printf("atualizador: %s é a versão mais nova", versaoApp)
		return
	}
	log.Printf("atualizador: encontrada %s (atual %s)", u.Versao, versaoApp)

	pendMu.Lock()
	pendUpd, pendBusca, pendOpts, pendWV = u, busca, o, w
	pendMu.Unlock()

	// A pergunta aparece sozinha uma vez por versão; depois disso o botão no topo do leitor continua
	// lá até você atualizar (ou clicar nele para ser perguntado de novo).
	arqOf := filepath.Join(o.dados, arqUltimaOferta)
	if b, err := os.ReadFile(arqOf); err == nil && strings.TrimSpace(string(b)) == u.Versao {
		log.Printf("atualizador: %s já foi oferecida; botão fica visível no leitor", u.Versao)
		return
	}
	_ = os.WriteFile(arqOf, []byte(u.Versao), 0o644)
	ofertarEAplicar()
}

// ofertarEAplicar pergunta, baixa, confere o SHA-256, troca o programa e pede para reabrir.
// Pode ser chamada pela pergunta automática ou pelo botão do leitor; só roda uma por vez.
func ofertarEAplicar() {
	pendMu.Lock()
	u, busca, o, w := pendUpd, pendBusca, pendOpts, pendWV
	pendMu.Unlock()
	if u == nil {
		return
	}
	if !aplicando.CompareAndSwap(false, true) {
		log.Printf("atualizador: já há uma atualização em andamento")
		return
	}
	defer aplicando.Store(false)

	como := "Ele será baixado, conferido e instalado por cima desta pasta."
	if o.instaladoNoPadrao() {
		como = "Ele será baixado, conferido e instalado por cima da instalação atual."
	}
	if caixaMensagem("ComicXD - atualização",
		fmt.Sprintf("Há uma versão nova do ComicXD para Windows: %s (você usa a %s).\n\n%s\nSua biblioteca e seu progresso de leitura são mantidos, e o ComicXD reabre sozinho.\n\nAtualizar agora?", u.Versao, versaoApp, como),
		mbYesNo|mbIconInfo) != idYes {
		log.Printf("atualizador: usuário adiou")
		return
	}

	ctxDown, cancelDown := context.WithTimeout(context.Background(), 8*time.Minute)
	defer cancelDown()
	if err := aplicarAtualizacao(ctxDown, busca, u, o); err != nil {
		log.Printf("atualizador: FALHOU: %v", err)
		if caixaMensagem("ComicXD - atualização",
			"Não consegui atualizar automaticamente:\n\n"+err.Error()+"\n\nNada foi alterado na versão atual. Abrir a página de downloads para atualizar manualmente?",
			mbYesNo|mbIconError) == idYes {
			abrirExterno(paginaReleases)
		}
		return
	}
	log.Printf("atualizador: %s aplicada; reiniciando", u.Versao)
	reiniciarExe.Store(o.exe)
	w.Dispatch(func() { w.Terminate() })
}

func aplicarAtualizacao(ctx context.Context, busca fonteFn, u *Atualizacao, o opcoesAtualizacao) error {
	if o.instaladoNoPadrao() {
		return aplicarViaSetup(ctx, busca, u, o)
	}
	bin, _, err := baixarVerificado(ctx, busca, u.Portatil, u.Hashes)
	if err != nil {
		return err
	}
	if err := substituirExe(o.exe, bin); err != nil {
		return fmt.Errorf("%w\n\n(A pasta do programa precisa permitir gravação.)", err)
	}
	return nil
}

func aplicarViaSetup(ctx context.Context, busca fonteFn, u *Atualizacao, o opcoesAtualizacao) error {
	setupBin, _, err := baixarVerificado(ctx, busca, u.Setup, u.Hashes)
	if err != nil {
		return err
	}
	// o Setup instala o mesmo programa do "portable": o hash dele é o esperado em disco depois
	txt, err := busca(ctx, u.Hashes.URL, limiteHash)
	if err != nil {
		return err
	}
	esperado, err := hashDoArquivo(txt, u.Portatil.Nome)
	if err != nil {
		return err
	}
	pasta, err := pastaTemporariaAtualizacao(o.dados)
	if err != nil {
		return err
	}
	setup := filepath.Join(pasta, "ComicXD-Setup.exe")
	if err := os.WriteFile(setup, setupBin, 0o755); err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, setup, "/S")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("o instalador falhou: %v %s", err, string(out))
	}
	instalado, err := os.ReadFile(o.exe)
	if err != nil {
		return fmt.Errorf("não consegui conferir o programa instalado: %w", err)
	}
	if got := sha256Hex(instalado); got != esperado {
		return fmt.Errorf("depois da instalação o programa não confere com o esperado (%s)", got[:12])
	}
	return nil
}

// reabrirSeAtualizado é chamado por main() DEPOIS de liberar a instância única.
func reabrirSeAtualizado(args []string) {
	v, _ := reiniciarExe.Load().(string)
	if v == "" {
		return
	}
	time.Sleep(900 * time.Millisecond) // deixa o processo antigo soltar a pasta do WebView2
	cmd := exec.Command(v, args...)
	cmd.Dir = filepath.Dir(v)
	if err := cmd.Start(); err != nil {
		log.Printf("atualizador: não consegui reabrir: %v", err)
		caixaMensagem("ComicXD", "O ComicXD foi atualizado. Abra-o de novo pelo atalho.\n\n"+err.Error(), mbOK|mbIconInfo)
		return
	}
	log.Printf("atualizador: novo processo iniciado (pid %d)", cmd.Process.Pid)
}
