Object.assign(EN,{'Cor do app':'App color','Cor personalizada':'Custom color','Biblioteca':'Library','＋ Adicionar':'＋ Add','Buscar na biblioteca':'Search the library','Mais recentes':'Newest','Nome (A–Z)':'Name (A–Z)','Maiores primeiro':'Largest first','Mais antigos':'Oldest','Proteger armazenamento':'Protect storage','Backup do progresso':'Progress backup','Copiar':'Copy','Restaurar':'Restore',
'Copie este texto e guarde. Para restaurar, cole o texto aqui e toque em Restaurar. (Guarda onde você parou e as preferências; os arquivos continuam na biblioteca.)':'Copy this text and keep it. To restore, paste it here and tap Restore. (Keeps where you stopped and your preferences; files stay in the library.)'});
/* ---------- biblioteca: indice persistente, importacao (aparelho / nuvem via seletor do Android), busca, armazenamento ---------- */
const FONTES={aparelho:['Aparelho','Device'],gdrive:['Google Drive','Google Drive'],onedrive:['OneDrive','OneDrive'],ftp:['FTP / outro','FTP / other']};
const bibAberto=()=>!$('bib').hidden;
let bibIdx=[],bibF=Object.assign({tipo:'todos',fonte:'todas',q:'',ord:'recente'},{}),bibObs=null,bibUrls=[],bibFonteAdd='aparelho',avisoT=0;
const fmtB=b=>{b=+b||0;if(b<1024)return b+' B';const u=['KB','MB','GB','TB'];let i=-1;do{b/=1024;i++}while(b>=1024&&i<3);return b.toFixed(b<10?1:0)+' '+u[i]};
function aviso(t){let el=$('aviso-g');if(!el){el=document.createElement('div');el.id='aviso-g';el.setAttribute('role','status');document.body.append(el)}
  el.textContent=t;el.classList.add('on');clearTimeout(avisoT);avisoT=setTimeout(()=>el.classList.remove('on'),5000)}
async function idxOp(mode,fn){const d=await db();if(!d)return null;return new Promise(ok=>{try{const tx=d.transaction('indice',mode),st=tx.objectStore('indice'),q=fn(st);
  if(mode==='readonly'){q.onsuccess=()=>ok(q.result===undefined?null:q.result);q.onerror=()=>ok(null)}else{tx.oncomplete=()=>ok(true);tx.onerror=tx.onabort=()=>ok(null)}}catch(e){ok(null)}})}
const idxAll=async()=>(await idxOp('readonly',st=>st.getAll()))||[];
const idxPut=r=>idxOp('readwrite',st=>st.put(r,r.key));
const idxDel=k=>idxOp('readwrite',st=>st.delete(k));
const idxGet=k=>idxOp('readonly',st=>st.get(k));
const semExt=n=>n.replace(/\.(cbr|cbz|zip|rar|pdf|epub)$/i,'');
function regDe(key,v,fonte){const tam=(v.files||[]).reduce((a,f)=>a+((f.blob&&f.blob.size)||0),0);
  return {key,name:v.name,manga:key.startsWith('mg:'),fonte:fonte||'aparelho',tam,capa:v.capa||null,t:v.t||Date.now(),pag:null}}
// livros guardados por versoes antigas entram no indice uma vez
async function bibMigrar(){if(store.get('hq-idx-ok',false))return;const d=await db();if(!d)return;
  const keys=(await libOp('readonly',st=>st.getAllKeys()))||[],tem=new Set((await idxAll()).map(x=>x.key));
  for(const k of keys){if(tem.has(k))continue;const v=await libGet(k);if(v)await idxPut(regDe(k,v,'aparelho'))}
  store.set('hq-idx-ok',true)}
async function chaveLivro(files,name,manga,n){const tam=files.reduce((a,f)=>a+f.size,0),bn=semExt(name);
  const ex=(await idxAll()).find(x=>!!x.manga===!!manga&&x.name===bn&&x.tam===tam);return ex?ex.key:(manga?'mg:':'hq:')+name+':'+n}
