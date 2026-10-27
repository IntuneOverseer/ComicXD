
/* ---------- marcar quadros a mao (v0.70): modulo separado; sem marcas, a leitura guiada segue 100% automatica ---------- */
const MK={on:false,i:0,url:null,nat:null,cur:[],drawing:null};
const mkKey=()=>'hq-man|'+book.key;
function mkLer(){return store.get(mkKey(),{v:1,pages:{}})}
function mkGravar(d){store.set(mkKey(),d)}
function mkPlano(i){   // plano manual da pagina i (ou null)
  if(!book||book.manga)return null;const d=mkLer(),p=d.pages&&d.pages[i];if(!p||!p.q||!p.q.length)return null;
  const w=p.w,h=p.h,fit=Math.min(VW/w,VH/h),steps=p.q.map(q=>{
    const r=[q[0]*w,q[1]*h,q[2]*w,q[3]*h],s=Math.max(fit,Math.min(VW/r[2],VH/r[3])),z=s/fit;
    return {cx:r[0]+r[2]/2,cy:r[1]+r[3]/2,z:z,rect:r}});
  return {w,h,bg:[0,0,0],guiado:true,steps,manual:true}}
function mkTemMarcas(){if(!book||book.manga)return false;const d=mkLer();return Object.keys(d.pages||{}).some(k=>d.pages[k]&&d.pages[k].q&&d.pages[k].q.length)}
function mkAplicar(){   // recarrega os planos: paginas marcadas usam o manual, as outras voltam ao automatico
  if(!book||book.manga)return;const d=mkLer();
  for(let i=0;i<book.pages.length;i++){const m=mkPlano(i);
    if(m)book.plans[i]=m;else if(book.plans[i]&&book.plans[i].manual){book.plans[i]=null;ensurePlan(i)}}
  openPage(pi)}
/* ---- interface ---- */
function mkMontar(){
  if($('marc'))return;
  const d=document.createElement('div');d.id='marc';d.hidden=true;
  d.innerHTML='<div class="mk-top"><button type="button" class="ib" id="mk-x"></button><div class="mk-tt" id="mk-tt"></div><button type="button" class="ib" id="mk-ok"></button></div>'+
   '<div class="mk-st" id="mk-st"><div class="mk-box" id="mk-box"><img id="mk-img" alt="" draggable="false"><svg id="mk-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg></div></div>'+
   '<div class="mk-dica" id="mk-dica"></div>'+
   '<div class="mk-bar"><button type="button" class="ib" id="mk-pv"></button><button type="button" class="ib" id="mk-un"></button><button type="button" class="ib" id="mk-cl"></button><button type="button" class="ib" id="mk-nx"></button></div>'+
   '<div class="mk-bar2"><button type="button" class="ib" id="mk-rs"></button></div>';
  $('reader').appendChild(d);
  $('mk-x').onclick=()=>mkFechar();$('mk-ok').onclick=()=>mkFechar();
  $('mk-rs').onclick=()=>{if(!mkTemMarcas())return;if(confirm(L('Voltar esta HQ ao original? Todas as marcas manuais (todas as páginas) serão apagadas e a leitura guiada volta ao automático.','Restore this comic to the original? All manual marks (every page) will be deleted and guided reading goes back to automatic.'))){try{localStorage.removeItem(mkKey())}catch(e){}MK.cur=[];mkDesenhar();toast(L('Voltou ao original (automático)','Restored to the original (automatic)'))}};
  $('mk-pv').onclick=()=>mkIr(MK.i-1);$('mk-nx').onclick=()=>mkIr(MK.i+1);
  $('mk-un').onclick=()=>{if(MK.cur.length){MK.cur.pop();mkSalvarPag();mkDesenhar()}};
  $('mk-cl').onclick=()=>{if(MK.cur.length&&confirm(L('Apagar todas as marcas desta página e voltar ao automático?','Delete all marks on this page and go back to automatic?'))){MK.cur=[];mkSalvarPag();mkDesenhar()}};
  const sv=$('mk-svg');
  sv.addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.mk-b'))return;e.preventDefault();e.stopPropagation();try{sv.setPointerCapture(e.pointerId)}catch(_){}
    MK.drawing={id:e.pointerId,pts:[mkPt(e)]};mkDesenhar()});
  sv.addEventListener('pointermove',e=>{const dr=MK.drawing;if(!dr||dr.id!==e.pointerId)return;e.preventDefault();
    const p=mkPt(e),l=dr.pts[dr.pts.length-1];if(Math.abs(p[0]-l[0])+Math.abs(p[1]-l[1])>.002){dr.pts.push(p);mkDesenhar()}});
  const fim=e=>{const dr=MK.drawing;if(!dr||dr.id!==e.pointerId)return;MK.drawing=null;
    let x0=1,y0=1,x1=0,y1=0;for(const p of dr.pts){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}
    if(dr.pts.length>=6&&x1-x0>.04&&y1-y0>.03){const pad=.012;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(1,x1+pad);y1=Math.min(1,y1+pad);
      MK.cur.push([x0,y0,x1-x0,y1-y0]);mkSalvarPag()}
    mkDesenhar()};
  sv.addEventListener('pointerup',fim);sv.addEventListener('pointercancel',e=>{if(MK.drawing&&MK.drawing.id===e.pointerId){MK.drawing=null;mkDesenhar()}});
  addEventListener('resize',()=>{if(MK.on)mkAjustar()});
  mkTextos()}
