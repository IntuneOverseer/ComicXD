
/* ---------- chat entre leitores (P2P / WebRTC, sem servidor de mensagens) ---------- */
Object.assign(EN,{'Chat':'Chat','Sala':'Room','Entrar':'Join','Sair da sala':'Leave room','Limpar':'Clear','Bloqueados':'Blocked','Nome da sala':'Room name','Sala desta HQ':'This comic\'s room','Avatar':'Avatar','Automático':'Automatic',
 'Chat entre leitores':'Reader chat','As mensagens passam direto entre os aparelhos, sem servidor guardando nada. Seu endereço de rede (IP) fica visível para quem está na sala. As conversas ficam só neste aparelho por até 30 dias e depois se apagam sozinhas. Não há moderação central: use Bloquear. Palavras ofensivas são trocadas por ******.':'Messages go straight between devices, with no server storing anything. Your network address (IP) is visible to people in the room. Conversations stay only on this device for up to 30 days and then delete themselves. There is no central moderation: use Block. Offensive words are replaced with ******.',
 'Aceitar e entrar':'Accept and join','Digite uma mensagem':'Type a message','Enviar':'Send','Emojis':'Emojis','Enviar GIF':'Send GIF','Fechar chat':'Close chat'});
const CHAT={sala:null,tr:null,peers:new Map(),vistos:new Set(),url:[],ult:0,bloq:new Set(store.get('hq-chat-bloq',[])),idbp:null,t0:0,aviso:0};
const DIAS_CACHE=30,GIF_MAX=800*1024,TXT_MAX=400;
const UID=(()=>{let u=store.get('hq-uid','');if(!u){u=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b=>b.toString(16).padStart(2,'0')).join('');store.set('hq-uid',u)}return u})();
const chatAberto=()=>!$('chat').hidden;
function meuNome(){return limparNome(FILTRO(PERFIL.nome))||('Leitor'+UID.slice(0,3))}
function meuAvatar(){return PERFIL.avatar==null||PERFIL.avatar==='auto'?AV.auto(UID):(+PERFIL.avatar|0)}
function nomeSala(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)}
const hhmm=ts=>{const d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
/* cache local (IndexedDB), apaga o que passar de 30 dias */
function chatDB(){if(CHAT.idbp)return CHAT.idbp;CHAT.idbp=new Promise(ok=>{try{const r=indexedDB.open('hq-chat',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('m',{autoIncrement:true});s.createIndex('sala','sala');s.createIndex('ts','ts')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}catch(e){ok(null)}});return CHAT.idbp}
async function dbRun(fn){const d=await chatDB();if(!d)return null;return new Promise(ok=>{try{const tx=d.transaction('m','readwrite');const r=fn(tx.objectStore('m'));tx.oncomplete=()=>ok(r&&r.result!==undefined?r.result:true);tx.onerror=tx.onabort=()=>ok(null)}catch(e){ok(null)}})}
async function purgar(){const lim=Date.now()-DIAS_CACHE*864e5;const d=await chatDB();if(!d)return;try{const tx=d.transaction('m','readwrite'),c=tx.objectStore('m').index('ts').openCursor(IDBKeyRange.upperBound(lim));c.onsuccess=()=>{const k=c.result;if(k){k.delete();k.continue()}}}catch(e){}}
async function salvarMsg(m){await dbRun(s=>s.add({sala:CHAT.sala,ts:m.ts,uid:m.uid,nick:m.nick,av:m.av,txt:m.gif?'':m.txt,gif:!!m.gif,me:!!m.me}))}
async function carregarHist(sala){const d=await chatDB();if(!d)return [];return new Promise(ok=>{const out=[];try{const c=d.transaction('m').objectStore('m').index('sala').openCursor(IDBKeyRange.only(sala));c.onsuccess=()=>{const k=c.result;if(k){out.push(k.value);k.continue()}else ok(out.sort((a,b)=>a.ts-b.ts).slice(-200))};c.onerror=()=>ok([])}catch(e){ok([])}})}
async function limparSala(sala){const d=await chatDB();if(!d)return;await new Promise(ok=>{try{const tx=d.transaction('m','readwrite'),c=tx.objectStore('m').index('sala').openCursor(IDBKeyRange.only(sala));c.onsuccess=()=>{const k=c.result;if(k){k.delete();k.continue()}};tx.oncomplete=tx.onerror=ok}catch(e){ok()}})}
/* transporte: WebRTC (Trystero/trackers) ou BroadcastChannel (modo de teste) */
function abrirTransporte(sala,h){
  if(store.get('hq-chat-mock',false)){const id='m'+Math.random().toString(36).slice(2,8),bc=new BroadcastChannel('hqchat:'+sala),pe=new Set();
    const env=(o,alvo)=>bc.postMessage({from:id,to:alvo||null,o});
    bc.onmessage=e=>{const{from,to,o}=e.data;if(from===id||(to&&to!==id))return;
      if(o.k==='hello'){if(!pe.has(from)){pe.add(from);h.entrou(from);env({k:'hello'},from)}}
      else if(o.k==='bye'){if(pe.delete(from))h.saiu(from)}
      else if(o.k==='hi')h.hi(o.d,from);else if(o.k==='msg')h.msg(o.d,from);else if(o.k==='gif')h.gif(o.d,from)};
    env({k:'hello'});
    return {id,peers:()=>pe.size,hi:(d,t)=>env({k:'hi',d},t),msg:d=>env({k:'msg',d}),gif:d=>env({k:'gif',d}),sair:()=>{env({k:'bye'});bc.close()}}}
  if(!window.HQP2P)throw new Error('P2P indisponível');
  const r=window.HQP2P.joinRoom({appId:'comicxd-chat-v1'},'s:'+sala),A=r.makeAction('hi'),B=r.makeAction('msg'),C=r.makeAction('gif');
  r.onPeerJoin=id=>h.entrou(id);r.onPeerLeave=id=>h.saiu(id);
  A.onMessage=(d,m)=>h.hi(d,m.peerId||m);B.onMessage=(d,m)=>h.msg(d,m.peerId||m);C.onMessage=(d,m)=>h.gif(d,m.peerId||m);
  return {id:window.HQP2P.selfId,peers:()=>Object.keys(r.getPeers?r.getPeers():{}).length,hi:(d,t)=>A.send(d,t?{target:t}:undefined),msg:d=>B.send(d),gif:d=>C.send(d),sair:()=>r.leave()}}
/* regras de recebimento */
const okStr=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
function limitaPeer(p){const a=p.cota||(p.cota=[]),n=performance.now();while(a.length&&n-a[0]>3000)a.shift();if(a.length>=6)return false;a.push(n);return true}
function perfilDe(pid){let p=CHAT.peers.get(pid);if(!p){p={uid:pid,nick:'Leitor',av:AV.auto(pid)};CHAT.peers.set(pid,p)}return p}
function aplicarHi(d,pid){if(!d||!okStr(d.uid,32))return;const p=perfilDe(pid);p.uid=d.uid;p.nick=limparNome(FILTRO(String(d.nick||'')).slice(0,24))||'Leitor';p.av=Number.isInteger(d.av)?((d.av%AV.N)+AV.N)%AV.N:AV.auto(d.uid);statusChat()}
function receber(d,pid,gif){const p=perfilDe(pid);if(!d||!okStr(d.id,24)||CHAT.vistos.has(d.id)||CHAT.bloq.has(p.uid)||!limitaPeer(p))return;
  const m={id:d.id,ts:Date.now(),uid:p.uid,nick:p.nick,av:p.av,me:false};
  if(gif){let u=null;try{if(typeof d.g==='string'&&d.g.length<GIF_MAX*1.4+100){const bin=atob(d.g);u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i)}}catch(e){u=null}if(!u||u.length>GIF_MAX||u.length<10)return;const sig=String.fromCharCode(...u.slice(0,6));if(sig!=='GIF89a'&&sig!=='GIF87a')return;m.gif=URL.createObjectURL(new Blob([u],{type:'image/gif'}));CHAT.url.push(m.gif)}
  else{if(typeof d.t!=='string'||!d.t.trim())return;m.txt=FILTRO(d.t.trim().slice(0,TXT_MAX))}
  CHAT.vistos.add(d.id);pintarMsg(m);salvarMsg(m)}
/* interface */
function statusChat(){const n=CHAT.tr?CHAT.tr.peers():0,s=$('cx-status');if(!CHAT.sala){s.textContent='';return}
  s.className=n?'on':'';s.textContent=n?L('● '+(n+1)+' online','● '+(n+1)+' online'):L('● procurando leitores…','● looking for readers…')}
function sistema(t){const d=document.createElement('div');d.className='cx-sys';d.textContent=t;$('cx-msgs').append(d);rolar()}
function rolar(){const b=$('cx-msgs');b.scrollTop=b.scrollHeight}
/* v0.57: teclado virtual encolhe a tela; mantem o fim da conversa e o campo de digitacao visiveis */
addEventListener('resize',()=>{const c=$('chat');if(c&&!c.hidden){rolar();const f=document.activeElement;if(f&&f.closest&&f.closest('#cx-form'))setTimeout(()=>{try{f.scrollIntoView({block:'nearest'})}catch(e){}},50)}});
function pintarMsg(m){const box=$('cx-msgs'),cor=AV.cor(m.uid),li=document.createElement('div');li.className='cx-m'+(m.me?' me':'');li.dataset.u=m.uid;
  if(!m.me){li.style.setProperty('--fg',cor.fg);li.style.setProperty('--bg',cor.bg);li.style.setProperty('--bd',cor.bd)}
  const av=document.createElement('div');av.className='cx-av';av.innerHTML=AV.svg(m.av,m.uid);
  const bl=document.createElement('div');bl.className='cx-b';
  const hd=document.createElement('div');hd.className='cx-h';const nm=document.createElement('b');nm.textContent=m.me?L('você','you'):m.nick;const tm=document.createElement('span');tm.textContent=hhmm(m.ts);hd.append(nm,tm);
  if(!m.me){const bk=document.createElement('button');bk.type='button';bk.className='cx-bk';bk.textContent='⛔';bk.title=L('Bloquear','Block');bk.setAttribute('aria-label',L('Bloquear ','Block ')+m.nick);bk.onclick=()=>bloquear(m.uid,m.nick);hd.append(bk)}
  bl.append(hd);
  if(m.gif&&typeof m.gif==='string'){const im=()=>{const i=document.createElement('img');i.className='cx-gif';i.alt='GIF';i.src=m.gif;return i};
    if(m.me)bl.append(im());else{const b=document.createElement('button');b.type='button';b.className='cx-gifb';b.textContent=L('▶ GIF — toque para ver','▶ GIF — tap to view');b.onclick=()=>b.replaceWith(im());bl.append(b)}}
  else bl.append(txtLinks(m.txt));
  li.append(av,bl);const perto=box.scrollHeight-box.scrollTop-box.clientHeight<120;box.append(li);while(box.children.length>300)box.firstChild.remove();if(perto||m.me)rolar()}
function bloquear(uid,nick){CHAT.bloq.add(uid);store.set('hq-chat-bloq',[...CHAT.bloq]);for(const el of [...$('cx-msgs').querySelectorAll('.cx-m:not(.me)')])if(el.dataset.u===uid)el.remove();sistema(L(nick+' foi bloqueado(a) neste aparelho.',nick+' was blocked on this device.'))}
function enviar(txt,gifBuf){const now=performance.now();if(now-CHAT.ult<700||!CHAT.tr)return false;CHAT.ult=now;const id=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-6);CHAT.vistos.add(id);
  const m={id,ts:Date.now(),uid:UID,nick:meuNome(),av:meuAvatar(),me:true};
  if(gifBuf){m.gif=URL.createObjectURL(new Blob([gifBuf],{type:'image/gif'}));CHAT.url.push(m.gif);{const u8=new Uint8Array(gifBuf);let bin='';for(let i=0;i<u8.length;i+=0x8000)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));CHAT.tr.gif({id,g:btoa(bin)})}}
  else{const bruto=txt.trim().slice(0,TXT_MAX);if(!bruto)return false;const t=FILTRO(bruto);m.txt=t;if(FILTRO.achou)toastChat(L('Palavras ofensivas foram ocultadas.','Offensive words were hidden.'));CHAT.tr.msg({id,t})}
  pintarMsg(m);salvarMsg(m);return true}