const CATS=['webtoon','manhua','manhwa'],CATS_HQ=['marvel','dc'];
const catNome=c=>c==='marvel'?'Marvel':c==='dc'?'DC Comics':c==='webtoon'?L('Webtoon','Webtoon'):c==='manhua'?L('Manhua','Manhua'):c==='manhwa'?L('Manhwa','Manhwa'):'';
const RE_MARVEL=/marvel|homem[- ]aranha|spider-?man|vingadores|avengers|wolverine|x-?men|\bhulk\b|infernal hulk|homem[- ]de[- ]ferro|iron man|capit[aã]o am[eé]rica|captain america|\bthor\b|demolidor|daredevil|justiceiro|punisher|c[ií]clope|cyclops|deadpool|pantera negra|black panther|quarteto fant|fantastic four|guardi[oõ]es da gal|homem[- ]formiga|ant-?man|doutor estranho|doctor strange|\bvenom\b|thanos|surfista prateado|magneto|vi[uú]va negra|black widow|gavi[aã]o arqueiro|hawkeye|motoqueiro fantasma|ghost rider|armagedom|armagedon/i;
const RE_DC=/\bdc\b|dc comics|batman|superman|liga da justi[cç]a|justice league|mulher[- ]maravilha|wonder woman|\bflash\b|lanterna verde|green lantern|aquaman|coringa|\bjoker\b|asa noturna|nightwing|arlequina|harley quinn|mulher[- ]gato|catwoman|shazam|supergirl|batgirl|jovens tit[aã]s|teen titans|watchmen|sandman|constantine|flashpoint|crise nas infinitas|infinite crisis/i;
const catDoNome=(n,mg)=>{n=String(n||'');if(!mg)return RE_MARVEL.test(n)?'marvel':RE_DC.test(n)?'dc':undefined;return /webtoon/i.test(n)?'webtoon':/manhwa/i.test(n)?'manhwa':/manhua/i.test(n)?'manhua':undefined};
const bibTipoOk=(x,t)=>t==='todos'||(t==='hq'?!x.manga:t==='manga'?(!!x.manga&&!x.cat):x.cat===t);
async function guardarLivro(key,name,files,primeira,fonte,pag,catF){
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
  const capa=primeira?await capaDe(primeira):null,plain=files.map(f=>({name:f.name,type:f.type,blob:f})),v={name,files:plain,capa,t:Date.now()};
  const ok=await libPut(key,v);
  if(!ok){aviso(L('Sem espaço para guardar “'+name+'”. Libere espaço na Biblioteca (remova títulos) e abra de novo.','Not enough space to store “'+name+'”. Free space in the Library (remove titles) and open it again.'));return null}
  const ant=await idxGet(key);await idxPut(Object.assign(regDe(key,v,(ant&&ant.fonte)||fonte||'aparelho'),{pag:pag||(ant&&ant.pag)||null,cat:catF!==undefined?catF:(ant&&ant.cat!==undefined)?ant.cat:catDoNome(name,!!(ant?ant.manga:false)||/^mg:/.test(key))}));
  const r=store.get('hq-recentes',[]),it=r.find(x=>x.key===key);if(it){it.salvo=true;store.set('hq-recentes',r)}
  renderRecent();if(bibAberto())bibRender();return ok}
async function abrirDaEstante(it){const v=await libGet(it.key);
  if(!v||!v.files||!v.files.length){aviso(L('“'+it.name+'” não está mais guardada neste aparelho. Remova da biblioteca e adicione de novo.','“'+it.name+'” is no longer stored on this device. Remove it from the library and add it again.'));return}
  const files=v.files.map(f=>f.blob instanceof File?f.blob:new File([f.blob],f.name,{type:f.type||''}));
  if(bibAberto())bibAbrir(false,true);
  openFiles(files,{daEstante:true,manga:!!it.manga,chave:it.key})}

