package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCompararVersao(t *testing.T) {
	casos := []struct {
		a, b string
		want int
		ok   bool
	}{
		{"0.71.1", "0.70.1", 1, true},
		{"0.71.1", "0.71.1", 0, true},
		{"0.71", "0.71.0", 0, true},
		{"0.9", "0.10", -1, true}, // numérico, não texto
		{"0.71.1-teste1", "0.71.1", 0, true},
		{"v0.72", "0.71.9", 1, true},
		{"abc", "0.1", 0, false},
		{"", "0.1", 0, false},
	}
	for _, c := range casos {
		got, ok := compararVersao(c.a, c.b)
		if got != c.want || ok != c.ok {
			t.Errorf("comparar(%q,%q)=%d,%v quer %d,%v", c.a, c.b, got, ok, c.want, c.ok)
		}
	}
}

func rel(tag string, nomes ...string) release {
	r := release{Tag: tag}
	for _, n := range nomes {
		r.Ativos = append(r.Ativos, ativoRelease{Nome: n, URL: "https://github.com" + prefixoDownload + tag + "/" + n})
	}
	return r
}

func TestEscolherAtualizacao(t *testing.T) {
	win := func(v string) []string {
		return []string{"ComicXD-" + v + "-Windows-portable.exe", "ComicXD-" + v + "-Windows-Setup.exe", "SHA256.txt"}
	}
	apk := release{Tag: "v0.72", Ativos: []ativoRelease{{Nome: "ComicXD-0.72.apk", URL: "https://github.com" + prefixoDownload + "v0.72/ComicXD-0.72.apk"}}}
	rels := []release{apk, rel("v0.71.1", win("0.71.1")...), rel("v0.70.1", win("0.70.1")...)}

	if u := escolherAtualizacao(rels, "0.70.1", hostPermitido); u == nil || u.Versao != "0.71.1" {
		t.Fatalf("esperava 0.71.1, veio %+v", u)
	}
	if u := escolherAtualizacao(rels, "0.71.1", hostPermitido); u != nil {
		t.Fatalf("já está na mais nova, veio %+v", u)
	}
	if u := escolherAtualizacao(rels, "0.99", hostPermitido); u != nil {
		t.Fatalf("versão local maior, veio %+v", u)
	}
	// Release de Android/HTML (sem arquivos do Windows) nunca é oferecida
	if u := escolherAtualizacao([]release{apk}, "0.1", hostPermitido); u != nil {
		t.Fatalf("release só de Android não pode ser oferecida: %+v", u)
	}
	// falta SHA256.txt -> ignora
	if u := escolherAtualizacao([]release{rel("v0.80", "ComicXD-0.80-Windows-portable.exe", "ComicXD-0.80-Windows-Setup.exe")}, "0.1", hostPermitido); u != nil {
		t.Fatalf("sem SHA256.txt não pode: %+v", u)
	}
	// versões diferentes entre portable e Setup -> ignora
	if u := escolherAtualizacao([]release{rel("v0.80", "ComicXD-0.80-Windows-portable.exe", "ComicXD-0.81-Windows-Setup.exe", "SHA256.txt")}, "0.1", hostPermitido); u != nil {
		t.Fatalf("versões incoerentes não podem: %+v", u)
	}
	// rascunho e pré-lançamento
	r := rel("v0.90", win("0.90")...)
	r.Rascunho = true
	if u := escolherAtualizacao([]release{r}, "0.1", hostPermitido); u != nil {
		t.Fatalf("rascunho não pode")
	}
	r.Rascunho, r.PreRelease = false, true
	if u := escolherAtualizacao([]release{r}, "0.1", hostPermitido); u != nil {
		t.Fatalf("pré-lançamento não pode")
	}
	// URL fora do GitHub / do projeto
	mau := rel("v0.95", win("0.95")...)
	mau.Ativos[0].URL = "https://example.com/ComicXD-0.95-Windows-portable.exe"
	if u := escolherAtualizacao([]release{mau}, "0.1", hostPermitido); u != nil {
		t.Fatalf("host estranho não pode")
	}
	// ordem das releases não importa
	rs := []release{rel("v0.71.1", win("0.71.1")...), rel("v0.73", win("0.73")...), rel("v0.72", win("0.72")...)}
	if u := escolherAtualizacao(rs, "0.70", hostPermitido); u == nil || u.Versao != "0.73" {
		t.Fatalf("esperava 0.73, veio %+v", u)
	}
}

