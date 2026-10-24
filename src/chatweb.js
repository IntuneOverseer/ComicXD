/* ---------- chat: janela flutante (web), links com aviso e cores ---------- */
Object.assign(EN,{'Cor do chat':'Chat color','Minimizar':'Minimize','Avisar antes de abrir links':'Warn before opening links','Você está saindo do app':'You are leaving the app','Este link abre um <b>site externo</b>, fora do ComicXD. O app não verifica o conteúdo dele. Confira o endereço:':'This link opens an <b>external site</b>, outside ComicXD. The app does not check its content. Please check the address:','Tem certeza que deseja acessar?':'Are you sure you want to open it?','Não mostrar este aviso novamente':'Do not show this warning again','Acessar':'Open'});
const ehWebCx=()=>document.documentElement.dataset.modo==='web';
/* links */
const URL_RE=/https?:\/\/[^\s<>"']+/gi;
function txtLinks(t){const d=document.createElement('div');d.className='cx-t';let i=0,m;URL_RE.lastIndex=0;
  while((m=URL_RE.exec(t))){let u=m[0];while(/[.,;:!?)\]}]$/.test(u))u=u.slice(0,-1);let ok=false;try{const x=new URL(u);ok=x.protocol==='http:'||x.protocol==='https:'}catch(e){}
    if(!ok){URL_RE.lastIndex=m.index+m[0].length;continue}
    d.append(t.slice(i,m.index));const b=document.createElement('button');b.type='button';b.className='cx-link';b.textContent=u;b.title=u;b.onclick=()=>linkIr(u);d.append(b);i=m.index+u.length;URL_RE.lastIndex=i}
  d.append(t.slice(i));return d}
function linkAbrir(u){try{window.open(u,'_blank','noopener,noreferrer')}catch(e){}}
function linkIr(u){if(store.get('hq-link-ok',false)){linkAbrir(u);return}
  $('ld-url').textContent=u;$('ld-nao').checked=false;$('link-dlg').hidden=false;$('ld-ok').focus();
  $('ld-ok').onclick=()=>{if($('ld-nao').checked){store.set('hq-link-ok',true);cxUI()}$('link-dlg').hidden=true;linkAbrir(u)};
  $('ld-x').onclick=()=>{$('link-dlg').hidden=true}}
$('link-dlg').addEventListener('keydown',e=>{if(e.key==='Escape')$('link-dlg').hidden=true});
/* cores do chat */
const CXN={neon:['Neon (padrão)','Neon (default)'],app:['Cor do app','App color'],azul:['Azul','Blue'],verde:['Verde','Green'],roxo:['Roxo','Purple'],rosa:['Rosa suave','Soft pink'],laranja:['Laranja','Orange'],grafite:['Grafite','Graphite'],custom:['Personalizada','Custom']};
const CXC={azul:'#2f8cff',verde:'#2fbf71',roxo:'#8a5cff',rosa:'#f4a3c4',laranja:'#ff8a3d',grafite:'#9aa4b8'};
const CX=Object.assign({id:'neon',cor:'#2f8cff'},store.get('hq-chat-cor',{}));
function cxVars(hx){const c=hex2(hx),bg=[7,10,22],m=(t,a,b)=>rgb2(mixc(a,b,t)),w=[255,255,255],rg=a=>a.map(Math.round).join(',');
  return {'--cxa':rgb2(c),'--cxa2':m(.45,c,w),'--cxl':m(.22,bg,c),'--cxl2':m(.38,bg,c),'--cxb':m(.06,bg,c),'--cxh':m(.03,bg,c),'--cxp':m(.3,c,w),'--cxs':m(.7,c,w),'--cxi':m(.09,bg,c),'--cxc':m(.12,bg,c),'--cxar':rg(c),'--cxpr':rg(mixc(c,w,.3)),'--cxsr':rg(mixc(c,w,.7))}}
