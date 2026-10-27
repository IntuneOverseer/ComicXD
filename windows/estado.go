package main

// Lógica pura (sem Windows): estado da janela e pasta de dados.
// Fica separada para poder ser testada fora do Windows.

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Rect em coordenadas inteiras (mesma convenção do Windows: direita/baixo exclusivos).
type Rect struct{ L, T, R, B int32 }

func (r Rect) W() int32 { return r.R - r.L }
func (r Rect) H() int32 { return r.B - r.T }

// Estado guardado entre execuções.
type Estado struct {
	Janela     *Rect `json:"janela,omitempty"`
	Maximizada bool  `json:"maximizada"`
}

const (
	LarguraMinima = 480
	AlturaMinima  = 320
)

func carregarEstado(caminho string) Estado {
	var e Estado
	b, err := os.ReadFile(caminho)
	if err != nil {
		return Estado{}
	}
	if json.Unmarshal(b, &e) != nil {
		return Estado{}
	}
	if e.Janela != nil && (e.Janela.W() < LarguraMinima || e.Janela.H() < AlturaMinima) {
		e.Janela = nil
	}
	return e
}

// salvarEstado grava de forma atômica (arquivo temporário + renomear), para que
// um fechamento no meio da gravação nunca deixe o arquivo pela metade.
func salvarEstado(caminho string, e Estado) error {
	b, err := json.MarshalIndent(e, "", "  ")
	if err != nil {
		return err
	}
	tmp := caminho + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, caminho)
}

func intersecao(a, b Rect) (w, h int32) {
	l, t, r, bt := max32(a.L, b.L), max32(a.T, b.T), min32(a.R, b.R), min32(a.B, b.B)
	if r <= l || bt <= t {
		return 0, 0
	}
	return r - l, bt - t
}

func max32(a, b int32) int32 {
	if a > b {
		return a
	}
	return b
}
func min32(a, b int32) int32 {
	if a < b {
		return a
	}
	return b
}

// ajustarRetangulo garante que a janela restaurada seja alcançável:
// a barra de título (faixa de 40 px no topo) precisa ter pelo menos 150 px
// visíveis em alguma tela. Caso contrário (monitor removido, resolução menor),
// centraliza na primeira tela (a principal), limitando o tamanho a 92% dela.
// Devolve o retângulo final e se houve correção.
func ajustarRetangulo(r Rect, telas []Rect) (Rect, bool) {
	if len(telas) == 0 {
		return r, false
	}
	faixa := Rect{r.L, r.T, r.R, r.T + 40}
	for _, t := range telas {
		if w, h := intersecao(faixa, t); w >= 150 && h >= 20 {
			return r, false
		}
	}
	p := telas[0]
	w, h := r.W(), r.H()
	if w < LarguraMinima {
		w = LarguraMinima
	}
	if h < AlturaMinima {
		h = AlturaMinima
	}
	if mw := p.W() * 92 / 100; w > mw {
		w = mw
	}
	if mh := p.H() * 92 / 100; h > mh {
		h = mh
	}
	l := p.L + (p.W()-w)/2
	t := p.T + (p.H()-h)/2
	return Rect{l, t, l + w, t + h}, true
}

// tamanhoPadrao: 1280x860, mas nunca mais que 85% da tela principal.
func tamanhoPadrao(telaW, telaH int32) (int32, int32) {
	w, h := int32(1280), int32(860)
	if mw := telaW * 85 / 100; w > mw {
		w = mw
	}
	if mh := telaH * 85 / 100; h > mh {
		h = mh
	}
	if w < LarguraMinima {
		w = LarguraMinima
	}
	if h < AlturaMinima {
		h = AlturaMinima
	}
	return w, h
}

// escolherPastaDados decide onde ficam biblioteca, progresso e preferências.
//
//   - Modo instalado (existe "instalado.txt" ao lado do .exe): %LOCALAPPDATA%\ComicXD.
//   - Modo portátil (padrão): "ComicXD-dados" ao lado do .exe, se for gravável.
//   - Se a pasta do .exe não for gravável (Program Files, CD, rede somente leitura):
//     %LOCALAPPDATA%\ComicXD.
//
// "gravavel" tenta criar a pasta e um arquivo de teste.
func escolherPastaDados(pastaExe, localAppData string, instalado bool, gravavel func(string) bool) (pasta string, portatil bool) {
	locais := filepath.Join(localAppData, "ComicXD")
	if instalado {
		return locais, false
	}
	ao_lado := filepath.Join(pastaExe, "ComicXD-dados")
	if gravavel(ao_lado) {
		return ao_lado, true
	}
	return locais, false
}

// pastaGravavel: cria a pasta (se preciso) e confirma escrevendo/removendo um arquivo.
func pastaGravavel(p string) bool {
	if err := os.MkdirAll(p, 0o755); err != nil {
		return false
	}
	t := filepath.Join(p, ".teste-escrita")
	if err := os.WriteFile(t, []byte("ok"), 0o644); err != nil {
		return false
	}
	_ = os.Remove(t)
	return true
}