/* ---------- importar sem abrir ---------- */
async function bibImportar(files,fonte){
  files=[...files];if(!files.length)return;let manga=aba==='manga',catF;if(bibF.tipo!=='todos'){manga=!CATS_HQ.includes(bibF.tipo);catF=(CATS.includes(bibF.tipo)||CATS_HQ.includes(bibF.tipo))?bibF.tipo:null}
  const arqs=files.filter(f=>EXT_MG.test(f.name)),imgs=files.filter(f=>IMG.test(f.name)&&!EXT_MG.test(f.name));
  const grupos=arqs.map(f=>[f]);if(imgs.length)grupos.push(imgs);
  if(!grupos.length){aviso(L('Nenhum formato aceito. Use PDF, CBZ, CBR, ZIP, RAR, EPUB ou imagens.','No supported format. Use PDF, CBZ, CBR, ZIP, RAR, EPUB or images.'));return}
  const T4=(pt,en,ja,ko)=>[pt,en,ja,ko][LI()],tot=grupos.reduce((a,g)=>a+g.reduce((x,f)=>x+f.size,0),0)||1;
  let ok=0,dup=0,erro=0,i=0,feito=0,cancel=false,tIni=performance.now(),ini=0,tamAtu=1,rate=0,tFile=performance.now(),fim=0;
  const box=$('imp');$('imp-t').textContent=T4('Importando para a biblioteca…','Importing to the library…','ライブラリに取り込み中…','라이브러리로 가져오는 중…');
  $('imp-sub').textContent=T4('Por favor, aguarde. Não feche o app até terminar.','Please wait. Do not close the app until it finishes.','しばらくお待ちください。終わるまでアプリを閉じないでください。','잠시만 기다려 주세요. 끝날 때까지 앱을 닫지 마세요.');
  $('imp-x').textContent=T4('Cancelar','Cancel','キャンセル','취소');$('imp-x').disabled=false;$('imp-x').onclick=()=>{cancel=true;$('imp-x').disabled=true;$('imp-sub').textContent=T4('Cancelando depois deste arquivo…','Cancelling after this file…','このファイルの後でキャンセルします…','이 파일 이후 취소합니다…')};
  box.hidden=false;
  const fmtT=s=>s>=90?Math.round(s/60)+' min':Math.max(1,Math.round(s))+' s';
  const pinta=()=>{const agora=performance.now(),dt=(agora-tIni)/1000;
    // taxa medida (bytes/s); antes do 1o arquivo terminar, estimativa conservadora
    const r=rate||6e6,esp=Math.max(0.35,tamAtu/r),tf=(agora-tFile)/1000,frac=tf<=esp?0.9*(tf/esp):0.9+0.07*(1-Math.exp(-(tf-esp)/(esp+4))),prog=Math.min(1,(feito+tamAtu*frac)/tot);
    $('imp-i').style.width=(fim?100:prog*100).toFixed(1)+'%';
    $('imp-n').textContent=fim?T4('Concluído','Done','完了','완료'):T4(i+' de '+grupos.length+' · '+Math.round(prog*100)+'%',i+' of '+grupos.length+' · '+Math.round(prog*100)+'%',i+' / '+grupos.length+' 件 · '+Math.round(prog*100)+'%',i+' / '+grupos.length+' 개 · '+Math.round(prog*100)+'%');
    if(fim){$('imp-eta').textContent='';return}
    if(!rate&&dt<1.2){$('imp-eta').textContent=T4('calculando o tempo…','estimating time…','時間を計算中…','시간 계산 중…');return}
    if(tf>esp*1.15){const outros=(tot-feito-tamAtu)/r;$('imp-eta').textContent=outros>3?T4('este arquivo é grande, demora mais · faltam ~'+fmtT(outros+3)+'+','this file is large and takes longer · ~'+fmtT(outros+3)+'+ left','このファイルは大きく時間がかかります · 残り '+fmtT(outros+3)+' 以上','이 파일은 커서 오래 걸립니다 · '+fmtT(outros+3)+' 이상 남음'):T4('finalizando este arquivo (arquivos grandes demoram mais)…','finishing this file (large files take longer)…','このファイルを仕上げ中(大きいファイルは時間がかかります)…','이 파일을 마무리하는 중 (큰 파일은 오래 걸립니다)…');return}
    const falta=Math.max(1,((tot-feito)-tamAtu*frac)/r);
    $('imp-eta').textContent=T4('faltam ~'+fmtT(falta),'~'+fmtT(falta)+' left','残り約 '+fmtT(falta),'약 '+fmtT(falta)+' 남음')};
  const tm=setInterval(pinta,250);pinta();
  for(const g of grupos){if(cancel)break;i++;tamAtu=g.reduce((x,f)=>x+f.size,0)||1;tFile=performance.now();
    $('imp-nome').textContent=g[0].name.replace(/_+/g,' ');pinta();
    try{const r=await bibImportarUm(g,fonte,manga,catF);if(r==='dup')dup++;else if(r)ok++;else erro++}catch(e){erro++}
    feito+=tamAtu;const dtot=(performance.now()-tIni)/1000;rate=Math.max(1e5,feito/Math.max(0.2,dtot));
    await new Promise(r=>setTimeout(r,0))}
  fim=1;pinta();$('imp-nome').textContent='';await new Promise(r=>setTimeout(r,(performance.now()-tIni)<1100?1100-(performance.now()-tIni):350));
  clearInterval(tm);box.hidden=true;await bibRender();
  aviso(L(ok+' adicionado(s)'+(dup?' · '+dup+' já existia(m)':'')+(erro?' · '+erro+' com erro':''),ok+' added'+(dup?' · '+dup+' already there':'')+(erro?' · '+erro+' failed':'')))}
