/* ---------- cor do app: 5 padroes + cor personalizada ---------- */
const hex2=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const rgb2=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mixc=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const lum=a=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(a[0])+0.7152*f(a[1])+0.0722*f(a[2])};
const SUP_NAVY={'--bg':'#0a0d19','--bg2':'#10142a','--panel':'#151a33','--line':'#252c4d','--fg':'#f6f7ff','--dim':'#9aa4cc','--s1':'10,13,25','--s2':'6,8,18','--s3':'5,7,15','--s4':'21,26,51','--k1':'#0a0d1a','--k2':'#0b0e1c','--k3':'#161b36'};
const SUP_PB={'--bg':'#0b0b0b','--bg2':'#141414','--panel':'#1a1a1a','--line':'#303030','--fg':'#f4f4f4','--dim':'#a8a8a8','--s1':'16,16,16','--s2':'8,8,8','--s3':'5,5,5','--s4':'26,26,26','--k1':'#0e0e0e','--k2':'#111111','--k3':'#1c1c1c'};
Object.assign(EN,{'Rolar para cima':'Scroll up','Rolar para baixo':'Scroll down','Mais zoom':'Zoom in','Menos zoom':'Zoom out','Ajustar à tela':'Fit to screen','Leitura livre':'Free reading','Modo compacto':'Compact mode','Prévia':'Preview','Cores sugeridas':'Suggested colors','Ajuste fino':'Fine tuning','Matiz':'Hue','Intensidade':'Saturation','Brilho':'Brightness','Código da cor':'Color code','Aplicar':'Apply','Cancelar':'Cancel','▶ Continuar':'▶ Continue'});
const TEMAS={
  classico:{n:['HQ clássico','Classic comic'],sw:'linear-gradient(135deg,#ff3358,#ffb020)'},
  mangaorig:{n:['Mangá original','Original manga'],sw:'linear-gradient(135deg,#8a5cff,#2f8cff 55%,#27d3c3)'},
  pb:{n:['Preto e branco','Black & white'],sw:'linear-gradient(135deg,#ffffff 50%,#111 50%)'},
  azul:{n:['Azul','Blue'],cor:'#2f8cff',sw:'#2f8cff'},
  verde:{n:['Verde','Green'],cor:'#2fbf71',sw:'#2fbf71'},
  roxo:{n:['Roxo','Purple'],cor:'#8a5cff',sw:'#8a5cff'},
  rosa:{n:['Rosa suave','Soft pink'],cor:'#f4a3c4',sw:'#f4a3c4'},
  menta:{n:['Menta','Mint'],cor:'#8fd9b6',sw:'#8fd9b6'},
  areia:{n:['Areia','Sand'],cor:'#e6c9a0',sw:'#e6c9a0'}};
const TEMA=Object.assign({id:'auto',cor:'#ff6a3d'},store.get('hq-tema',{}));
function temaVars(id,corCustom){
  if(id==='mangaorig')return Object.assign({},SUP_NAVY,{'--h1':'#8a5cff','--h2':'#8fd3ff','--h3':'#2f8cff','--accent':'#8a5cff','--grad':'linear-gradient(100deg,#8a5cff 0%,#2f8cff 55%,#27d3c3 100%)','--on':'#14091f','--g1':'138,92,255','--g2':'47,140,255'});
  if(id==='classico')return Object.assign({},SUP_NAVY,{'--h1':'#ff3358','--h2':'#ffb020','--h3':'#2f8cff','--accent':'#ff3358','--grad':'linear-gradient(100deg,#ff3358 0%,#ff7a2f 55%,#ffb020 100%)','--on':'#1a0509','--g1':'255,51,88','--g2':'47,140,255'});
  if(id==='pb')return Object.assign({},SUP_PB,{'--h1':'#ffffff','--h2':'#ffffff','--h3':'#bdbdbd','--accent':'#ffffff','--grad':'linear-gradient(100deg,#ffffff 0%,#e4e4e4 100%)','--on':'#101010','--g1':'110,110,110','--g2':'80,80,80'});
  const c=hex2(id==='custom'?corCustom:TEMAS[id].cor),claro=mixc(c,[255,255,255],0.2),esc=mixc(c,[0,0,0],0.18);
  return Object.assign({},SUP_NAVY,{'--h1':rgb2(c),'--h2':rgb2(mixc(c,[255,255,255],0.35)),'--h3':rgb2(c),'--accent':rgb2(c),'--grad':'linear-gradient(100deg,'+rgb2(claro)+' 0%,'+rgb2(c)+' 55%,'+rgb2(esc)+' 100%)','--on':lum(c)>0.38?'#101010':'#ffffff','--g1':c.map(Math.round).join(','),'--g2':esc.map(Math.round).join(',')})}
