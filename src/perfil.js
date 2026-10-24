
/* ---------- perfil (apelido), idioma e saudacao ---------- */
const PERFIL=Object.assign({nome:'',almoco:true,hora:'12:00',lem:true,lemH:'12:00',lemUlt:''},store.get('hq-perfil',{}));
const salvarPerfil=()=>store.set('hq-perfil',PERFIL);
const limparNome=s=>String(s||'').replace(/[\u0000-\u001f<>&"]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
function saudacaoPeriodo(){return OI[periodoDe()][LI()]}
function ehAlmoco(){if(!PERFIL.almoco)return false;const d=new Date(),m=d.getHours()*60+d.getMinutes(),p=String(PERFIL.hora||'12:00').split(':'),ini=((+p[0])||12)*60+((+p[1])||0);return m>=ini&&m<ini+120}
function renderOla(sortear){const box=$('ola');if(!box)return;const nome=PERFIL.nome,per=periodoDe();
  if(sortear||renderOla.per!==per||renderOla.lang!==LANG||!renderOla.txt){renderOla.per=per;renderOla.lang=LANG;renderOla.txt=sorteiaMsg(per)}
  const oi=saudacaoPeriodo();
  $('ola-oi').textContent=nome?(LANG==='ja'||LANG==='ko'?nome+(LANG==='ja'?'さん、':'님, ')+oi:oi+', '+nome+'!'):L('Bem-vindo ao ComicXD!','Welcome to ComicXD!');
  $('ola-q').textContent=renderOla.txt;
  const sug=$('ola-sug');sug.textContent='';const r=store.get('hq-recentes',[]),it=r.find(x=>x.page<x.total)||r[0];sug.hidden=!it;
  if(it){const nm=it.name.replace(/_+/g,' ').trim(),b=document.createElement('button');b.type='button';b.className='btn';b.textContent=L('▶ Continuar “'+nm+'” · página '+it.page+' de '+it.total,'▶ Continue “'+nm+'” · page '+it.page+' of '+it.total);if(LANG==='ja')b.textContent='▶ 「'+nm+'」を続きから · '+it.page+' / '+it.total+' ページ';if(LANG==='ko')b.textContent='▶ “'+nm+'” 이어서 읽기 · '+it.page+' / '+it.total+' 페이지';b.onclick=()=>abrirDaEstante(it);sug.append(b)}
  const f=$('ola-form'),semNome=!nome;if(semNome&&f.hidden&&!renderOla.fechado)f.hidden=false;if(!semNome&&!renderOla.editando)f.hidden=true;
  $('ola-edit').hidden=semNome}
/* ---------- lembrete de leitura (aviso dentro do app + Notification quando o navegador permite) ---------- */
function lemMsg(h){const a=LEM[faixaLem(h)];return a[Math.floor(Math.random()*a.length)].map(x=>x[LI()])}
function mostrarLembrete(t,c){const bx=$('lembrete');if(!bx)return;$('lem-t').textContent=t;$('lem-c').textContent=c;bx.hidden=false}
function dispararLembrete(h,teste){const [t,c]=lemMsg(h);mostrarLembrete(t,c);
  try{if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&(document.hidden||teste))new Notification(t,{body:c,tag:'comicxd-lembrete'})}catch(e){}}
function checarLembrete(){if(!PERFIL.lem)return;const d=new Date(),hoje=d.toDateString();if(PERFIL.lemUlt===hoje)return;
  const p=String(PERFIL.lemH||'12:00').split(':'),ini=(+p[0]||0)*60+(+p[1]||0),ag=d.getHours()*60+d.getMinutes();if(ag<ini||ag>=ini+180)return;
  PERFIL.lemUlt=hoje;salvarPerfil();dispararLembrete(+p[0]||12)}
$('lem-ok').onclick=()=>{$('lembrete').hidden=true;if($('home').hidden)return;const r=store.get('hq-recentes',[]),it=r.find(x=>x.page<x.total)||r[0];if(it)abrirDaEstante(it)};
$('lem-x').onclick=()=>{$('lembrete').hidden=true};
$('pf-lem').onchange=e=>{if(e.target.checked){try{if(typeof Notification!=='undefined'&&Notification.permission==='default')Notification.requestPermission()}catch(x){}}};
$('pf-lem-teste').onclick=()=>{const p=String($('pf-lem-h').value||'12:00').split(':');dispararLembrete(+p[0]||12,true)};
$('ola-form').onsubmit=e=>{e.preventDefault();PERFIL.nome=limparNome($('ola-nome').value);salvarPerfil();renderOla.editando=false;renderOla.fechado=true;renderOla();$('pf-nome').value=PERFIL.nome};
$('ola-edit').onclick=()=>{renderOla.editando=true;$('ola-form').hidden=false;$('ola-nome').value=PERFIL.nome;$('ola-nome').focus()};
function setLang(v){try{if(LANGS.includes(v))localStorage.setItem('hq-lang',v);else localStorage.removeItem('hq-lang')}catch(e){}detectarLang();aplicarIdioma()}
function assinar(){const e=$('assinatura');if(e)e.textContent='ComicXD v'+VERSAO+' · '+L('Feito no Brasil com carinho por KaLeK ❤','Made in Brazil with love by KaLeK ❤')}
function aplicarIdioma(){traduzirDOM();assinar();pfAvatares();document.title='ComicXD';velTxt();letraTxt();if(book)label();renderRecent();renderOla();
  $('cfg-lang').value=LANGPREF;$('pf-lang').value=LANGPREF;if(!$('ajustes').hidden)$('diag').textContent=diagTxt();$('ola-nome').placeholder=TR('Seu apelido');$('pf-nome').placeholder=TR('Seu apelido')}
$('cfg-lang').onchange=e=>setLang(e.target.value);
function abrirPerfil(on){$('perfil').hidden=!on;if(on){$('pf-nome').value=PERFIL.nome;$('pf-lang').value=LANGPREF;$('pf-lem').checked=PERFIL.lem;$('pf-lem-h').value=PERFIL.lemH||'12:00';pfAvatares();$('pf-nome').focus()}}
$('perfil-btn').onclick=()=>abrirPerfil(true);
$('pf-ok').onclick=()=>{PERFIL.nome=limparNome($('pf-nome').value);PERFIL.lem=$('pf-lem').checked;PERFIL.lemH=/^\d\d:\d\d$/.test($('pf-lem-h').value)?$('pf-lem-h').value:'12:00';PERFIL.lemUlt='';salvarPerfil();abrirPerfil(false);checarLembrete();
  if($('pf-lang').value!==LANGPREF)setLang($('pf-lang').value);else aplicarIdioma()};
$('perfil').addEventListener('pointerdown',e=>{if(e.target===$('perfil'))abrirPerfil(false)});
$('perfil').addEventListener('keydown',e=>{if(e.key==='Escape')abrirPerfil(false);else if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();$('pf-ok').click()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!$('home').hidden)renderOla(true);checarLembrete()}});
setInterval(()=>{if(!$('home').hidden&&!document.hidden)renderOla();checarLembrete()},30000);
aplicarIdioma();checarLembrete();
