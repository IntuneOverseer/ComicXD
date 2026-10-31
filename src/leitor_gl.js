/* ---------- leitor: motor WebGL ----------
   Como o leitor do Kindle (OpenGL): a pagina vira uma textura na GPU, enviada ANTES de aparecer, e cada quadro de
   animacao e so um retangulo texturizado com uma matriz nova. Sem DOM, sem raster, sem redesenho de canvas 2D.
   A analise das paginas e feita antes de ler (tela de preparacao), entao nenhum nucleo trabalha durante a leitura. */
const wrap=$('wrap'),cv=$('gl'),msk=$('msk'),mskp=$('mskp');
let pi=0,si=0,guided=store.get('hq-modo','g')==='g',HQV=!!store.get('hq-vert',false),HC=!!store.get('hq-crop',false),cam={cx:0,cy:0,z:1,r:[0,0,1,1]},anim=null,cur=null,fade=null,VW=1,VH=1,DPR=1,bg=[0,0,0];
const easeK=t=>(1-Math.exp(-5*t))/(1-Math.exp(-5));
const CFG=Object.assign({vel:0.6,entrar:false,sair:false,fora:'pagina',esc:0.72,anim:true,lupa:true},store.get('hq-cfg',{}));
if(!store.get('hq-fora15',false)){CFG.fora='escura';store.set('hq-fora15',true);store.set('hq-cfg',CFG)}   // 0.15: liga o modo escurecido (ve o quadro anterior ao fundo)
const RM=matchMedia('(prefers-reduced-motion: reduce)');
function salvarCfg(){store.set('hq-cfg',CFG)}
let lastInput=0,ultimoToque=0;
/* interface: detecta computador (mouse) x tablet/celular (toque) */
const MODO_FIXO='__MODO__';
function detectarUI(){if(MODO_FIXO==='web'||MODO_FIXO==='toque'){document.documentElement.dataset.modo=MODO_FIXO;return}const p=store.get('hq-ui','auto');let web;
  if(p==='web')web=true;else if(p==='toque')web=false;
  else web=matchMedia('(pointer:fine)').matches&&matchMedia('(hover:hover)').matches&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  document.documentElement.dataset.modo=web?'web':'toque'}
detectarUI();
const barrasFixas=()=>document.documentElement.dataset.modo==='web'&&!$('reader').classList.contains('imersivo');
const FSOK=!!document.fullscreenEnabled&&!/; wv\)/.test(navigator.userAgent);
function alternarTelaCheia(){try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{})}catch(e){}}
if(FSOK)$('full').hidden=false;$('full').onclick=alternarTelaCheia;
/* modo compacto (so web): a area de leitura fica do tamanho da pagina, sem esticar no monitor */
const compactoSet=on=>{document.documentElement.toggleAttribute('data-compacto',on);$('compacto').classList.toggle('on',on);$('compacto').setAttribute('aria-pressed',on);store.set('hq-compacto',on);window.dispatchEvent(new Event('resize'))};
$('compacto').onclick=()=>compactoSet(!document.documentElement.hasAttribute('data-compacto'));
if(store.get('hq-compacto',false))compactoSet(true);
document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;$('reader').classList.toggle('imersivo',on&&!$('reader').hidden);menu(false);
  if(on&&!$('reader').hidden)toast(TR(document.documentElement.dataset.modo==='web'?'Tela cheia · roda do mouse ou ↑ ↓ passam · clique no centro: menu · Esc sai':'Tela cheia · toque no centro para o menu'))});
const cropQuer=()=>book&&(book.manga?MG.crop:(HC&&!guided&&!wtOn));
function plan(i){if(!book.manga&&HC&&!guided&&book.cplans&&book.cplans[i])return book.cplans[i];return book.plans[i]}
function provisorio(w,h){return {w,h,bg:[0,0,0],guiado:false,steps:[{cx:w/2,cy:h/2,z:1,rect:[0,0,w,h]}],provisorio:true}}
function curPlan(){const p=plan(pi);if(p)return p;return provisorio(cur&&cur.w||1000,cur&&cur.h||1600)}
function medir(){const b=wrap.getBoundingClientRect();VW=Math.max(2,b.width);VH=Math.max(2,b.height);DPR=Math.min(devicePixelRatio||1,2);
  const w=Math.round(VW*DPR),h=Math.round(VH*DPR);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}}
function pose(p,cx,cy,z){const fit=Math.min(VW/p.w,VH/p.h),s=fit*z,rw=VW/s,rh=VH/s;
  cx=rw>=p.w?p.w/2:Math.min(Math.max(cx,rw/2),p.w-rw/2);cy=rh>=p.h?p.h/2:Math.min(Math.max(cy,rh/2),p.h-rh/2);return {cx,cy,z:s}}
function target(p,s){const q=pose(p,s.cx,s.cy,s.z),r=s.rect,vw=VW/q.z,vh=VH/q.z;
  if(s.z>1.001&&r[2]<=vw*1.001&&r[3]<=vh*1.001)return {cx:r[0]+r[2]/2,cy:r[1]+r[3]/2,z:q.z,r,poly:s.poly};
  if(s.z>1.001&&r[3]<=vh*1.001)q.cy=r[1]+r[3]/2;
  return {cx:q.cx,cy:q.cy,z:q.z,r,poly:s.poly}}
function freeFull(){const p=curPlan(),f=pose(p,p.w/2,p.h/2,1);return {cx:f.cx,cy:f.cy,z:f.z,r:[0,0,p.w,p.h]}}
function rectTela(c){const r=c.r;return [VW/2+(r[0]-c.cx)*c.z,VH/2+(r[1]-c.cy)*c.z,Math.max(.01,r[2]*c.z),Math.max(.01,r[3]*c.z)]}
function lerpCam(f,t,a){return {cx:f.cx+(t.cx-f.cx)*a,cy:f.cy+(t.cy-f.cy)*a,z:Math.exp(Math.log(f.z)*(1-a)+Math.log(t.z)*a),r:[f.r[0]+(t.r[0]-f.r[0])*a,f.r[1]+(t.r[1]-f.r[1])*a,f.r[2]+(t.r[2]-f.r[2])*a,f.r[3]+(t.r[3]-f.r[3])*a]}}
function camAgora(){if(!anim)return cam;return Object.assign(lerpCam(anim.f,anim.t,easeK(anim.u)),{poly:anim.u>=1?anim.t.poly:null})}

/* ---------- WebGL ---------- */
const PBS={normal:0,pb:1,forte:2,verm:3};let PBM=PBS[store.get('hq-pb','normal')]||0;
let gl=null,perdeu=false,P1=null,P2=null,PX=null,FB=null,tr=null;const GLI={},U1={},U2={},UX={};
function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(p));return p}
function montarGL(){
  const VS='attribute vec2 a;uniform vec4 r;uniform vec2 s;varying vec2 uv;void main(){uv=a;vec2 p=r.xy+a*r.zw;gl_Position=vec4(p.x/s.x*2.0-1.0,1.0-p.y/s.y*2.0,0.0,1.0);}';
  const PR='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  P1=prog(VS,PR+'varying vec2 uv;uniform sampler2D t;uniform float al;uniform float fm;uniform vec2 px;uniform vec3 lc;\n'+
 'float lm(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}\n'+
 'void main(){if(lc.z>0.0&&distance(gl_FragCoord.xy,lc.xy)>lc.z)discard;vec3 o=texture2D(t,uv).rgb;vec3 c=o;\n'+
 'if(fm>0.5){float l=lm(o);\n'+
 ' if(fm<1.5){c=vec3(l);}else{\n'+
 '  float a=(lm(texture2D(t,uv+vec2(px.x,0.0)).rgb)+lm(texture2D(t,uv-vec2(px.x,0.0)).rgb)+lm(texture2D(t,uv+vec2(0.0,px.y)).rgb)+lm(texture2D(t,uv-vec2(0.0,px.y)).rgb))*0.25;\n'+
 '  float s=l+1.3*(l-a);s=clamp((s-0.5)*1.45+0.5,0.0,1.0);s=s*s*(3.0-2.0*s)*0.35+s*0.65;c=vec3(s);\n'+
 '  if(fm>2.5){float s2=clamp((l+0.6*(l-a)-0.06)/0.88,0.0,1.0);s2=s2*s2*(3.0-2.0*s2)*0.3+s2*0.7;float ch=o.r-max(o.g,o.b);float w=smoothstep(0.10,0.24,ch);float al=smoothstep(0.05,0.40,ch);float d=clamp(o.r/0.9,0.0,1.0);vec3 rc=mix(vec3(1.0),vec3(0.89,0.09,0.11),al)*d;c=mix(vec3(s2),rc,w);}}}\n'+
 'gl_FragColor=vec4(c*al,al);}');
  P2=prog(VS,PR+'uniform vec4 c;void main(){gl_FragColor=c;}');
  for(const [P,U,n] of [[P1,U1,['r','s','t','al','fm','px','lc']],[P2,U2,['r','s','c']]])for(const k of n)U[k]=gl.getUniformLocation(P,k);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  FB=null;PX=null;try{PX=prog(VS,PR+'\nvarying vec2 uv;uniform sampler2D A;uniform sampler2D B;uniform float q;uniform vec2 d;uniform float mode;uniform vec3 bgc;\nvec3 bk(vec3 t,float lit){float k=smoothstep(0.0,0.07,distance(t,bgc));return mix(bgc,mix(vec3(0.95,0.94,0.91),t,0.2),k)*lit;}\nvec4 T(vec2 p){return texture2D(A,vec2(p.x,1.0-p.y));}\nvec4 U(vec2 p){return texture2D(B,vec2(p.x,1.0-p.y));}\nbool inb(vec2 p){return p.x>=0.0&&p.x<=1.0&&p.y>=0.0&&p.y<=1.0;}\nvoid main(){\n  vec2 o=vec2(d.x<0.0?1.0:0.0,d.y<0.0?1.0:0.0);float s=dot(uv-o,d);vec3 col=vec3(0.0);vec3 paper=vec3(0.95,0.94,0.91);\n  if(mode<0.5){\n    float R=0.085;float PI=3.14159265;float f=q*(1.0+R);float e=2.0*f-PI*R;bool ok=false;\n    if(s<f){\n      if(s>=f-R){float th=PI-asin(clamp((f-s)/R,-1.0,1.0));float s0=f-R*th;\n        if(s0>=0.0){vec2 p=uv+d*(s0-s);col=bk(T(p).rgb,1.0-0.4*sin(th));ok=true;}}\n      if(!ok){float k=max(0.0,f-R-s);col=U(uv).rgb*(1.0-0.55*exp(-k*16.0));}\n    }else{\n      if(f>PI*R&&s<=e){float s0=e-s;vec2 p=uv+d*(s0-s);col=bk(T(p).rgb,1.0);}\n      else{float b=(f>PI*R)?e:f;col=T(uv).rgb*(1.0-0.42*exp(-(s-b)*14.0));}\n    }\n  }else if(mode<1.5){\n    vec2 pt=uv-d*q;if(inb(pt))col=T(pt).rgb;else col=U(uv+d*(1.0-q)).rgb;\n  }else if(mode<2.5){\n    vec2 pt=uv-d*q;\n    if(inb(pt))col=T(pt).rgb;else{float k=0.94+0.06*q;vec2 pu=(uv-0.5)/k+0.5;col=U(pu).rgb*(0.55+0.45*q)*(1.0-0.5*exp(-(q-s)*14.0));}\n  }else if(mode<3.5){\n    vec2 pt=uv+d*(1.0-q);\n    if(inb(pt))col=U(pt).rgb;else col=T(uv).rgb*(1.0-0.45*q)*(1.0-0.5*exp(-(s-q)*14.0));\n  }else{\n    float k=1.0+0.22*q;vec2 pt=(uv-0.5)/k+0.5;float a=1.0-smoothstep(0.0,1.0,q);col=mix(U(uv).rgb,T(pt).rgb,a);\n  }\n  gl_FragColor=vec4(col,1.0);\n}\n');for(const k of ['r','s','A','B','q','d','mode','bgc'])UX[k]=gl.getUniformLocation(PX,k)}catch(e){PX=null}
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.DITHER);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false)}
function iniciarGL(){
  const o={alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false};
  gl=cv.getContext('webgl2',o)||cv.getContext('webgl',o);
  if(!gl)throw new Error(TR('Este aparelho não liberou o WebGL para o leitor.'));
  GLI.v2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;GLI.max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  try{const d=gl.getExtension('WEBGL_debug_renderer_info');GLI.gpu=d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}catch(e){GLI.gpu='?'}
  GLI.aniso=gl.getExtension('EXT_texture_filter_anisotropic');montarGL();
  cv.addEventListener('webglcontextlost',e=>{e.preventDefault();perdeu=true});
  cv.addEventListener('webglcontextrestored',()=>{perdeu=false;tr=null;montarGL();for(const v of texs.values())v.tex=null;texs.clear();if(book&&!$('reader').hidden)openPage(pi)})}

