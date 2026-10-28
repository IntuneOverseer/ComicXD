package main

// Atualização automática do ComicXD para Windows — lógica pura (sem Windows),
// para poder ser testada em qualquer sistema.
//
// Fluxo: consulta as Releases do GitHub -> escolhe a mais nova que tenha os
// arquivos do Windows -> baixa -> confere o SHA-256 (SHA256.txt da mesma Release)
// -> o programa pergunta ao usuário e só então aplica.

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	urlReleases     = "https://api.github.com/repos/IntuneOverseer/ComicXD/releases?per_page=30"
	prefixoDownload = "/IntuneOverseer/ComicXD/releases/download/"
	limiteExe       = 80 << 20 // 80 MB: acima disso o download é recusado
	limiteHash      = 64 << 10
	intervaloCheque = 6 * time.Hour
)

type ativoRelease struct {
	Nome string `json:"name"`
	URL  string `json:"browser_download_url"`
	Tam  int64  `json:"size"`
}

type release struct {
	Tag        string         `json:"tag_name"`
	Rascunho   bool           `json:"draft"`
	PreRelease bool           `json:"prerelease"`
	Ativos     []ativoRelease `json:"assets"`
}

// Atualizacao é o que foi decidido após olhar as Releases.
type Atualizacao struct {
	Versao   string
	Portatil ativoRelease
	Setup    ativoRelease
	Hashes   ativoRelease
}

var reVersao = regexp.MustCompile(`^v?(\d+(?:\.\d+){0,3})$`)
var reAtivo = regexp.MustCompile(`^ComicXD-(\d+(?:\.\d+){1,3})-Windows-(portable|Setup)\.exe$`)

// versaoNumeros devolve só a parte numérica ("0.71.1-teste" -> [0 71 1]).
func versaoNumeros(v string) ([]int, bool) {
	v = strings.TrimSpace(v)
	if i := strings.IndexAny(v, "-+ "); i >= 0 {
		v = v[:i]
	}
	m := reVersao.FindStringSubmatch(v)
	if m == nil {
		return nil, false
	}
	var n []int
	for _, p := range strings.Split(m[1], ".") {
		x, err := strconv.Atoi(p)
		if err != nil {
			return nil, false
		}
		n = append(n, x)
	}
	return n, true
}

// compararVersao: -1 se a<b, 0 se iguais, 1 se a>b; ok=false se alguma não for número.
func compararVersao(a, b string) (int, bool) {
	x, ok1 := versaoNumeros(a)
	y, ok2 := versaoNumeros(b)
	if !ok1 || !ok2 {
		return 0, false
	}
	for i := 0; i < 4; i++ {
		var p, q int
		if i < len(x) {
			p = x[i]
		}
		if i < len(y) {
			q = y[i]
		}
		if p != q {
			if p < q {
				return -1, true
			}
			return 1, true
		}
	}
	return 0, true
}

// escolherAtualizacao olha a lista de Releases e devolve a mais nova (maior que
// atual) que tenha portable + Setup + SHA256.txt com a MESMA versão no nome.
// Ignora rascunhos e pré-lançamentos; ignora Releases só de Android/HTML.
func escolherAtualizacao(rels []release, atual string, hostOK func(string) bool) *Atualizacao {
	var melhor *Atualizacao
	for _, r := range rels {
		if r.Rascunho || r.PreRelease {
			continue
		}
		var port, setup, hash ativoRelease
		ver := ""
		coerente := true
		for _, a := range r.Ativos {
			if a.Nome == "SHA256.txt" {
				hash = a
				continue
			}
			m := reAtivo.FindStringSubmatch(a.Nome)
			if m == nil {
				continue
			}
			if ver != "" && ver != m[1] {
				coerente = false
			}
			ver = m[1]
			if m[2] == "portable" {
				port = a
			} else {
				setup = a
			}
		}
		if !coerente || ver == "" || port.URL == "" || setup.URL == "" || hash.URL == "" {
			continue
		}
		if !hostOK(port.URL) || !hostOK(setup.URL) || !hostOK(hash.URL) {
			continue
		}
		if c, ok := compararVersao(ver, atual); !ok || c <= 0 {
			continue
		}
		if melhor != nil {
			if c, _ := compararVersao(ver, melhor.Versao); c <= 0 {
				continue
			}
		}
		melhor = &Atualizacao{Versao: ver, Portatil: port, Setup: setup, Hashes: hash}
	}
	return melhor
}

