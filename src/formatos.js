
/* ---------- formatos extras: PDF (pdf.js offline) e EPUB ---------- */
let pdfWorkerURL=null,pdfWk=null;
// worker do PDF aquecido antes de precisar (abrir mangá fica mais rápido)
function pdfPre(){try{if(pdfWk||!window.pdfjsLib)return;
  if(!pdfWorkerURL){const src=document.getElementById('pdfworker').textContent;pdfWorkerURL=URL.createObjectURL(new Blob([src],{type:'text/javascript'}))}
  pdfWk=new pdfjsLib.PDFWorker({port:new Worker(pdfWorkerURL)})}catch(e){pdfWk=null}}
// PDF preguicoso: abre o documento e mede so a 1a pagina; as outras sao medidas em segundo plano e cada pagina vira JPEG quando pedida
function pdfLim(){const q=store.get('hq-pdfq','auto'),dm=navigator.deviceMemory||4;
  if(q==='max')return {w:3000,h:4000,s:4.5,j:0.95,t:2,a:60e6};if(q==='alta')return {w:2400,h:3600,s:4,j:0.92,t:1.5,a:45e6};
  return dm>=6?{w:2200,h:3300,s:3.5,j:0.9,t:1,a:30e6}:{w:1800,h:2700,s:3,j:0.88,t:1,a:30e6}}
function comLimite(pr,ms,msg){let t;return Promise.race([pr,new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error(msg)),ms)})]).finally(()=>clearTimeout(t))}
function pdfConfere(d,fimBytes){   /* devolve texto do erro, ou '' se o arquivo parece um PDF inteiro */
  if(!d||d.length<64)return L('Esse arquivo está vazio ou incompleto.','This file is empty or incomplete.');
  const ini=String.fromCharCode.apply(null,d.subarray(0,1024));
  if(ini.indexOf('%PDF-')<0)return L('Esse arquivo não é um PDF válido.','This file is not a valid PDF.');
  const fim=String.fromCharCode.apply(null,fimBytes||d.subarray(Math.max(0,d.length-16384)));
  if(fim.indexOf('%%EOF')<0)return L('Esse PDF está incompleto (download cortado). Baixe de novo.','This PDF is incomplete (cut-off download). Download it again.');
  return ''}
