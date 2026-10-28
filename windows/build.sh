#!/usr/bin/env bash
# Compila o ComicXD para Windows (64 bits) a partir de Linux ou macOS, sem precisar de Windows.
#
#   ./build.sh [versao] [caminho-do-ComicXD-pc.html]
#
# Requisitos: Go 1.24+ e a ferramenta rsrc (go install github.com/akavel/rsrc@v0.10.2).
# Saída: dist/ComicXD-<versão>-Windows-portable.exe  e  dist/ComicXD-<versão>-Windows-Setup.exe
set -euo pipefail
cd "$(dirname "$0")"
VERSAO="${1:-0.70}"
HTML="${2:-../dist/ComicXD-pc.html}"
RSRC="${RSRC:-$(command -v rsrc || echo "$(go env GOPATH)/bin/rsrc")}"
[ -x "$RSRC" ] || { echo "rsrc não encontrado: go install github.com/akavel/rsrc@v0.10.2 (ou RSRC=/caminho/rsrc)"; exit 1; }
export CGO_ENABLED=0

echo "== leitor embutido: $HTML"; cp "$HTML" index.html
# TRAVA: o leitor (.html) embutido tem que ser da versão do leitor que este Windows declara (0.71.1 -> leitor 0.71)
HV="$(grep -o 'const VERSAO="[^"]*"' index.html | head -1 | cut -d'"' -f2)"
VN="${VERSAO%%-*}"; VL="$(echo "$VN" | cut -d. -f1,2)"
if [ "$HV" != "$VL" ] && [ -z "${PULAR_TRAVA_HTML:-}" ]; then
  echo "ERRO: o .html embutido é da versão '$HV', mas este Windows ($VERSAO) exige leitor '$VL'. Use o ComicXD-pc.html certo."; exit 1
fi
echo "   leitor $HV confere com o Windows $VERSAO"
echo "== testes da lógica";        GOOS="$(go env GOHOSTOS)" go test ./... 2>&1 | grep -v "no test files" | tail -3
echo "== vet (Windows)";           GOOS=windows GOARCH=amd64 go vet ./... 2>&1 | grep -v -E "possible misuse of unsafe.Pointer|^#" || true

echo "== recursos (ícone + manifesto)"
"$RSRC" -manifest rsrc/app.manifest   -ico rsrc/icone.ico -arch amd64 -o rsrc_windows_amd64.syso
"$RSRC" -manifest rsrc/setup.manifest -ico rsrc/icone.ico -arch amd64 -o setup/rsrc_windows_amd64.syso

mkdir -p dist; rm -f dist/*.exe dist/SHA256.txt
echo "== programa";    GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H=windowsgui -s -w -X main.versaoApp=$VERSAO" -o dist/ComicXD-portable.exe .
gzip -9 -n -c dist/ComicXD-portable.exe > setup/ComicXD.exe.gz
echo "== instalador";  GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H=windowsgui -s -w -X main.versao=$VERSAO" -o dist/ComicXD-Setup.exe ./setup

V="${VERSAO%%-*}"
mv dist/ComicXD-portable.exe "dist/ComicXD-$V-Windows-portable.exe"
mv dist/ComicXD-Setup.exe    "dist/ComicXD-$V-Windows-Setup.exe"
( cd dist && sha256sum *.exe | tee SHA256.txt )