/* ---------- efeitos de virar pagina (so mangá no APK): livro, deslizar, empilhar, cobrir, zoom ---------- */
const FXS={livro:{m:0,d:600},deslizar:{m:1,d:360},empilhar:{m:2,d:380},cobrir:{m:3,d:380},zoom:{m:4,d:340}};
let FXSEL=store.get('hq-fx','livro'),trFwd=true;
window.__lv=()=>({pi,z:+(cam.z/fitZ()).toFixed(2),cy:Math.round(cam.cy),cx:Math.round(cam.cx),LZ,LS,LW,LX});
window.__fx=(fx,u,fwd)=>{const o=texs.get(pi+(fwd?-1:1));if(!o||!cur){return 'sem textura vizinha'}tr={e:o,c:freeFull(),t0:0,u,fx:FXS[fx],fwd,d:fxDir(),pronto:false,fijo:true};pedir();return 'ok'};window.__fxFim=()=>{tr=null;pedir()};
$('cfg-fx').value=FXS[FXSEL]?FXSEL:'nenhum';$('cfg-fx').onchange=e=>{FXSEL=e.target.value;store.set('hq-fx',FXSEL)};
function pbAplicar(redesenhar){const m=Object.keys(PBS).find(k=>PBS[k]===PBM)||'normal';
  const w=$('wt');if(w)for(let k=0;k<4;k++)w.classList.toggle('pb'+k,k>0&&k===PBM&&!ehManga());if(redesenhar)pedir()}   /* v0.68b: o Vertical (HQ) usa filtro CSS/SVG equivalente ao do shader */
$('cfg-pb').value=Object.keys(PBS).find(k=>PBS[k]===PBM)||'normal';
$('cfg-pb').onchange=e=>{PBM=PBS[e.target.value]||0;store.set('hq-pb',e.target.value);pbAplicar(true)};pbAplicar(false);
function fxAtual(){if(!PX||!book||wtOn)return null;if(!book.manga&&guided)return null;if(!book.manga&&mgDir()==='v')return null;if(book.manga){if(MG.modo==='v')return null}return FXS[FXSEL]||null}   /* v0.68: o efeito vale também com zoom (página inteira ou ampliada) */
let _fxAv=null;
function fxAviso(){const bloq=!!book&&!book.manga&&guided;if(_fxAv===bloq)return;_fxAv=bloq;const a=$('fx-aviso'),sel=$('cfg-fx');if(!a)return;a.hidden=!bloq;if(sel)sel.disabled=bloq}
function fxDir(){const m=mgDir()||'ltr';return m==='rtl'?[1,0]:m==='ltr'?[-1,0]:[0,-1]}
function fbLiberar(){if(!FB)return;for(const k of ['ta','tb'])gl.deleteTexture(FB[k]);for(const k of ['fa','fb'])gl.deleteFramebuffer(FB[k]);FB=null}
function fbAlocar(){const w=cv.width,h=cv.height;if(FB&&FB.w===w&&FB.h===h)return false;fbLiberar();FB={w,h};
  for(const [t,f] of [['ta','fa'],['tb','fb']]){const x=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,x);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,x,0);FB[t]=x;FB[f]=fb}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return true}
function cenaFB(fb,e,c){gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,cv.width,cv.height);gl.clearColor(bg[0]/255,bg[1]/255,bg[2]/255,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(P1);gl.uniform2f(U1.s,VW,VH);gl.uniform1i(U1.t,0);gl.activeTexture(gl.TEXTURE0);pagina(e,c,1);janela(c);gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
function compor(c){if(fbAlocar())tr.pronto=false;
  if(!tr.pronto){cenaFB(FB.fa,tr.e,tr.c);cenaFB(FB.fb,cur,c);tr.pronto=true}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);gl.useProgram(PX);
  const u=tr.u,k=tr.fx.m===0?(u<0.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2):1-Math.pow(1-u,3),q=tr.fwd?k:1-k;
  gl.uniform4f(UX.r,0,0,VW,VH);gl.uniform2f(UX.s,VW,VH);gl.uniform1f(UX.q,q);gl.uniform2f(UX.d,tr.d[0],tr.d[1]);gl.uniform1f(UX.mode,tr.fx.m);gl.uniform3f(UX.bgc,bg[0]/255,bg[1]/255,bg[2]/255);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tr.fwd?FB.ta:FB.tb);gl.uniform1i(UX.A,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tr.fwd?FB.tb:FB.ta);gl.uniform1i(UX.B,1);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.activeTexture(gl.TEXTURE0)}