async function bibImportarUm(g,fonte,manga0,catF){
  const f=g[0],ehArq=EXT_MG.test(f.name),ehMg=/\.(pdf|epub)$/i.test(f.name)?true:manga0;let name,n=0,capa=null;
  if(!ehArq){const o=[...g].sort((a,b)=>natural(a.name,b.name));name=o[0].name.replace(/[_ -]*\d*\.\w+$/,'')||'Imagens';n=o.length;capa=o[0]}
  else{name=f.name;
    if(/\.pdf$/i.test(f.name)){const p=await pdfAbrir(f,null,1);n=p.length;try{capa=await p[0].get()}finally{p.fecha()}}
    else if(/\.epub$/i.test(f.name)){const p=await epubPaginas(f,true);n=p.length;if(n)capa=await p[0].get()}
    else if(/\.(cbz|zip)$/i.test(f.name)){const zip=await JSZip.loadAsync(f),ns=Object.keys(zip.files).filter(x=>!zip.files[x].dir&&IMG.test(x)&&!/__MACOSX|\/\./.test(x)).sort(natural);
      n=ns.length;if(n)capa=new Blob([await zip.files[ns[0]].async('uint8array')],{type:mimeOf(ns[0])})}
    else{const data=await f.arrayBuffer();
      try{const ex=await UnrarLib.createExtractorFromData({wasmBinary:b64ToBytes('unrarwasm').buffer,data}),ns=[...ex.getFileList().fileHeaders].filter(h=>!h.flags.directory&&IMG.test(h.name)&&!/__MACOSX/.test(h.name)).map(h=>h.name).sort(natural);
        n=ns.length;if(n){const o=ex.extract({files:[ns[0]]});for(const x of o.files){capa=new Blob([x.extraction],{type:mimeOf(ns[0])})}}}
      catch(e){try{const zip=await JSZip.loadAsync(data),ns=Object.keys(zip.files).filter(x=>!zip.files[x].dir&&IMG.test(x)).sort(natural);n=ns.length;if(n)capa=new Blob([await zip.files[ns[0]].async('uint8array')],{type:mimeOf(ns[0])})}catch(e2){}}}}
  if(!ehArq?false:!n&&!/\.(cbr|rar)$/i.test(f.name))return false;
  const tam=g.reduce((a,x)=>a+x.size,0),bn=semExt(name),ex=(await idxAll()).find(x=>!!x.manga===!!ehMg&&x.name===bn&&x.tam===tam);if(ex)return 'dup';
  const key=(ehMg?'mg:':'hq:')+name+':'+(n||tam);
  return !!(await guardarLivro(key,bn,g,capa,fonte,n,catF))}