function mkTextos(){
  $('mk-x').textContent='‹ '+L('Voltar','Back');$('mk-ok').textContent='✔ '+L('Pronto','Done');
  $('mk-pv').textContent='◀ '+L('Página','Page');$('mk-nx').textContent=L('Página','Page')+' ▶';
  $('mk-rs').textContent='↺ '+L('Voltar HQ ao original (todas as páginas)','Restore comic to original (all pages)');
  $('mk-un').textContent='↶ '+L('Desfazer','Undo');$('mk-cl').textContent='🗑 '+L('Limpar página','Clear page');
  $('mk-dica').textContent=L('Circule cada quadro com o dedo, na ordem de leitura: o número aparece sozinho. Toque no número para apagar aquele quadro. Páginas sem marca continuam automáticas.','Circle each panel with your finger, in reading order: the number appears by itself. Tap a number to delete that panel. Pages without marks stay automatic.')}
function mkPt(e){const r=$('mk-svg').getBoundingClientRect();return [Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]}
function mkDesenhar(){
  const sv=$('mk-svg');if(!sv)return;const NS='http://www.w3.org/2000/svg',U=1000;let h='';
  const r=sv.getBoundingClientRect(),k=Math.max(1,r.width?U/r.width:1);   // 1px de tela em unidades do svg
  MK.cur.forEach((q,n)=>{const x=q[0]*U,y=q[1]*U,w=q[2]*U,hh=q[3]*U,R=15*k;
    h+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+hh+'" fill="rgba(255,178,26,.13)" stroke="#ffb21a" stroke-width="'+(3*k)+'" stroke-dasharray="'+(10*k)+' '+(6*k)+'"/>'+
       '<g class="mk-b" data-n="'+n+'" style="cursor:pointer"><circle cx="'+(x+R+4*k)+'" cy="'+(y+R+4*k)+'" r="'+R+'" fill="#ffb21a" stroke="#1a1200" stroke-width="'+(2*k)+'"/>'+
       '<text x="'+(x+R+4*k)+'" y="'+(y+R+4*k)+'" text-anchor="middle" dominant-baseline="central" font-size="'+(17*k)+'" font-weight="900" fill="#1a1200" font-family="sans-serif">'+(n+1)+'</text></g>'});
  if(MK.drawing&&MK.drawing.pts.length>1)h+='<polyline fill="none" stroke="#ffb21a" stroke-width="'+(4*k)+'" stroke-linecap="round" stroke-linejoin="round" points="'+MK.drawing.pts.map(p=>(p[0]*U).toFixed(1)+','+(p[1]*U).toFixed(1)).join(' ')+'"/>';
  sv.innerHTML=h;
  sv.querySelectorAll('.mk-b').forEach(g=>{g.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();MK.cur.splice(+g.dataset.n,1);mkSalvarPag();mkDesenhar()})});
  const n=MK.cur.length;$('mk-tt').textContent=L('Marcar quadros','Mark panels')+' · '+L('página','page')+' '+(MK.i+1)+'/'+book.pages.length+(n?' · '+n+' '+(n===1?L('quadro','panel'):L('quadros','panels')):' · '+L('automático','automatic'));
  $('mk-rs').disabled=!mkTemMarcas();$('mk-un').disabled=!n;$('mk-cl').disabled=!n;$('mk-pv').disabled=MK.i<=0;$('mk-nx').disabled=MK.i>=book.pages.length-1}