async function pdfAbrir(file,prog,lru){const LIM=pdfLim();
  /* paginas muito altas (webtoon em PDF): escala pela largura nativa; o limite por altura deixava a imagem minuscula e borrada */
  /* resolucao nativa: maior imagem desenhada na pagina (sem filtro; so reamostra para o tamanho original) */
  const nativo=async pg=>{try{const ol=await pg.getOperatorList(),O=pdfjsLib.OPS;let m=0;for(let i=0;i<ol.fnArray.length;i++){const f=ol.fnArray[i],a=ol.argsArray[i];let w=0;
      if(f===O.paintImageXObject||f===O.paintJpegXObject)w=a[1]|0;else if(f===O.paintInlineImageXObject&&a[0])w=a[0].width|0;if(w>m)m=w}return m}catch(e){return 0}};
  const escalaN=(v,nat)=>{const base=nat>0?nat/v.width:0;if(!base)return escala(v);const k=base*LIM.t;
    return v.height>3*v.width?Math.max(0.2,Math.min(k,Math.sqrt(LIM.a/(v.width*v.height)),32000/v.height)):Math.max(0.2,Math.min(k,4096/Math.max(v.width,v.height)))};
  const escala=v=>v.height>3*v.width?Math.max(0.2,Math.min(LIM.t,Math.sqrt(LIM.a/(v.width*v.height)),32000/v.height)):Math.min(LIM.w/v.width,LIM.h/v.height,LIM.s);
  if(!window.pdfjsLib)throw new Error(L('Leitor de PDF indisponível.','PDF reader unavailable.'));
  pdfPre();const wk=pdfWk;pdfWk=null;
  /* PDF muito grande (>=100 MB): nao carrega o arquivo inteiro na memoria; o pdf.js le so os pedacos de que precisa */
  const GRANDE=file.size>=104857600;
  let data=null,rangeOpts=null;
  if(GRANDE){
    const len=file.size,ini=new Uint8Array(await file.slice(0,Math.min(len,65536)).arrayBuffer()),fim=new Uint8Array(await file.slice(Math.max(0,len-16384),len).arrayBuffer());
    const tr=new pdfjsLib.PDFDataRangeTransport(len,ini);
    tr.requestDataRange=(b,e)=>{file.slice(b,e).arrayBuffer().then(buf=>tr.onDataRange(b,new Uint8Array(buf)),()=>{})};
    rangeOpts={range:tr,length:len,disableAutoFetch:true,disableStream:true,rangeChunkSize:1048576};
    data=new Uint8Array(Math.max(ini.length,64));data.set(ini);  /* so para a pre-checagem de cabecalho */
    {const ruim=pdfConfere(ini,fim);if(ruim){try{wk&&wk.destroy()}catch(x){}throw new Error(ruim)}}
  }else data=new Uint8Array(await file.arrayBuffer());
  /* protecao (0.69): confere o arquivo ANTES de abrir; PDF cortado/corrompido nao trava o app */
  if(!GRANDE){const ruim=pdfConfere(data);if(ruim){try{wk&&wk.destroy()}catch(x){}throw new Error(ruim)}}
  let doc,tmPdf=0;try{const tarefa=pdfjsLib.getDocument(Object.assign(rangeOpts?rangeOpts:{data},{worker:wk,isEvalSupported:false,useSystemFonts:false}));
    doc=await Promise.race([tarefa.promise,new Promise((_,rej)=>{tmPdf=setTimeout(()=>{try{tarefa.destroy()}catch(x){}rej(Object.assign(new Error('timeout'),{name:'PdfTimeout'}))},30000)})]);clearTimeout(tmPdf)}
  catch(e){clearTimeout(tmPdf);try{wk&&wk.destroy()}catch(x){}throw new Error((e&&e.name==='PdfTimeout')?L('Esse PDF demorou demais para abrir e pode estar corrompido.','This PDF took too long to open and may be corrupted.'):(e&&e.name==='PasswordException')?L('Esse PDF tem senha.','This PDF is password protected.'):L('Não consegui ler esse PDF.','Could not read this PDF.'))}
    const n=doc.numPages,pages=[];
  const medida=v=>{const k=escala(v);return {w:Math.round(v.width*k),h:Math.round(v.height*k)}};
  const p1=await comLimite(doc.getPage(1),20000,L('Esse PDF demorou demais para abrir a primeira página e pode estar corrompido.','This PDF took too long to open its first page and may be corrupted.')),m1=medida(p1.getViewport({scale:1}));p1.cleanup();
  for(let p=1;p<=n;p++)pages.push({name:'p'+String(p).padStart(4,'0')+'.jpg',blob:null,w:m1.w,h:m1.h,n:p});
  let vivo=true;const dbg=pages.dbg={med:1,n,ren:'',erro:'',ms:''};
  // mede o tamanho de TODAS as paginas antes de o leitor abrir (espera no maximo 2,5 s; o resto termina em segundo plano).
  // sem isso a lista nasce com a altura da capa, o leitor acha que cabem dezenas de paginas na tela e desenha as erradas
  const medirTudo=(async()=>{for(let p=2;p<=n&&vivo;p++){try{const pg=await doc.getPage(p),m=medida(pg.getViewport({scale:1}));pg.cleanup();const o=pages[p-1];
      if(o.w!==m.w||o.h!==m.h){o.w=m.w;o.h=m.h;pages.onDim&&pages.onDim(p-1)}dbg.med=p}catch(e){dbg.erro='dim p'+p+': '+(e&&e.message||e);break}
    if(p%20===0)await new Promise(r=>setTimeout(r,0))}})();
  await Promise.race([medirTudo,new Promise(r=>setTimeout(r,2500))]);
  const pend=new Map(),ordem=[],ordemF=[],espera=[];let rodando=false;
  const desenha=async(pgo,alvoW)=>{const pg=await doc.getPage(pgo.n),v0=pg.getViewport({scale:1});
    const k=alvoW?alvoW/v0.width:escalaN(v0,await nativo(pg)),vp=pg.getViewport({scale:k});
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,Math.round(vp.height));
    const ctx=c.getContext('2d',{alpha:false});ctx.imageSmoothingQuality='high';ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:ctx,viewport:vp,canvas:c}).promise;
    const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',alvoW?0.72:(vp.height>3*vp.width?Math.max(LIM.j,0.92):LIM.j)));c.width=c.height=0;pg.cleanup();return blob};
  // paginas compridas (webtoon): em vez de um canvas/JPEG gigante, desenha FATIAS de ~2000 px; so as proximas da tela, a mais perto primeiro
  const SH=2000,keep=new Map();
  const usar=async n=>{if(keep.has(n)){const p=keep.get(n);keep.delete(n);keep.set(n,p);return p}const p=await doc.getPage(n);keep.set(n,p);
    while(keep.size>3){const o=keep.keys().next().value,po=keep.get(o);keep.delete(o);try{po.cleanup()}catch(e){}}return p};
  const desenhaFatia=async(pgo,k,fator)=>{const pg=await usar(pgo.n),v0=pg.getViewport({scale:1});
    if(!pgo.esc)pgo.esc=(async()=>escalaN(v0,await nativo(pg)))();
    const vp=pg.getViewport({scale:(await pgo.esc)*(fator||1)}),ns=pgo.ns();
    const y0=Math.round(k*SH/pgo.h*vp.height),y1=k<ns-1?Math.round((k+1)*SH/pgo.h*vp.height):Math.round(vp.height);
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,y1-y0);
    const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:ctx,viewport:vp,transform:[1,0,0,1,0,-y0],canvas:c}).promise;
    const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',Math.max(LIM.j,0.9)));c.width=c.height=0;return blob};
  // fila unica: escolhe sempre a pagina mais proxima da tela (pri) e joga fora as que o leitor ja nao quer (q)
  const bombear=async()=>{if(rodando)return;rodando=true;
    try{while(espera.length){
      for(let k=espera.length-1;k>=0;k--){const e=espera[k];const pj=e.k==null?e.pgo.blob:e.pgo.fb.get(e.k);if(pj){espera.splice(k,1);e.ok(pj)}else if(e.q&&!e.q()){espera.splice(k,1);e.no(new Error('cancelado'))}}
      if(!espera.length)break;
      let b=0,bp=Infinity;for(let k=0;k<espera.length;k++){const v=espera[k].pri?espera[k].pri():0;if(v<bp){bp=v;b=k}}
      const e=espera.splice(b,1)[0];dbg.ren='p'+e.pgo.n+(e.k==null?'':'.'+e.k);const t0=performance.now();
      try{const faz=re=>e.k==null?(re?desenha(e.pgo,Math.max(360,Math.round((e.pgo.w||720)*0.6))):desenha(e.pgo)):desenhaFatia(e.pgo,e.k,re?0.6:1);let blob=await faz(false);if(!blob)blob=await faz(true);if(!blob)throw new Error('toBlob vazio');
        dbg.ms=(performance.now()-t0|0)+'ms';e.ok(blob)}
      catch(x){dbg.erro='p'+e.pgo.n+(e.k==null?'':'.'+e.k)+': '+(x&&x.message||x);e.no(x)}
      await new Promise(r=>setTimeout(r,0))}}
    finally{rodando=false;dbg.ren=''}};
  pages.forEach((pgo,i)=>{pgo.get=(q,pri)=>{if(pgo.blob)return Promise.resolve(pgo.blob);if(pend.has(i))return pend.get(i);
    const pr=new Promise((ok,no)=>{espera.push({pgo,q,pri,ok,no});bombear()}).then(b=>{pgo.blob=b;pend.delete(i);
      if(lru){ordem.push(i);while(ordem.length>lru){const o=ordem.shift();if(o!==i&&pages[o])pages[o].blob=null}}return b},e=>{pend.delete(i);throw e});
    pend.set(i,pr);return pr};
    pgo.fb=new Map();pgo.ns=()=>pgo.w&&pgo.h>SH*1.6?Math.ceil(pgo.h/SH):1;
    pgo.fatia=(k,q,pri)=>{if(pgo.fb.has(k))return Promise.resolve(pgo.fb.get(k));const key=i+':'+k;if(pend.has(key))return pend.get(key);
      const pr=new Promise((ok,no)=>{espera.push({pgo,k,q,pri,ok,no});bombear()}).then(b=>{pgo.fb.set(k,b);pend.delete(key);ordemF.push([pgo,k]);
        while(ordemF.length>16){const [po,ko]=ordemF.shift();if(!(po===pgo&&ko===k))po.fb.delete(ko)}return b},e=>{pend.delete(key);throw e});
      pend.set(key,pr);return pr}});
  let filaM=Promise.resolve();
  pages.forEach(pgo=>{pgo.mini=()=>{const pr=filaM.then(()=>desenha(pgo,150));filaM=pr.catch(()=>{});return pr}});
  pages.fecha=()=>{vivo=false;try{doc.destroy()}catch(e){}try{wk&&wk.destroy()}catch(e){}};
  return pages}
