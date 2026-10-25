Object.assign(EN,{'Cortar bordas não vale no modo guiado — use Página inteira ou Vertical':'Trim borders does not apply in guided mode — use Full page or Vertical','Zoom salvo · vale para todas as páginas':'Zoom saved · applies to all pages','Zoom normal':'Normal zoom','Vertical · rolagem contínua · pinça ou dois toques para zoom':'Vertical · continuous scroll · pinch or double-tap to zoom','Vertical · deslize ou toque embaixo para rolar':'Vertical · swipe or tap at the bottom to scroll',' pinça ou dois toques; o zoom vale para as próximas páginas. No modo Vertical, as páginas rolam em sequência (como o webtoon) e o zoom vale para todas':' pinch or double-tap; the zoom carries to the next pages. In Vertical mode, pages scroll in sequence (like webtoon) and the zoom applies to all','Zoom':'Zoom','Efeito ao virar a página':'Page turn effect','Livro (página virando)':'Book (page turning)','Deslizar':'Slide','Empilhar':'Stack','Cobrir':'Cover','Zoom suave':'Soft zoom','Nenhum (só esmaecer)':'None (fade only)','Só no modo mangá. O Webtoon rola direto, sem efeito.':'Manga mode only. Webtoon scrolls directly, with no effect.','Qualidade do PDF':'PDF quality','Automática':'Automatic','Alta (mais nítida)':'High (sharper)','Máxima (usa mais memória)':'Maximum (uses more memory)','Vale na próxima vez que abrir o PDF.':'Applies the next time you open the PDF.','Tom da página':'Page tint','Normal':'Normal','Amarelo':'Yellow','Sépia':'Sepia','Âmbar (leitura à noite)':'Amber (night reading)','Azul':'Blue','Verde':'Green','Rosa':'Pink','Intensidade do tom':'Tint strength',
'Como ler mangá':'How to read manga','Avançar':'Next','Voltar':'Back','Modos':'Modes','Tom da página (Aa)':'Page tint (Aa)',
' toque na esquerda ou deslize para a direita':' tap the left or swipe right',' clique na esquerda, roda do mouse ou <kbd>←</kbd> <kbd>espaço</kbd>':' click the left, mouse wheel or <kbd>←</kbd> <kbd>space</kbd>',
' toque na direita ou deslize para a esquerda':' tap the right or swipe left',' clique na direita ou <kbd>→</kbd>':' click the right or <kbd>→</kbd>',
' Mangá, Ocidental, Vertical ou Webtoon na barra de baixo':' Manga, Western, Vertical or Webtoon on the bottom bar',' ✂ tira as margens da página':' ✂ trims the page margins',' amarelo, azul, sépia e outras cores para cansar menos a vista':' yellow, blue, sepia and other colors to be easier on the eyes','Ler mangá':'Reading manga','Modos de leitura':'Reading modes','Bordas e fundo':'Borders and background',
'Toque na <b>esquerda</b> da tela (ou deslize para a direita) para avançar; na <b>direita</b> para voltar.':'Tap the <b>left</b> side of the screen (or swipe right) to go forward; tap the <b>right</b> to go back.',
'Use as setas <kbd>←</kbd> para avançar e <kbd>→</kbd> para voltar, a roda do mouse ou a barra de espaço.':'Use the <kbd>←</kbd> key to go forward and <kbd>→</kbd> to go back, the mouse wheel or the space bar.',
'No menu, troque entre <b>Mangá</b> (direita para esquerda), <b>Ocidental</b>, <b>Vertical</b> e <b>Webtoon</b> (rolagem contínua). O app lembra o modo de cada obra.':'In the menu, switch between <b>Manga</b> (right to left), <b>Western</b>, <b>Vertical</b> and <b>Webtoon</b> (continuous scroll). The app remembers each title\'s mode.',
'O botão <b>✂ Cortar bordas</b> tira as margens da página. Em <b>Aa</b> você escolhe o fundo: preto, cinza ou branco.':'The <b>✂ Crop borders</b> button trims the page margins. In <b>Aa</b> you pick the background: black, gray or white.','Mangá':'Manga','Na aba <b>Mangá</b> o arquivo abre da direita para a esquerda, com as bordas cortadas. No menu, troque entre <b>Mangá</b>, <b>Ocidental</b>, <b>Vertical</b> e <b>Webtoon</b>. Serve PDF, CBZ, CBR, EPUB e imagens.':'In the <b>Manga</b> tab the file opens right-to-left with borders cropped. In the menu, switch between <b>Manga</b>, <b>Western</b>, <b>Vertical</b> and <b>Webtoon</b>. Works with PDF, CBZ, CBR, EPUB and images.','guiada':'guided','Mangá':'Manga','Mangá ←':'Manga ←','Ocidental →':'Western →','Cortar bordas':'Crop borders','Cortar bordas das páginas':'Crop page borders',
'Fundo atrás da página':'Page background','Cinza':'Gray','Branco':'White','Espaço entre páginas (webtoon)':'Space between pages (webtoon)',
'Bordas cortadas':'Borders cropped','Bordas originais':'Original borders','Lendo PDF…':'Reading PDF…','Lendo EPUB…':'Reading EPUB…','Esse PDF não tem páginas.':'This PDF has no pages.'});
/* ---------- modo mangá: PDF/CBZ/EPUB, direção, corte de bordas, webtoon ---------- */
const MG=Object.assign({modo:'rtl',crop:true,bg:'preto',gap:false},store.get('hq-mg',{}));
const MGBG={preto:[0,0,0],cinza:[40,40,44],branco:[255,255,255]};
const MGNOME={rtl:['Mangá ←','Manga ←'],ltr:['Ocidental →','Western →'],v:['Vertical','Vertical'],web:['Webtoon','Webtoon']};
function mgSalvarCfg(){store.set('hq-mg',MG)}
const ehManga=()=>!!(book&&book.manga);
const mgDir=()=>ehManga()?(wtOn?null:MG.modo):(HQV&&!guided?'v':null);
let guidedSalvo=null,wtOn=false;
const pgBlob=async(i,q,pri)=>{const p=book.pages[i];return p.blob||await p.get(q,pri)};
const wt=$('wt');const wti=document.createElement('div');wti.id='wti';wt.append(wti);
function mgBgCss(){const c=MGBG[MG.bg]||MGBG.preto;return 'rgb('+c[0]+','+c[1]+','+c[2]+')'}