function corFundo(){const c=ehManga()?(MGBG[MG.bg]||MGBG.preto):curPlan().bg;return CFG.fora==='preto'?'#000':`rgb(${c[0]},${c[1]},${c[2]})`}
function corFora(){return (CFG.fora==='escura'&&!ehManga())?'rgba(0,0,0,'+CFG.esc+')':corFundo()}
function pintarFundo(){bg=ehManga()?(MGBG[MG.bg]||MGBG.preto):CFG.fora==='preto'?[0,0,0]:curPlan().bg}
function pagina(e,c,al){gl.bindTexture(gl.TEXTURE_2D,e.tex);gl.uniform1f(U1.fm,ehManga()?0:PBM);gl.uniform2f(U1.px,1/Math.max(1,e.w),1/Math.max(1,e.h));gl.uniform4f(U1.r,VW/2-c.cx*c.z,VH/2-c.cy*c.z,e.w*c.z,e.h*c.z);gl.uniform1f(U1.al,al);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
function janela(c){const R=rectTela(c),x0=R[0],y0=R[1],x1=x0+R[2],y1=y0+R[3],esc=CFG.fora==='escura'&&!ehManga();
  const col=esc?[0,0,0,CFG.esc]:[bg[0]/255,bg[1]/255,bg[2]/255,1];
  gl.useProgram(P2);gl.uniform2f(U2.s,VW,VH);gl.uniform4f(U2.c,col[0]*col[3],col[1]*col[3],col[2]*col[3],col[3]);if(esc)gl.enable(gl.BLEND);
  const A=[[0,0,VW,y0],[0,y1,VW,VH-y1],[0,y0,x0,y1-y0],[x1,y0,VW-x1,y1-y0]];
  for(let k=0;k<4;k++){const a=A[k];if(a[2]>0.4&&a[3]>0.4){gl.uniform4f(U2.r,a[0],a[1],a[2],a[3]);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}}
  if(esc)gl.disable(gl.BLEND)}
function desenhar(c){if(!gl||perdeu)return;
  if(tr&&tr.e.tex&&cur&&cur.tex){compor(c);return}gl.viewport(0,0,cv.width,cv.height);gl.clearColor(bg[0]/255,bg[1]/255,bg[2]/255,1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(cur&&cur.tex){gl.useProgram(P1);gl.uniform2f(U1.s,VW,VH);gl.uniform1i(U1.t,0);gl.activeTexture(gl.TEXTURE0);pagina(cur,c,1);
    if(fade&&fade.e.tex){gl.enable(gl.BLEND);pagina(fade.e,fade.c,fade.a);gl.disable(gl.BLEND)}
    janela(c);if(LUPA.on)lupaDesenhar(c)}}

/* ---------- laco de quadros: so roda enquanto algo se mexe ---------- */
const DG={ult:null,ts:0,n:0,max:0,lentos:0,soma:0,lat:0};
function diagFim(){DG.ult=DG.n?{n:DG.n,media:Math.round(DG.soma/DG.n*10)/10,max:Math.round(DG.max),lentos:DG.lentos,lat:Math.round(DG.lat)}:null;DG.ts=0;DG.n=0;DG.max=0;DG.lentos=0;DG.soma=0}
let rafId=0;
function pedir(){if(!rafId&&!document.hidden)rafId=requestAnimationFrame(tick)}
function tick(ts){rafId=0;let c=cam,mais=false;
  if(anim){if(anim.t0===null){anim.t0=ts;DG.lat=Math.max(0,performance.now()-(anim.in||anim.call))}
    else{const d=ts-DG.ts;DG.n++;DG.soma+=d;if(d>DG.max)DG.max=d;if(d>24)DG.lentos++}
    DG.ts=ts;anim.u=Math.min(1,(ts-anim.t0)/anim.d);
    if(anim.u>=1){const a=anim;anim=null;c=cam;fim(a)}else{c=lerpCam(anim.f,anim.t,easeK(anim.u));mais=true}}
  if(tr&&!tr.fijo){if(tr.t0===null)tr.t0=ts;tr.u=Math.min(1,(ts-tr.t0)/tr.fx.d);if(tr.u>=1)tr=null;else mais=true}
  if(fade){if(fade.t0===null)fade.t0=ts;const u=Math.min(1,(ts-fade.t0)/170);fade.a=1-u*(2-u);if(u>=1)fade=null;else mais=true}
  desenhar(c);if(mais)pedir()}
function mskOff(){msk.classList.remove('on')}
// contorno real (quadro diagonal/arredondado): um svg pinta fora do poligono, dentro da janela, quando a camera para
function mascara(c){mskOff();if(!c||!c.poly||c.poly.length<3)return;
  const R=rectTela(c),P=c.poly.map(([x,y])=>(VW/2+(x-c.cx)*c.z).toFixed(1)+' '+(VH/2+(y-c.cy)*c.z).toFixed(1));
  msk.setAttribute('viewBox',`0 0 ${VW} ${VH}`);mskp.setAttribute('d',`M${R[0].toFixed(1)} ${R[1].toFixed(1)}h${R[2].toFixed(1)}v${R[3].toFixed(1)}h${(-R[2]).toFixed(1)}Z M${P.join(' L')}Z`);mskp.setAttribute('fill',corFora());
  requestAnimationFrame(()=>msk.classList.add('on'))}
function pararAnim(){if(!anim)return;cam=camAgora();anim=null;DG.ts=0;pedir()}
function mover(t,dur){const f=camAgora();if(anim)diagFim();anim=null;mskOff();cam=t;
  if(!dur||!CFG.anim||RM.matches||!cur){mascara(t);pedir();return}
  anim={f,t,t0:null,d:dur,u:0,call:performance.now(),in:ultimoToque&&performance.now()-ultimoToque<400?ultimoToque:0};pedir()}
function fim(a){diagFim();mascara(a.t);agendarSalvar();pump()}
function extras(p){return guided&&p.guiado!==false&&!p.provisorio&&p.tipo!=='imagem-com-texto'&&p.steps.length>0}
function sMin(p){return extras(p)&&CFG.entrar?-1:0}
function sMax(p){return p.steps.length-1+(extras(p)&&CFG.sair?1:0)}
function alvoDoPasso(p){return (si<0||si>=p.steps.length)?freeFull():target(p,p.steps[si])}
function goStep(i,instant){const p=curPlan();si=Math.max(sMin(p),Math.min(i,sMax(p)));const t=alvoDoPasso(p);
  if(instant){pararAnim();cam=t;mskOff();mascara(t);pedir()}else mover(t,CFG.vel*1000);label();agendarSalvar()}

/* ---------- paginas = texturas ---------- */
const texs=new Map();
const dorme=ms=>new Promise(r=>setTimeout(r,ms));
function texDe(i,urgente){if(i<0||i>=book.pages.length)return Promise.resolve(null);
  let e=texs.get(i);if(e){if(urgente)e.urg=true;return e.ok}
  e={i,tex:null,w:0,h:0,urg:!!urgente,crop:!!cropQuer()};texs.set(i,e);
  const bk=book;e.ok=(async()=>{let bm=await createImageBitmap(await pgBlob(i),{premultiplyAlpha:'none'});
    if(e.crop){let r=bk.crops.get(i);if(r===undefined){r=await cortarPg(bk,bm,bm.width,bm.height);bk.crops.set(i,r)}
      if(r){const c2=await createImageBitmap(bm,r[0],r[1],r[2],r[3]);bm.close();bm=c2}}
    if(texs.get(i)!==e){bm.close();return e}
    e.w=bm.width;e.h=bm.height;const m=Math.min(GLI.max||4096,4096),k=Math.min(1,m/Math.max(bm.width,bm.height));
    if(k<1){const r=await createImageBitmap(bm,{resizeWidth:Math.round(bm.width*k),resizeHeight:Math.round(bm.height*k),resizeQuality:'high'});bm.close();bm=r}
    // envio para a GPU so com a tela parada (nunca no meio de um movimento), a nao ser que a pagina seja pedida agora
    while(!e.urg&&(anim||fade||performance.now()-lastInput<300))await dorme(120);
    if(texs.get(i)!==e||!gl||perdeu){bm.close();return e}
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    const fat=(!e.urg&&bm.width*bm.height>1.4e6)?Math.min(6,Math.ceil(bm.width*bm.height/1.2e6)):0;
    if(!fat){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bm);bm.close()}
    else{   // pagina grande que ninguem pediu ainda: envia em fatias, uma por quadro e so com a tela parada (nao engasga o fim do efeito)
      const W=bm.width,Hh=bm.height,h1=Math.ceil(Hh/fat);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,Hh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(let y=0;y<Hh;y+=h1){const hh=Math.min(h1,Hh-y);
        const sl=await createImageBitmap(bm,0,y,W,hh,{premultiplyAlpha:'none'});
        while(!e.urg&&(anim||fade||tr||performance.now()-lastInput<300))await dorme(100);
        if(texs.get(i)!==e||!gl||perdeu){sl.close();bm.close();gl&&gl.deleteTexture(t);return e}
        await new Promise(r=>requestAnimationFrame(r));
        gl.bindTexture(gl.TEXTURE_2D,t);gl.texSubImage2D(gl.TEXTURE_2D,0,0,y,gl.RGBA,gl.UNSIGNED_BYTE,sl);sl.close()}
      bm.close()}
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    if(GLI.v2){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);if(GLI.aniso)gl.texParameterf(gl.TEXTURE_2D,GLI.aniso.TEXTURE_MAX_ANISOTROPY_EXT,2)}
    else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    e.tex=t;if(!bk.manga&&e.crop&&bk===book){(bk.cplans=bk.cplans||[])[i]={w:e.w,h:e.h,bg:[0,0,0],guiado:false,steps:[{cx:e.w/2,cy:e.h/2,z:1,rect:[0,0,e.w,e.h]}]}}if(bk.manga&&bk===book&&!bk.plans[i])bk.plans[i]={w:e.w,h:e.h,bg:MGBG[MG.bg]||[0,0,0],guiado:false,steps:[{cx:e.w/2,cy:e.h/2,z:1,rect:[0,0,e.w,e.h]}]};return e})();
  e.ok.catch(()=>{if(texs.get(i)===e)texs.delete(i)});return e.ok}
function limparTex(){if(!book)return;for(const [k,v] of [...texs])if(Math.abs(k-pi)>2&&v!==cur&&!(fade&&fade.e===v)&&!(tr&&tr.e===v)){if(v.tex&&gl)gl.deleteTexture(v.tex);v.tex=null;texs.delete(k)}}
function soltarTudo(){for(const v of texs.values()){if(v.tex&&gl)gl.deleteTexture(v.tex);v.tex=null}texs.clear();cur=null;fade=null;tr=null;anim=null}
// depois que a pagina assenta, envia a proxima, a anterior e a seguinte: virar a pagina nao espera JPEG nem GPU
function preCarregar(tok){setTimeout(async()=>{
  // uma pagina por vez, com folga entre elas e so com a tela parada: o envio de cada textura grande para a GPU nao se junta no fim do efeito de virar pagina
  for(const k of [pi+1,pi-1,pi+2]){if(tok!==openToken)return;
    while(tok===openToken&&(anim||fade||tr||performance.now()-lastInput<500))await dorme(150);if(tok!==openToken)return;
    const ja=texs.has(k);try{await texDe(k)}catch(e){}if(!ja)await dorme(450)}
  limparTex()},700)}
function mostrarPagina(e,c,fadeOn){const old=cur,oc=camAgora();pararAnim();cur=e;cam=c;pintarFundo();
  const fx=(old&&old!==e&&old.tex&&fadeOn&&CFG.anim&&!RM.matches)?fxAtual():null;
  tr=fx?{e:old,c:oc,t0:null,u:0,fx,fwd:trFwd,d:fxDir(),pronto:false}:null;
  fade=(!fx&&old&&old!==e&&old.tex&&fadeOn&&CFG.anim&&!RM.matches)?{e:old,c:oc,a:1,t0:null}:null;mskOff();mascara(c);pedir()}

/* ---------- planos ---------- */
function ensurePlan(i){if(book.manga||i<0||i>=book.pages.length||book.plans[i]||book.inflight.has(i))return book.inflight.get(i);
  {const mp=typeof mkPlano==='function'&&mkPlano(i);if(mp){book.plans[i]=mp;return Promise.resolve(mp)}}
  const z=ZOOM,plans=book.plans,infl=book.inflight,ck=VERSAO_PLANO+'|z'+z+'|'+book.key+'|'+i+'|'+book.pages[i].blob.size;
  const pr=cacheGet(ck).then(c=>c||analyze(book.pages[i].blob,i,z).then(r=>{cachePut(ck,r);return r})).then(r=>{plans[i]=r;infl.delete(i);return r}).catch(err=>{infl.delete(i);const e=texs.get(i),w=e&&e.w||1000,h=e&&e.h||1600;
    plans[i]=Object.assign(provisorio(w,h),{provisorio:false,erro:String(err)});return plans[i]});
  infl.set(i,pr);return pr}