func TestHostPermitido(t *testing.T) {
	ok := []string{
		"https://github.com/IntuneOverseer/ComicXD/releases/download/v0.71.1/ComicXD-0.71.1-Windows-Setup.exe",
		"https://objects.githubusercontent.com/github-production-release-asset/abc",
		"https://release-assets.githubusercontent.com/x",
	}
	for _, u := range ok {
		if !hostPermitido(u) {
			t.Errorf("deveria permitir %s", u)
		}
	}
	mau := []string{
		"http://github.com/IntuneOverseer/ComicXD/releases/download/v1/a.exe",
		"https://github.com/outro/repo/releases/download/v1/a.exe",
		"https://github.com.evil.com/IntuneOverseer/ComicXD/releases/download/v1/a.exe",
		"https://evilgithubusercontent.com/x",
		"https://user@github.com/IntuneOverseer/ComicXD/releases/download/v1/a.exe",
		"ftp://github.com/x", "", "file:///c:/x.exe",
	}
	for _, u := range mau {
		if hostPermitido(u) {
			t.Errorf("deveria recusar %s", u)
		}
	}
}

func falso(n int) []byte {
	b := bytes.Repeat([]byte{7}, n)
	b[0], b[1] = 'M', 'Z'
	return b
}

func hashHex(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func TestBaixarVerificado(t *testing.T) {
	exe := falso(2 << 20)
	nome := "ComicXD-0.99-Windows-portable.exe"
	hashes := fmt.Sprintf("%s  %s\nffff  outro.exe\n", hashHex(exe), nome)
	mux := http.NewServeMux()
	mux.HandleFunc("/exe", func(w http.ResponseWriter, r *http.Request) { w.Write(exe) })
	mux.HandleFunc("/ruim", func(w http.ResponseWriter, r *http.Request) { w.Write(append(exe[:len(exe)-1:len(exe)-1], 9)) })
	mux.HandleFunc("/hash", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(hashes)) })
	mux.HandleFunc("/grande", func(w http.ResponseWriter, r *http.Request) { w.Write(make([]byte, limiteHash+10)) })
	mux.HandleFunc("/off", func(w http.ResponseWriter, r *http.Request) { http.Error(w, "x", 500) })
	srv := httptest.NewServer(mux)
	defer srv.Close()
	busca := fonteHTTP(srv.Client())
	ctx := context.Background()

	b, h, err := baixarVerificado(ctx, busca, ativoRelease{Nome: nome, URL: srv.URL + "/exe"}, ativoRelease{Nome: "SHA256.txt", URL: srv.URL + "/hash"})
	if err != nil || !bytes.Equal(b, exe) || h != hashHex(exe) {
		t.Fatalf("caminho feliz falhou: %v", err)
	}
	// conteúdo adulterado -> recusa
	if _, _, err := baixarVerificado(ctx, busca, ativoRelease{Nome: nome, URL: srv.URL + "/ruim"}, ativoRelease{URL: srv.URL + "/hash"}); err == nil {
		t.Fatal("hash diferente deveria falhar")
	}
	// nome sem hash no SHA256.txt
	if _, _, err := baixarVerificado(ctx, busca, ativoRelease{Nome: "ComicXD-0.99-Windows-Setup.exe", URL: srv.URL + "/exe"}, ativoRelease{URL: srv.URL + "/hash"}); err == nil {
		t.Fatal("sem hash para o nome deveria falhar")
	}
	// erro de servidor e limite de tamanho
	if _, _, err := baixarVerificado(ctx, busca, ativoRelease{Nome: nome, URL: srv.URL + "/off"}, ativoRelease{URL: srv.URL + "/hash"}); err == nil {
		t.Fatal("HTTP 500 deveria falhar")
	}
	if _, _, err := baixarVerificado(ctx, busca, ativoRelease{Nome: nome, URL: srv.URL + "/exe"}, ativoRelease{URL: srv.URL + "/grande"}); err == nil {
		t.Fatal("SHA256.txt gigante deveria falhar")
	}
}

func TestRedirecionamento(t *testing.T) {
	alvo := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("oi")) }))
	defer alvo.Close()
	ponte := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, alvo.URL, 302) }))
	defer ponte.Close()
	// política que recusa tudo: o redirecionamento tem que ser barrado
	c := novoClienteHTTP(func(string) bool { return false })
	if _, err := baixar(context.Background(), c, ponte.URL, 10); err == nil {
		t.Fatal("redirecionamento para destino não permitido deveria falhar")
	}
	c = novoClienteHTTP(func(string) bool { return true })
	if b, err := baixar(context.Background(), c, ponte.URL, 10); err != nil || string(b) != "oi" {
		t.Fatalf("redirecionamento permitido falhou: %v %q", err, b)
	}
	if hostPermitidoRedirect("http://github.com/x") || !hostPermitidoRedirect("https://objects.githubusercontent.com/x") || hostPermitidoRedirect("https://evil.com/x") {
		t.Fatal("política de redirecionamento errada")
	}
}