// hostPermitido: só HTTPS, só GitHub, só o caminho de downloads deste projeto.
func hostPermitido(u string) bool {
	p, err := url.Parse(u)
	if err != nil || p.Scheme != "https" || p.User != nil {
		return false
	}
	h := strings.ToLower(p.Hostname())
	if h == "github.com" {
		return strings.HasPrefix(p.Path, prefixoDownload)
	}
	// destinos de redirecionamento dos downloads do GitHub
	return strings.HasSuffix(h, ".githubusercontent.com")
}

// hostPermitidoRedirect é usado nos redirecionamentos (o caminho muda).
func hostPermitidoRedirect(u string) bool {
	p, err := url.Parse(u)
	if err != nil || p.Scheme != "https" || p.User != nil {
		return false
	}
	h := strings.ToLower(p.Hostname())
	return h == "github.com" || strings.HasSuffix(h, ".githubusercontent.com")
}

func novoClienteHTTP(redirOK func(string) bool) *http.Client {
	return &http.Client{
		Timeout: 10 * time.Minute,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > 5 {
				return errors.New("redirecionamentos demais")
			}
			if !redirOK(req.URL.String()) {
				return fmt.Errorf("redirecionamento para destino não permitido: %s", req.URL.Host)
			}
			return nil
		},
	}
}

func buscarReleases(ctx context.Context, c *http.Client, endereco string) ([]release, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endereco, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "ComicXD-Windows-Updater")
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("servidor respondeu %d", resp.StatusCode)
	}
	var rels []release
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&rels); err != nil {
		return nil, fmt.Errorf("resposta inválida: %w", err)
	}
	return rels, nil
}

// fonteFn obtém os bytes de um endereço (HTTP real, ou arquivo local no modo de teste).
type fonteFn func(ctx context.Context, endereco string, limite int64) ([]byte, error)

func fonteHTTP(c *http.Client) fonteFn {
	return func(ctx context.Context, e string, l int64) ([]byte, error) { return baixar(ctx, c, e, l) }
}

// fonteLocal lê arquivos da pasta do feed de teste (nome simples, sem caminhos).
func fonteLocal(pasta string) fonteFn {
	return func(_ context.Context, e string, l int64) ([]byte, error) {
		if e != filepath.Base(e) || e == "" || e == "." || e == ".." {
			return nil, errors.New("feed de teste: use só nomes de arquivo")
		}
		b, err := os.ReadFile(filepath.Join(pasta, e))
		if err != nil {
			return nil, err
		}
		if int64(len(b)) > l {
			return nil, errors.New("arquivo maior que o limite permitido")
		}
		return b, nil
	}
}

func baixar(ctx context.Context, c *http.Client, endereco string, limite int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endereco, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "ComicXD-Windows-Updater")
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("servidor respondeu %d", resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, limite+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > limite {
		return nil, errors.New("arquivo maior que o limite permitido")
	}
	return b, nil
}

// hashDoArquivo procura "<sha256>  <nome>" (formato do sha256sum) em SHA256.txt.
func hashDoArquivo(txt []byte, nome string) (string, error) {
	sc := bufio.NewScanner(strings.NewReader(string(txt)))
	for sc.Scan() {
		f := strings.Fields(sc.Text())
		if len(f) != 2 {
			continue
		}
		if strings.TrimPrefix(f[1], "*") == nome {
			h := strings.ToLower(f[0])
			if len(h) == 64 {
				if _, err := hex.DecodeString(h); err == nil {
					return h, nil
				}
			}
		}
	}
	return "", fmt.Errorf("SHA256.txt não tem o hash de %s", nome)
}