let esperando=false;
function prefetch(){for(const k of [pi+1,pi+2,pi+3,pi+4,pi+5,pi-1])ensurePlan(k)}
let openToken=0,firstShow=true,wantPage=0;
async function openPage(i,last){const tok=++openToken;wantPage=i;fimFechar();if(wtOn){wtIr(i);return}
  lzPersistir();
  let e;try{e=await texDe(i,true)}catch(err){return}if(tok!==openToken||!e||!e.tex)return;
  if(guided&&!plan(i)){$('work').hidden=false;esperando=true;   // so acontece se a HQ foi aberta com "Ler já"
    if(!cur||firstShow){firstShow=false;pi=i;mostrarPagina(e,freeFull(),false);label()}
    ensurePlan(i);prefetch();pump();await book.inflight.get(i);esperando=false;if(tok!==openToken)return}
  $('work').hidden=true;esperando=false;
  const trocou=!!cur&&cur!==e;trFwd=i>=pi;pi=i;prefetch();const p=curPlan();
  let c;if(!guided){si=0;c=freeFull();const zS=(!LW&&LS>0)?Math.min(6,LS/p.h/Math.min(VW/p.w,VH/p.h)):0;   /* mesma escala da pagina anterior: simples->dupla e dupla->simples */
    if(livreWeb()&&(LW||(LS>0?zS>1.04:LZ>1.04))){const zr=LW?Math.max(1,(VW/p.w)/Math.min(VW/p.w,VH/p.h)):(LS>0?zS:LZ),md=ehManga()?mgDir():null,px=md==='rtl'?(last?0:p.w):md==='ltr'?(last?p.w:0):(document.documentElement.dataset.modo==='toque'?0:(LW?.5:LX)*p.w),q=pose(p,px,last?p.h:0,zr);c={cx:q.cx,cy:q.cy,z:q.z,r:[0,0,p.w,p.h]}}}else{si=last?sMax(p):sMin(p);c=alvoDoPasso(p)}
  mostrarPagina(e,c,trocou);label();agendarSalvar();preCarregar(tok)}
// aviso de fim: so aparece quando a pessoa tenta avancar alem da ultima pagina
let fimOn=false,fimT=0;
function fimMostrar(){if(fimOn||!book||performance.now()<fimT)return;fimOn=true;menu(false);
  $('fim-t').textContent=wtOn?L('Fim do capítulo','End of chapter'):L('Fim da leitura','End of reading');
  $('fim-p').textContent=wtOn?L('Você chegou ao final deste webtoon.','You reached the end of this webtoon.'):L('Você chegou à última página.','You reached the last page.');
  $('fim-lib').textContent=L('Voltar para a biblioteca','Back to library');$('fim-x').textContent=L('Continuar aqui','Stay here');
  $('fim').hidden=false;try{$('fim-lib').focus({preventScroll:true})}catch(e){}}
function fimFechar(){if(!fimOn&&$('fim').hidden)return;fimOn=false;$('fim').hidden=true;fimT=performance.now()+900}
let bibDepois=false;   // 'Voltar para a biblioteca' do aviso de fim: abre a tela da biblioteca (estante), nao a tela inicial
$('fim-lib').onclick=()=>{fimOn=false;$('fim').hidden=true;fimT=0;bibDepois=true;$('back').click()};
$('fim-x').onclick=fimFechar;
function next(){if(wtOn){wtRolar(1);return}const p=curPlan();if(!guided||p.provisorio){if(pi<book.pages.length-1)openPage(pi+1);else fimMostrar();return}
  if(si<sMax(p))goStep(si+1);else if(pi<book.pages.length-1)openPage(pi+1);else fimMostrar()}
function prev(){fimFechar();if(wtOn){wtRolar(-1);return}const p=curPlan();if(!guided||p.provisorio){if(pi>0)openPage(pi-1);return}
  if(si>sMin(p))goStep(si-1);else if(pi>0)openPage(pi-1,true)}

/* ---------- rotulos e progresso: nada de DOM enquanto a barra esta escondida ---------- */
let rotuloSujo=true;
function label(){fxAviso();document.documentElement.toggleAttribute('data-livre',livreWeb());lvZ();rotuloSujo=true;if(menuAberto()||barrasFixas())rotuloAgora()}
function rotuloAgora(){if(!book)return;rotuloSujo=false;const p=curPlan(),n=book.pages.length;
  const pgT=L(`Página <b>${pi+1}</b> de ${n}`,`Page <b>${pi+1}</b> of ${n}`);$('stat').innerHTML=guided&&p.guiado!==false&&!p.provisorio?pgT+' · '+(si<0||si>=p.steps.length?L('página inteira','full page'):L(`quadro <b>${si+1}</b>/${p.steps.length}`,`panel <b>${si+1}</b>/${p.steps.length}`)):pgT;
  $('slider').max=n;$('slider').value=pi+1;tirasSync()}
let podeSalvar=false,salvarT=0;
function save(){if(!book||!podeSalvar)return;store.set(book.key,book.manga?{page:pi,step:0,m:MG.modo}:{page:pi,step:si});
  const r=store.get('hq-recentes',[]).filter(x=>x.key!==book.key);r.unshift(book.manga?{key:book.key,name:book.name,page:pi+1,total:book.pages.length,manga:true,m:MG.modo}:{key:book.key,name:book.name,page:pi+1,total:book.pages.length});store.set('hq-recentes',r.slice(0,12))}
function agendarSalvar(){clearTimeout(salvarT);salvarT=setTimeout(()=>{if(anim||performance.now()-lastInput<900){agendarSalvar();return}save()},1200)}
addEventListener('pagehide',()=>save());
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else pedir()});
let toastT=0;function toast(t){const el=$('toast');el.textContent=t;el.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>{el.style.opacity=0},1500)}
function botoesHQ(){const v=!ehManga()&&HQV;if(typeof bgSelUI==='function')bgSelUI();$('m-g').classList.toggle('on',guided);$('m-l').classList.toggle('on',!guided&&!v);if($('m-v'))$('m-v').classList.toggle('on',!guided&&v);if(!ehManga()&&$('mg-crop')){$('mg-crop').classList.toggle('on',HC);$('mg-crop').classList.toggle('inativo',guided)}}
function setMode(g,silencio){guided=g;if(!ehManga())store.set('hq-modo',g?'g':'l');botoesHQ();
  if(!book||!cur)return;if(!wtOn&&!ehManga()&&!!cur.crop!==!!cropQuer()){soltarTudo();openPage(pi);if(!silencio)toast(TR(g?'Leitura guiada':'Página inteira · pinça ou dois toques para zoom'));return}
  if(!silencio)toast(TR(g?'Leitura guiada':(!ehManga()&&HQV)?'Vertical · deslize ou toque embaixo para rolar':'Página inteira · pinça ou dois toques para zoom'));
  if(g)goStep(si);else{mover(freeFull(),300);label()}}

/* ---------- preparar a HQ antes de ler ---------- */
let prepTok=0;
function preparar(inicio){return new Promise(res=>{
  const tok=++prepTok,t0=performance.now(),n=book.pages.length;prepMode=true;pi=inicio;
  $('prep-nome').textContent=book.name;$('prep-txt').textContent=TR('Preparando os quadros…');$('prep-i').style.width='0%';$('prep-n').textContent=L('0 de '+n+' páginas','0 of '+n+' pages');$('prep-t').textContent='';
  let capaURL=null;const im=$('prep-capa');im.removeAttribute('src');capaDe(book.pages[0].blob).then(b=>{if(b&&tok===prepTok&&!fim){capaURL=URL.createObjectURL(b);im.src=capaURL}});
  let feito=0,fim=false;
  const mostra=setTimeout(()=>{if(!fim)$('prep').hidden=false},400);   // se tudo ja estava no cache, nem aparece
  const pinta=()=>{const pct=Math.round(100*feito/n),dt=(performance.now()-t0)/1000;$('prep-i').style.width=pct+'%';$('prep-n').textContent=L(feito+' de '+n+' páginas · '+pct+'%',feito+' of '+n+' pages · '+pct+'%');
    if(feito>=2&&dt>4&&feito<n){const s=Math.round((n-feito)*dt/feito);$('prep-t').textContent=L('faltam ~','~')+(s>=90?Math.round(s/60)+' min':s+' s')+L('',' left')}else $('prep-t').textContent=''};
  const iv=setInterval(pinta,300);
  const fecha=r=>{if(fim)return;fim=true;prepMode=false;clearTimeout(mostra);clearInterval(iv);$('prep').hidden=true;if(capaURL)URL.revokeObjectURL(capaURL);if(r==='cancel')queue.length=0;res(r);pump()};
  $('prep-cancel').onclick=()=>fecha('cancel');$('prep-ler').onclick=()=>fecha('ler');
  let rest=n;const ord=[];for(let k=0;k<n;k++)ord.push((inicio+k)%n);
  for(const i of ord)Promise.resolve(book.plans[i]||ensurePlan(i)).then(()=>{feito++;if(--rest===0){pinta();fecha('ok')}})}) }

/* ---------- modo livre: pinça, arrastar com inercia, dois toques para zoom ---------- */
function clampFree(c){const p=curPlan(),fit=Math.min(VW/p.w,VH/p.h),z=Math.min(Math.max(c.z,fit),fit*6),q=pose(p,c.cx,c.cy,z/fit);return {cx:q.cx,cy:q.cy,z,r:[0,0,p.w,p.h]}}
function livreDaqui(){pararAnim();mskOff();const p=curPlan();cam=clampFree({...cam,r:[0,0,p.w,p.h]});
  guided=false;store.set('hq-modo','l');botoesHQ();label()}