/* corte de bordas: acha a caixa do conteúdo comparando cada ponto com a cor do canto (mediana dos 4 cantos) */
function cortarCalc(src,sw,sh,soLados){
  const k=Math.min(1,480/Math.max(sw,sh)),w=Math.max(12,Math.round(sw*k)),h=Math.max(12,Math.round(sh*k));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);
  let d;try{d=x.getImageData(0,0,w,h).data}catch(e){return null}
  const cs=[];for(const [ox,oy] of [[0,0],[w-5,0],[0,h-5],[w-5,h-5]])for(let yy=0;yy<5;yy++)for(let xx=0;xx<5;xx++){const q=((oy+yy)*w+ox+xx)*4;cs.push([d[q],d[q+1],d[q+2]])}
  const med=ch=>{const a=cs.map(v=>v[ch]).sort((p,q)=>p-q);return a[a.length>>1]};
  const R=med(0),G=med(1),B=med(2),TOL=34,rows=new Uint16Array(h),cols=new Uint16Array(w);
  for(let yy=1;yy<h-1;yy++)for(let xx=1;xx<w-1;xx++){const q=(yy*w+xx)*4;
    if(Math.abs(d[q]-R)>TOL||Math.abs(d[q+1]-G)>TOL||Math.abs(d[q+2]-B)>TOL){rows[yy]++;cols[xx]++}}
  c.width=c.height=0;
  const mr=Math.max(2,w*0.004),mc=Math.max(2,h*0.004),fr=Array.from(rows,v=>v>=mr),fc=Array.from(cols,v=>v>=mc);
  const ini=f=>{for(let i=0;i<f.length-2;i++)if(f[i]&&f[i+1]&&f[i+2])return i;return -1};
  const fim=f=>{for(let i=f.length-1;i>=2;i--)if(f[i]&&f[i-1]&&f[i-2])return i;return -1};
  let y0=ini(fr),y1=fim(fr),x0=ini(fc),x1=fim(fc);
  if(y0<0||x0<0||y1<=y0||x1<=x0)return null;
  const px=Math.round(w*0.012)+1,py=Math.round(h*0.012)+1;
  x0=Math.max(0,x0-px);x1=Math.min(w-1,x1+px);y0=soLados?0:Math.max(0,y0-py);y1=soLados?h-1:Math.min(h-1,y1+py);
  const area=(x1-x0+1)*(y1-y0+1)/(w*h);if(area>0.97||area<0.3)return null;
  const r=[Math.round(x0/k),Math.round(y0/k),Math.round((x1-x0+1)/k),Math.round((y1-y0+1)/k)];
  r[0]=Math.min(r[0],sw-2);r[1]=Math.min(r[1],sh-2);r[2]=Math.max(2,Math.min(r[2],sw-r[0]));r[3]=Math.max(2,Math.min(r[3],sh-r[1]));return r}

/* ---------- mudar de modo ---------- */
function mgEntrar(s){
  lzTroca('hq-lz-mg');guidedSalvo=guided;guided=false;document.documentElement.dataset.leitura='manga';
  MG.modo=(s&&s.m)||book.sugModo||MG.modo;if(!MGNOME[MG.modo])MG.modo='rtl';
  if(MG.modo==='web'||MG.modo==='v')wtAbrir();mgUI()}
