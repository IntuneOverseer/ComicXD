import os; os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))
import sys
src=open('src/base/HQ-Guiada-leve013.html',encoding='utf-8').read()
def rep(old,new,cnt=1):
    global src
    n=src.count(old)
    if n!=cnt: sys.exit(f'ERRO {n}: {old[:90]!r}')
    src=src.replace(old,new)
def cut(a_mark,b_mark,new,start=0):
    global src
    a=src.index(a_mark,start); b=src.index(b_mark,a)
    src=src[:a]+new+src[b:]
rep('<title>HQ Guiada</title>','<title>ComicXD</title>\n<meta name="theme-color" content="#0a0d19">\n<script>(function(){try{var p=JSON.parse(localStorage.getItem("hq-ui")||"\\"auto\\"");var w=p==="web"||(p!=="toque"&&matchMedia("(pointer:fine)").matches&&matchMedia("(hover:hover)").matches&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));document.documentElement.dataset.modo=w?"web":"toque"}catch(e){document.documentElement.dataset.modo="toque"}})()</script>')
# CSS
cut('<style>','</style>','<style>\n'+open('src/style.css',encoding='utf-8').read())
# corpo (biblioteca + preparo + leitor)
cut('<section id="home">','<script id="cvgz"',open('src/home.html',encoding='utf-8').read()+'\n')
# tema removido
cut('/* ---------- tema (so a interface) ---------- */','/* ---------- utilidades ---------- */','')
# pump: sem analise durante a leitura
cut('let pumpT=0;\nfunction pump(){','function analyze(','''let pumpT=0,prepMode=false;
function pump(){
  if(!queue.length)return;
  // lendo: nenhum nucleo trabalha durante o movimento nem logo depois de um toque; so 1 nucleo, so com a tela parada
  if(!prepMode&&!esperando&&(anim||performance.now()-lastInput<1800)){if(!pumpT)pumpT=setTimeout(()=>{pumpT=0;pump()},500);return}
  const lim=(prepMode||esperando)?workers.length:1;let busy=workers.filter(s=>s.busy).length;
  const pr=j=>{const d=j.page-(book?pi:0);return d===0?-1:d>0?d:100-d};queue.sort((a,b)=>pr(a)-pr(b));
  for(const st of workers){ if(st.busy||!queue.length)continue; if(busy>=lim)break; const job=queue.shift(); st.busy=true; st.job=job; busy++; st.w.postMessage({id:job.id,blob:job.blob,zoom:job.zoom}); }
}
''')
# abrir: prepara tudo antes de ler
rep("""    await startWorker();
    $('loading').hidden=true;openReader();
    if(!opt.daEstante)guardarLivro(key,book.name,files,pages[0]&&pages[0].blob);""","""    await startWorker();
    $('loading').hidden=true;
    if(!opt.daEstante)guardarLivro(key,book.name,files,pages[0]&&pages[0].blob);
    const s0=store.get(key,null),r0=await preparar(s0?Math.min(s0.page,pages.length-1):0);
    if(r0==='cancel'){book=null;return}
    openReader();""")
# biblioteca antiga e leitor antigo saem; entram os novos
cut('let capaURLs=[];\nasync function renderRecent()','/* ---------- leitor ---------- */\nconst cvs=','')
cut('/* ---------- leitor ---------- */\nconst cvs=','})();\n</script>\n</body>',open('src/leitor_gl.js',encoding='utf-8').read()+open('src/filtro.js',encoding='utf-8').read()+open('src/marcar.js',encoding='utf-8').read()+open('src/avatares.js',encoding='utf-8').read()+open('src/chat.js',encoding='utf-8').read()+open('src/saudacoes.js',encoding='utf-8').read()+open('src/perfil.js',encoding='utf-8').read()+'\nrenderRecent();\n')

# ---- v0.18: nucleo de deteccao hqcore12 (ordem por relacao + limpeza de passos) + plano v10 ----
import re as _re,base64 as _b64
_core=_b64.b64encode(open('src/core/hqcore12.js','rb').read()).decode()
_m=_re.search(r'(<script id="hqcore" type="text/plain"[^>]*>)(.*?)(</script>)',src,_re.S)
assert _m,'hqcore'
src=src[:_m.start(2)]+_core+src[_m.end(2):]
assert "const VERSAO_PLANO='v9';" in src
src=src.replace("const VERSAO_PLANO='v9';","const VERSAO_PLANO='v13';")

# ---- v0.20: idioma PT/EN, perfil, saudacao, nome ComicXD ----
import sys as _sys,json as _json
_jk=_json.load(open('src/trad/jako.json',encoding='utf-8'))
for _lg in _jk:
    for _k in list(_jk[_lg].keys()):
        _t=_k.strip()
        if _t!=_k and _t and _t not in _jk[_lg]: _jk[_lg][_t]=_jk[_lg][_k].strip()
