//go:build windows

// ComicXD-Setup: instala o ComicXD só para o usuário atual (não pede administrador).
//
//	ComicXD-Setup.exe        instalação com perguntas
//	ComicXD-Setup.exe /S     instalação silenciosa (atalho no Menu Iniciar, sem atalho na Área de Trabalho)
package main

import (
	"bytes"
	"compress/gzip"
	_ "embed"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"unsafe"

	"comicxd-windows/internal/inst"

	"golang.org/x/sys/windows"
)

//go:embed ComicXD.exe.gz
var appGz []byte

var versao = "0.70-teste1"

var (
	user32      = windows.NewLazySystemDLL("user32.dll")
	pMessageBox = user32.NewProc("MessageBoxW")
	mbOK        = uintptr(0x0)
	mbYesNo     = uintptr(0x4)
	mbIconError = uintptr(0x10)
	mbIconInfo  = uintptr(0x40)
	idYes       = 6
	silencioso  bool
	tituloSetup = "Instalar ComicXD"
)

func caixa(titulo, texto string, flags uintptr) int {
	if silencioso {
		log.Printf("[%s] %s", titulo, texto)
		if flags&mbYesNo != 0 {
			return idYes
		}
		return 1
	}
	t, _ := windows.UTF16PtrFromString(texto)
	c, _ := windows.UTF16PtrFromString(titulo)
	r, _, _ := pMessageBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), flags)
	return int(r)
}

func init() { runtime.LockOSThread() }

func main() {
	for _, a := range os.Args[1:] {
		switch strings.ToLower(a) {
		case "/s", "-s", "--silencioso", "/silent", "--silent":
			silencioso = true
		}
	}
	if f, err := os.OpenFile(filepath.Join(os.TempDir(), "ComicXD-Setup.log"), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644); err == nil {
		log.SetOutput(f)
	}
	log.Printf("ComicXD-Setup %s | silencioso=%v", versao, silencioso)

	dir := inst.PastaInstalacaoPadrao()
	if os.Getenv("LOCALAPPDATA") == "" {
		caixa(tituloSetup, "Não encontrei a pasta do seu perfil (LOCALAPPDATA). Não dá para instalar.", mbOK|mbIconError)
		return
	}

	if !silencioso {
		if caixa(tituloSetup, "Instalar o ComicXD "+versao+" neste computador?\n\n"+
			"Pasta: "+dir+"\n\nÉ só para o seu usuário e não precisa de administrador.\n"+
			"Se já houver uma versão instalada, ela será atualizada e sua biblioteca é mantida.", mbYesNo|mbIconInfo) != idYes {
			return
		}
	}
	desktop := false
	if !silencioso {
		desktop = caixa(tituloSetup, "Criar também um atalho na Área de Trabalho?\n\n(O atalho no Menu Iniciar será criado de qualquer forma.)", mbYesNo|mbIconInfo) == idYes
	}

	avisos, err := instalar(dir, desktop)
	if err != nil {
		log.Printf("ERRO: %v", err)
		caixa(tituloSetup, "A instalação não terminou:\n\n"+err.Error()+"\n\nDetalhes em:\n"+filepath.Join(os.TempDir(), "ComicXD-Setup.log"), mbOK|mbIconError)
		return
	}
	msg := "ComicXD instalado com sucesso!"
	if len(avisos) > 0 {
		msg += "\n\nAvisos:\n- " + strings.Join(avisos, "\n- ")
	}
	if silencioso {
		log.Printf("%s", msg)
		return
	}
	msg += "\n\nAbrir o ComicXD agora?"
	if caixa(tituloSetup, msg, mbYesNo|mbIconInfo) == idYes {
		_ = windows.ShellExecute(0, windows.StringToUTF16Ptr("open"), windows.StringToUTF16Ptr(filepath.Join(dir, inst.NomeExe)), nil, windows.StringToUTF16Ptr(dir), 1)
	}
}

func instalar(dir string, desktop bool) (avisos []string, err error) {
	zr, err := gzip.NewReader(bytes.NewReader(appGz))
	if err != nil {
		return nil, fmt.Errorf("pacote interno inválido: %w", err)
	}
	exeBytes, err := io.ReadAll(zr)
	if err != nil {
		return nil, fmt.Errorf("pacote interno inválido: %w", err)
	}
	if len(exeBytes) < 1<<20 || string(exeBytes[:2]) != "MZ" {
		return nil, fmt.Errorf("pacote interno não parece um programa do Windows")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("não consegui criar a pasta %s: %w", dir, err)
	}

	destino := filepath.Join(dir, inst.NomeExe)
	novo := destino + ".novo"
	if err := os.WriteFile(novo, exeBytes, 0o755); err != nil {
		return nil, fmt.Errorf("não consegui gravar o programa: %w", err)
	}
	// Atualização com o app aberto: o Windows deixa RENOMEAR um .exe em uso (não apagar).
	if _, e := os.Stat(destino); e == nil {
		velho := destino + ".old"
		_ = os.Remove(velho)
		if err := os.Rename(destino, velho); err != nil {
			_ = os.Remove(novo)
			return nil, fmt.Errorf("não consegui substituir a versão instalada (o ComicXD está aberto?). Feche-o e tente de novo.\n%w", err)
		}
	}
	if err := os.Rename(novo, destino); err != nil {
		return nil, fmt.Errorf("não consegui finalizar a gravação do programa: %w", err)
	}
	_ = os.Remove(destino + ".old")
	log.Printf("programa gravado em %s (%d bytes)", destino, len(exeBytes))

	if err := os.WriteFile(filepath.Join(dir, inst.NomeMarca),
		[]byte("Este arquivo diz ao ComicXD que ele foi instalado: biblioteca e progresso ficam em %LOCALAPPDATA%\\ComicXD.\r\nNão apague.\r\n"), 0o644); err != nil {
		return nil, fmt.Errorf("não consegui gravar a marca de instalação: %w", err)
	}

	if p, e := inst.CaminhoAtalhoMenuIniciar(); e != nil {
		avisos = append(avisos, "Menu Iniciar: "+e.Error())
	} else if e := inst.CriarAtalho(p, destino, dir, "ComicXD - leitor de HQ, mangá e webtoon"); e != nil {
		avisos = append(avisos, "Não consegui criar o atalho do Menu Iniciar: "+e.Error())
	} else {
		log.Printf("atalho: %s", p)
	}
	if desktop {
		if p, e := inst.CaminhoAtalhoAreaDeTrabalho(); e != nil {
			avisos = append(avisos, "Área de Trabalho: "+e.Error())
		} else if e := inst.CriarAtalho(p, destino, dir, "ComicXD - leitor de HQ, mangá e webtoon"); e != nil {
			avisos = append(avisos, "Não consegui criar o atalho da Área de Trabalho: "+e.Error())
		} else {
			log.Printf("atalho: %s", p)
		}
	}
	if e := inst.RegistrarDesinstalacao(dir, versao, uint32(len(exeBytes)/1024)); e != nil {
		avisos = append(avisos, "Não consegui registrar a desinstalação em \"Aplicativos instalados\": "+e.Error())
	}
	return avisos, nil
}