/* ---------- tela da biblioteca ---------- */
function bibAbrir(on,semHist){const b=$('bib');
  if(on){if(bibAberto())return;b.hidden=false;try{history.pushState({hq:'bib'},'')}catch(e){}bibMigrar().then(bibRender);bibRender()}
  else{if(!bibAberto())return;if(!semHist&&history.state&&history.state.hq==='bib'){history.back();return}bibFechar()}}
function bibFechar(){$('bib').hidden=true;$('bib-menu').hidden=true;$('bib-add-s').hidden=true;$('bib-bk').hidden=true;if(bibObs){bibObs.disconnect();bibObs=null}for(const u of bibUrls)URL.revokeObjectURL(u);bibUrls=[];$('bib-grid').replaceChildren()}
addEventListener('popstate',()=>{if(bibAberto())bibFechar()});
$('bib-btn').onclick=()=>bibAbrir(true);$('bib-x').onclick=()=>bibAbrir(false);
$('bib-q').oninput=e=>{bibF.q=e.target.value;bibRender()};$('bib-ord').onchange=e=>{bibF.ord=e.target.value;bibRender()};
async function bibMedidor(){const a=await idxAll(),soma=a.reduce((s,x)=>s+(x.tam||0),0);let e=null,pers=null;
  try{e=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null;pers=navigator.storage&&navigator.storage.persisted?await navigator.storage.persisted():null}catch(x){}
  const usado=e&&e.usage||soma,quota=e&&e.quota||0,pct=quota?Math.min(100,usado/quota*100):0;
  $('bib-med-t').textContent=a.length+L(' título(s) · ',' title(s) · ')+fmtB(soma)+(quota?L(' · app usa '+fmtB(usado)+' de '+fmtB(quota),' · app uses '+fmtB(usado)+' of '+fmtB(quota)):'');
  $('bib-med-i').style.width=pct+'%';$('bib-med').classList.toggle('alerta',pct>85);
  $('bib-prot').hidden=pers!==false;$('bib-med-av').hidden=pct<=85;
  $('bib-med-av').textContent=L('Pouco espaço livre: remova títulos que você já leu para continuar adicionando.','Low free space: remove titles you already read to keep adding.')}
function bibChips(todos){const box=$('bib-chips');box.replaceChildren();
  const mk=(grp,val,txt,n)=>{const b=document.createElement('button');b.type='button';b.className='chip'+(bibF[grp]===val?' on':'');b.textContent=txt+(n!==undefined?' '+n:'');b.onclick=()=>{bibF[grp]=val;bibRender()};box.append(b)};
  mk('tipo','todos',L('Todos','All'),todos.length);for(const c of CATS_HQ)mk('tipo',c,catNome(c),todos.filter(x=>x.cat===c).length);mk('tipo','manga',L('Mangá','Manga'),todos.filter(x=>bibTipoOk(x,'manga')).length);for(const c of CATS)mk('tipo',c,catNome(c),todos.filter(x=>x.cat===c).length);
  const fs=[...new Set(todos.map(x=>x.fonte))];if(fs.length>1){const sp=document.createElement('span');sp.className='sep';box.append(sp);mk('fonte','todas',L('Todas as origens','All sources'));for(const f of fs)mk('fonte',f,FONTES[f]?LN(FONTES[f]):f)}}
