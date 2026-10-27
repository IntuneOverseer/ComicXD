package main

import "testing"

func TestPastaInstalacaoValida(t *testing.T) {
	tem := func(ps ...string) func(string) bool {
		return func(p string) bool {
			for _, x := range ps {
				if p == x {
					return true
				}
			}
			return false
		}
	}
	d := "/u/AppData/Local/Programs/ComicXD"
	completo := tem(d+"/ComicXD.exe", d+"/instalado.txt")
	casos := []struct {
		nome     string
		dir, reg string
		existe   func(string) bool
		esperado bool
	}{
		{"ok", d, d, completo, true},
		{"ok com barra final e caixa", d + "/", d, completo, true},
		{"registro diferente", d, "/u/outro/ComicXD", completo, false},
		{"nome errado", "/u/Programs/Outro", "/u/Programs/Outro", tem("/u/Programs/Outro/ComicXD.exe", "/u/Programs/Outro/instalado.txt"), false},
		{"raiz", "/", "/", tem("/ComicXD.exe", "/instalado.txt"), false},
		{"faltando marca", d, d, tem(d + "/ComicXD.exe"), false},
		{"faltando exe", d, d, tem(d + "/instalado.txt"), false},
		{"vazio", "", d, completo, false},
		{"sem registro", d, "", completo, false},
		{"relativa", "ComicXD", "ComicXD", tem("ComicXD/ComicXD.exe", "ComicXD/instalado.txt"), false},
	}
	for _, c := range casos {
		if got := pastaInstalacaoValida(c.dir, c.reg, c.existe); got != c.esperado {
			t.Errorf("%s: esperado %v, veio %v", c.nome, c.esperado, got)
		}
	}
}