function mgSair(){
  lzTroca('hq-lz');wtFechar();document.documentElement.removeAttribute('data-leitura');
  $('slider').style.direction='';$('prev').onclick=prev;$('next').onclick=next;
  $('prev').setAttribute('aria-label',L('Voltar','Back'));$('next').setAttribute('aria-label',L('Avançar','Next'));
  if(guidedSalvo!==null){guided=guidedSalvo;guidedSalvo=null}
  try{book&&book.pages&&book.pages.fecha&&book.pages.fecha()}catch(e){}}
function mgUI(){
  for(const b of document.querySelectorAll('#mseg button'))b.classList.toggle('on',b.dataset.m===MG.modo);
  $('mg-crop').classList.toggle('on',MG.crop);$('cfg-crop').checked=MG.crop;$('cfg-mbg').value=MG.bg;$('cfg-gap').checked=MG.gap;
  $('cfg-gap').closest('label').style.display=(MG.modo==='web'||MG.modo==='v')?'':'none';
  const rtl=MG.modo==='rtl';$('slider').style.direction=rtl?'rtl':'';
  $('prev').onclick=rtl?next:prev;$('next').onclick=rtl?prev:next;
  $('prev').setAttribute('aria-label',L(rtl?'Avançar':'Voltar',rtl?'Next':'Back'));$('next').setAttribute('aria-label',L(rtl?'Voltar':'Avançar',rtl?'Back':'Next'));
  wrap.style.background=mgBgCss();wt.style.background=mgBgCss();if(book&&cur){pintarFundo();pedir()}}
function setMg(m,quieto){
  if(!ehManga()||MG.modo===m||!MGNOME[m])return;const eraWeb=wtOn;MG.modo=m;mgSalvarCfg();
  const quer=(m==='web'||m==='v');
  if(quer&&!eraWeb)wtAbrir();
  else if(!quer&&eraWeb){wtFechar();mgRecarregar()}
  else if(quer&&eraWeb)wtZoomIniciar();
  mgUI();if(!quieto)toast(L('Modo: ','Mode: ')+LN(MGNOME[m]));agendarSalvar()}
function mgRecarregar(){if(!ehManga()||wtOn)return;soltarTudo();book.plans.fill(null);openPage(pi)}
function mgCrop(on){MG.crop=on;mgSalvarCfg();book.crops.clear();mgUI();
  if(wtOn){wtAbrir()}else mgRecarregar();toast(TR(on?'Bordas cortadas':'Bordas originais'))}
for(const b of document.querySelectorAll('#mseg button'))b.onclick=()=>setMg(b.dataset.m);
function hqCrop(){
  if(guided&&!wtOn){toast(TR('Cortar bordas não vale no modo guiado — use Página inteira ou Vertical'));return}
  HC=!HC;store.set('hq-crop',HC);book.crops.clear();book.cplans=[];botoesHQ();
  if(wtOn)wtAbrir();else{soltarTudo();openPage(pi)}
  toast(TR(HC?'Bordas cortadas':'Bordas originais'))}
$('mg-crop').onclick=()=>{if(!book)return;if(ehManga())mgCrop(!MG.crop);else hqCrop()};$('cfg-crop').onchange=e=>{if(ehManga())mgCrop(e.target.checked)};
$('cfg-mbg').onchange=e=>{MG.bg=e.target.value;mgSalvarCfg();mgUI();if(wtOn)wt.style.background=mgBgCss()};
$('cfg-gap').onchange=e=>{MG.gap=e.target.checked;mgSalvarCfg();wt.classList.toggle('gap',MG.gap)};

/* ---------- webtoon: rolagem contínua, só as páginas perto da tela ficam carregadas ---------- */
let wtObs=null,wtRaf=0,wtMexeu=false,wtAlvo=0,wtTm=[];const wtUrls=new Map();
function wtAvisar(){}   // aviso removido (0.49)
function wtAbrir(){
  wtLimpar();wtAvisar(true);wtOn=true;wt.hidden=false;wt.classList.toggle('gap',MG.gap);wt.style.background=mgBgCss();
  const fr=document.createDocumentFragment();
  book.pages.forEach((p,i)=>{const d=document.createElement('div');d.className='it';d.dataset.i=i;d.style.aspectRatio=(p.w&&p.h)?p.w+'/'+p.h:'1/1.45';fr.append(d)});
  wti.append(fr);const bk=book;
  bk.pages.onDim=i=>{const el=wti.children[i];if(el&&!el.dataset.s){const p=bk.pages[i];el.style.aspectRatio=p.w+'/'+p.h}
    // as alturas das paginas chegam aos poucos (PDF): enquanto o leitor nao mexeu, mantem a posicao de retomada e carrega o que esta na tela
    if(wtOn&&book===bk&&!wtMexeu){const a=wti.children[wtAlvo];if(a)wt.scrollTop=a.offsetTop;wtAgendarVarrer()}};
  wtObs=new IntersectionObserver(es=>{for(const e of es){const i=+e.target.dataset.i;if(e.isIntersecting)wtCarregar(i,e.target,bk);else wtLiberar(i,e.target)}},{root:wt,rootMargin:'120% 0px'});
  for(const el of wti.children)wtObs.observe(el);
  wtZoomIniciar();wtMexeu=false;wtAlvo=pi;clearInterval(wtSeg);wtSeg=setInterval(wtVarrer,1500);wtIr(pi);for(const t of wtTm)clearTimeout(t);wtTm=[0,120,400,900,1800].map(ms=>setTimeout(()=>{if(wtOn&&book===bk){if(!wtMexeu){const a=wti.children[wtAlvo];if(a)wt.scrollTop=a.offsetTop}wtVarrer();wtRepintar()}},ms))}