function zoomAt(px,py,k){LW=false;pararAnim();const c={...cam},wx=c.cx+(px-VW/2)/c.z,wy=c.cy+(py-VH/2)/c.z;c.z*=k;c.cx=wx-(px-VW/2)/c.z;c.cy=wy-(py-VH/2)/c.z;cam=clampFree(c);pedir()}
function panBy(dx,dy){pararAnim();cam=clampFree({...cam,cx:cam.cx-dx/cam.z,cy:cam.cy-dy/cam.z});pedir()}
function zoomPara(px,py,k){const c={...cam},wx=c.cx+(px-VW/2)/c.z,wy=c.cy+(py-VH/2)/c.z;c.z*=k;c.cx=wx-(px-VW/2)/c.z;c.cy=wy-(py-VH/2)/c.z;mover(clampFree(c),320)}
function naPaginaInteira(){const p=curPlan();return cam.z<=Math.min(VW/p.w,VH/p.h)*1.04}
function duploToque(x,y){if(livreWeb()&&!guided){if(naPaginaInteira()){LW=false;zoomPara(x,y,2.2);toast(TR('Zoom salvo · vale para as próximas páginas'))}else livreAjustar();return}
  if(guided){livreDaqui();zoomPara(x,y,2);toast(TR('Zoom livre · dois toques voltam'));return}
  if(!naPaginaInteira()){mover(freeFull(),320);return}
  setMode(true)}

/* ---------- lupa (0.69): segurar o dedo no modo guiado mostra a pagina inteira ampliada embaixo do dedo ---------- */
const LUPA={on:false,x:0,y:0,lx:0,ly:0,tm:0,R:96,Z:2.3};
function lupaRaio(){return Math.round(Math.max(84,Math.min(130,Math.min(VW,VH)*0.17)))}
function lupaPode(){return !!(CFG.lupa&&guided&&book&&cur&&cur.tex&&!wtOn&&!tr&&$('ajustes').hidden)}
function lupaPos(){const R=LUPA.R,el=$('lupa');if(!el)return;const lx=Math.max(R+4,Math.min(VW-R-4,LUPA.x));let ly=LUPA.y-R*1.4;if(ly<R+4)ly=LUPA.y+R*1.4;ly=Math.max(R+4,Math.min(VH-R-4,ly));LUPA.lx=lx;LUPA.ly=ly;
  el.style.width=el.style.height=(R*2)+'px';el.style.transform='translate('+(lx-R)+'px,'+(ly-R)+'px)'}
function lupaLigar(x,y){if(!lupaPode())return false;LUPA.R=lupaRaio();LUPA.x=x;LUPA.y=y;LUPA.on=true;lupaPos();$('lupa').hidden=false;try{if(navigator.vibrate)navigator.vibrate(12)}catch(e){}pedir();return true}
function lupaMover(x,y){LUPA.x=x;LUPA.y=y;lupaPos();pedir()}
function lupaDesligar(){clearTimeout(LUPA.tm);if(!LUPA.on)return;LUPA.on=false;const el=$('lupa');if(el)el.hidden=true;pedir()}
function lupaEmpurra(v,max){const D=LUPA.R/LUPA.Z*1.3,M=LUPA.R*1.2;if(v<M)return v-D*(1-Math.max(0,v)/M);if(v>max-M)return v+D*(1-Math.max(0,max-v)/M);return v}   // perto da borda a lupa passa a mostrar o que fica fora da tela (balao cortado)
function lupaDesenhar(c){const k=cv.width/VW,z2=c.z*LUPA.Z,px0=c.cx+(LUPA.x-VW/2)/c.z,py0=c.cy+(LUPA.y-VH/2)/c.z,rad=LUPA.R/LUPA.Z/c.z,px=Math.min(Math.max(c.cx+(lupaEmpurra(LUPA.x,VW)-VW/2)/c.z,Math.min(px0,rad)),Math.max(px0,cur.w-rad)),py=Math.min(Math.max(c.cy+(lupaEmpurra(LUPA.y,VH)-VH/2)/c.z,Math.min(py0,rad)),Math.max(py0,cur.h-rad));   // o empurrao nunca deixa a lupa mostrar vazio alem da borda da pagina
  const c2={cx:px-(LUPA.lx-VW/2)/z2,cy:py-(LUPA.ly-VH/2)/z2,z:z2};
  gl.useProgram(P1);gl.uniform2f(U1.s,VW,VH);gl.uniform1i(U1.t,0);gl.activeTexture(gl.TEXTURE0);gl.uniform3f(U1.lc,LUPA.lx*k,(VH-LUPA.ly)*k,LUPA.R*k);
  pagina(cur,c2,1);gl.uniform3f(U1.lc,0,0,0)}

/* ---------- toques: bordas viram na hora; centro = menu (1 toque) ou zoom (2 toques) ---------- */
const ptr=new Map();let pinch=null,down=null,lastTap=0,tapTimer=null,trilha=[];
function bordaX(d){if(!book||!cur||!curPlan())return true;const p=curPlan(),meio=VW/2/cam.z;if(p.w*cam.z<=VW*1.02)return true;return d<0?cam.cx<=meio+1:cam.cx>=p.w-meio-1}
function bordaY(d){if(!book||!cur||!curPlan())return true;const p=curPlan(),meio=VH/2/cam.z;if(p.h*cam.z<=VH*1.02)return true;return d<0?cam.cy<=meio+1:cam.cy>=p.h-meio-1}
function pos(e){const r=wrap.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
wrap.addEventListener('pointerdown',e=>{lastInput=performance.now();if(!$('ajustes').hidden){abrirAjustes(false);return}
  wrap.setPointerCapture(e.pointerId);const q=pos(e);ptr.set(e.pointerId,q);
  if(ptr.size===2){const [a,b]=[...ptr.values()];if(guided)livreDaqui();pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),m:[(a[0]+b[0])/2,(a[1]+b[1])/2]};down=null;clearTimeout(LUPA.tm);lupaDesligar()}
  else{down={x:q[0],y:q[1],t:performance.now(),moved:false,bl:bordaX(-1),br:bordaX(1),bt:bordaY(-1),bb:bordaY(1)};trilha=[[q[0],q[1],performance.now()]];clearTimeout(LUPA.tm);if(guided&&CFG.lupa)LUPA.tm=setTimeout(()=>{if(down&&!down.moved&&ptr.size===1){const r=ptr.values().next().value;if(lupaLigar(r[0],r[1]))down.lupa=true}},380)}});