function temaEfetivo(){return TEMA.id==='auto'?(aba==='manga'?'mangaorig':'classico'):TEMA.id}
function aplicarTema(){const v=temaVars(temaEfetivo(),TEMA.cor),s=document.documentElement.style;for(const k in v)s.setProperty(k,v[k]);
  const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',v['--bg']);temaUI();try{cxAplicar()}catch(e){}}
function temaUI(){const box=$('pf-temas');if(!box)return;
  if(!box.children.length){const mk=(id,sw)=>{const b=document.createElement('button');b.type='button';b.className='sw';b.dataset.t=id;b.innerHTML='<i></i><span></span>';b.firstChild.style.background=sw;
      b.onclick=()=>{if(id==='custom'){corAbrir();return}TEMA.id=id;store.set('hq-tema',TEMA);aplicarTema()};box.append(b)};
    mk('auto','linear-gradient(135deg,#ff3358 0 50%,#8a5cff 50% 100%)');for(const k in TEMAS)mk(k,TEMAS[k].sw);mk('custom','conic-gradient(#ff4d4d,#ffd24d,#4dff88,#4dd2ff,#7a4dff,#ff4dd2,#ff4d4d)')}
  for(const b of box.children){const id=b.dataset.t;b.classList.toggle('on',TEMA.id===id);b.setAttribute('aria-pressed',TEMA.id===id);
    b.lastChild.textContent=id==='auto'?L('Automático','Automatic'):id==='custom'?L('Personalizada','Custom'):LN(TEMAS[id].n);
    if(id==='custom'&&TEMA.id==='custom')b.firstChild.style.background=TEMA.cor}}
/* seletor de cor personalizada */
const hsl2hex=(h,s,l)=>{s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return rgb2([f(0)*255,f(8)*255,f(4)*255])};
const hex2hsl=hx=>{const [r,g,b]=hex2(hx).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}return [Math.round(h),Math.round(s*100),Math.round(l*100)]};
const PAL=['#e74c3c','#ff6a3d','#f5a623','#f1c40f','#a3d977','#2fbf71','#1abc9c','#2fb5c9','#2f8cff','#5b6cff','#8a5cff','#b86bff','#e056c4','#ff5c8a','#f4a3c4','#8fd9b6','#e6c9a0','#9aa4b8'];
let corCb=null;
const CB_TEMA={prev:hx=>{const v=temaVars('custom',hx),s=document.documentElement.style;for(const k in v)s.setProperty(k,v[k])},ok:hx=>temaCustom(hx),x:()=>aplicarTema(),ini:()=>TEMA.id==='custom'?TEMA.cor:(temaVars(temaEfetivo())['--accent'].length===7?temaVars(temaEfetivo())['--accent']:'#ff6a3d')};
function corVer(hx){corCb.prev(hx);$('cd-amostra').style.background=hx;$('cd-hex').value=hx;
  const [h,sa,l]=hex2hsl(hx);$('cd-h').value=h;$('cd-s').value=sa;$('cd-l').value=l;
  $('cd-s').style.background='linear-gradient(90deg,'+hsl2hex(h,10,l)+','+hsl2hex(h,100,l)+')';$('cd-l').style.background='linear-gradient(90deg,'+hsl2hex(h,sa,25)+','+hsl2hex(h,sa,52)+','+hsl2hex(h,sa,80)+')';
  for(const b of $('cd-pal').children)b.classList.toggle('on',b.dataset.c===hx)}
function corAbrir(cb){corCb=cb||CB_TEMA;const d=$('cor-dlg');$('cd-prev').removeAttribute('style');d.hidden=false;
  if(!$('cd-pal').children.length){for(const c of PAL){const b=document.createElement('button');b.type='button';b.dataset.c=c;b.style.background=c;b.setAttribute('aria-label',c);b.onclick=()=>corVer(c);$('cd-pal').append(b)}
    $('cd-h').style.background='linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
    const sl=()=>corVer(hsl2hex(+$('cd-h').value,+$('cd-s').value,+$('cd-l').value));$('cd-h').oninput=sl;$('cd-s').oninput=sl;$('cd-l').oninput=sl;
    $('cd-hex').oninput=e=>{let v=e.target.value.trim();if(v[0]!=='#')v='#'+v;if(/^#[0-9a-f]{6}$/i.test(v))corVer(v.toLowerCase())};
    $('cd-ok').onclick=()=>{$('cd-prev').removeAttribute('style');corCb.ok($('cd-hex').value);d.hidden=true};
    $('cd-x').onclick=()=>{$('cd-prev').removeAttribute('style');d.hidden=true;corCb.x()}}
  corVer(corCb.ini());$('cd-ok').focus()}
function temaCustom(c){TEMA.id='custom';TEMA.cor=c;store.set('hq-tema',TEMA);aplicarTema()}