function toastChat(t){const e=$('cx-toast');e.textContent=t;e.classList.add('on');clearTimeout(toastChat.t);toastChat.t=setTimeout(()=>e.classList.remove('on'),2200)}
async function entrarSala(nome){const sala=nomeSala(FILTRO(nome)),n=sala.replace(/-/g,'');if(!sala||/\*/.test(sala)){toastChat(L('Escolha outro nome de sala.','Pick another room name.'));return}
  sairSala(true);CHAT.sala=sala;CHAT.vistos=new Set();CHAT.peers=new Map();$('cx-msgs').textContent='';$('cx-join').hidden=true;$('cx-sala').textContent='#'+sala;$('cx-room').hidden=false;$('cx-form').hidden=false;
  const h=await carregarHist(sala);if(h.length){sistema(L('— histórico guardado neste aparelho (até 30 dias) —','— history saved on this device (up to 30 days) —'));for(const x of h){if(!x.me&&CHAT.bloq.has(x.uid))continue;pintarMsg({id:'h',ts:x.ts,uid:x.uid,nick:FILTRO(x.nick),av:x.av,me:x.me,txt:x.gif?'[GIF]':FILTRO(x.txt||'')})}sistema(L('— agora —','— now —'))}
  try{CHAT.tr=abrirTransporte(sala,{
    entrou:pid=>{perfilDe(pid);CHAT.tr.hi({uid:UID,nick:meuNome(),av:meuAvatar()},pid);statusChat()},
    saiu:pid=>{const p=CHAT.peers.get(pid);if(p)sistema(L(p.nick+' saiu.',p.nick+' left.'));CHAT.peers.delete(pid);statusChat()},
    hi:(d,pid)=>{aplicarHi(d,pid);},msg:(d,pid)=>receber(d,pid,false),gif:(d,pid)=>receber(d,pid,true)})}
  catch(e){sistema(L('Não foi possível iniciar o P2P neste aparelho.','Could not start P2P on this device.'));return}
  statusChat();clearInterval(CHAT.iv);CHAT.t0=Date.now();CHAT.iv=setInterval(()=>{statusChat();if(!CHAT.avisou&&CHAT.tr&&!CHAT.tr.peers()&&Date.now()-CHAT.t0>25000){CHAT.avisou=true;sistema(L('Ninguém por aqui ainda. A sala existe enquanto houver alguém nela — chame um amigo com o mesmo nome de sala.','Nobody here yet. The room exists while someone is in it — invite a friend with the same room name.'))}},2000);
  $('cx-txt').focus()}