func sha256Hex(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

// ehExecutavelWindows: sanidade mínima do que foi baixado.
func ehExecutavelWindows(b []byte) bool { return len(b) > 1<<20 && b[0] == 'M' && b[1] == 'Z' }

// BaixarVerificado baixa o arquivo e o hash e só devolve os bytes se o SHA-256 conferir.
func baixarVerificado(ctx context.Context, busca fonteFn, alvo, hashes ativoRelease) ([]byte, string, error) {
	txt, err := busca(ctx, hashes.URL, limiteHash)
	if err != nil {
		return nil, "", fmt.Errorf("baixar SHA256.txt: %w", err)
	}
	esperado, err := hashDoArquivo(txt, alvo.Nome)
	if err != nil {
		return nil, "", err
	}
	b, err := busca(ctx, alvo.URL, limiteExe)
	if err != nil {
		return nil, "", fmt.Errorf("baixar %s: %w", alvo.Nome, err)
	}
	if got := sha256Hex(b); got != esperado {
		return nil, "", fmt.Errorf("SHA-256 não confere (%s != %s): arquivo descartado", got, esperado)
	}
	if !ehExecutavelWindows(b) {
		return nil, "", errors.New("o arquivo baixado não parece um programa do Windows")
	}
	return b, esperado, nil
}

// substituirExe troca o programa em disco por novo, mesmo com ele aberto (o
// Windows permite RENOMEAR um .exe em uso). Se algo falhar depois de renomear o
// antigo, devolve o antigo ao lugar.
func substituirExe(exe string, novo []byte) error {
	tmp := exe + ".novo"
	velho := exe + ".old"
	if err := os.WriteFile(tmp, novo, 0o755); err != nil {
		return fmt.Errorf("gravar o novo programa: %w", err)
	}
	_ = os.Remove(velho)
	if err := os.Rename(exe, velho); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("não consegui preparar a troca: %w", err)
	}
	if err := os.Rename(tmp, exe); err != nil {
		_ = os.Rename(velho, exe) // volta o antigo
		_ = os.Remove(tmp)
		return fmt.Errorf("não consegui concluir a troca (versão antiga mantida): %w", err)
	}
	return nil
}

// ---- controle de frequência (não consulta o GitHub a cada abertura) ----

func deveConsultar(arq string, agora time.Time) bool {
	b, err := os.ReadFile(arq)
	if err != nil {
		return true
	}
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(string(b)))
	if err != nil {
		return true
	}
	return agora.Sub(t) >= intervaloCheque || agora.Before(t)
}

func marcarConsulta(arq string, agora time.Time) {
	_ = os.WriteFile(arq, []byte(agora.UTC().Format(time.RFC3339)), 0o644)
}

// pastaTemporariaAtualizacao é onde o instalador baixado fica até ser executado.
func pastaTemporariaAtualizacao(dados string) (string, error) {
	p := filepath.Join(dados, "atualizacao")
	_ = os.RemoveAll(p)
	return p, os.MkdirAll(p, 0o755)
}

// ---- modo de teste: --feed arquivo.json (nunca usado sem pedir) ----

type feedTeste struct {
	Releases []release `json:"releases"`
}

// lerFeedTeste lê um JSON local com a mesma estrutura das Releases; os
// "browser_download_url" são caminhos de arquivo locais.
func lerFeedTeste(arq string) ([]release, error) {
	b, err := os.ReadFile(arq)
	if err != nil {
		return nil, err
	}
	var f feedTeste
	if err := json.Unmarshal(b, &f); err != nil {
		return nil, err
	}
	return f.Releases, nil
}