async function bibRender(){
  const todos=await idxAll();for(const x of todos)if(x.cat===undefined)x.cat=catDoNome(x.name,x.manga);bibIdx=todos;bibChips(todos);bibMedidor();
  const q=bibF.q.trim().toLowerCase();
  let l=todos.filter(x=>bibTipoOk(x,bibF.tipo)&&(bibF.fonte==='todas'||x.fonte===bibF.fonte)&&(!q||x.name.toLowerCase().includes(q)));
  const nat=(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
  l.sort(bibF.ord==='nome'?nat:bibF.ord==='tam'?(a,b)=>b.tam-a.tam:bibF.ord==='antigo'?(a,b)=>a.t-b.t:(a,b)=>b.t-a.t);
  const g=$('bib-grid');if(bibObs){bibObs.disconnect();bibObs=null}for(const u of bibUrls)URL.revokeObjectURL(u);bibUrls=[];g.replaceChildren();
  $('bib-vazio').hidden=l.length>0;$('bib-vazio').textContent=todos.length?L('Nada encontrado com esse filtro.','Nothing found with this filter.'):L('Sua biblioteca está vazia. Toque em ＋ Adicionar para trazer arquivos do aparelho, do Google Drive, do OneDrive ou de um app com FTP.','Your library is empty. Tap ＋ Add to bring files from the device, Google Drive, OneDrive or an FTP app.');
  bibObs=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const li=e.target,it=li._it;bibObs.unobserve(li);
    if(it.capa){const u=URL.createObjectURL(it.capa);bibUrls.push(u);const im=li.querySelector('.capa');const n=document.createElement('img');n.className='capa';n.alt='';n.src=u;im.replaceWith(n)}}},{root:g,rootMargin:'300px'});
  const fr=document.createDocumentFragment();
  for(const it of l){const li=document.createElement('div');li.className='bc';li._it=it;
    const pr=store.get(it.key,null),pct=pr&&it.pag?Math.min(100,Math.round(100*(pr.page+1)/it.pag)):0;
    const b=document.createElement('button');b.type='button';b.className='bc-b';b.setAttribute('aria-label',L('Abrir ','Open ')+it.name);
    const cap=document.createElement('span');cap.className='capa vazia';cap.textContent=it.cat?catNome(it.cat).toUpperCase():it.manga?'MANGÁ':'HQ';
    const ft=document.createElement('span');ft.className='ft';const nm=document.createElement('span');nm.className='nome';nm.textContent=it.name.replace(/_+/g,' ').trim();
    const meta=document.createElement('span');meta.className='pg';meta.textContent=fmtB(it.tam)+(it.pag?' · '+it.pag+L(' pág.',' pg.'):'');
    ft.append(nm,meta);if(pct){const pg=document.createElement('span');pg.className='prog';pg.innerHTML='<i></i>';pg.firstChild.style.width=pct+'%';ft.append(pg)}
    const tag=document.createElement('span');tag.className='bd';tag.textContent=(FONTES[it.fonte]?LN(FONTES[it.fonte]):it.fonte);
    b.append(cap,tag,ft);let lpT=0,lpF=false;
    b.addEventListener('pointerdown',()=>{lpF=false;clearTimeout(lpT);lpT=setTimeout(()=>{lpF=true;try{navigator.vibrate&&navigator.vibrate(15)}catch(x){}bibMenu(it)},520)});
    for(const ev of ['pointerup','pointerleave','pointercancel'])b.addEventListener(ev,()=>clearTimeout(lpT));
    b.addEventListener('contextmenu',e=>{e.preventDefault();clearTimeout(lpT);lpF=true;bibMenu(it)});
    b.onclick=e=>{if(lpF){lpF=false;e.preventDefault();return}abrirDaEstante(it)};
    const mn=document.createElement('button');mn.type='button';mn.className='rm';mn.textContent='⋯';mn.setAttribute('aria-label',L('Opções de ','Options for ')+it.name);mn.onclick=e=>{e.stopPropagation();bibMenu(it)};
    li.append(b,mn);fr.append(li);}
  g.append(fr);for(const li of g.children)bibObs.observe(li)}