function sairSala(silencioso){if(CHAT.tr){try{CHAT.tr.sair()}catch(e){}CHAT.tr=null}clearInterval(CHAT.iv);CHAT.avisou=false;CHAT.sala=null;CHAT.url.forEach(u=>URL.revokeObjectURL(u));CHAT.url=[];
  if(!silencioso){$('cx-msgs').textContent='';$('cx-join').hidden=false;$('cx-room').hidden=true;$('cx-form').hidden=true}statusChat()}
function abrirChat(on){const c=$('chat');if(on){if(!chatAberto()){c.hidden=false;if(document.documentElement.dataset.modo!=='web'){try{history.pushState({hq:'chat'},'')}catch(e){}}purgar();if(!store.get('hq-chat-ok',false))$('cx-aviso').hidden=false;
      if(!CHAT.sala){$('cx-join').hidden=false;$('cx-room').hidden=true;$('cx-form').hidden=true;$('cx-sala-in').value='';chipsSala()}}
    if(!CHAT.sala&&$('cx-aviso').hidden)$('cx-sala-in').focus()}
  else{if(chatAberto()){if(history.state&&history.state.hq==='chat')history.back();else fecharChat()}}}
function fecharChat(){$('chat').hidden=true}
addEventListener('popstate',()=>{if(chatAberto())fecharChat()});
function chipsSala(){const box=$('cx-chips');box.textContent='';const lst=[['geral',L('geral','general')],['quadrinhos',L('quadrinhos','comics')],['anime',L('anime e mangá','anime & manga')]];
  if(typeof book!=='undefined'&&book&&book.name){const s=nomeSala(book.name.replace(/\.(cbr|cbz|zip|rar)$/i,''));if(s)lst.unshift([s,L('Sala desta HQ','This comic\'s room')])}
  for(const [s,l] of lst){const b=document.createElement('button');b.type='button';b.className='cx-chip';b.textContent=l;b.onclick=()=>entrarSala(s);box.append(b)}}