_i18n='const VERSAO='+_json.dumps(open('src/VERSAO.txt').read().strip())+';\nconst __JA='+_json.dumps(_jk['ja'],ensure_ascii=False)+';const __KO='+_json.dumps(_jk['ko'],ensure_ascii=False)+';\n'+open('src/i18n.js',encoding='utf-8').read()
assert src.count("const ZOOMS=[1.1,1.25")==1
src=src.replace("const ZOOMS=[1.1,1.25",_i18n+"\nconst ZOOMS=[1.1,1.25",1)
# padrao da leitura guiada: Letra 5 (zoom 1.8). Quem ja escolheu outro tamanho mantem o que escolheu.
_z0="let ZOOM=store.get('hq-zoom',1.4);if(!ZOOMS.includes(ZOOM))ZOOM=1.4;"
assert src.count(_z0)==1,'zoom padrao'
src=src.replace(_z0,"let ZOOM=store.get('hq-zoom',1.8);if(!ZOOMS.includes(ZOOM))ZOOM=1.8;",1)
def _r(o,n):
    global src
    assert src.count(o)==1,(src.count(o),o[:70]); src=src.replace(o,n)
_r("$('loadmsg').textContent='Abrindo a HQ…';","$('loadmsg').textContent=TR('Abrindo a HQ…');")
_r("$('loadmsg').textContent='Preparando o leitor…';","$('loadmsg').textContent=TR('Preparando o leitor…');")
_r("throw new Error('Não achei imagens nesse arquivo. Use CBR, CBZ, ZIP, RAR ou selecione as imagens das páginas.')","throw new Error(TR('Não achei imagens nesse arquivo. Use PDF, CBR, CBZ, ZIP, RAR, EPUB ou selecione as imagens das páginas.'))")
_r("m.textContent='“'+it.name+'” não está mais guardada neste aparelho. Abra o arquivo de novo e ela volta para cá.'","m.textContent=L('“'+it.name+'” não está mais guardada neste aparelho. Abra o arquivo de novo e ela volta para cá.','“'+it.name+'” is no longer saved on this device. Open the file again and it comes back here.')")

# ---- v0.21: chat P2P ----
_bundle=open('src/p2p/p2p.bundle.js',encoding='utf-8').read().replace('</script','<\\/script')
assert src.count('<script id="hqcore"')==1
src=src.replace('<script id="hqcore"','<script>'+_bundle+'</script>\n<script id="hqcore"',1)
_r("addEventListener('popstate',()=>{if($('reader').hidden)return;","addEventListener('popstate',()=>{if($('reader').hidden||chatAberto())return;")

# ---- v0.22: modo mangá, PDF/EPUB ----
_pdfl=open('src/p2p/pdf.lib.js',encoding='utf-8').read().replace('</script','<\\/script')
_pdfw=open('src/p2p/pdf.worker.js',encoding='utf-8').read()
assert '</script' not in _pdfw
src=src.replace('<script id="hqcore"','<script>'+_pdfl+'</script>\n<script id="pdfworker" type="text/plain">'+_pdfw+'</script>\n<script id="hqcore"',1)
_r("const MAX_LIVROS=6;","const MAX_LIVROS=8;")
_r("files=[...files];opt=opt||{};  // copia","files=[...files];opt=opt||{};const manga=opt.manga!==undefined?!!opt.manga:aba==='manga';{const ck=checarFormato(files,manga);if(ck==='trocar'){recusarHQ(files);return}if(ck){formatoInvalido(manga);return}}  // copia")
_r("    if(files.length===1 && /\\.(cbz|zip)$/i.test(files[0].name)){",
"""    if(files.length===1 && /\\.pdf$/i.test(files[0].name)){
      name=files[0].name;pages=await pdfAbrir(files[0],(p,n)=>{$('loadmsg').textContent=L('Lendo PDF… '+p+' de '+n,'Reading PDF… '+p+' of '+n)},manga?36:0);
      if(!manga){for(let p=0;p<pages.length;p++){$('loadmsg').textContent=L('Lendo PDF… '+(p+1)+' de '+pages.length,'Reading PDF… '+(p+1)+' of '+pages.length);pages[p].blob=await pages[p].get()}pages.fecha()}
    }else if(files.length===1 && /\\.epub$/i.test(files[0].name)){
      name=files[0].name;$('loadmsg').textContent=TR('Lendo EPUB…');pages=await epubPaginas(files[0],manga);
    }else if(files.length===1 && /\\.(cbz|zip)$/i.test(files[0].name)){""")
_r("const key='hq:'+name+':'+pages.length;","const key=(manga?'mg:':'hq:')+name+':'+pages.length;")
_r("book={name:name.replace(/\\.(cbr|cbz|zip|rar)$/i,''),key,pages,plans:new Array(pages.length).fill(null),inflight:new Map(),bitmaps:new Map()};",
"""book={name:name.replace(/\\.(cbr|cbz|zip|rar|pdf|epub)$/i,''),key,pages,plans:new Array(pages.length).fill(null),inflight:new Map(),bitmaps:new Map(),manga,crops:new Map()};
    if(manga){const s0=store.get(key,null),bk0=book;
      $('loading').hidden=true;if(!opt.daEstante)guardarLivro(key,book.name,files,pages[0].blob||await pages[0].get());
      openReader();if(!s0)mgSugerir(pages).then(m=>{if(m&&book===bk0&&MG.modo!=='web')setMg('web')});return}""")
