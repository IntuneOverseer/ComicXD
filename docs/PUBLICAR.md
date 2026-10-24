# Passo a passo: GitHub → Reddit

Eu não consigo postar nas suas contas. Tudo abaixo você faz (uns 20–30 min).

## A. GitHub
1. Crie conta/entre em https://github.com → **New repository**. Nome: `ComicXD`. Público. **Não** marque README/LICENSE (já existem aqui).
2. Descompacte este pacote e, dentro da pasta, rode:
   ```bash
   git init -b main
   git add .
   git commit -m "ComicXD 0.55"
   git remote add origin https://github.com/SEU_USUARIO/ComicXD.git
   git push -u origin main
   ```
   (Sem Git instalado: no repositório vazio use **uploading an existing file** e arraste as pastas; cada arquivo precisa ter < 25 MB, ok aqui.)
3. Ajuste: **About** (engrenagem) → descrição curta, site vazio, tópicos: `comic-reader`, `manga-reader`, `webtoon`, `cbz`, `cbr`, `android`, `webview`, `open-source`.
4. **Releases → Draft a new release** → tag `v0.55` → título `ComicXD 0.55` → anexe o `ComicXD-0.55.apk` → cole as notas (do `CHANGELOG.md`) → Publish.
5. Confirme no `LICENSE` o nome/ano de copyright e se MIT é o que você quer.

### Antes da primeira release pública (decisão sua)
O APK atual é assinado com chave *debug*. Se você trocar de chave depois, todo mundo terá de desinstalar para atualizar. Se quiser, gere sua chave agora (veja `docs/BUILD.md`), me peça para reassinar, e **guarde o `.jks` + senha em 2 lugares**.

## B. Reddit
1. Crie o post de apresentação **no seu perfil** (u/seuusuario) ou em um subreddit onde seja permitido, usando o texto de `docs/REDDIT.md`.
2. Fixar no perfil: abra o post → menu **⋯** → *Add to profile / Pin to profile* (o nome muda conforme app/versão; pode exigir que o post esteja no seu perfil). O link do GitHub também pode ir na **bio** (Editar perfil → Descrição).
3. Depois poste nas comunidades de HQ/mangá/Android:
   - **Leia as regras de cada uma antes** (autopromoção, flair obrigatório, idade mínima de conta/karma, dia de "Showcase").
   - Um subreddit por vez, espaçando dias. Textos diferentes em cada um, não copie e cole igual.
   - Diga que o app é seu, gratuito e open source, e que **não tem conteúdo pirata**. Diga que teve ajuda de IA no desenvolvimento (várias comunidades exigem ou valorizam).
   - Responda comentários; peça feedback de bugs, não "estrelas".
4. Não poste links de quadrinhos, scans ou sites piratas em lugar nenhum — derruba o post e pode banir a conta.

## C. Cuidados
- Teste o APK que vai na Release em pelo menos 2 aparelhos antes de divulgar.
- Deixe claro no README: "testado principalmente em tablet X / Android Y".
- Chat P2P usa trackers públicos: já está explicado em `THIRD_PARTY.md`.