function listaBloq(){const p=$('cx-bloqs');p.hidden=!p.hidden;if(p.hidden)return;p.textContent='';const a=[...CHAT.bloq];if(!a.length){p.textContent=L('Ninguém bloqueado.','Nobody blocked.');return}
  for(const u of a){const r=document.createElement('div');const t=document.createElement('span');t.textContent=L('Usuário ','User ')+u.slice(0,6);const b=document.createElement('button');b.type='button';b.className='cx-chip';b.textContent=L('desbloquear','unblock');b.onclick=()=>{CHAT.bloq.delete(u);store.set('hq-chat-bloq',[...CHAT.bloq]);r.remove()};r.append(t,b);p.append(r)}}
const EMOJIS='😀 😁 😂 🤣 😊 😍 🤩 😎 🤓 🥳 😏 😅 😭 😡 🥺 😱 🤯 🤔 😴 😈 👍 👎 👏 🙌 💪 🙏 👀 🤝 ✌️ 🤘 💥 ⚡ 🔥 ✨ 💫 🌟 💯 ❤️ 💙 💚 💛 🧡 💜 🖤 💔 🦸 🦹 🥷 🧙 🧛 🤖 👾 👻 💀 👽 🐱 🐉 🦇 🕷️ 🕸️ ⚔️ 🛡️ 🗡️ 🏹 🎮 🕹️ 📚 📖 🎬 🍿 ☕ 🍕 🍔 🍜 🍣 🌮 🍫 🎉 🏆 🎯 🚀 🌙 ☀️ 🌈 ⭐'.split(' ');
function montarEmojis(){const e=$('cx-emo');if(e.dataset.ok)return;e.dataset.ok=1;for(const x of EMOJIS){const b=document.createElement('button');b.type='button';b.textContent=x;b.setAttribute('aria-label',x);b.onclick=()=>{const i=$('cx-txt'),a=i.selectionStart==null?i.value.length:i.selectionStart,z=i.selectionEnd==null?a:i.selectionEnd;if(i.value.length+x.length<=TXT_MAX){i.value=i.value.slice(0,a)+x+i.value.slice(z);i.focus();const p=a+x.length;try{i.setSelectionRange(p,p)}catch(_){}}};e.append(b)}}
$('cx-emo-b').onclick=()=>{montarEmojis();$('cx-emo').hidden=!$('cx-emo').hidden};
$('cx-gif-b').onclick=()=>$('cx-file').click();
$('cx-file').onchange=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;if(f.size>GIF_MAX){toastChat(L('GIF grande demais (máx. 800 KB).','GIF too big (max 800 KB).'));return}
  const buf=await f.arrayBuffer(),u=new Uint8Array(buf),sig=String.fromCharCode(...u.slice(0,6));if(sig!=='GIF89a'&&sig!=='GIF87a'){toastChat(L('Escolha um arquivo .gif.','Pick a .gif file.'));return}
  if(!enviar('',buf))toastChat(L('Calma! Espere um instante.','Slow down! Wait a moment.'))};