function mkAjustar(){
  if(!MK.nat)return;const st=$('mk-st').getBoundingClientRect(),box=$('mk-box'),w=MK.nat[0],h=MK.nat[1],s=Math.min(st.width/w,st.height/h);
  box.style.width=Math.floor(w*s)+'px';box.style.height=Math.floor(h*s)+'px';mkDesenhar()}
function mkSalvarPag(){const d=mkLer();d.pages=d.pages||{};
  if(MK.cur.length)d.pages[MK.i]={w:MK.nat[0],h:MK.nat[1],q:MK.cur.map(q=>q.map(v=>+v.toFixed(5)))};else delete d.pages[MK.i];mkGravar(d)}
async function mkIr(i){
  if(i<0||i>=book.pages.length)return;MK.i=i;MK.drawing=null;
  const d=mkLer(),p=d.pages&&d.pages[i];MK.cur=p&&p.q?p.q.map(q=>q.slice()):[];
  if(MK.url){URL.revokeObjectURL(MK.url);MK.url=null}
  const img=$('mk-img');img.removeAttribute('src');
  const url=URL.createObjectURL(book.pages[i].blob);MK.url=url;
  await new Promise(res=>{img.onload=res;img.onerror=res;img.src=url});
  if(MK.i!==i)return;MK.nat=[img.naturalWidth||1000,img.naturalHeight||1600];
  if(p&&(p.w!==MK.nat[0]||p.h!==MK.nat[1])){/* medidas mudaram: marcas normalizadas continuam validas */}
  mkAjustar()}
function mkModoOk(){return !!book&&!book.manga&&!!guided&&!wtOn}   // so no modo Guiado
function mkEstado(){const b=$('mk-btn');if(!b)return;const ok=mkModoOk();b.classList.toggle('off',!ok);b.setAttribute('aria-disabled',ok?'false':'true')}
function mkNao(){const b=$('mk-btn');if(!b)return;b.classList.remove('sacode');void b.offsetWidth;b.classList.add('sacode');setTimeout(()=>b.classList.remove('sacode'),450);toast(L('Disponível só no modo Guiado','Available only in Guided mode'))}
setInterval(()=>{const r=$('reader');if(r&&!r.hidden)mkEstado()},250);
function mkAbrir(){
  if(!mkModoOk()||MK.on)return;mkMontar();mkTextos();MK.on=true;$('marc').hidden=false;menu(false);
  mkIr(pi)}
function mkFechar(){
  if(!MK.on)return;MK.on=false;$('marc').hidden=true;MK.drawing=null;
  if(MK.url){URL.revokeObjectURL(MK.url);MK.url=null}$('mk-img').removeAttribute('src');
  mkAplicar();mkBadge()}
function mkBadge(){const b=$('mk-btn');if(b)b.classList.toggle('on',mkTemMarcas())}
(function(){const b=document.createElement('button');b.type='button';b.id='mk-btn';b.className='ib hq-only';b.setAttribute('aria-label','Marcar quadros');
  b.innerHTML='✎ <span></span>';b.querySelector('span').textContent=L('Marcar quadros','Mark panels');
  b.onclick=e=>{e.stopPropagation();if(!mkModoOk()){mkNao();return}mkAbrir()};const ref=$('chat-btn2');ref.parentNode.insertBefore(b,ref)})();

/* ---------- titulo da barra de cima: ajusta o tamanho para aparecer por completo (tablet e celular) ---------- */
function tituloAjustar(){
  const t=$('rtitle');if(!t||!t.textContent)return;
  t.style.fontSize='';let s=Math.round(parseFloat(getComputedStyle(t).fontSize))||20;
  while(s>10&&(t.scrollWidth>t.clientWidth+1||t.getBoundingClientRect().height>s*1.12*(innerWidth<600?3:2)+2)){s--;t.style.fontSize=s+'px'}}
(function(){const t=$('rtitle');if(!t)return;
  try{new MutationObserver(()=>tituloAjustar()).observe(t,{childList:true,characterData:true,subtree:true})}catch(e){}
  addEventListener('resize',()=>tituloAjustar());addEventListener('orientationchange',()=>setTimeout(tituloAjustar,250));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tituloAjustar()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>tituloAjustar())})();