// carrega direto o que esta perto da tela, sem depender so do IntersectionObserver (na WebView ele pode nao disparar ate o primeiro toque)
function wtVarrer(){if(!wtOn||!book)return;const h=wt.clientHeight||innerHeight,top=wt.scrollTop-h*1.2,bot=wt.scrollTop+h*2.2,bk=book;
  for(const el of wti.children){const y=el.offsetTop,b=y+el.offsetHeight;if(b<top||y>bot){if(el.dataset.s)wtLiberar(+el.dataset.i,el)}else if(!el.dataset.s)wtCarregar(+el.dataset.i,el,bk);else if(el.dataset.f)wtFatiasFaltam(el,bk)}}
let wtVT=0,wtSeg=0;function wtAgendarVarrer(delay){if(wtVT)return;wtVT=setTimeout(()=>{wtVT=0;wtVarrer()},delay||300)}
// empurra a WebView a pintar a lista (evita tela branca ate o primeiro toque)
function wtRepintar(){if(!wtOn)return;const t=wt.scrollTop;requestAnimationFrame(()=>{if(!wtOn)return;wt.scrollTop=t+1;requestAnimationFrame(()=>{if(wtOn&&!wtMexeu)wt.scrollTop=t})})}
for(const ev of ['pointerdown','touchstart','wheel','keydown'])wt.addEventListener(ev,()=>{wtMexeu=true;wtAvisar(false)},{passive:true,capture:true});
function wtLimpar(){wtAvisar(false);clearInterval(wtSeg);if(wtObs){wtObs.disconnect();wtObs=null}for(const u of wtUrls.values())URL.revokeObjectURL(u);wtUrls.clear();wti.replaceChildren()}
function wtFechar(){if(!wtOn&&wt.hidden)return;wtOn=false;wt.hidden=true;wtLimpar();VZ=1;wtZoomCss()}
// ---- pagina comprida de PDF: fatias de ~2000 px empilhadas ----
function wtFatiasFaltam(el,bk){const p=bk.pages[+el.dataset.i];if(!p||!p.fatia)return;const h=wt.clientHeight||innerHeight,top=wt.scrollTop-h*1.2,bot=wt.scrollTop+h*2.2;
  for(const d of el.children){if(d.firstChild||d.dataset.p)continue;const y=el.offsetTop+d.offsetTop;if(y+d.offsetHeight<top||y>bot)continue;wtFatia(+el.dataset.i,el,d,bk,p)}}
async function wtFatia(i,el,d,bk,p){const k=+d.dataset.k;d.dataset.p='1';
  const near=()=>{if(book!==bk||!el.isConnected||el.dataset.s!=='1'||!d.isConnected)return false;const h=wt.clientHeight||innerHeight,y=el.offsetTop+d.offsetTop;return y+d.offsetHeight>=wt.scrollTop-h*1.5&&y<=wt.scrollTop+h*2.5};
  const dist=()=>Math.abs(el.offsetTop+d.offsetTop+d.offsetHeight/2-(wt.scrollTop+(wt.clientHeight||innerHeight)/2));
  try{const blob=await p.fatia(k,near,dist);if(book!==bk||el.dataset.s!=='1'||!d.isConnected)return;
    const u=URL.createObjectURL(blob);wtUrls.set(i+':'+k,u);const im=new Image();im.alt='';im.decoding='async';im.style.cssText='display:block;width:100%;height:100%';
    im.onload=()=>{if(d.isConnected){d.replaceChildren(im);delete d.dataset.p;if(!wtMexeu)wtRepintar()}};
    im.onerror=()=>{delete d.dataset.p;d.textContent='⚠'};im.src=u}
  catch(e){delete d.dataset.p;if(e&&e.message==='cancelado'){wtAgendarVarrer();return}
    const t=(+d.dataset.t||0)+1;d.dataset.t=t;
    if(t<3){wtAgendarVarrer(1200)}else{d.dataset.p='1';d.textContent='⚠ '+L('Falha ao carregar. Toque para tentar de novo.','Failed to load. Tap to retry.')+' ['+(e&&e.message||e)+']';d.style.cssText+=';color:#f88;font:600 13px sans-serif;padding:12px';
      d.onclick=ev=>{ev.stopPropagation();d.onclick=null;d.dataset.t=0;d.textContent='';d.style.color='';delete d.dataset.p;wtVarrer()}}}}