// paginas de ZIP/EPUB sob demanda (so descomprime a pagina quando ela e pedida; guarda as ultimas)
function zipPreguicoso(zip,nomes,lru){
  const pages=nomes.map(n=>({name:n,blob:null})),ordem=[],pend=new Map();
  pages.forEach((pgo,i)=>{pgo.get=()=>{if(pgo.blob)return Promise.resolve(pgo.blob);if(pend.has(i))return pend.get(i);
    const pr=zip.files[pgo.name].async('uint8array').then(u=>{const b=new Blob([u],{type:mimeOf(pgo.name)});pgo.blob=b;pend.delete(i);
      ordem.push(i);while(ordem.length>lru){const o=ordem.shift();if(o!==i)pages[o].blob=null}return b},e=>{pend.delete(i);throw e});
    pend.set(i,pr);return pr}});
  return pages}
async function epubPaginas(file,preguicoso){
  const zip=await JSZip.loadAsync(file),dir=n=>n.replace(/[^/]*$/,''),res=(b,r)=>{const u=new URL(r,'http://x/'+b);return decodeURIComponent(u.pathname.slice(1))};
  const txt=async n=>zip.files[n]?await zip.files[n].async('string'):null,xml=s=>new DOMParser().parseFromString(s,'application/xml');
  let ordem=[];
  try{const cont=xml(await txt('META-INF/container.xml')),opf=cont.querySelector('rootfile').getAttribute('full-path'),d=xml(await txt(opf)),base=dir(opf),mf=new Map();
    for(const it of d.querySelectorAll('manifest > item'))mf.set(it.getAttribute('id'),it.getAttribute('href'));
    for(const ir of d.querySelectorAll('spine > itemref')){const h=mf.get(ir.getAttribute('idref'));if(!h)continue;const arq=res(base,h);const html=await txt(arq);if(!html)continue;
      const doc=new DOMParser().parseFromString(html,'text/html');
      for(const im of doc.querySelectorAll('img,image')){const s=im.getAttribute('src')||im.getAttribute('xlink:href')||im.getAttribute('href');if(s&&IMG.test(s))ordem.push(res(dir(arq),s))}}}catch(e){ordem=[]}
  const vistos=new Set();ordem=ordem.filter(n=>zip.files[n]&&!vistos.has(n)&&vistos.add(n));
  if(!ordem.length)ordem=Object.keys(zip.files).filter(n=>!zip.files[n].dir&&IMG.test(n)&&!/__MACOSX/.test(n)).sort(natural);
  if(preguicoso)return zipPreguicoso(zip,ordem,40);
  const pages=[];for(const n of ordem){const b=await zip.files[n].async('uint8array');pages.push({name:n,blob:new Blob([b],{type:mimeOf(n)})})}
  return pages}

// aquece o leitor de PDF quando o aparelho esta ocioso (a 1a abertura de PDF fica mais rapida)
(function(){const w=()=>{try{pdfPre()}catch(e){}};addEventListener('load',()=>setTimeout(()=>{(window.requestIdleCallback||(f=>setTimeout(f,300)))(w,{timeout:3000})},500))})();
