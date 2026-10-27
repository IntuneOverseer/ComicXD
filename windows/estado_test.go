package main

import (
	"os"
	"path/filepath"
	"testing"
)

var tela1 = Rect{0, 0, 1920, 1080}
var tela2 = Rect{1920, 0, 3840, 1080}

func TestAjustarVisivelNaoMuda(t *testing.T) {
	r := Rect{100, 100, 1300, 900}
	got, mudou := ajustarRetangulo(r, []Rect{tela1})
	if mudou || got != r {
		t.Fatalf("não devia mudar: %v %v", got, mudou)
	}
}

func TestAjustarSegundoMonitor(t *testing.T) {
	r := Rect{2000, 50, 3200, 900}
	if _, mudou := ajustarRetangulo(r, []Rect{tela1, tela2}); mudou {
		t.Fatal("janela no 2º monitor é válida")
	}
}

func TestAjustarMonitorRemovido(t *testing.T) {
	// estava no 2º monitor, que não existe mais
	r := Rect{2000, 50, 3200, 900}
	got, mudou := ajustarRetangulo(r, []Rect{tela1})
	if !mudou {
		t.Fatal("devia corrigir")
	}
	if got.L < 0 || got.R > 1920 || got.T < 0 || got.B > 1080 {
		t.Fatalf("fora da tela: %v", got)
	}
	if got.W() != 1200 || got.H() != 850 {
		t.Fatalf("tamanho devia ser mantido (cabe na tela): %v", got)
	}
}

func TestAjustarTituloAcimaDaTela(t *testing.T) {
	r := Rect{100, -500, 1300, 300} // barra de título fora da tela, inalcançável
	if _, mudou := ajustarRetangulo(r, []Rect{tela1}); !mudou {
		t.Fatal("barra de título inalcançável devia ser corrigida")
	}
}

func TestAjustarMaiorQueATela(t *testing.T) {
	r := Rect{5000, 5000, 9000, 8000}
	got, mudou := ajustarRetangulo(r, []Rect{{0, 0, 1366, 768}})
	if !mudou || got.W() > 1366*92/100 || got.H() > 768*92/100 || got.L < 0 || got.T < 0 {
		t.Fatalf("não coube: %v", got)
	}
}

func TestAjustarSemTelas(t *testing.T) {
	r := Rect{1, 2, 700, 500}
	got, mudou := ajustarRetangulo(r, nil)
	if mudou || got != r {
		t.Fatal("sem telas, não mexe")
	}
}

func TestTamanhoPadrao(t *testing.T) {
	if w, h := tamanhoPadrao(2560, 1440); w != 1280 || h != 860 {
		t.Fatalf("%d x %d", w, h)
	}
	if w, h := tamanhoPadrao(1366, 768); w != 1161 || h != 652 {
		t.Fatalf("%d x %d", w, h)
	}
	if w, h := tamanhoPadrao(400, 300); w != LarguraMinima || h != AlturaMinima {
		t.Fatalf("%d x %d", w, h)
	}
}

func TestEstadoIdaEVolta(t *testing.T) {
	d := t.TempDir()
	c := filepath.Join(d, "janela.json")
	in := Estado{Janela: &Rect{10, 20, 1210, 880}, Maximizada: true}
	if err := salvarEstado(c, in); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(c + ".tmp"); err == nil {
		t.Fatal("sobrou arquivo temporário")
	}
	out := carregarEstado(c)
	if out.Janela == nil || *out.Janela != *in.Janela || !out.Maximizada {
		t.Fatalf("%+v", out)
	}
}

func TestEstadoCorrompidoOuInvalido(t *testing.T) {
	d := t.TempDir()
	c := filepath.Join(d, "janela.json")
	if e := carregarEstado(c); e.Janela != nil {
		t.Fatal("inexistente devia dar estado vazio")
	}
	_ = os.WriteFile(c, []byte("{isto não é json"), 0o644)
	if e := carregarEstado(c); e.Janela != nil || e.Maximizada {
		t.Fatal("corrompido devia dar estado vazio")
	}
	_ = os.WriteFile(c, []byte(`{"janela":{"L":0,"T":0,"R":50,"B":50}}`), 0o644)
	if e := carregarEstado(c); e.Janela != nil {
		t.Fatal("janela minúscula devia ser descartada")
	}
}

func TestPastaDados(t *testing.T) {
	sempre := func(string) bool { return true }
	nunca := func(string) bool { return false }
	if p, port := escolherPastaDados(`D:\App`, `C:\L`, false, sempre); p != filepath.Join(`D:\App`, "ComicXD-dados") || !port {
		t.Fatalf("portátil: %s %v", p, port)
	}
	if p, port := escolherPastaDados(`D:\App`, `C:\L`, false, nunca); p != filepath.Join(`C:\L`, "ComicXD") || port {
		t.Fatalf("sem escrita devia ir pro LocalAppData: %s %v", p, port)
	}
	if p, port := escolherPastaDados(`D:\App`, `C:\L`, true, sempre); p != filepath.Join(`C:\L`, "ComicXD") || port {
		t.Fatalf("instalado: %s %v", p, port)
	}
}

func TestPastaGravavelReal(t *testing.T) {
	d := t.TempDir()
	if !pastaGravavel(filepath.Join(d, "x", "y")) {
		t.Fatal("devia criar e gravar")
	}
	arq := filepath.Join(d, "arquivo")
	_ = os.WriteFile(arq, []byte("a"), 0o644)
	if pastaGravavel(filepath.Join(arq, "sub")) {
		t.Fatal("dentro de um arquivo não pode ser gravável")
	}
}