func TestSubstituirExe(t *testing.T) {
	d := t.TempDir()
	exe := filepath.Join(d, "ComicXD.exe")
	os.WriteFile(exe, []byte("antigo"), 0o755)
	if err := substituirExe(exe, []byte("novo!!")); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(exe); string(b) != "novo!!" {
		t.Fatalf("exe = %q", b)
	}
	if b, _ := os.ReadFile(exe + ".old"); string(b) != "antigo" {
		t.Fatalf(".old = %q", b)
	}
	if _, err := os.Stat(exe + ".novo"); err == nil {
		t.Fatal(".novo deveria ter sumido")
	}
	// segunda troca sobrescreve o .old
	if err := substituirExe(exe, []byte("novo2")); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(exe + ".old"); string(b) != "novo!!" {
		t.Fatalf(".old após 2ª troca = %q", b)
	}
	// falha ao gravar (pasta inexistente): nada muda
	if err := substituirExe(filepath.Join(d, "nada", "x.exe"), []byte("a")); err == nil {
		t.Fatal("pasta inexistente deveria falhar")
	}
	// falha na 2ª etapa: .novo é diretório?? simulamos exe inexistente -> rename falha, sem lixo
	if err := substituirExe(filepath.Join(d, "naoexiste.exe"), []byte("a")); err == nil {
		t.Fatal("exe inexistente deveria falhar")
	}
	if _, err := os.Stat(filepath.Join(d, "naoexiste.exe.novo")); err == nil {
		t.Fatal("não pode sobrar .novo")
	}
}

func TestFrequencia(t *testing.T) {
	arq := filepath.Join(t.TempDir(), "u.txt")
	agora := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	if !deveConsultar(arq, agora) {
		t.Fatal("sem arquivo => consulta")
	}
	marcarConsulta(arq, agora)
	if deveConsultar(arq, agora.Add(time.Hour)) {
		t.Fatal("1h depois não consulta")
	}
	if !deveConsultar(arq, agora.Add(7*time.Hour)) {
		t.Fatal("7h depois consulta")
	}
	if !deveConsultar(arq, agora.Add(-time.Hour)) {
		t.Fatal("relógio voltou => consulta")
	}
	os.WriteFile(arq, []byte("lixo"), 0o644)
	if !deveConsultar(arq, agora) {
		t.Fatal("arquivo corrompido => consulta")
	}
}

func TestFonteLocalEFeed(t *testing.T) {
	d := t.TempDir()
	os.WriteFile(filepath.Join(d, "a.bin"), []byte("x"), 0o644)
	f := fonteLocal(d)
	if b, err := f(context.Background(), "a.bin", 10); err != nil || string(b) != "x" {
		t.Fatal(err)
	}
	for _, mau := range []string{"../a.bin", "sub/a.bin", "..", ""} {
		if _, err := f(context.Background(), mau, 10); err == nil {
			t.Errorf("deveria recusar %q", mau)
		}
	}
	os.WriteFile(filepath.Join(d, "feed.json"), []byte(`{"releases":[{"tag_name":"v9","assets":[{"name":"SHA256.txt","browser_download_url":"SHA256.txt"}]}]}`), 0o644)
	rs, err := lerFeedTeste(filepath.Join(d, "feed.json"))
	if err != nil || len(rs) != 1 || rs[0].Ativos[0].Nome != "SHA256.txt" {
		t.Fatalf("feed: %v %+v", err, rs)
	}
}

func TestHashDoArquivo(t *testing.T) {
	h := hashHex([]byte("a"))
	txt := []byte(h + " *ComicXD-1-Windows-portable.exe\r\n" + "zz  ComicXD-1-Windows-Setup.exe\n")
	if got, err := hashDoArquivo(txt, "ComicXD-1-Windows-portable.exe"); err != nil || got != h {
		t.Fatalf("%v %s", err, got)
	}
	if _, err := hashDoArquivo(txt, "ComicXD-1-Windows-Setup.exe"); err == nil {
		t.Fatal("hash inválido deveria falhar")
	}
}