function wtMontarFatias(el,p){const n=p.ns(),fr=document.createDocumentFragment();el.dataset.f='1';
  for(let k=0;k<n;k++){const d=document.createElement('div'),hs=k<n-1?2000:p.h-(n-1)*2000;d.dataset.k=k;d.style.cssText='position:relative;width:100%;aspect-ratio:'+p.w+'/'+Math.max(1,hs);fr.append(d)}
  el.replaceChildren(fr);wtFatiasFaltam(el,book)}
async function wtCarregar(i,el,bk){
  if(el.dataset.s)return;el.dataset.s='1';
  {const p=bk.pages[i];if(p&&p.fatia&&p.ns()>1){wtMontarFatias(el,p);return}}
  const q=()=>{if(book!==bk||!el.isConnected||el.dataset.s!=='1')return false;const h=wt.clientHeight||innerHeight,y=el.offsetTop,b=y+el.offsetHeight;return b>=wt.scrollTop-h*1.5&&y<=wt.scrollTop+h*2.5};
  try{const blob=await pgBlob(i,q,()=>Math.abs(i-pi));if(book!==bk||el.dataset.s!=='1'||!el.isConnected)return;
    const u=URL.createObjectURL(blob);wtUrls.set(i,u);const im=new Image();im.alt='';im.decoding='async';
    im.onload=()=>{if(el.dataset.s!=='1'||book!==bk)return;{const h=wt.clientHeight||innerHeight;if(el.offsetTop+el.offsetHeight>=wt.scrollTop&&el.offsetTop<=wt.scrollTop+h)wtAvisar(false)}const W=im.naturalWidth,H=im.naturalHeight;let r=null;
      if(bk.manga?MG.crop:HC){r=bk.crops.has('w'+i)?bk.crops.get('w'+i):cortarCalc(im,W,H,true);bk.crops.set('w'+i,r)}
      const cw=r?r[2]:W,ch=r?r[3]:H;el.style.aspectRatio=cw+'/'+ch;
      if(r){im.style.cssText='position:absolute;top:0;width:'+(W/cw*100)+'%;left:-'+(r[0]/cw*100)+'%'}
      el.replaceChildren(im);if(!wtMexeu)wtRepintar()};
    im.onerror=()=>{if(el.dataset.s==='1')el.textContent='⚠ imagem invalida'};im.src=u}
  catch(e){if(el.dataset.s!=='1'||book!==bk)return;
    if(e&&e.message==='cancelado'){delete el.dataset.s;wtAgendarVarrer();return}
    // falha de verdade: tenta no maximo 3 vezes (antes tentava para sempre e travava o aparelho) e mostra o motivo
    const t=(+el.dataset.t||0)+1;el.dataset.t=t;
    if(t<3){delete el.dataset.s;wtAgendarVarrer(1200)}
    else{el.textContent='⚠ '+L('Não consegui carregar esta página. Toque para tentar de novo.','Could not load this page. Tap to retry.')+' ['+(e&&e.message||e)+']';el.style.color='#f88';el.style.font='600 14px sans-serif';el.style.padding='16px';
      el.onclick=ev=>{ev.stopPropagation();el.onclick=null;el.dataset.t=0;el.textContent='';el.style.color='';delete el.dataset.s;wtVarrer()}}}}   // cancelada ou falhou: libera para tentar de novo quando voltar a ser necessaria
function wtLiberar(i,el){
  if(!el.dataset.s)return;delete el.dataset.s;delete el.dataset.f;el.replaceChildren();for(const [k,u] of [...wtUrls]){if(k===i||String(k).startsWith(i+':')){wtUrls.delete(k);setTimeout(()=>URL.revokeObjectURL(u),400)}}}
function wtIr(i){const el=wti.children[i];pi=i;if(el)wt.scrollTop=el.offsetTop;label();agendarSalvar()}
function wtPos(){
  const n=wti.children.length;if(!n)return;let k;
  if(wt.scrollTop+wt.clientHeight>=wt.scrollHeight-4)k=n-1;
  else{const y=wt.scrollTop+wt.clientHeight*0.35;let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(wti.children[m].offsetTop<=y)lo=m;else hi=m-1}k=lo}
  if(k!==pi){pi=k;label();agendarSalvar()}}