function bibMenu(it,conf){const m=$('bib-menu'),c=$('bib-menu-c');m.hidden=false;c.replaceChildren();
  const h=document.createElement('h3');h.textContent=it.name;c.append(h);
  const p=document.createElement('p');p.className='info';
  p.textContent=(it.cat?catNome(it.cat):it.manga?L('Mangá','Manga'):'HQ')+' · '+fmtB(it.tam)+(it.pag?' · '+it.pag+L(' páginas',' pages'):'')+' · '+(FONTES[it.fonte]?LN(FONTES[it.fonte]):it.fonte)+' · '+L('adicionado em ','added ')+new Date(it.t).toLocaleDateString(LANGHTML[LANG]);c.append(p);
  const bt=(txt,fn,cls)=>{const b=document.createElement('button');b.type='button';b.className='btn'+(cls?' '+cls:'');b.textContent=txt;b.onclick=fn;c.append(b)};
  if(!conf){bt(L('▶ Abrir','▶ Open'),()=>{m.hidden=true;abrirDaEstante(it)});
    if(it.manga){const q=document.createElement('p');q.className='info';q.textContent=L('Mover para a categoria:','Move to category:');c.append(q);const row=document.createElement('div');row.className='chips';
      for(const cv of ['manga',...CATS]){const b=document.createElement('button');b.type='button';const atual=(it.cat||'manga')===cv;b.className='chip'+(atual?' on':'');b.textContent=cv==='manga'?L('Mangá','Manga'):catNome(cv);
        b.onclick=async()=>{if(atual)return;const n=Object.assign({},it);if(cv==='manga')n.cat=null;else n.cat=cv;await idxPut(n);await bibRender();bibMenu(n)};row.append(b)}c.append(row)}else{const q=document.createElement('p');q.className='info';q.textContent=L('Mover para a categoria:','Move to category:');c.append(q);const row=document.createElement('div');row.className='chips';
      for(const cv of ['hq',...CATS_HQ]){const b=document.createElement('button');b.type='button';const atual=(it.cat||'hq')===cv;b.className='chip'+(atual?' on':'');b.textContent=cv==='hq'?L('Sem categoria','No category'):catNome(cv);
        b.onclick=async()=>{if(atual)return;const n=Object.assign({},it);n.cat=cv==='hq'?null:cv;await idxPut(n);await bibRender();bibMenu(n)};row.append(b)}c.append(row)}bt(L('Remover da biblioteca','Remove from library'),()=>bibMenu(it,true),'ghost');bt(L('Fechar','Close'),()=>{m.hidden=true},'ghost')}
  else{const w=document.createElement('p');w.className='info';w.textContent=L('Isso apaga a cópia guardada no app. O arquivo original no aparelho ou na nuvem não é tocado.','This deletes the copy stored in the app. The original file on the device or cloud is not touched.');c.append(w);
    bt(L('Sim, remover','Yes, remove'),async()=>{await libDel(it.key);await idxDel(it.key);m.hidden=true;await bibRender();renderRecent()},'perigo');bt(L('Cancelar','Cancel'),()=>bibMenu(it),'ghost')}}