_r("openFiles(files,{daEstante:true})}","openFiles(files,{daEstante:true,manga:!!it.manga})}")
_r("      for(const n of names){const b=await zip.files[n].async('uint8array');pages.push({name:n,blob:new Blob([b],{type:mimeOf(n)})})}\n    }else if(files.length===1 && /\\.(cbr|rar)$/i","      if(manga)pages=zipPreguicoso(zip,names,40);else for(const n of names){const b=await zip.files[n].async('uint8array');pages.push({name:n,blob:new Blob([b],{type:mimeOf(n)})})}\n    }else if(files.length===1 && /\\.(cbr|rar)$/i")
_r("indexedDB.open('hq-guiada',2)","indexedDB.open('hq-guiada',3)")
_r("if(!d.objectStoreNames.contains('livros'))d.createObjectStore('livros')}","if(!d.objectStoreNames.contains('livros'))d.createObjectStore('livros');if(!d.objectStoreNames.contains('indice'))d.createObjectStore('indice')}")
_r("const key=(manga?'mg:':'hq:')+name+':'+pages.length;","const key=opt.chave||await chaveLivro(files,name,manga,pages.length);idxGet(key).then(r=>{if(r&&!r.pag){r.pag=pages.length;idxPut(r)}});")
_r("guardarLivro(key,book.name,files,pages[0].blob||await pages[0].get());","guardarLivro(key,book.name,files,pages[0].blob||await pages[0].get(),'aparelho',pages.length);")
_r("guardarLivro(key,book.name,files,pages[0]&&pages[0].blob);","guardarLivro(key,book.name,files,pages[0]&&pages[0].blob,'aparelho',pages.length);")
# modulos novos antes do leitor
_cur=open('src/manga.js',encoding='utf-8').read()+'\n'+open('src/formatos.js',encoding='utf-8').read()+'\n'+open('src/biblioteca.js',encoding='utf-8').read()+'\n'+open('src/tema.js',encoding='utf-8').read()+'\n'+open('src/chatweb.js',encoding='utf-8').read()+'\naplicarTema();\n'
_k='/* ---------- leitor: motor WebGL ----------'
assert src.count(_k)==1
src=src.replace(_k,_cur+_k,1)
# ---- v0.45: modo fixo (apk/pc) + bibliotecas pesadas avaliadas sob demanda/ocioso ----
_modo=_sys.argv[1] if len(_sys.argv)>1 else 'auto'
src=src.replace("const MODO_FIXO='__MODO__';","const MODO_FIXO='"+('toque' if _modo=='apk' else 'web' if _modo=='pc' else 'auto')+"';")
if _modo in ('apk','pc'):
    _mm='toque' if _modo=='apk' else 'web'
    src=_re.sub(r'<script>\(function\(\)\{try\{var p=JSON\.parse\(localStorage\.getItem\("hq-ui"\).*?</script>','<script>document.documentElement.dataset.modo="'+_mm+'"</script>',src,count=1,flags=_re.S)
    src=_re.sub(r'\s*<label><span>Interface</span>\s*<select id="cfg-ui">.*?</select></label>','',src,count=1,flags=_re.S)
_lazy=[('HQP2P','window.HQP2P={joinRoom'),('pdfjsLib','window.pdfjsLib=Hv;'),('JSZip','JSZip v3.10.1'),('UnrarLib','self.UnrarLib={createExtractorFromData')]
for _nm,_sig in _lazy:
    _hit=None
    for _m in _re.finditer(r'<script>',src):
        _e=src.index('</script>',_m.end())
        _t=src[_m.end():_e]
        if len(_t)>10000 and _sig in _t[:300]+_t[-400:]:_hit=(_m.start(),_m.end(),_e);break
    assert _hit,_nm
    src=src[:_hit[0]]+'<script type="text/plain" data-lazy="'+_nm+'">'+src[_hit[1]:_hit[2]]+src[_hit[2]:]
_boot="""<script>(function(){var N=["pdfjsLib","JSZip","UnrarLib","HQP2P"],E={};function ld(n){var el=E[n];if(!el)return;E[n]=null;try{delete window[n]}catch(e){}(0,eval)(el.textContent);el.textContent=""}
N.forEach(function(n){var el=document.querySelector('script[data-lazy="'+n+'"]');if(!el)return;E[n]=el;Object.defineProperty(window,n,{configurable:true,get:function(){ld(n);return window[n]},set:function(v){try{delete window[n]}catch(e){}window[n]=v}})});
function aquece(i){if(i>=N.length)return;var f=function(){try{if(E[N[i]])void window[N[i]]}catch(e){}setTimeout(function(){aquece(i+1)},60)};(window.requestIdleCallback||function(g){setTimeout(g,200)})(f,{timeout:4000})}
window.addEventListener("load",function(){setTimeout(function(){aquece(0)},300)})})()</script>
"""
_i=src.index("<script>\n(function(){\n'use strict';")
src=src[:_i]+_boot+src[_i:]
open('dist/index.html','w',encoding='utf-8').write(src); print('ok',len(src))