const wtFundo=()=>wt.scrollTop+wt.clientHeight>=wt.scrollHeight-6;
function wtRolar(d){if(d>0&&wtFundo()){fimMostrar();return}wt.scrollBy({top:d*wt.clientHeight*0.85,behavior:CFG.anim?'smooth':'auto'})}
wt.addEventListener('scroll',()=>{lastInput=performance.now();if(wtRaf)return;wtRaf=requestAnimationFrame(()=>{wtRaf=0;wtPos()})},{passive:true});
// webtoon: estava no fim e continua puxando para baixo -> aviso de fim
let wtFimY=null,wtFimW=0,wtFimWT=0;
wt.addEventListener('touchstart',e=>{wtFimY=(wtFundo()&&e.touches.length===1)?e.touches[0].clientY:null},{passive:true});
wt.addEventListener('touchmove',e=>{if(wtFimY!==null&&wtFimY-e.touches[0].clientY>70){wtFimY=null;fimMostrar()}},{passive:true});
wt.addEventListener('wheel',e=>{if(e.deltaY>0&&wtFundo()){const t=performance.now();if(t-wtFimWT>700)wtFimW=0;wtFimWT=t;wtFimW+=e.deltaY;if(wtFimW>160){wtFimW=0;fimMostrar()}}else wtFimW=0},{passive:true});
wt.addEventListener('pointerdown',e=>e.stopPropagation());
wt.addEventListener('pointerup',e=>e.stopPropagation());
wt.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
wt.addEventListener('click',e=>{const rc=wt.getBoundingClientRect(),h=wt.clientHeight,y=e.clientY-rc.top;
  if(y>h*0.3&&y<h*0.7){
    if(wtVert()){const t=performance.now();
      if(wtTapT&&t-wtTapAt<300){clearTimeout(wtTapT);wtTapT=null;wtZoomSet(VZ>1.05?1:2.2,e.clientX-rc.left,y,true);toast(TR(VZ>1.05?'Zoom salvo · vale para todas as páginas':'Zoom normal'));return}
      wtTapAt=t;clearTimeout(wtTapT);wtTapT=setTimeout(()=>{wtTapT=null;if(!barrasFixas())menu(!menuAberto())},280);return}
    if(!barrasFixas())menu(!menuAberto());return}
  if(menuAberto()){menu(false);return}wtRolar(y>=h*0.7?1:-1)});

/* ---------- vertical: rolagem continua (como o webtoon), com o zoom que o leitor escolher ---------- */
let VZ=1,wtTapT=null,wtTapAt=0,pz=null;
const wtVert=()=>!!(wtOn&&book&&(book.manga?MG.modo==='v':HQV));
const vzKey=()=>book&&book.manga?'hq-vz-mg':'hq-vz';
function wtZoomCss(){const base=Math.min(wt.clientWidth||innerWidth,900);wt.style.setProperty('--iw',(base*VZ)+'px');wt.classList.toggle('zm',VZ>1.001)}
function wtZoomIniciar(){VZ=wtVert()?Math.min(5,Math.max(1,+store.get(vzKey(),1)||1)):1;wtZoomCss();if(VZ>1.001)wt.scrollLeft=Math.max(0,(wt.scrollWidth-wt.clientWidth)/2)}
let zAnim=null;
const zClamp=z=>Math.min(5,Math.max(1,z));
/* aplica o zoom de verdade (1 vez so): troca a largura das paginas e acerta a rolagem para o ponto do toque ficar no lugar */
function wtZoomCommit(z,sx,sy,mx,my,salvar){const o=VZ;VZ=zClamp(z);wtZoomCss();wti.style.transform='';wti.style.transformOrigin='';wti.style.willChange='';
  const k=VZ/o;wt.scrollLeft=VZ>1.001?sx*k-mx:0;wt.scrollTop=sy*k-my;if(salvar)store.set(vzKey(),+VZ.toFixed(2))}
/* dois toques / roda: animacao suave so com transform (GPU), sem recalcular as paginas a cada quadro */
function wtZoomSet(z,fx,fy,salvar){z=zClamp(z);if(Math.abs(z-VZ)<0.001||zAnim)return;
  const sx=wt.scrollLeft+fx,sy=wt.scrollTop+fy,r=z/VZ;
  if(!wti.animate){wtZoomCommit(z,sx,sy,fx,fy,salvar);return}
  wti.style.transformOrigin=sx+'px '+sy+'px';wti.style.willChange='transform';
  zAnim=wti.animate([{transform:'scale(1)'},{transform:'scale('+r+')'}],{duration:(CFG.anim&&!RM.matches)?230:1,easing:'cubic-bezier(.22,.8,.3,1)',fill:'forwards'});
  zAnim.onfinish=()=>{const a=zAnim;zAnim=null;a.cancel();wtZoomCommit(z,sx,sy,fx,fy,salvar)}}