wrap.addEventListener('pointermove',e=>{if(!ptr.has(e.pointerId))return;lastInput=performance.now();const old=ptr.get(e.pointerId),q=pos(e);ptr.set(e.pointerId,q);
  if(pinch&&ptr.size===2){const [a,b]=[...ptr.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    zoomAt(m[0],m[1],d/pinch.d);panBy(m[0]-pinch.m[0],m[1]-pinch.m[1]);pinch={d,m};return}
  if(!down)return;if(LUPA.on){lupaMover(q[0],q[1]);return}if(Math.hypot(q[0]-down.x,q[1]-down.y)>10){down.moved=true;clearTimeout(LUPA.tm)}
  trilha.push([q[0],q[1],performance.now()]);if(trilha.length>6)trilha.shift();
  if(down.moved&&!guided&&!naPaginaInteira())panBy(q[0]-old[0],q[1]-old[1])});
function deslize(dx,dy,dt){const m=mgDir(),mn=(dt||999)<230?22:32;
  if(m==='v'){if(Math.abs(dy)>mn&&Math.abs(dy)>1.2*Math.abs(dx)&&(naPaginaInteira()||(livreWeb()&&down&&(dy<0?down.bb:down.bt)))){if(dy<0)next();else prev();return true}return false}
  if(Math.abs(dx)>mn&&Math.abs(dx)>1.2*Math.abs(dy)&&(guided||naPaginaInteira()||(livreWeb()&&down&&(dx<0?down.br:down.bl)))){if((dx<0)!==(m==='rtl'))next();else prev();return true}return false}
function up(e){if(!ptr.has(e.pointerId))return;lastInput=performance.now();ultimoToque=e.timeStamp||performance.now();const q=pos(e);ptr.delete(e.pointerId);if(ptr.size<2)pinch=null;
  if(LUPA.on&&ptr.size===0){lupaDesligar();down=null;return}
  clearTimeout(LUPA.tm);
  if(down&&ptr.size===0){const dt=performance.now()-down.t,dx=q[0]-down.x,dy=q[1]-down.y;
    if(!down.moved&&dt<350)tap(q[0],q[1]);
    else if(down.moved&&dt<450&&deslize(dx,dy,dt)){}
    else if(down.moved&&dt<300&&Math.hypot(dx,dy)<=18)tap(q[0],q[1]);   /* toque com o dedo tremendo (mais de 10px, menos de 18px) conta como toque */
    else if(down.moved&&!guided&&!naPaginaInteira()&&trilha.length>1){
      const a=trilha[0],b=trilha[trilha.length-1],tt=Math.max(16,b[2]-a[2]),vx=(b[0]-a[0])/tt,vy=(b[1]-a[1])/tt;
      if(Math.hypot(vx,vy)>0.35)mover(clampFree({...cam,cx:cam.cx-vx*260/cam.z,cy:cam.cy-vy*260/cam.z}),420)}}
  if(ptr.size===0)down=null}
wrap.addEventListener('pointerup',up);wrap.addEventListener('pointercancel',e=>{ptr.delete(e.pointerId);pinch=null;down=null;lupaDesligar()});wrap.addEventListener('contextmenu',e=>{if(LUPA.on||CFG.lupa&&guided)e.preventDefault()});
function menuAberto(){return $('reader').classList.contains('menu')}
function menu(on){$('reader').classList.toggle('menu',on);if(on){if(rotuloSujo)rotuloAgora();else tirasSync()}if(!on)abrirAjustes(false)}
function tap(x,y){const now=performance.now(),m=mgDir(),centro=m==='v'?(y>VH*0.3&&y<VH*0.7):(x>VW*0.3&&x<VW*0.7);
  if(centro){if(now-lastTap<300&&tapTimer){clearTimeout(tapTimer);tapTimer=null;lastTap=0;duploToque(x,y);return}
    lastTap=now;clearTimeout(tapTimer);tapTimer=setTimeout(()=>{tapTimer=null;if(!barrasFixas())menu(!menuAberto())},280);return}
  if(menuAberto()){menu(false);return}
  if(!guided&&!naPaginaInteira()){if(livreWeb()){livrePasso(m==='v'?(y>=VH*0.7?1:-1):m==='rtl'?(x>=VW*0.7?-1:1):(x>=VW*0.7?1:-1))}return}
  if(m==='v'){if(y>=VH*0.7)next();else prev()}else if(m==='rtl'){if(x>=VW*0.7)prev();else next()}else{if(x>=VW*0.7)next();else prev()}}
// roda do mouse / trackpad: passa quadro (guiado) ou pagina; com Ctrl (ou pinça do trackpad) faz zoom; com zoom livre, rola a pagina
/* leitura livre na web (so HQ): roda rola a pagina na vertical, botoes laterais de zoom; ao fim da pagina passa para a proxima mantendo o zoom */
const livreWeb=()=>!guided&&!wtOn;   /* v0.58: vale tambem para mangá (Mangá, Ocidental, Vertical); webtoon tem rolagem propria */
let LZK='hq-lz';const _lz=store.get(LZK,{});let LZ=Math.max(1,+_lz.z||1),LS=+_lz.s||0,LW=!!_lz.w,LX=Math.min(1,Math.max(0,_lz.x==null?.5:+_lz.x)),ovAcc=0,ovLock=0;
const lzSalvar=()=>store.set(LZK,{z:+LZ.toFixed(3),s:+LS.toFixed(1),w:LW,x:+LX.toFixed(3)});
function lzPersistir(){if(livreWeb()&&cur&&curPlan()&&!openPage.semLer){const pp=curPlan();if(!LW){LZ=Math.max(1,cam.z/fitZ());LS=LZ>1.04?cam.z*pp.h:0}LX=Math.min(1,Math.max(0,cam.cx/pp.w));lzSalvar()}}
function lzTroca(k){if(k===LZK)return;lzPersistir();LZK=k;const q=store.get(k,{});LZ=Math.max(1,+q.z||1);LS=+q.s||0;LW=!!q.w;LX=Math.min(1,Math.max(0,q.x==null?.5:+q.x))}
const fitZ=()=>{const p=curPlan();return Math.min(VW/p.w,VH/p.h)};
function lvZ(){const e=$('lv-z');if(e&&book&&cur)e.textContent=Math.round(cam.z/fitZ()*100)+'%'}
function livreFluxo(dy){const antes=cam.cy;panBy(0,-dy);lvZ();if(Math.abs(cam.cy-antes)>0.5){ovAcc=0;return}
  const t=performance.now();if(t<ovLock)return;ovAcc+=dy;if(Math.abs(ovAcc)>=140){const d=ovAcc;ovAcc=0;ovLock=t+420;if(d>0)next();else prev()}}
function livrePasso(dir){ // botao/tecla: rola ~70% da altura visivel; no fim, passa a pagina
  if(naPaginaInteira()){if(dir>0)next();else prev();return}
  const t=clampFree({...cam,cy:cam.cy+dir*(VH*0.7)/cam.z});if(Math.abs(t.cy-cam.cy)<0.5){if(dir>0)next();else prev();return}
  mover(t,260);setTimeout(lvZ,300)}
function livreZoom(k){LW=false;const c=Math.max(fitZ(),Math.min(fitZ()*6,cam.z*k));mover(clampFree({...cam,z:c}),240);setTimeout(lvZ,280)}
function livreAjustar(){LZ=1;LS=0;LW=false;LX=.5;lzSalvar();mover(freeFull(),260);setTimeout(lvZ,300)}
function livreLargura(){const p=curPlan();LW=true;const z=Math.max(fitZ(),Math.min(fitZ()*6,VW/p.w)),q=pose(p,p.w/2,cam.cy,z/fitZ());mover(clampFree({cx:q.cx,cy:q.cy,z,r:[0,0,p.w,p.h]}),260);lzSalvar();setTimeout(lvZ,300);toast(TR('Ajustado à largura · vale para as próximas páginas'))}
$('lv-w').onclick=livreLargura;
$('lv-up').onclick=()=>livrePasso(-1);$('lv-dn').onclick=()=>livrePasso(1);$('lv-mais').onclick=()=>livreZoom(1.25);$('lv-menos').onclick=()=>livreZoom(0.8);$('lv-fit').onclick=livreAjustar;
let wheelAcc=0,wheelLock=0;
wrap.addEventListener('wheel',e=>{e.preventDefault();lastInput=performance.now();
  if(e.ctrlKey){if(guided)livreDaqui();const q=pos(e);zoomAt(q[0],q[1],Math.exp(-e.deltaY*0.01));return}
  if(livreWeb()&&!naPaginaInteira()){livreFluxo(e.deltaY);return}
  if(!guided&&!naPaginaInteira()){panBy(-e.deltaX,-e.deltaY);return}
  const agora=performance.now();if(agora<wheelLock)return;wheelAcc+=e.deltaY;
  if(Math.abs(wheelAcc)>=40){const d=wheelAcc;wheelAcc=0;wheelLock=agora+230;if(d>0)next();else prev()}},{passive:false});


/* ---------- seletor de paginas (estilo Kindle): faixa de miniaturas, barra de posicao e grade ---------- */
// miniaturas sob demanda (150 px), guardadas no aparelho; so 2 por vez e so as que estao a vista
const thURL=new Map(),thMemo=new Map(),thFila=[],thQuer=new Set();let thAtivos=0;
function thReset(){for(const u of thURL.values())URL.revokeObjectURL(u);thURL.clear();thMemo.clear();thFila.length=0;thQuer.clear();T.built=''}
async function thGerar(i){const pg=book.pages[i],k='th1|'+book.key+'|'+i+'|'+(pg.blob?pg.blob.size:pg.w+'x'+pg.h);let b=await cacheGet(k);
  if(!b&&!pg.blob&&pg.mini){b=await pg.mini();if(b)cachePut(k,b)}
  if(!b){const bm=await createImageBitmap(pg.blob||await pgBlob(i),{resizeWidth:150,resizeQuality:'medium'}),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);bm.close();
    b=await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.72));if(b)cachePut(k,b)}
  return b?URL.createObjectURL(b):null}
function thBomba(){while(thAtivos<2&&thFila.length){const t=thFila.pop();
    if(!thQuer.has(t.i)&&!t.forte){thMemo.delete(t.i);t.ok(null);continue}
    thAtivos++;thGerar(t.i).then(u=>{if(u)thURL.set(t.i,u);t.ok(u)},()=>{thMemo.delete(t.i);t.ok(null)}).finally(()=>{thAtivos--;setTimeout(thBomba,anim?120:0)})}}
function thGarantir(i,forte){if(thURL.has(i))return Promise.resolve(thURL.get(i));let p=thMemo.get(i);if(p)return p;
  p=new Promise(ok=>{thFila.push({i,ok,forte:!!forte});thBomba()});thMemo.set(i,p);return p}
function thAplicar(el){const i=+el.dataset.i;if(el.dataset.ok)return;el.dataset.ok='1';thGarantir(i).then(u=>{if(u){el.style.backgroundImage='url('+u+')'}else delete el.dataset.ok})}
const T={el:$('tiras'),inn:$('tiras-in'),built:'',preview:-1,semAte:0,commitT:0,cur:-1,raf:0};
function tirasMontar(){if(T.built===book.key)return;T.built=book.key;T.cur=-1;T.preview=-1;const fr=document.createDocumentFragment();
  for(let i=0;i<book.pages.length;i++){const b=document.createElement('button');b.type='button';b.className='th';b.dataset.i=i;b.setAttribute('aria-label',L('Página ','Page ')+(i+1));b.innerHTML='<i>'+(i+1)+'</i>';fr.append(b)}
  T.inn.replaceChildren(fr)}
const tirasVisivel=()=>!!T.el.offsetParent&&T.el.clientWidth>0;
function tirasPos(i){const e=T.inn.children[i];return e?e.offsetLeft+e.offsetWidth/2-T.el.clientWidth/2:0}
function tirasIdx(){const a=T.inn.children[0],b=T.inn.children[1];if(!a)return 0;const step=b?b.offsetLeft-a.offsetLeft:72;
  return Math.max(0,Math.min(book.pages.length-1,Math.round((T.el.scrollLeft-tirasPos(0))/step)))}
function tirasIr(i,suave){if(!tirasVisivel())return;T.alvo=tirasPos(i);T.semAte=performance.now()+(suave?1200:90);T.el.scrollTo({left:T.alvo,behavior:suave?'smooth':'auto'})}
function tirasMarcar(i){if(T.cur===i)return;const o=T.inn.children[T.cur],n=T.inn.children[i];if(o)o.classList.remove('on');if(n)n.classList.add('on');T.cur=i}
function tirasCarregar(){if(!tirasVisivel())return;const c=tirasIdx();thQuer.clear();const a=Math.max(0,c-9),b=Math.min(book.pages.length-1,c+9);
  for(let i=a;i<=b;i++){thQuer.add(i)}for(let i=a;i<=b;i++){const el=T.inn.children[i];if(el)thAplicar(el)}}
// preview: arrastando a faixa ou a barra, a pagina so abre quando o dedo para (250 ms), como no Kindle
function previewPage(k){k=Math.max(0,Math.min(book.pages.length-1,k));if(k===T.preview)return;T.preview=k;$('slider').value=k+1;
  $('stat').innerHTML=L('Página <b>'+(k+1)+'</b> de '+book.pages.length,'Page <b>'+(k+1)+'</b> of '+book.pages.length);tirasMarcar(k);clearTimeout(T.commitT);T.commitT=setTimeout(()=>{if(T.preview!==pi)openPage(T.preview)},250)}
