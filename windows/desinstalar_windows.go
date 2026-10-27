//go:build windows

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"comicxd-windows/internal/inst"
)

func existeArquivo(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// iniciarDesinstalacao roda dentro da pasta instalada: confirma com o usuário e
// reexecuta uma CÓPIA de si mesmo a partir de %TEMP% (um .exe em uso não consegue
// apagar a própria pasta).
func iniciarDesinstalacao(pastaExe string) {
	reg, _ := inst.LocalInstalado()
	if !pastaInstalacaoValida(pastaExe, reg, existeArquivo) {
		caixaMensagem("Desinstalar ComicXD", "Este ComicXD não parece ter sido instalado pelo instalador, então não vou apagar nada.\n\n"+
			"Se você usa a versão portátil, é só apagar a pasta do programa.", mbOK|mbIconInfo)
		return
	}
	if caixaMensagem("Desinstalar ComicXD", "Desinstalar o ComicXD deste computador?\n\nSeus quadrinhos e progresso serão perguntados na próxima etapa.", mbYesNo|mbIconInfo) != idYes {
		return
	}
	exe, err := os.Executable()
	if err != nil {
		caixaMensagem("Desinstalar ComicXD", err.Error(), mbOK|mbIconError)
		return
	}
	tmp := filepath.Join(os.TempDir(), fmt.Sprintf("ComicXD-desinstalar-%d.exe", os.Getpid()))
	dados, err := os.ReadFile(exe)
	if err == nil {
		err = os.WriteFile(tmp, dados, 0o755)
	}
	if err != nil {
		caixaMensagem("Desinstalar ComicXD", "Não consegui preparar o desinstalador:\n"+err.Error(), mbOK|mbIconError)
		return
	}
	cmd := exec.Command(tmp, "--desinstalar-final", pastaExe)
	if err := cmd.Start(); err != nil {
		caixaMensagem("Desinstalar ComicXD", "Não consegui iniciar o desinstalador:\n"+err.Error(), mbOK|mbIconError)
		return
	}
}

// concluirDesinstalacao roda a partir da cópia em %TEMP%.
func concluirDesinstalacao(pasta string) {
	self, _ := os.Executable()
	defer autoApagar(self)

	reg, _ := inst.LocalInstalado()
	if !pastaInstalacaoValida(pasta, reg, existeArquivo) {
		caixaMensagem("Desinstalar ComicXD", "Pasta de instalação não confere com o registro; nada foi apagado.", mbOK|mbIconError)
		return
	}
	apagarDados := caixaMensagem("Desinstalar ComicXD",
		"Apagar também a sua biblioteca, o progresso de leitura e as preferências deste computador?\n\n"+
			"Sim = apagar tudo (não dá para desfazer)\nNão = manter (recomendado; se instalar de novo, tudo volta)", mbYesNo|mbIconInfo) == idYes

	var avisos []string

	// 1) o .exe (se estiver em uso, o Windows recusa: pedimos para fechar)
	exeApp := filepath.Join(pasta, inst.NomeExe)
	if err := os.Remove(exeApp); err != nil && !os.IsNotExist(err) {
		caixaMensagem("Desinstalar ComicXD", "O ComicXD parece estar aberto. Feche-o e rode a desinstalação de novo.\n\n"+err.Error(), mbOK|mbIconError)
		return
	}
	// 2) atalhos
	if p, err := inst.CaminhoAtalhoMenuIniciar(); err == nil {
		_ = os.Remove(p)
	}
	if p, err := inst.CaminhoAtalhoAreaDeTrabalho(); err == nil {
		_ = os.Remove(p)
	}
	// 3) registro
	if err := inst.RemoverRegistro(); err != nil {
		avisos = append(avisos, "Não consegui limpar o registro do Windows: "+err.Error())
	}
	// 4) pasta de instalação (tudo o que está dentro dela é do instalador)
	if err := os.RemoveAll(pasta); err != nil {
		avisos = append(avisos, "Sobrou a pasta "+pasta+": "+err.Error())
	}
	// 5) dados (opcional)
	if apagarDados {
		d := inst.PastaDadosInstalado()
		if strings.EqualFold(filepath.Base(d), "ComicXD") && filepath.Dir(d) != d {
			if err := os.RemoveAll(d); err != nil {
				avisos = append(avisos, "Não consegui apagar os dados em "+d+": "+err.Error())
			}
		}
	}
	msg := "ComicXD desinstalado."
	if !apagarDados {
		msg += "\n\nSua biblioteca e progresso foram mantidos."
	}
	if len(avisos) > 0 {
		msg += "\n\nAvisos:\n- " + strings.Join(avisos, "\n- ")
	}
	log.Printf("desinstalação concluída: %v", avisos)
	caixaMensagem("Desinstalar ComicXD", msg, mbOK|mbIconInfo)
}

// autoApagar remove a cópia temporária depois que este processo terminar.
func autoApagar(caminho string) {
	if !strings.Contains(strings.ToLower(filepath.Base(caminho)), "comicxd-desinstalar-") {
		return
	}
	cmd := exec.Command("cmd.exe", "/c", "ping -n 3 127.0.0.1 >nul & del /f /q \""+caminho+"\"")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	_ = cmd.Start()
}