const dist2=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
const pto=(t,rc)=>[(t[0].clientX+t[1].clientX)/2-rc.left,(t[0].clientY+t[1].clientY)/2-rc.top];
wt.addEventListener('touchstart',e=>{if(wtVert()&&e.touches.length===2&&!zAnim){const rc=wt.getBoundingClientRect(),m=pto(e.touches,rc);
  pz={d:dist2(e.touches),z0:VZ,m0:m,m:m,r:1,sx:wt.scrollLeft+m[0],sy:wt.scrollTop+m[1]};wti.style.transformOrigin=pz.sx+'px '+pz.sy+'px';wti.style.willChange='transform'}},{passive:true});
/* pinca: so transform enquanto os dedos mexem (suave); o tamanho real das paginas muda uma vez ao soltar */
wt.addEventListener('touchmove',e=>{if(!pz||!wtVert()||e.touches.length!==2)return;e.preventDefault();
  const rc=wt.getBoundingClientRect(),m=pto(e.touches,rc);pz.r=zClamp(pz.z0*dist2(e.touches)/pz.d)/pz.z0;pz.m=m;
  wti.style.transform='translate('+(m[0]-pz.m0[0])+'px,'+(m[1]-pz.m0[1])+'px) scale('+pz.r+')'},{passive:false});
const pzFim=e=>{if(pz&&(!e.touches||e.touches.length<2)){const q=pz;pz=null;wtZoomCommit(q.z0*q.r,q.sx,q.sy,q.m[0],q.m[1],true)}};
wt.addEventListener('touchend',pzFim,{passive:true});wt.addEventListener('touchcancel',pzFim,{passive:true});
wt.addEventListener('wheel',e=>{if(!wtVert()||!e.ctrlKey)return;e.preventDefault();const rc=wt.getBoundingClientRect();wtZoomSet(VZ*Math.exp(-e.deltaY*0.01),e.clientX-rc.left,e.clientY-rc.top,true)},{passive:false});
new ResizeObserver(()=>{if(wtVert())wtZoomCss()}).observe(wt);

/* ---------- formato do arquivo e modo sugerido ---------- */
async function mgSugerir(pages){
  try{const rs=[];const idx=[...new Set([0,Math.floor(pages.length/2),1].filter(k=>k>=0&&k<pages.length))];
    for(const k of idx){const p=pages[k];if(p.w&&p.h){rs.push(p.h/p.w);continue}
      const bm=await createImageBitmap(p.blob||await p.get(),{resizeWidth:60});rs.push(bm.height/bm.width);bm.close&&bm.close()}
    rs.sort((a,b)=>a-b);return rs[rs.length>>1]>2.2?'web':null}catch(e){return null}}

/* ---------- abas da biblioteca: HQ | Mangá ---------- */
let aba=store.get('hq-aba','hq')==='manga'?'manga':'hq';
function setAba(k){aba=k;store.set('hq-aba',k);if(k==='manga')setTimeout(pdfPre,300);renderRecent()}
if(aba==='manga')setTimeout(pdfPre,1200);
function abasUI(){document.documentElement.dataset.aba=aba;if(typeof aplicarTema==='function')aplicarTema();
  for(const b of document.querySelectorAll('#abas button')){const on=b.dataset.k===aba;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)}
  const m=aba==='manga';
  $('brand-sub').textContent=m?L('leitura de mangá · PDF, webtoon e mais · feito no Brasil','manga reading · PDF, webtoon and more · made in Brazil'):L('leitura guiada de quadrinhos · quadro a quadro · feito no Brasil','guided comic reading · panel by panel · made in Brazil');
  const ab=m?L('＋ Abrir mangá','＋ Open manga'):L('＋ Abrir HQ','＋ Open comic');$('abrir-top').textContent=ab;$('fab').textContent=ab;
  $('drop-t').textContent=m?L('Abra um mangá','Open a manga'):L('Abra uma HQ','Open a comic');
  $('rodape').textContent=m?L('O mangá abre direto, sem preparo, e fica guardado neste aparelho. Nada sai do seu aparelho.','Manga opens right away, no preparation, and stays saved on this device. Nothing leaves your device.'):L('Antes de ler, cada HQ é preparada (só na primeira vez) para a passagem de quadros ficar lisa. Nada sai do seu aparelho.','Before reading, each comic is prepared (first time only) so panel changes run smooth. Nothing leaves your device.');
  $('drop-fmt').textContent=m?L('PDF, CBZ, CBR, ZIP, RAR, EPUB ou várias imagens · fica guardado neste aparelho','PDF, CBZ, CBR, ZIP, RAR, EPUB or several images · stays saved on this device'):L('CBR, CBZ, ZIP, RAR ou várias imagens · fica guardada neste aparelho','CBR, CBZ, ZIP, RAR or several images · stays saved on this device');
  $('drop-modo').textContent=m?L('Vai abrir como mangá: da direita para a esquerda, bordas cortadas, com modos vertical e webtoon.','Opens as manga: right-to-left, cropped borders, with vertical and webtoon modes.'):L('Vai abrir como HQ: leitura guiada, quadro a quadro, com detecção de balões.','Opens as a comic: guided panel-by-panel reading with balloon detection.');
  $('vazio').textContent=m?L('Sua estante de mangá está vazia. Escolha um PDF, CBZ ou EPUB abaixo e a capa aparece aqui.','Your manga shelf is empty. Pick a PDF, CBZ or EPUB below and the cover shows up here.'):L('Nenhuma HQ ainda. Escolha um arquivo abaixo e ela aparece aqui.','No comics yet. Pick a file below and it shows up here.')}
