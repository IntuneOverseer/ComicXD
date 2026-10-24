# Como gerar tudo

Requisitos: Python 3. Para o APK: Java + [apktool](https://apktool.org/) + um assinador (ex.: [uber-apk-signer](https://github.com/patrickfav/uber-apk-signer)).

## HTML (um arquivo só)
```bash
python3 build/build.py pc    # -> dist/index.html  (versão PC / navegador)
python3 build/build.py apk   # -> dist/index.html  (versão toque / Android)
python3 build/build.py auto  # detecta sozinho
```
`dist/ComicXD-pc.html` e `dist/ComicXD-apk.html` já vêm prontos no repositório.

## APK
```bash
cp -r android/apktool-project /tmp/cx && mkdir -p /tmp/cx/assets
cp dist/ComicXD-apk.html /tmp/cx/assets/index.html
apktool b /tmp/cx -o ComicXD-unsigned.apk
# assinar com SUA chave (veja abaixo)
```

### Assinatura (importante)
Os APKs de teste foram assinados com chave *debug*. Para a versão pública, crie **uma chave sua** e guarde com backup:
```bash
keytool -genkeypair -v -keystore comicxd-release.jks -alias comicxd -keyalg RSA -keysize 2048 -validity 10000
```
Quem instalar uma versão assinada com outra chave precisa **desinstalar antes** de atualizar. Nunca suba o `.jks` ao GitHub (já está no `.gitignore`).

## Estrutura
- `src/` – módulos JS, HTML, CSS, traduções (`src/trad/jako.json`)
- `src/base/` – HTML-base com as bibliotecas embutidas
- `src/core/hqcore12.js` – núcleo de análise (OpenCV)
- `src/p2p/` – bundle do chat P2P, pdf.js
- `build/build.py` – junta tudo em um HTML
- `android/apktool-project/` – projeto Android (WebView) para apktool
