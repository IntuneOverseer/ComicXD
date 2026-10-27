package main

import (
	"path/filepath"
	"strings"
)

// pastaInstalacaoValida protege o desinstalador: ele só apaga uma pasta que
// (1) é exatamente a registrada na instalação, (2) se chama "ComicXD" e não é
// a raiz de um disco, e (3) contém os dois arquivos que a instalação grava.
func pastaInstalacaoValida(dir, registrada string, existe func(string) bool) bool {
	if dir == "" || registrada == "" {
		return false
	}
	d := filepath.Clean(dir)
	r := filepath.Clean(registrada)
	if !strings.EqualFold(d, r) {
		return false
	}
	if !filepath.IsAbs(d) || filepath.Dir(d) == d { // relativa ou raiz do disco
		return false
	}
	if !strings.EqualFold(filepath.Base(d), "ComicXD") {
		return false
	}
	return existe(filepath.Join(d, "ComicXD.exe")) && existe(filepath.Join(d, "instalado.txt"))
}