function tirasSync(){if(!book)return;tirasMontar();if(!tirasVisivel())return;const noToque=performance.now()-(T.userT||0)<700;T.preview=pi;tirasMarcar(pi);if(!noToque)tirasIr(pi,T.pronto);T.pronto=true;tirasCarregar()}
T.el.addEventListener('pointerdown',()=>{T.userT=performance.now();lastInput=T.userT;T.semAte=0},{passive:true});
T.el.addEventListener('scroll',()=>{if(T.raf)return;T.raf=requestAnimationFrame(()=>{T.raf=0;if(!book)return;tirasCarregar();if(performance.now()<T.semAte){if(Math.abs(T.el.scrollLeft-T.alvo)<3)T.semAte=0;return}T.userT=performance.now();lastInput=T.userT;previewPage(tirasIdx())})},{passive:true});
T.inn.addEventListener('click',e=>{const b=e.target.closest('.th');if(!b)return;const i=+b.dataset.i;clearTimeout(T.commitT);T.preview=i;tirasMarcar(i);$('slider').value=i+1;tirasIr(i,true);if(i!==pi)openPage(i)});
// grade com todas as paginas (Page Flip View)
let gradeObs=null;
function abrirGrade(){if(!book)return;const body=$('grade-body');body.replaceChildren();const fr=document.createDocumentFragment();
  for(let i=0;i<book.pages.length;i++){const b=document.createElement('button');b.type='button';b.className='th'+(i===pi?' on':'');b.dataset.i=i;b.setAttribute('aria-label',L('Página ','Page ')+(i+1));b.innerHTML='<i>'+(i+1)+'</i>';fr.append(b)}
  body.append(fr);$('grade-n').textContent=book.pages.length+L(' páginas',' pages');$('grade').hidden=false;
  if(gradeObs)gradeObs.disconnect();
  gradeObs=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){thQuer.add(+e.target.dataset.i);thAplicar(e.target);gradeObs.unobserve(e.target)}},{root:body,rootMargin:'400px'});
  for(const el of body.children)gradeObs.observe(el);
  const at=body.children[pi];if(at)at.scrollIntoView({block:'center'})}
function fecharGrade(){if($('grade').hidden)return;$('grade').hidden=true;if(gradeObs){gradeObs.disconnect();gradeObs=null}$('grade-body').replaceChildren()}
$('grade-body').addEventListener('click',e=>{const b=e.target.closest('.th');if(!b)return;const i=+b.dataset.i;fecharGrade();menu(false);if(i!==pi)openPage(i)});
$('grade-x').onclick=fecharGrade;$('grid-btn').onclick=abrirGrade;

/* ---------- barras, ajustes, voltar ---------- */
async function setZoomLevel(d){const k=Math.max(0,Math.min(ZOOMS.length-1,ZOOMS.indexOf(ZOOM)+d));if(ZOOMS[k]===ZOOM)return;ZOOM=ZOOMS[k];store.set('hq-zoom',ZOOM);letraTxt();
  if(!book)return;queue.length=0;book.plans=new Array(book.pages.length).fill(null);book.inflight=new Map();abrirAjustes(false);
  const r=await preparar(wantPage);if(r==='cancel'&&!book)return;openPage(wantPage)}
function letraTxt(){$('letra-v').textContent=L('Letra '+(ZOOMS.indexOf(ZOOM)+1)+' de '+ZOOMS.length,'Text size '+(ZOOMS.indexOf(ZOOM)+1)+' of '+ZOOMS.length)}
$('zm').onclick=()=>setZoomLevel(-1);$('zp').onclick=()=>setZoomLevel(1);
$('m-g').onclick=()=>{if(!guided||wtOn){const era=wtOn;if(era){HQV=false;store.set('hq-vert',false);wtFechar()}setMode(true);if(era)openPage(pi)}};
$('m-l').onclick=()=>{if(guided||HQV||wtOn){const era=wtOn;HQV=false;store.set('hq-vert',false);if(era)wtFechar();setMode(false);if(era)openPage(pi)}};
if($('m-v'))$('m-v').onclick=()=>{if(!book||ehManga()||(HQV&&wtOn))return;HQV=true;store.set('hq-vert',true);guided=false;store.set('hq-modo','l');botoesHQ();toast(TR('Vertical · rolagem contínua · pinça ou dois toques para zoom'));wtAbrir();label()};
$('next').onclick=next;$('prev').onclick=prev;
$('slider').oninput=()=>{const k=+$('slider').value-1;previewPage(k);tirasIr(k,false)};
function voltarBiblioteca(){fimOn=false;$('fim').hidden=true;fimT=0;pararAnim();fecharGrade();menu(false);thReset();$('reader').hidden=true;$('home').hidden=false;openToken++;save();lzPersistir();soltarTudo();mgSair();renderRecent();renderOla();
  try{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}
  bibDepois=false;try{bibAbrir(true)}catch(e){}}
let saindo=false;
$('back').onclick=()=>{if(history.state&&history.state.hq==='leitor'){saindo=true;history.back()}else voltarBiblioteca()};
addEventListener('popstate',()=>{if($('reader').hidden)return;
  if(saindo){saindo=false;voltarBiblioteca();return}
  if(!$('grade').hidden){fecharGrade();try{history.pushState({hq:'leitor'},'')}catch(e){}return}
  if(!$('ajustes').hidden||menuAberto()){menu(false);try{history.pushState({hq:'leitor'},'')}catch(e){}return}
  // trava: gesto/botao "voltar" do aparelho NAO sai mais da leitura; sai so pelo menu (toque no centro > Biblioteca)
  if(history.state&&history.state.hq==='leitor')return;   // ja esta no estado da leitura (ex.: acabou de fechar o chat)
  try{history.pushState({hq:'leitor'},'')}catch(e){}
  if(fimOn)fimFechar();toast(L('Para sair: toque no centro e use "Biblioteca"','To leave: tap the center and use "Library"'))});
addEventListener('keydown',e=>{if($('reader').hidden||!$('grade').hidden||e.target===$('slider')||(e.target.closest&&e.target.closest('#ajustes,#chat,#link-dlg,#cor-dlg')))return;
  const rtl=mgDir()==='rtl';
  if(e.key===' '||e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();if(livreWeb())livrePasso(1);else next()}
  if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();if(livreWeb())livrePasso(-1);else prev()}
  if(e.key==='ArrowRight'){e.preventDefault();if(rtl)prev();else next()}
  if(e.key==='ArrowLeft'){e.preventDefault();if(rtl)next();else prev()}
  if((e.key==='g'||e.key==='G')&&!ehManga())setMode(!guided);if(e.key==='m'||e.key==='M')menu(!menuAberto());if(e.key==='-')setZoomLevel(-1);if(e.key==='+'||e.key==='=')setZoomLevel(1);
  if(e.key==='f'||e.key==='F')alternarTelaCheia();if(e.key==='Escape'&&!document.fullscreenElement){if(!$('grade').hidden)fecharGrade();else if(menuAberto())menu(false);else $('back').click()}});
function diagTxt(){const u=DG.ult;return L('Diagnóstico · GPU: ','Diagnostics · GPU: ')+(GLI.gpu||'?')+L('\nTela ','\nScreen ')+Math.round(VW)+'×'+Math.round(VH)+L(' · densidade ',' · density ')+DPR+L(' · textura máx ',' · max texture ')+(GLI.max||'?')+(GLI.v2?' · WebGL2':' · WebGL1')+' · '+workers.length+L(' núcleos de análise',' analysis cores')+
  L('\nÚltimo movimento: ','\nLast move: ')+(u?u.n+L(' quadros · média ',' frames · avg ')+u.media+L(' ms · pior ',' ms · worst ')+u.max+' ms · '+u.lentos+L(' lentos (>24 ms) · toque→1º quadro ',' slow (>24 ms) · tap→1st frame ')+u.lat+' ms':L('ainda nenhum','none yet'))}
function abrirAjustes(on){$('ajustes').hidden=!on;$('cfg').setAttribute('aria-expanded',on);$('cfg').classList.toggle('on',on);if(on)$('diag').textContent=diagTxt()}
$('cfg').onclick=()=>abrirAjustes($('ajustes').hidden);$('cfg-ok').onclick=()=>abrirAjustes(false);
const velTxt=()=>{$('cfg-vel-v').textContent=CFG.vel.toFixed(1).replace('.',LANG==='pt'?',':'.')+' s'};
if($('cfg-ui')){$('cfg-ui').value=store.get('hq-ui','auto');$('cfg-ui').onchange=e=>{store.set('hq-ui',e.target.value);detectarUI()}}
$('cfg-vel').value=CFG.vel;$('cfg-entrar').checked=CFG.entrar;$('cfg-lupa').checked=CFG.lupa!==false;$('cfg-sair').checked=CFG.sair;$('cfg-fora').value=CFG.fora;velTxt();letraTxt();
const animUI=()=>{$('cfg-anim').checked=CFG.anim;$('cfg-vel').disabled=!CFG.anim;$('cfg-vel').closest('label').style.opacity=CFG.anim?1:.45};animUI();
$('cfg-anim').onchange=e=>{CFG.anim=e.target.checked;animUI();salvarCfg();if(!CFG.anim){pararAnim();fade=null}toast(TR(CFG.anim?'Animações ligadas':'Corte seco · sem animação'))};
$('cfg-vel').oninput=e=>{CFG.vel=Math.round(+e.target.value*10)/10;velTxt();salvarCfg()};
$('cfg-lupa').onchange=e=>{CFG.lupa=e.target.checked;salvarCfg();if(!CFG.lupa)lupaDesligar()};
$('cfg-entrar').onchange=e=>{CFG.entrar=e.target.checked;salvarCfg();if(book&&guided)goStep(si,true)};
$('cfg-sair').onchange=e=>{CFG.sair=e.target.checked;salvarCfg();if(book&&guided)goStep(si,true)};
function foraUI(){$('cfg-fora').value=CFG.fora;$('esc').classList.toggle('on',CFG.fora==='escura');$('cfg-esc-v').textContent=Math.round(CFG.esc*100)+'%'}
function aplicarFora(){salvarCfg();foraUI();if(book&&cur){pintarFundo();mascara(cam);pedir()}}
$('cfg-fora').onchange=e=>{CFG.fora=e.target.value;aplicarFora()};
$('cfg-esc').value=CFG.esc;$('cfg-esc').oninput=e=>{CFG.esc=Math.round(+e.target.value*100)/100;aplicarFora()};
$('esc').onclick=()=>{CFG.fora=CFG.fora==='escura'?'pagina':'escura';aplicarFora();toast(TR(CFG.fora==='escura'?'Fora do quadro escurecido':'Fora do quadro na cor da página'))};foraUI();
new ResizeObserver(()=>{if($('reader').hidden)return;medir();if(!book||!cur)return;if(guided&&!curPlan().provisorio)goStep(si,true);else{pararAnim();cam=clampFree(cam);pedir()}}).observe(wrap);
function openReader(){podeSalvar=false;const s=store.get(book.key,null);firstShow=true;soltarTudo();$('home').hidden=true;$('reader').hidden=false;$('rtitle').textContent=book.name;
  try{history.pushState({hq:'leitor'},'')}catch(e){}
  try{if(!gl)iniciarGL()}catch(err){$('reader').hidden=true;$('home').hidden=false;$('err').hidden=false;$('err').textContent=err.message;return}
  if(book.manga)mgEntrar(s);else{document.documentElement.removeAttribute('data-leitura');$('slider').style.direction='';$('prev').onclick=prev;$('next').onclick=next}
  medir();setMode(guided,true);if(!book.manga&&HQV&&!guided)wtAbrir();menu(false);if(!store.get(book.manga?'hq-dica-mg':'hq-dica',false))setTimeout(()=>dica(true),350);else toast(TR('Toque no centro para o menu'));const start=s?Math.min(s.page,book.pages.length-1):0;
  openPage(start).then(()=>{if(s&&s.step&&guided&&pi===start&&plan(start))goStep(s.step,true);podeSalvar=true;save()})}