const CX_KEYS=['--cxa','--cxa2','--cxl','--cxl2','--cxb','--cxh','--cxp','--cxs','--cxi','--cxc','--cxar','--cxpr','--cxsr'];
function cxAplicarCor(hx){const s=$('chat').style;if(!hx){for(const k of CX_KEYS)s.removeProperty(k);return}const v=cxVars(hx);for(const k in v)s.setProperty(k,v[k])}
function cxCorAtual(){if(CX.id==='neon')return null;if(CX.id==='app'){const a=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();return /^#[0-9a-f]{6}$/i.test(a)?a:'#ff6a3d'}if(CX.id==='custom')return CX.cor;return CXC[CX.id]||null}
function cxAplicar(){cxAplicarCor(cxCorAtual());cxUI()}
const CB_CHAT={prev:hx=>{cxAplicarCor(hx);const p=$('cd-prev').style;p.setProperty('--grad','linear-gradient(100deg,'+hx+','+hx+')');p.setProperty('--h2',hx);p.setProperty('--accent',hx);p.setProperty('--on','#05070f')},ok:hx=>{CX.id='custom';CX.cor=hx;store.set('hq-chat-cor',CX);cxAplicar()},x:()=>cxAplicar(),ini:()=>CX.id==='custom'?CX.cor:(cxCorAtual()||'#00e5ff')};
function cxUI(){const box=$('cx-sws');if(!box)return;
  if(!box.children.length){for(const id of Object.keys(CXN)){const b=document.createElement('button');b.type='button';b.dataset.t=id;
      b.style.background=id==='neon'?'linear-gradient(135deg,#00e5ff 50%,#39ff14 50%)':id==='app'?'linear-gradient(135deg,var(--accent) 50%,var(--bg) 50%)':id==='custom'?'conic-gradient(#ff4d4d,#ffd24d,#4dff88,#4dd2ff,#7a4dff,#ff4dd2,#ff4d4d)':CXC[id];
      b.onclick=()=>{if(id==='custom'){corAbrir(CB_CHAT);return}CX.id=id;store.set('hq-chat-cor',CX);cxAplicar()};box.append(b)}}
  for(const b of box.children){const id=b.dataset.t;b.classList.toggle('on',CX.id===id);const n=LN(CXN[id]);b.title=n;b.setAttribute('aria-label',n);if(id==='custom'&&CX.id==='custom')b.style.background=CX.cor}
  $('cx-lkaviso').checked=!store.get('hq-link-ok',false)}
$('cx-pal').onclick=()=>{const p=$('cx-cores');p.hidden=!p.hidden;if(!p.hidden)cxUI()};
$('cx-lkaviso').onchange=e=>{store.set('hq-link-ok',!e.target.checked)};
cxAplicar();
/* janela flutante: arrastar, redimensionar, minimizar (somente web) */
const GEO=Object.assign({w:380,h:560,x:null,y:null,min:false},store.get('hq-chat-geo',{}));
function geoAplicar(){const c=$('chat');if(!ehWebCx()){c.style.left=c.style.top=c.style.width=c.style.height='';c.classList.remove('min');return}
  const W=innerWidth,H=innerHeight,w=Math.min(Math.max(GEO.w,300),W-16),h=Math.min(Math.max(GEO.h,300),H-16),ah=GEO.min?46:h;
  let x=GEO.x==null?W-w-16:GEO.x,y=GEO.y==null?64:GEO.y;x=Math.min(Math.max(x,0),W-w);y=Math.min(Math.max(y,0),Math.max(0,H-ah));
  c.style.left=x+'px';c.style.top=y+'px';c.style.width=w+'px';c.style.height=ah+'px';c.classList.toggle('min',!!GEO.min);$('cx-min').textContent=GEO.min?'▢':'▁'}
const geoSalvar=()=>store.set('hq-chat-geo',GEO);
(function(){let op=null;const c=$('chat');
  function ini(e,d){if(!ehWebCx()||e.button>0)return;const r=c.getBoundingClientRect();op={d,mx:e.clientX,my:e.clientY,x:r.left,y:r.top,w:r.width,h:r.height};GEO.x=r.left;GEO.y=r.top;GEO.w=r.width;if(!GEO.min)GEO.h=r.height;e.preventDefault();try{e.target.setPointerCapture(e.pointerId)}catch(_){}}
  c.querySelector('.cx-top').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;ini(e,'m')});
  for(const z of c.querySelectorAll('.cx-rz'))z.addEventListener('pointerdown',e=>ini(e,z.dataset.d));
  addEventListener('pointermove',e=>{if(!op)return;const dx=e.clientX-op.mx,dy=e.clientY-op.my,d=op.d,W=innerWidth,H=innerHeight;
    if(d==='m'){GEO.x=op.x+dx;GEO.y=op.y+dy}
    else{let x=op.x,w=op.w,h=op.h;if(d.includes('r'))w=op.w+dx;if(d==='l'||d==='bl'){w=op.w-dx;x=op.x+dx}if(d.includes('b'))h=op.h+dy;
      if(w<300){if(d==='l'||d==='bl')x=op.x+op.w-300;w=300}if(h<300)h=300;GEO.x=x;GEO.w=w;GEO.h=h}
    geoAplicar()});
  const fim=()=>{if(op){op=null;geoSalvar()}};addEventListener('pointerup',fim);addEventListener('pointercancel',fim);
  $('cx-min').onclick=()=>{GEO.min=!GEO.min;geoSalvar();geoAplicar()};
  c.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();abrirChat(false)}});
  addEventListener('resize',geoAplicar);new MutationObserver(()=>{if(!c.hidden)geoAplicar()}).observe(c,{attributes:true,attributeFilter:['hidden']});geoAplicar()})();
window.__cxTeste=m=>pintarMsg(m);
