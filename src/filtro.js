
/* ---------- filtro de ofensas (PT + EN): troca por ****** ---------- */
const FILTRO=(()=>{
  const PALAVRAS=('puta puto putaria putinha putao caralho carai caraio porra merda bosta foda foder fodase fdp vsf vtnc vtc pqp krl crl cacete buceta bct xota xoxota ppk piroca cu cuzao arrombado arrombada babaca otario otaria idiota imbecil retardado retardada retardo mongol mongoloide burro burra nojento nojenta gordo gorda gordao vagabundo vagabunda vadia corno corna viado viadinho bicha baitola sapatao traveco crioulo crioula aleijado anta jumento desgracado desgraca maldito lixo humano '+
   'fuck fucker fucking fck fuk fuking shit shitty bullshit bitch bastard asshole ass dick dickhead cock pussy cunt whore slut hoe nigger nigga faggot fag retard retarded idiot moron loser ugly fatso freak scum douche wanker twat prick bollocks kys').split(/\s+/).filter(Boolean);
  const FRASES=['se mata','vai se matar','vai morrer','vai se foder','vai tomar no cu','filho da puta','filha da puta','kill yourself','go die','shut up','cala a boca','mata te','morre logo'];
  const FORTES=['caralho','buceta','arrombad','fuck','nigger','nigga','faggot','bullshit','motherfuck','filhodaputa','cuzao'];
  const LEET={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','€':'e','8':'b'};
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ​-‏]/g,'').replace(/[01345@$€78]/g,c=>LEET[c]||c).replace(/([a-z])\1{2,}/g,'$1');
  const SET=new Set(PALAVRAS.map(norm));
  const FR=FRASES.map(f=>norm(f).replace(/\s+/g,' '));
  const mascara=s=>'*'.repeat(Math.max(3,s.length));
  function limpar(txt){
    txt=String(txt==null?'':txt);let ach=false;
    // 1) frases (ignora pontuacao e espacos repetidos)
    let t=txt;
    for(const f of FR){const re=new RegExp(f.split(' ').map(w=>w.split('').join('[^\\p{L}\\p{N}]{0,2}')).join('[^\\p{L}\\p{N}]+'),'giu');
      t=t.replace(re,m=>{ach=true;return mascara(m)})}
    // 2) letras separadas: f u c k / p.u.t.a (testa qualquer trecho da sequencia)
    t=t.replace(/(^|[^\p{L}\p{N}])((?:\p{L}[ .\-_*]){2,}\p{L})(?![\p{L}\p{N}])/gu,(m,a,b)=>{
      const ch=[...b],pos=[];ch.forEach((c,i)=>{if(/\p{L}/u.test(c))pos.push(i)});const mk=new Set();
      for(let i=0;i<pos.length;i++)for(let j=i+2;j<pos.length;j++){const w=pos.slice(i,j+1).map(k=>ch[k]).join('');const n=norm(w);
        if(SET.has(n)||(n.length>=6&&FORTES.some(f=>n.includes(f))))for(let k=i;k<=j;k++)mk.add(pos[k])}
      if(!mk.size)return m;ach=true;return a+ch.map((c,i)=>mk.has(i)?'*':c).join('')});
    // 3) palavra a palavra (+ trechos fortes colados)
    t=t.replace(/[\p{L}\p{N}@$€]+/gu,w=>{
      if(/^\*+$/.test(w))return w;const n=norm(w);
      if(SET.has(n)){ach=true;return mascara(w)}
      if(n.length>=6){for(const f of FORTES){const i=n.indexOf(f);if(i>=0){ach=true;return mascara(w)}}}
      return w});
    limpar.achou=ach;return t}
  limpar.achou=false;
  return limpar})();