$('cx-form').onsubmit=e=>{e.preventDefault();const i=$('cx-txt');if(!i.value.trim())return;if(enviar(i.value)){i.value='';$('cx-emo').hidden=true}else toastChat(L('Calma! Espere um instante.','Slow down! Wait a moment.'))};
$('cx-join-form').onsubmit=e=>{e.preventDefault();entrarSala($('cx-sala-in').value)};
$('cx-x').onclick=()=>abrirChat(false);$('cx-sair').onclick=()=>sairSala(false);
$('cx-limpar').onclick=async()=>{if(!CHAT.sala)return;await limparSala(CHAT.sala);$('cx-msgs').textContent='';sistema(L('Conversa apagada deste aparelho.','Conversation deleted from this device.'))};
$('cx-bloq').onclick=listaBloq;
$('cx-aceito').onclick=()=>{store.set('hq-chat-ok',true);$('cx-aviso').hidden=true};
$('chat').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')abrirChat(false)});
$('chat').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
{const tg=()=>abrirChat(!(chatAberto()&&document.documentElement.dataset.modo==='web'));$('chat-btn').onclick=tg;$('chat-btn2').onclick=tg}
/* avatares no perfil */
function pfAvatares(){const g=$('pf-av');if(!g)return;g.textContent='';const sel=(PERFIL.avatar==null?'auto':PERFIL.avatar);
  const mk=(v,html,rot)=>{const b=document.createElement('button');b.type='button';b.className='pf-av-b'+(String(sel)===String(v)?' on':'');b.innerHTML=html;b.setAttribute('aria-label',rot);b.onclick=()=>{PERFIL.avatar=v;salvarPerfil();pfAvatares()};g.append(b)};
  mk('auto','<span>A</span>',L('Automático','Automatic'));for(let i=0;i<AV.N;i++)mk(i,AV.svg(i,UID),'Avatar '+(i+1))}