/* ---------- dica de uso (1a leitura; reabre em Aa) ---------- */
function dica(on){const d=$('dica');if(!on){d.hidden=true;store.set(ehManga()?'hq-dica-mg':'hq-dica',true);return}d.hidden=false;const b=$('dica-ok');if(b)b.focus({preventScroll:true})}
$('dica-ok').onclick=e=>{e.stopPropagation();dica(false)};$('dica').addEventListener('pointerdown',e=>e.stopPropagation());
$('dica').addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter'){e.stopPropagation();dica(false)}});
$('cfg-dica').onclick=()=>{abrirAjustes(false);dica(true)};

/* ---------- biblioteca: heroi "continuar" + estante ---------- */
let capaURLs=[];
async function renderRecent(){abasUI();const r=store.get('hq-recentes',[]).filter(x=>!!x.manga===(aba==='manga')).slice(0,MAX_LIVROS),box=$('recent');capaURLs.forEach(u=>URL.revokeObjectURL(u));capaURLs=[];
  $('vazio').hidden=r.length>0;$('shelf').querySelector('ul').classList.toggle('capas',aba==='manga');
  if(!r.length){box.hidden=true;return}box.hidden=false;
  const hb=$('herobox'),ul=$('shelf').querySelector('ul');hb.innerHTML='';ul.innerHTML='';$('shelf').hidden=r.length<2;
  const rem=(it,e)=>{e.stopPropagation();store.set('hq-recentes',store.get('hq-recentes',[]).filter(x=>x.key!==it.key));renderRecent()};
  const botao=it=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',L('Remover ','Remove ')+it.name);b.className='rm';b.textContent='✕';b.onclick=e=>rem(it,e);return b};
  const nome=it=>it.name.replace(/_+/g,' ').trim();
  r.forEach((it,k)=>{
    const pct=Math.round(100*it.page/Math.max(1,it.total));
    if(k===0){const h=document.createElement('div');h.id='hero';h.setAttribute('role','button');h.tabIndex=0;h.setAttribute('aria-label',L('Continuar '+it.name+', página '+it.page+' de '+it.total,'Continue '+it.name+', page '+it.page+' of '+it.total));
      const cap=document.createElement('div');cap.className='capa vazia';cap.textContent=it.manga?'MANGÁ':'HQ';
      const tx=document.createElement('div');tx.className='tx';
      tx.innerHTML='<span class="kicker">'+TR('Continuar lendo')+'</span><span class="nome"></span><span class="pg"></span><span class="prog"><i></i></span>';
      tx.querySelector('.nome').textContent=nome(it);tx.querySelector('.pg').textContent=L('Página '+it.page+' de '+it.total,'Page '+it.page+' of '+it.total)+' · '+pct+'%';tx.querySelector('i').style.width=pct+'%';
      const bt=document.createElement('span');bt.className='btn';bt.textContent=TR('▶ Continuar');tx.append(bt);
      h.append(cap,tx,botao(it));h.onclick=()=>abrirDaEstante(it);h.onkeydown=e=>{if(e.key==='Enter')abrirDaEstante(it)};hb.append(h);
      libGet(it.key).then(v=>{if(v&&v.capa){const u=URL.createObjectURL(v.capa);capaURLs.push(u);const bgi=document.createElement('img');bgi.className='bg';bgi.alt='';bgi.src=u;h.prepend(bgi);
        const im=document.createElement('img');im.className='capa';im.alt='';im.src=u;cap.replaceWith(im)}});return}
    const li=document.createElement('li'),b=document.createElement('button');b.className='card';b.type='button';b.setAttribute('aria-label',L('Continuar '+it.name+', página '+it.page+' de '+it.total,'Continue '+it.name+', page '+it.page+' of '+it.total));
    const cap=document.createElement('span');cap.className='capa vazia';cap.textContent=it.manga?'MANGÁ':'HQ';
    const ft=document.createElement('span');ft.className='ft';ft.innerHTML='<span class="nome"></span><span class="pg"></span><span class="prog"><i></i></span>';
    ft.querySelector('.nome').textContent=nome(it);ft.querySelector('.pg').textContent=L('Pág. '+it.page+' de '+it.total,'Pg. '+it.page+' of '+it.total);ft.querySelector('i').style.width=pct+'%';
    b.append(cap,ft);if(it.manga&&it.m&&MGNOME[it.m]){const bd=document.createElement('span');bd.className='bd';bd.textContent=LN(MGNOME[it.m]);b.append(bd)}b.onclick=()=>abrirDaEstante(it);li.append(b,botao(it));ul.append(li);
    libGet(it.key).then(v=>{if(v&&v.capa){const u=URL.createObjectURL(v.capa);capaURLs.push(u);const im=document.createElement('img');im.className='capa';im.alt='';im.src=u;cap.replaceWith(im)}})})}
$('fab').onclick=()=>$('file').click();$('abrir-top').onclick=()=>$('file').click();

/* v0.68 — aviso de nova versão (só no APK): consulta a última Release do GitHub ao abrir.
   "Sim" baixa o APK pelo navegador do celular; "Não" fecha e pergunta de novo na próxima abertura. */
(()=>{if(typeof MODO_FIXO==='undefined'||(MODO_FIXO!=='toque'&&MODO_FIXO!=='web')||!/^file:/.test(location.protocol))return;
const ALVO=MODO_FIXO==='toque'?/\.apk$/i:/^ComicXD-pc\.html$/i;
const num=s=>String(s).replace(/^v/i,'').split('.').map(x=>parseInt(x,10)||0);
const maior=(a,b)=>{a=num(a);b=num(b);for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x>y}return false};
const aviso=(v,url)=>{if(document.getElementById('upd'))return;
  const o=document.createElement('div');o.id='upd';o.setAttribute('role','dialog');
  o.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,7,16,.78)';
  const c=document.createElement('div');c.style.cssText='max-width:360px;width:100%;background:#141830;border:1px solid #2a3158;border-radius:18px;padding:20px;color:#e8eaf6;font:16px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
  const h=document.createElement('div');h.style.cssText='font-weight:800;font-size:20px;color:#ffb300;margin-bottom:8px';h.textContent=L('Nova versão disponível','New version available');
  const p=document.createElement('div');p.style.cssText='margin-bottom:16px;opacity:.9';p.textContent=L('A versão '+v+' do ComicXD saiu (você está na '+VERSAO+'). Quer baixar agora? '+(MODO_FIXO==='toque'?'O download abre no navegador e depois é só tocar para instalar.':'Baixa o novo arquivo .html; depois abra ele no lugar deste (guarde o arquivo na mesma pasta e abra no mesmo navegador).'),'ComicXD '+v+' is out (you have '+VERSAO+'). Download it now? '+(MODO_FIXO==='toque'?'The download opens in your browser, then just tap to install.':'It downloads the new .html file; then open it instead of this one (keep it in the same folder and open it in the same browser).'));
  const r=document.createElement('div');r.style.cssText='display:flex;gap:10px';
  const bt=(t,pri)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.style.cssText='flex:1;min-height:46px;border-radius:12px;border:1px solid #2a3158;font:700 16px system-ui,sans-serif;'+(pri?'background:linear-gradient(90deg,#ff4d6d,#ffb300);color:#1a0b00;border:0':'background:#1d2244;color:#e8eaf6');return b};
  const nao=bt(L('Não','No'),0),sim=bt(L('Sim, baixar','Yes, download'),1);
  nao.onclick=()=>o.remove();
  sim.onclick=()=>{o.remove();try{const f=document.createElement('iframe');f.style.display='none';f.src=url;document.body.appendChild(f);setTimeout(()=>f.remove(),60000)}catch(e){}};
  r.append(nao,sim);c.append(h,p,r);o.append(c);document.body.appendChild(o)};
const checar=()=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),8000);
  fetch('https://api.github.com/repos/IntuneOverseer/ComicXD/releases/latest',{signal:ac.signal,headers:{Accept:'application/vnd.github+json'}})
  .then(r=>r.ok?r.json():null).then(j=>{clearTimeout(t);if(!j||!j.tag_name||!maior(j.tag_name,VERSAO))return;
    const a=(j.assets||[]).find(x=>ALVO.test(x.name||''));if(!a)return;aviso(j.tag_name.replace(/^v/i,''),a.browser_download_url)}).catch(()=>{clearTimeout(t)})};
let ult=0;const rodar=()=>{ult=Date.now();checar()};setTimeout(rodar,2500);
/* ao voltar para o app (depois de sair e voltar), confere de novo se já passaram 3 min da última checagem */
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-ult>180000&&!document.getElementById('upd'))rodar()})})();