for(const b of document.querySelectorAll('#abas button'))b.onclick=()=>setAba(b.dataset.k);
window.__mg=()=>({pi,wtOn,modo:MG.modo,crop:MG.crop,guided,menu:menuAberto(),tw:(texs.get(pi)||{}).w,th:(texs.get(pi)||{}).h,n:book&&book.pages.length,cargas:[...wti.children].filter(e=>e.dataset.s).length,itens:wti.children.length,scrollH:wt.scrollHeight,sc:wt.scrollTop});
window.__voltar=()=>voltarBiblioteca();

function recusarHQ(files){const e=$('err');$('loading').hidden=true;e.hidden=false;
  e.textContent=L('PDF e EPUB são formatos de mangá. A aba HQ lê CBR, CBZ, ZIP, RAR e imagens. Para ler este arquivo, use a aba Mangá.','PDF and EPUB are manga formats. The Comic tab reads CBR, CBZ, ZIP, RAR and images. To read this file, use the Manga tab.');
  const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=L('Abrir na aba Mangá','Open in the Manga tab');b.style.cssText='display:block;margin:12px auto 0';
  b.onclick=()=>{e.hidden=true;setAba('manga');openFiles(files,{manga:true})};e.append(b)}

/* ---------- formatos aceitos por aba ---------- */
const EXT_HQ=/\.(cbz|cbr|zip|rar)$/i,EXT_MG=/\.(cbz|cbr|zip|rar|pdf|epub)$/i;
function checarFormato(files,manga){
  if(!manga&&files.some(f=>/\.(pdf|epub)$/i.test(f.name)))return 'trocar';
  const ok=f=>(manga?EXT_MG:EXT_HQ).test(f.name)||IMG.test(f.name);
  return files.some(ok)?null:'invalido'}
function formatoInvalido(manga){const e=$('err');$('loading').hidden=true;e.hidden=false;
  e.textContent=manga?L('Esse formato não é lido na aba Mangá. Aqui abrem PDF, CBZ, CBR, ZIP, RAR, EPUB e imagens.','This format is not supported in the Manga tab. It opens PDF, CBZ, CBR, ZIP, RAR, EPUB and images.')
    :L('Esse formato não é lido na aba HQ. Aqui abrem CBR, CBZ, ZIP, RAR e imagens. Para PDF ou EPUB, use a aba Mangá.','This format is not supported in the Comic tab. It opens CBR, CBZ, ZIP, RAR and images. For PDF or EPUB, use the Manga tab.')}

/* ---------- tom da página (amarelo, azul...) ---------- */
const TONS={normal:null,amarelo:[255,214,64],sepia:[235,196,140],ambar:[255,160,60],azul:[110,170,255],verde:[120,222,140],rosa:[255,150,190]};
const TOM=Object.assign({cor:'normal',int:0.5},store.get('hq-tom',{}));
function tomAplicar(){const el=$('tom'),c=TONS[TOM.cor];if(!c){el.style.display='none';return}
  el.style.display='block';el.style.background='rgb('+c[0]+','+c[1]+','+c[2]+')';el.style.opacity=TOM.int}
$('cfg-pdfq').value=store.get('hq-pdfq','auto');$('cfg-pdfq').onchange=e=>{store.set('hq-pdfq',e.target.value);try{toast(L('Qualidade do PDF: vale na próxima abertura.','PDF quality: applies the next time you open it.'))}catch(x){}};
$('cfg-tom').value=TOM.cor;$('cfg-tom-i').value=TOM.int;
$('cfg-tom').onchange=e=>{TOM.cor=e.target.value;store.set('hq-tom',TOM);tomAplicar();$('cfg-tom-i').closest('label').style.display=TOM.cor==='normal'?'none':''};
$('cfg-tom-i').oninput=e=>{TOM.int=+e.target.value;store.set('hq-tom',TOM);tomAplicar()};
$('cfg-tom-i').closest('label').style.display=TOM.cor==='normal'?'none':'';tomAplicar();