// adicionar: o seletor de arquivos do Android mostra o aparelho, o Google Drive, o OneDrive e apps de FTP instalados
const AJUDA={aparelho:['Do aparelho','Escolha um ou vários arquivos (PDF, CBZ, CBR, ZIP, RAR, EPUB ou imagens).'],gdrive:['Google Drive','Na janela de arquivos, toque em ☰ e escolha “Drive”. Precisa do app Google Drive instalado e logado.'],onedrive:['OneDrive','Na janela de arquivos, toque em ☰ e escolha “OneDrive”. Precisa do app OneDrive instalado e logado.'],ftp:['FTP / outro','O ComicXD não fala FTP sozinho. Instale um app de arquivos com FTP (Solid Explorer, CX Explorer, Material Files…), conecte seu servidor lá e ele aparece nesta janela de arquivos.']};
const AJUDA_L=()=>{if(LANG==='pt')return AJUDA;if(LANG==='en')return AJUDA_EN;const o={};for(const k in AJUDA)o[k]=[L(AJUDA[k][0],AJUDA_EN[k][0]),L(AJUDA[k][1],AJUDA_EN[k][1])];return o};
const AJUDA_EN={aparelho:['From device','Pick one or more files (PDF, CBZ, CBR, ZIP, RAR, EPUB or images).'],gdrive:['Google Drive','In the file window, tap ☰ and choose “Drive”. Needs the Google Drive app installed and signed in.'],onedrive:['OneDrive','In the file window, tap ☰ and choose “OneDrive”. Needs the OneDrive app installed and signed in.'],ftp:['FTP / other','ComicXD does not speak FTP by itself. Install a file app with FTP (Solid Explorer, CX Explorer, Material Files…), connect your server there and it shows up in this file window.']};
function bibAddUI(){const c=$('bib-add-c');c.replaceChildren();const h=document.createElement('h3');h.textContent=L('Adicionar à biblioteca','Add to library');c.append(h);
  const A=AJUDA_L(),ic={aparelho:'📱',gdrive:'☁',onedrive:'☁',ftp:'⇅'};
  for(const k of ['aparelho','gdrive','onedrive','ftp']){const b=document.createElement('button');b.type='button';b.className='bsrc';
    b.innerHTML='<b></b><small></small>';b.firstChild.textContent=ic[k]+' '+A[k][0];b.lastChild.textContent=A[k][1];b.onclick=()=>{bibFonteAdd=k;$('bib-add-s').hidden=true;$('bib-file').value='';$('bib-file').click()};c.append(b)}
  const x=document.createElement('button');x.type='button';x.className='btn ghost';x.textContent=L('Fechar','Close');x.onclick=()=>{$('bib-add-s').hidden=true};c.append(x)}
$('bib-add').onclick=()=>{bibAddUI();$('bib-add-s').hidden=false};
$('bib-file').onchange=()=>{const f=[...$('bib-file').files];$('bib-file').value='';if(f.length)bibImportar(f,bibFonteAdd)};
$('bib-prot').onclick=async()=>{try{const ok=await navigator.storage.persist();aviso(ok?L('Armazenamento protegido.','Storage protected.'):L('O Android não liberou a proteção agora. Os dados continuam guardados; só podem ser limpos se o aparelho ficar sem espaço.','Android did not grant protection now. Your data stays stored; it may only be cleared if the device runs out of space.'))}catch(e){}bibMedidor()};
/* backup do progresso e das preferencias (texto) */
$('bib-bkb').onclick=()=>{const o={v:1,t:Date.now(),ls:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&!/^hq-chat/.test(k))o.ls[k]=localStorage.getItem(k)}
  idxAll().then(a=>{o.lib=a.map(x=>({key:x.key,name:x.name,fonte:x.fonte,manga:x.manga}));$('bib-bk-t').value=JSON.stringify(o);$('bib-bk').hidden=false})};
$('bib-bk-c').onclick=async()=>{const t=$('bib-bk-t');t.select();let ok=false;try{await navigator.clipboard.writeText(t.value);ok=true}catch(e){try{ok=document.execCommand('copy')}catch(x){}}aviso(ok?L('Backup copiado. Cole em um lugar seguro.','Backup copied. Paste it somewhere safe.'):L('Selecione o texto e copie manualmente.','Select the text and copy it manually.'))};
$('bib-bk-r').onclick=()=>{try{const o=JSON.parse($('bib-bk-t').value);if(!o||!o.ls)throw 0;let n=0;for(const k in o.ls){try{localStorage.setItem(k,o.ls[k]);n++}catch(e){}}aviso(L('Progresso restaurado ('+n+' itens). Reabrindo…','Progress restored ('+n+' items). Reloading…'));setTimeout(()=>location.reload(),900)}catch(e){aviso(L('Texto de backup inválido.','Invalid backup text.'))}};
$('bib-bk-x').onclick=()=>{$('bib-bk').hidden=true};
