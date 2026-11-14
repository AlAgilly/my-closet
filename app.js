'use strict';
/* My Closet: data lives in this device's IndexedDB and syncs to a private GitHub repo the user owns. */

const GROUPS=[
  ['Tops',['Long sleeves','Short sleeves','Crewnecks','Hoodies','Tank tops','Sweaters','Bodysuits','Blouses']],
  ['Bottoms',['Jeans','Pants','Skirts','Leggings','Shorts']],
  ['Full length',['Dresses','Overalls','Rompers','Jumpsuits']],
  ['Jackets',['Cardigans','Jackets','Coats','Vests','Blazers']],
  ['Shoes',['Footwear','Heels']],
  ['Accessories',['Bags','Jewelry','Hats','Hair accessories','Glasses','Belts','Bras','Underwear','Tights']],
  ['Other',['Activewear','Other']]];
const MAIN_GROUPS=['Tops','Bottoms','Full length','Jackets','Shoes','Accessories'];
const SHOE_T=['Footwear','Heels'],UNDER_T=['Bras','Underwear','Tights'],HEAD_T=['Hats','Hair accessories'];
const GROUP_OF={};GROUPS.forEach(([g,ts])=>ts.forEach(t=>GROUP_OF[t]=g));
const TYPE_ORDER=GROUPS.flatMap(g=>g[1]);
// Generic colour names, each with a display shade. Exact shades are kept as colourHex; names stay simple.
const GENERIC=[['black','#1c1c1e'],['white','#f6f6f4'],['grey','#8e8e93'],['beige','#d8c3a0'],['brown','#7b5234'],['red','#c8302f'],['maroon','#7a1f2e'],['orange','#ec8a2f'],['yellow','#f2cf45'],['green','#3f8f53'],['blue','#3b74c4'],['navy','#1f2d55'],['purple','#7a4a9c'],['pink','#ec9ab8']];
const GEN_HEX=Object.fromEntries(GENERIC);
const LEGACY={cream:'beige',lightblue:'blue',olive:'green',burgundy:'maroon',gold:'yellow',silver:'grey',gray:'grey',tan:'beige',khaki:'beige',wine:'maroon',teal:'green',denim:'blue'};
const genericName=c=>{c=(c||'').trim().toLowerCase();return GEN_HEX[c]?c:LEGACY[c]||c};
const hexToRgb=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
function rgbToName(r,g,b){
  r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,dl=mx-mn;
  const s=dl===0?0:dl/(1-Math.abs(2*l-1));let h=0;
  if(dl){h=mx===r?((g-b)/dl)%6:mx===g?(b-r)/dl+2:(r-g)/dl+4;h=(h*60+360)%360}
  if(l<.13&&!(l>=.09&&s>=.45&&h>=200&&h<250))return 'black';
  if(s<.12||(s<.2&&l>.25&&l<.85))return l>.78?'white':l<.24?'black':'grey';
  if(l>.93&&s<.35)return 'white';
  if(h>=15&&h<50){if(s>=.6&&l>=.35&&l<=.78)return h<40?'orange':'yellow';return l<.4?'brown':'beige'}
  if(h<15||h>=345){if(l>.72)return 'pink';if(l<.33&&s>=.45)return 'maroon';return l<.3?'brown':'red'}
  if(h<75){if(l<.32)return 'green';return (s<.45&&l>.6)||l>.85?'beige':'yellow'}
  if(h<170)return 'green';
  if(h<250)return l<.32?'navy':'blue';
  if(h<290)return 'purple';
  if(h>=320&&l<.3&&s>=.35)return 'maroon';
  return 'pink';
}
const hexToName=h=>rgbToName(...hexToRgb(h));
const swatchOf=it=>it?.colourHex||GEN_HEX[genericName(it?.colour)]||okColour(it?.colour);
const itemColours=it=>[genericName(it?.colour),...(it?.colours2||[])].filter(Boolean);
const COLS=['closets','items','outfits','plans','looks','prefs'];
const MAIN='main';
const S={group:'All',f:{colours:[],seasons:[],dress:'',styles:[],worn:''},closets:new Map(),items:new Map(),outfits:new Map(),plans:new Map(),looks:new Map(),prefs:new Map(),lookFilter:'todo',deleted:new Map(),ready:false,view:'closet',closet:'all',type:'All',q:'',colour:'',style:'',sort:'new',month:new Date(),statsCloset:'all',notice:'',sync:{state:'off',msg:''},
  shuf:{closet:'all',style:'',season:'auto',occ:'',mode:'mix',pools:{},on:(()=>{try{return{hat:true,outer:true,shoes:true,acc:true,...JSON.parse(localStorage.getItem('closet.shufOn')||'{}')}}catch(e){return{hat:true,outer:true,shoes:true,acc:true}}})(),outer:false,bag:false,acc:false,slots:{},locks:new Set()}};
const URLS=new Map(); // imageId -> object URL
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
{const v=ls.get('closet.view');if(['closet','outfits','shuffle','calendar','stats'].includes(v))S.view=v;S.closet=ls.get('closet.current')||'all'}

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=()=>ymd(new Date());
const parse=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const fmtDate=s=>{const d=parse(s);return d.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric',...(d.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})})};
const daysAgo=s=>Math.round((parse(today())-parse(s))/864e5);
const shortAgo=s=>{const n=daysAgo(s);return n===0?'Today':n===1?'Yesterday':n<0?'Planned':n+'d ago'};
const ago=s=>{const n=daysAgo(s);return n===0?'today':n===1?'yesterday':n<0?`in ${-n} day${n===-1?'':'s'}`:`${n} days ago`};
const money=n=>(n===null||n===undefined||n===''||isNaN(n))?'':new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:Number(n)%1?2:0}).format(n);
const okColour=c=>c&&window.CSS&&CSS.supports('color',c.replace(/\s+/g,''))?c.replace(/\s+/g,''):'';
const newId=()=>(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Date.now().toString(36)+Math.random().toString(36).slice(2,12));
const groupOf=it=>GROUP_OF[it?.type]||it?.group||'Other';
const typeOf=it=>it?.type||'Other';
const typeRank=t=>{const i=TYPE_ORDER.indexOf(t);return i<0?500:i};
const closetOf=it=>S.closets.has(it.closetId)?it.closetId:MAIN;
const closetName=id=>S.closets.get(id)?.name||'My Closet';
const inCloset=(it,c)=>c==='all'||closetOf(it)===c;
const hasImg=it=>it?.imageId&&URLS.has(it.imageId);
const imageIdsOf=it=>[it?.imageId,it?.backImageId].filter(Boolean);
const wantedImages=items=>new Set([...items].flatMap(imageIdsOf));
const lookImages=looks=>new Set([...looks].map(l=>l?.imageId).filter(Boolean));
const img=id=>id&&URLS.has(id)?`<img src="${URLS.get(id)}" alt="" loading="lazy" draggable="false" onerror="this.remove()">`:'';
function thumb(it){
  if(hasImg(it))return img(it.imageId);
  const c=swatchOf(it);
  return `<span class="ini" ${c?`style="color:${c}"`:''}>${esc((it?.name||'?').trim()[0]?.toUpperCase()||'?')}</span>`;
}
const phCls=it=>'ph'+(it?.cutout&&hasImg(it)?' cut':'');
function toast(msg){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;$('#toastRoot').replaceChildren(t);setTimeout(()=>t.remove(),2600)}

/* ---------- IndexedDB ---------- */
let IDB=null;
function idbOpen(){return new Promise((res,rej)=>{
  const r=indexedDB.open('my-closet',4);
  r.onupgradeneeded=()=>{for(const s of[...COLS,'images','meta','emb'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s)};
  r.onblocked=()=>{S.notice='The app is open in another tab with an older version. Close that tab to finish updating.';render()};
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();S.notice='A newer version of the app was opened. Reload this page to keep using it.';render()};if(S.notice.startsWith('The app is open'))S.notice='';res(db)};
  r.onerror=()=>rej(r.error)})}
function idbTx(stores,mode,fn){return new Promise((res,rej)=>{const t=IDB.transaction(stores,mode);let out;const q=fn(t);if(q&&'onsuccess'in q)q.onsuccess=()=>{out=q.result};t.oncomplete=()=>res(out);t.onerror=t.onabort=()=>rej(t.error)})}
const idbGet=(s,k)=>idbTx(s,'readonly',t=>t.objectStore(s).get(k));
const idbPut=(s,k,v)=>idbTx(s,'readwrite',t=>{t.objectStore(s).put(v,k)});
const idbDel=(s,k)=>idbTx(s,'readwrite',t=>{t.objectStore(s).delete(k)});
function idbAll(s){return new Promise((res,rej)=>{const m=new Map();const t=IDB.transaction(s);t.objectStore(s).openCursor().onsuccess=e=>{const c=e.target.result;if(c){m.set(c.key,c.value);c.continue()}};t.oncomplete=()=>res(m);t.onerror=()=>rej(t.error)})}
const saveTomb=()=>idbPut('meta','deleted',Object.fromEntries(S.deleted));

async function saveDoc(col,id,data){
  data={...data,updatedAt:Date.now()};
  await idbPut(col,id,data);S[col].set(id,data);
  if(S.deleted.delete(`${col}/${id}`))await saveTomb();
  render();scheduleSync();
}
async function delDoc(col,id){
  await idbDel(col,id);S[col].delete(id);S.deleted.set(`${col}/${id}`,Date.now());await saveTomb();
  render();scheduleSync();
}
async function addImage(blob){const id=newId();await idbPut('images',id,blob);URLS.set(id,URL.createObjectURL(blob));return id}
async function dropImage(id){if(!id)return;await idbDel('images',id).catch(()=>{});const u=URLS.get(id);if(u)URL.revokeObjectURL(u);URLS.delete(id)}

/* ---------- photos: resize, keep transparency, trim, background removal ---------- */
function loadImage(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error("image failed to load"));im.src=src})}
function hasAlpha(canvas){
  const s=document.createElement('canvas');s.width=64;s.height=64;const g=s.getContext('2d');g.drawImage(canvas,0,0,64,64);
  const d=g.getImageData(0,0,64,64).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]<200)n++;return n>40;
}
// Keep only the item: solid regions (alpha >= 200) that are at least 2% the size of the biggest one,
// plus a 3px soft edge around them. Faint background haze, ghost boxes and stray blobs are cleared.
function keepItemOnly(d,w,h){
  const N=w*h,lab=new Int32Array(N),q=new Int32Array(N),sizes=[0];let nl=0;
  for(let s=0;s<N;s++){
    if(lab[s]||d[s*4+3]<200)continue;
    nl++;let qh=0,qt=0;q[qt++]=s;lab[s]=nl;
    while(qh<qt){const i=q[qh++],x=i%w;
      if(x>0&&!lab[i-1]&&d[(i-1)*4+3]>=200){lab[i-1]=nl;q[qt++]=i-1}
      if(x<w-1&&!lab[i+1]&&d[(i+1)*4+3]>=200){lab[i+1]=nl;q[qt++]=i+1}
      if(i>=w&&!lab[i-w]&&d[(i-w)*4+3]>=200){lab[i-w]=nl;q[qt++]=i-w}
      if(i<N-w&&!lab[i+w]&&d[(i+w)*4+3]>=200){lab[i+w]=nl;q[qt++]=i+w}}
    sizes.push(qt);
  }
  if(!nl)return;
  const big=Math.max(...sizes),keep=sizes.map(z=>z>=big*.02);
  let near=new Uint8Array(N);for(let i=0;i<N;i++)if(lab[i]&&keep[lab[i]])near[i]=1;
  for(let r=0;r<3;r++){const nx=near.slice();for(let i=0;i<N;i++){if(near[i])continue;const x=i%w;if((x>0&&near[i-1])||(x<w-1&&near[i+1])||(i>=w&&near[i-w])||(i<N-w&&near[i+w]))nx[i]=1}near=nx}
  for(let i=0;i<N;i++)if(!near[i])d[i*4+3]=0;
}
// Crop a transparent image to the item and centre it with even padding.
// Faint halo pixels are cleared, and stray specks (rows/columns with only a few solid pixels) are ignored when finding the edges.
async function trimToBlob(c){
  const g=c.getContext('2d');const{width:w,height:h}=c;const img=g.getImageData(0,0,w,h),d=img.data;
  keepItemOnly(d,w,h);
  const rows=new Uint32Array(h),cols=new Uint32Array(w);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4+3;if(d[i]<12){d[i]=0;continue}if(d[i]>=128){rows[y]++;cols[x]++}}
  g.putImageData(img,0,0);
  const minR=Math.max(2,Math.round(w*.006)),minC=Math.max(2,Math.round(h*.006));
  let y0=0,y1=h-1,x0=0,x1=w-1;
  while(y0<h&&rows[y0]<minR)y0++;while(y1>y0&&rows[y1]<minR)y1--;
  while(x0<w&&cols[x0]<minC)x0++;while(x1>x0&&cols[x1]<minC)x1--;
  if(y0>=h||x0>=w||x1-x0<4||y1-y0<4)throw{code:'empty'};
  const iw=x1-x0+1,ih=y1-y0+1,pad=Math.round(Math.max(iw,ih)*.06);
  const o=document.createElement('canvas');o.width=iw+pad*2;o.height=ih+pad*2;
  o.getContext('2d').drawImage(c,x0,y0,iw,ih,pad,pad,iw,ih);
  return await new Promise(r=>o.toBlob(r,'image/png'));
}
async function shrink(file){
  let im;const url=URL.createObjectURL(file);
  try{im=await loadImage(url)}catch(e){URL.revokeObjectURL(url);throw{code:'unsupported_type'}}
  const max=1200,s=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
  const c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*s);c.height=Math.round(im.naturalHeight*s);
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);
  if(hasAlpha(c)){const r=await repairCutout(await trimToBlob(c));return{blob:r.blob,cutout:true}}
  return{blob:await new Promise(r=>c.toBlob(r,'image/jpeg',.85)),cutout:false};
}
// Fix see-through specks inside a cut-out. `a` is the alpha channel (one byte per pixel).
// 1) Background = see-through pixels connected to the image border. 2) Small see-through islands
// enclosed by the item become solid; large ones (e.g. inside a bag handle) stay as background.
// 3) Semi-see-through pixels more than 3px from the background become solid (soft outer edges kept).
function cleanAlpha(a,w,h,px,sc){
  const bgLike=(px&&sc&&sc.bg&&sc.item&&labDist(sc.bg,sc.item)>=25)?idx=>{const L=[];const step=Math.max(1,Math.floor(idx.length/400));for(let k=0;k<idx.length;k+=step){const o=idx[k]*4;L.push([px[o],px[o+1],px[o+2]])}const m=[0,1,2].map(c=>L.map(p=>p[c]).sort((x,y)=>x-y)[L.length>>1]);return labDist(toLab(...m),sc.bg)<12}:null;
  const N=w*h,bg=new Uint8Array(N),q=new Int32Array(N);let qh=0,qt=0;
  const push=i=>{if(!bg[i]&&a[i]<128){bg[i]=1;q[qt++]=i}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(qh<qt){const i=q[qh++],x=i%w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<N-w)push(i+w)}
  const seen=new Uint8Array(N),maxHole=Math.max(64,N*.003);
  for(let s=0;s<N;s++){
    if(bg[s]||seen[s]||a[s]>=128)continue;
    qh=0;qt=0;q[qt++]=s;seen[s]=1;
    while(qh<qt){const i=q[qh++],x=i%w;
      if(x>0&&!seen[i-1]&&a[i-1]<128){seen[i-1]=1;q[qt++]=i-1}
      if(x<w-1&&!seen[i+1]&&a[i+1]<128){seen[i+1]=1;q[qt++]=i+1}
      if(i>=w&&!seen[i-w]&&a[i-w]<128){seen[i-w]=1;q[qt++]=i-w}
      if(i<N-w&&!seen[i+w]&&a[i+w]<128){seen[i+w]=1;q[qt++]=i+w}}
    const isBg=qt>maxHole||(bgLike&&qt>12&&bgLike(Array.from(q.subarray(0,qt))));
    if(!isBg)for(let k=0;k<qt;k++)a[q[k]]=255;else for(let k=0;k<qt;k++)bg[q[k]]=1;
  }
  let near=bg;
  for(let r=0;r<3;r++){const nx=near.slice();for(let i=0;i<N;i++){if(near[i])continue;const x=i%w;if((x>0&&near[i-1])||(x<w-1&&near[i+1])||(i>=w&&near[i-w])||(i<N-w&&near[i+w]))nx[i]=1}near=nx}
  for(let i=0;i<N;i++)if(!near[i]&&a[i]<255)a[i]=255;
}
// Repair an already-saved cut-out: fill specks using the colour of the surrounding fabric.
async function repairCutout(blob){
  const im=await loadImage(URL.createObjectURL(blob));URL.revokeObjectURL(im.src);
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);
  const w=c.width,h=c.height,N=w*h,img=g.getImageData(0,0,w,h),d=img.data;
  const before=new Uint8Array(N),a=new Uint8Array(N);for(let i=0;i<N;i++){a[i]=before[i]=d[i*4+3]}
  cleanAlpha(a,w,h);
  const todo=[];for(let i=0;i<N;i++)if(a[i]!==before[i]){if(before[i]<200)todo.push(i);else d[i*4+3]=a[i]}
  const known=new Uint8Array(N);for(let i=0;i<N;i++)known[i]=before[i]>=200?1:0;
  let left=todo;
  for(let pass=0;pass<60&&left.length;pass++){
    const next=[],fill=[];
    for(const i of left){const x=i%w,y=(i/w)|0;let r=0,gg=0,b=0,n=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(known[j]){r+=d[j*4];gg+=d[j*4+1];b+=d[j*4+2];n++}}
      if(n)fill.push([i,r/n,gg/n,b/n]);else next.push(i)}
    for(const[i,r,gg,b]of fill){d[i*4]=r;d[i*4+1]=gg;d[i*4+2]=b;d[i*4+3]=255;known[i]=1}
    left=next;
  }
  g.putImageData(img,0,0);
  return{blob:await new Promise(r=>c.toBlob(r,'image/png')),fixed:todo.length};
}
// The models live in ml.js and run in the page (a background worker ran out of memory on iPhone).
const ML_SAY={'rmbg-download':'Downloading the cut-out tool. This happens once and is about 45 MB, so Wi-Fi helps…','rmbg-run':'Cutting out the background…',
  'clip-download':'Downloading the item recognizer. This happens once and is about 90 MB, so Wi-Fi helps…','clip-run':'Recognizing the item…',
  'seg-download':'Downloading the outfit finder. This happens once and is about 29 MB…','seg-run':'Finding your clothes in the photo…'};
let MLM=null;
async function ml(op,args,status){
  if(!MLM)MLM=import('./ml.js');
  const m=await MLM;
  return m.run(op,args,st=>status&&status(ML_SAY[st]||st));
}
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
// let the screen draw (status text, thumbnails, scrolled rows) before the next heavy step
const paintPause=()=>new Promise(r=>{let done=false;const go=()=>{if(!done){done=true;setTimeout(r,60)}};requestAnimationFrame(go);setTimeout(go,150)});
// colour of the photo's background (where the model is sure there's no item) and of the item itself
function sceneColours(a,px,N){
  const bg=[],it=[];const step=Math.max(1,Math.floor(N/40000));
  for(let i=0;i<N;i+=step){const o=i*4;if(a[i]<20)bg.push([px[o],px[o+1],px[o+2]]);else if(a[i]>250)it.push([px[o],px[o+1],px[o+2]])}
  const med=arr=>arr.length?[0,1,2].map(k=>arr.map(p=>p[k]).sort((x,y)=>x-y)[arr.length>>1]):null;
  const b=med(bg),t=med(it);return{bg:b&&toLab(...b),item:t&&toLab(...t)};
}
const labDist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// Remove faint background haze stuck to the item's edge: starting from the background, eat into pixels the model
// wasn't fully sure about that are the background's colour. Skipped when the item itself is close to the background colour.
function eatHaze(a,px,w,h,sc){
  if(!sc.bg||!sc.item||labDist(sc.bg,sc.item)<25)return;
  const N=w*h,q=new Int32Array(N),seen=new Uint8Array(N);let qh=0,qt=0;
  const near=i=>{const o=i*4;return labDist(toLab(px[o],px[o+1],px[o+2]),sc.bg)<14};
  for(let i=0;i<N;i++)if(a[i]<128){seen[i]=1;q[qt++]=i}
  while(qh<qt){const i=q[qh++],x=i%w;
    for(const j of[x>0?i-1:-1,x<w-1?i+1:-1,i-w,i+w]){if(j<0||j>=N||seen[j])continue;seen[j]=1;if(a[j]<245&&near(j)){a[j]=0;q[qt++]=j}}}
}
// Soft edges carry some of the old background colour (a light halo on dark clothes). Give each see-through-ish
// edge pixel the colour of the solid fabric next to it, keeping its softness.
function defringe(px,w,h){
  const N=w*h,known=new Uint8Array(N);let todo=[];
  for(let i=0;i<N;i++){const al=px[i*4+3];if(al>=250)known[i]=1;else if(al>0)todo.push(i)}
  for(let pass=0;pass<4&&todo.length;pass++){
    const next=[],fill=[];
    for(const i of todo){const x=i%w,y=(i/w)|0;let r=0,g=0,b=0,n=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(known[j]){r+=px[j*4];g+=px[j*4+1];b+=px[j*4+2];n++}}
      if(n)fill.push([i,r/n,g/n,b/n]);else next.push(i)}
    for(const[i,r,g,b]of fill){px[i*4]=r;px[i*4+1]=g;px[i*4+2]=b;known[i]=1}
    todo=next;
  }
}
async function removeBg(blob,status){
  const{mask,w,h}=await ml('rmbg',{blob},status);
  const im=await loadImage(URL.createObjectURL(blob));URL.revokeObjectURL(im.src);
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  g.drawImage(im,0,0,w,h);await yieldUI();
  const d=g.getImageData(0,0,w,h),sc=sceneColours(mask,d.data,w*h);
  eatHaze(mask,d.data,w,h,sc);await yieldUI();
  cleanAlpha(mask,w,h,d.data,sc);await yieldUI();
  for(let i=0;i<mask.length;i++)d.data[4*i+3]=mask[i];
  defringe(d.data,w,h);g.putImageData(d,0,0);
  return await trimToBlob(c);
}

/* ---------- auto-detect: type (on-device CLIP), colour (pixels), name ---------- */
const TYPE_PHRASE={'Hair accessories':'a hair accessory such as a hair clip, claw clip, scrunchie, bow or headband','Blouses':'a blouse, button-up shirt or other dressy top','Leggings':'a pair of leggings','Rompers':'a romper, a one-piece outfit with shorts','Bras':'a bra or bralette','Underwear':'a pair of underwear or panties','Tights':'a pair of tights or stockings','Short sleeves':'a short sleeve t-shirt','Long sleeves':'a long sleeve t-shirt or fitted long sleeve top','Crewnecks':'a crewneck sweatshirt','Tank tops':'a sleeveless tank top','Bodysuits':'a fitted bodysuit, a one-piece leotard top worn with pants',
  'Sweaters':'a knit sweater','Hoodies':'a hoodie','Cardigans':'a cardigan','Jeans':'a pair of denim jeans','Pants':'a pair of trousers','Shorts':'a pair of shorts','Skirts':'a skirt',
  'Overalls':'a pair of overalls with a bib and shoulder straps','Dresses':'a dress','Jumpsuits':'a jumpsuit','Jackets':'a jacket','Coats':'a long coat','Blazers':'a blazer','Vests':'a vest',
  'Footwear':'a pair of shoes such as sneakers, boots, flats, loafers or sandals','Heels':'a pair of high heels or pumps','Bags':'a handbag or purse','Belts':'a belt','Glasses':'a pair of sunglasses or eyeglasses','Hats':'a hat or cap',
  'Jewelry':'a piece of jewelry such as a necklace, ring, earrings or a watch','Activewear':'athletic sportswear such as a sports bra or gym leggings'};
const SINGULAR={'Hair accessories':'hair accessory','Blouses':'blouse','Leggings':'leggings','Rompers':'romper','Bras':'bra','Underwear':'underwear','Tights':'tights','Short sleeves':'t-shirt','Long sleeves':'long-sleeve top','Crewnecks':'crewneck','Tank tops':'tank top','Bodysuits':'bodysuit','Sweaters':'sweater','Hoodies':'hoodie','Cardigans':'cardigan','Jeans':'jeans','Pants':'pants','Shorts':'shorts','Skirts':'skirt',
  'Overalls':'overalls','Dresses':'dress','Jumpsuits':'jumpsuit','Jackets':'jacket','Coats':'coat','Blazers':'blazer','Vests':'vest','Footwear':'shoes','Heels':'heels','Bags':'bag','Belts':'belt','Glasses':'glasses','Hats':'hat',
  'Jewelry':'jewelry','Activewear':'activewear','Other':'item'};
const CLIP={cache:{}};
// text embeddings for a list of prompts, cached by key
async function clipText(key,prompts){
  if(CLIP.cache[key])return CLIP.cache[key];
  const{te,dim}=await ml('text',{prompts});
  return CLIP.cache[key]={dim,te,n:prompts.length,norms:prompts.map((_,i)=>Math.hypot(...te.subarray(i*dim,(i+1)*dim)))};
}
function clipProbs(img,T){
  const s=[];for(let i=0;i<T.n;i++){let d=0;for(let k=0;k<T.dim;k++)d+=img.ie[k]*T.te[i*T.dim+k];s.push(d/(img.norm*T.norms[i]))}
  const m=Math.max(...s),e=s.map(x=>Math.exp((x-m)*100)),z=e.reduce((a,b)=>a+b,0);return e.map(v=>v/z);
}
async function flatOnWhite(blob){
  const im=await loadImage(URL.createObjectURL(blob));const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0);URL.revokeObjectURL(im.src);
  return await new Promise(r=>c.toBlob(r,'image/jpeg',.9));
}
async function embedImage(blob,status){
  const ie=await ml('image',{blob:await flatOnWhite(blob)},status);return{ie,norm:Math.hypot(...ie)};
}
async function detectType(blob,status,img){
  img=img||await embedImage(blob,status);
  const types=Object.keys(TYPE_PHRASE),T=await clipText('types',types.map(t=>`a product photo of ${TYPE_PHRASE[t]}`));
  const p=clipProbs(img,T);
  // your own closet as examples: pieces that look like this one, and what you called them
  const near=[];
  for(const[,i]of S.items){if(!i.imageId||!GROUP_OF[i.type])continue;let e=null;try{e=await idbGet('emb','item:'+i.imageId)}catch(_){}if(e&&e.ie){const s=cosSim(img,e);if(s>=.8)near.push({t:i.type,s})}}
  near.sort((a,b)=>b.s-a.s);const votes={};let tot=0;
  for(const n of near.slice(0,7)){const w=n.s-.75;votes[n.t]=(votes[n.t]||0)+w;tot+=w}
  const score=types.map((t,n)=>p[n]+(tot?1.5*(votes[t]||0)/tot:0));
  return types[score.indexOf(Math.max(...score))];
}

/* details for more descriptive names. base = index of the "nothing special" option (left out of the name);
   word = the option replaces the item word (e.g. sneakers instead of shoes) */
const A={
  pat:{p:['a plain solid colour {t}','a striped {t}','a plaid {t}','a floral print {t}','a {t} with a big graphic print or logo','a polka dot {t}','a leopard print {t}'],w:['','striped','plaid','floral','graphic','polka-dot','leopard-print'],base:0},
  mat:{p:['a plain cotton {t}','a ribbed knit {t}','a chunky cable knit {t}','a denim {t}','a leather {t}','a shiny satin {t}','a lace {t}','a fuzzy fleece {t}','a corduroy {t}','a sparkly sequin {t}'],w:['','ribbed','cable-knit','denim','leather','satin','lace','fleece','corduroy','sequin'],base:0},
  crop:{p:['a regular length {t}','a cropped {t} that shows the midriff'],w:['','cropped'],base:0},
  sleeve:{p:['a short sleeve {t}','a long sleeve {t}','a sleeveless {t}'],w:['short-sleeve','long-sleeve','sleeveless'],base:null},
  neck:{p:['a crew neck {t}','a v-neck {t}','a square neck {t}','a turtleneck {t}','a collared {t}','an off-the-shoulder {t}'],w:['','v-neck','square-neck','turtleneck','collared','off-shoulder'],base:0},
  leg:{p:['straight leg {t}','wide leg {t}','skinny {t}','flared bootcut {t}','cargo {t} with side pockets','baggy loose {t}'],w:['straight-leg','wide-leg','skinny','flared','cargo','baggy'],base:null},
  len:{p:['a short mini {t}','a knee length midi {t}','a long ankle length maxi {t}'],w:['mini','midi','maxi'],base:null},
  zip:{p:['a pullover {t}','a zip-up {t} with a front zipper'],w:['','zip-up'],base:0},
  jacket:{p:['a plain jacket','a quilted puffer jacket','a bomber jacket','a windbreaker jacket','an oversized shirt jacket'],w:['','puffer','bomber','windbreaker','shacket'],base:0},
  coat:{p:['a wool coat','a belted trench coat','a quilted puffer coat','a fuzzy teddy coat'],w:['wool','trench','puffer','teddy'],base:null},
  foot:{p:['a pair of sneakers','a pair of boots','a pair of loafers','a pair of sandals','a pair of ballet flats','a pair of slippers'],w:['sneakers','boots','loafers','sandals','flats','slippers'],word:true},
  heels:{p:['a pair of pumps','a pair of strappy heeled sandals','a pair of heeled boots','a pair of mules'],w:['pumps','strappy heels','heeled boots','mules'],word:true},
  bag:{p:['a tote bag','a shoulder bag','a crossbody bag','a small clutch','a backpack','a top handle handbag'],w:['tote','shoulder bag','crossbody bag','clutch','backpack','handbag'],word:true},
  hat:{p:['a baseball cap','a knit beanie','a bucket hat','a wide brim sun hat','a fedora'],w:['cap','beanie','bucket hat','sun hat','fedora'],word:true},
  jewel:{p:['a necklace','a pair of earrings','a ring','a bracelet','a wristwatch'],w:['necklace','earrings','ring','bracelet','watch'],word:true},
  glass:{p:['a pair of sunglasses with dark lenses','a pair of clear eyeglasses'],w:['sunglasses','glasses'],word:true},
  active:{p:['a sports bra','a pair of gym leggings','a pair of athletic shorts','a workout top','a matching two piece activewear set'],w:['sports bra','leggings','athletic shorts','workout top','activewear set'],word:true},
  vest:{p:['a suit waistcoat','a quilted puffer vest','a knit sweater vest'],w:['waistcoat','puffer vest','sweater vest'],word:true}};
const DETAILS={Blouses:['pat','crop','mat','sleeve','neck'],Leggings:['pat','mat'],Rompers:['pat','mat'],'Short sleeves':['pat','crop','mat','neck'],'Long sleeves':['pat','crop','mat','neck'],Crewnecks:['pat','crop','mat'],'Tank tops':['pat','crop','mat','neck'],Bodysuits:['pat','mat','sleeve','neck'],Sweaters:['pat','crop','mat','neck'],
  Hoodies:['pat','crop','zip','mat'],Cardigans:['pat','crop','mat'],Jeans:['leg'],Pants:['pat','mat','leg'],Shorts:['pat','mat'],Skirts:['pat','mat','len'],Overalls:['mat'],
  Dresses:['pat','mat','len','neck'],Jumpsuits:['pat','mat'],Jackets:['mat','jacket','crop'],Coats:['coat'],Blazers:['pat','mat'],Vests:['vest'],Footwear:['mat','foot'],
  Heels:['heels'],Bags:['mat','bag'],Belts:['mat'],Glasses:['glass'],Hats:['hat'],Jewelry:['jewel'],Activewear:['active']};
async function describe(img,type){
  const noun=SINGULAR[type]||type.toLowerCase();let word=noun;const parts=[];
  for(const k of DETAILS[type]||[]){
    const a=A[k],T=await clipText(k+'|'+noun,a.p.map(x=>x.replace('{t}',noun))),p=clipProbs(img,T);
    const best=p.indexOf(Math.max(...p));
    if(a.word){if(p[best]>=.3)word=a.w[best];continue}
    if(a.base!==null&&a.base!==undefined){if(best!==a.base&&p[best]>=.5)parts.push(a.w[best])}
    else if(p[best]>=.4)parts.push(a.w[best]);
  }
  const pat=parts.filter(w=>A.pat.w.includes(w)),rest=parts.filter(w=>!A.pat.w.includes(w)&&!word.includes(w));
  return{word,details:[...pat,...rest].slice(0,3)};
}

// Main colour, robust to soft shading: exposure is corrected from the brightest part of the item, and mostly colourless
// items are judged white / grey / black from their overall brightness (so a shaded white top stays white).
async function detectColour(blob,cutout){
  const im=await loadImage(URL.createObjectURL(blob));const n=96,c=document.createElement('canvas');c.width=n;c.height=n;const g=c.getContext('2d');
  g.drawImage(im,0,0,n,n);URL.revokeObjectURL(im.src);const d=g.getImageData(0,0,n,n).data;
  const px=[];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(!cutout&&(x<n*.28||x>n*.72||y<n*.22||y>n*.78))continue;
    const i=(y*n+x)*4;if(d[i+3]<200)continue;px.push([d[i],d[i+1],d[i+2]]);
  }
  if(!px.length)return null;
  const lum=([r,g2,b])=>.299*r+.587*g2+.114*b;
  const sorted=px.map(lum).sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||1;
  const gain=p95>=150?clamp(242/p95,1,1.3):1; // only brighten light items that look underexposed
  const adj=px.map(([r,g2,b])=>[Math.min(255,r*gain),Math.min(255,g2*gain),Math.min(255,b*gain)]);
  const sat=([r,g2,b])=>{const mx=Math.max(r,g2,b)/255,mn=Math.min(r,g2,b)/255,l=(mx+mn)/2;return mx===mn?0:(mx-mn)/(1-Math.abs(2*l-1))};
  const neutral=adj.filter(p=>sat(p)<.15||(lum(p)>200&&sat(p)<.28)||lum(p)<25);
  // bins on the exposure-corrected pixels (for chromatic items and secondary colours)
  const bins=new Map();
  for(const[r,g2,b]of adj){const k=(r>>5)<<6|(g2>>5)<<3|(b>>5);const e=bins.get(k)||{n:0,r:0,g:0,b:0};e.n++;e.r+=r;e.g+=g2;e.b+=b;bins.set(k,e)}
  const names=new Map();let total=0;
  for(const b of bins.values()){const nm=rgbToName(b.r/b.n,b.g/b.n,b.b/b.n);const e=names.get(nm)||{n:0,top:null};e.n+=b.n;if(!e.top||b.n>e.top.n)e.top=b;names.set(nm,e);total+=b.n}
  if(neutral.length/adj.length>=.6){
    const ls=neutral.map(lum).sort((a,b)=>a-b),med=ls[Math.floor(ls.length/2)]/255;
    const name=med>.78?'white':med<.24?'black':'grey';
    const near=neutral.filter(p=>Math.abs(lum(p)/255-med)<.06),avg=[0,1,2].map(k=>near.reduce((s,p)=>s+p[k],0)/Math.max(1,near.length));
    const secondary=[...names.entries()].filter(([nm,e])=>!['white','grey','black'].includes(nm)&&e.n/total>=.15).sort((a,b)=>b[1].n-a[1].n).slice(0,2).map(([nm])=>nm);
    return{name,hex:rgbToHex(...avg),secondary};
  }
  const ranked=[...names.entries()].sort((a,b)=>b[1].n-a[1].n);
  const[mainName,m]=ranked[0];
  return{name:mainName,hex:rgbToHex(m.top.r/m.top.n,m.top.g/m.top.n,m.top.b/m.top.n),secondary:ranked.slice(1).filter(([,e])=>e.n/total>=.15).slice(0,2).map(([nm])=>nm)};
}
// colour word for titles: plain name, with light/dark where it helps (light blue, dark green, light grey)
function colourWord(col){
  if(!col)return '';const[r,g,b]=hexToRgb(col.hex||GEN_HEX[col.name]||'#808080');const l=(Math.max(r,g,b)+Math.min(r,g,b))/510;
  if(['white','black','navy','maroon','brown','beige'].includes(col.name))return col.name;
  if(col.name==='grey')return l>.68?'light grey':l<.36?'dark grey':'grey';
  return l>.72?'light '+col.name:l<.28?'dark '+col.name:col.name;
}
async function autoDetect(blob,cutout,status){
  const img=await embedImage(blob,status);
  const type=await detectType(blob,status,img);
  const col=await detectColour(blob,cutout).catch(()=>null);
  let det={word:SINGULAR[type]||type.toLowerCase(),details:[]};try{det=await describe(img,type)}catch(e){console.warn('describe',e)}
  const words=[colourWord(col),...det.details,det.word].filter(Boolean).join(' ');
  const name=words[0].toUpperCase()+words.slice(1);
  return{type,group:GROUP_OF[type]||'Other',colour:col?.name||'',colourHex:col?.hex||null,colours2:col?.secondary||[],name,emb:img};
}

/* ---------- GitHub sync ---------- */
const GH={
  cfg(){try{const c=JSON.parse(ls.get('closet.gh')||'null');return c&&c.repo&&c.token?c:null}catch(e){return null}},
  async req(path,opt={},cfg=GH.cfg()){
    const r=await fetch(`https://api.github.com/repos/${cfg.repo}${path?'/'+path:''}`,{method:opt.method||'GET',body:opt.body,cache:'no-store',
      headers:{Authorization:`Bearer ${cfg.token}`,Accept:opt.accept||'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(opt.body?{'Content-Type':'application/json'}:{})}});
    if(!r.ok&&!(opt.ok404&&r.status===404)){const e=new Error('GitHub '+r.status);e.status=r.status;throw e}
    return r;
  }
};
const b64FromBytes=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)};
const b64ToBytes=b=>Uint8Array.from(atob(b.replace(/\s/g,'')),c=>c.charCodeAt(0));
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v??null);
const pick=o=>({closets:o?.closets||{},items:o?.items||{},outfits:o?.outfits||{},plans:o?.plans||{},looks:o?.looks||{},prefs:o?.prefs||{},deleted:o?.deleted||{}});
const localDoc=()=>({closets:Object.fromEntries(S.closets),items:Object.fromEntries(S.items),outfits:Object.fromEntries(S.outfits),plans:Object.fromEntries(S.plans),looks:Object.fromEntries(S.looks),prefs:Object.fromEntries(S.prefs),deleted:Object.fromEntries(S.deleted)});
function merge(a,b){
  const out={deleted:{...b.deleted}};
  for(const[k,t]of Object.entries(a.deleted))if(!(out.deleted[k]>=t))out.deleted[k]=t;
  for(const col of COLS){
    out[col]={};
    for(const k of new Set([...Object.keys(a[col]),...Object.keys(b[col])])){
      const x=a[col][k],y=b[col][k],d=!x?y:!y?x:((x.updatedAt||0)>=(y.updatedAt||0)?x:y);
      const del=out.deleted[`${col}/${k}`];if(del&&del>=(d.updatedAt||0))continue;
      out[col][k]=d;
    }
  }
  return out;
}
async function applyLocal(m){
  await idbTx([...COLS,'meta'],'readwrite',t=>{for(const col of COLS){const st=t.objectStore(col);st.clear();for(const[k,v]of Object.entries(m[col]))st.put(v,k)}t.objectStore('meta').put(m.deleted,'deleted')});
  for(const col of COLS)S[col]=new Map(Object.entries(m[col]));
  S.deleted=new Map(Object.entries(m.deleted));
  const want=new Set([...wantedImages(S.items.values()),...lookImages(S.looks.values())]);
  for(const id of[...URLS.keys()])if(!want.has(id))await dropImage(id);
}
async function putFile(path,body){
  for(let i=0;;i++){try{return await GH.req('contents/'+path,{method:'PUT',body:JSON.stringify(body)})}catch(e){if(i<2&&e.status===409){await new Promise(r=>setTimeout(r,800*(i+1)));continue}throw e}}
}
// Header badge: a cloud with a mark for the state, plus a short label (last sync time, Waiting, Syncing…).
const SYNC_MARK={ok:'<path d="M9.6 13.6l1.8 1.8 3.2-3.4"/>',pending:'<path d="M12 16.2v-5M9.9 13.1l2.1-2.1 2.1 2.1"/>',busy:'<path d="M12 16.2v-5M9.9 13.1l2.1-2.1 2.1 2.1"/>',
  err:'<path d="M12 11v2.6M12 15.9v.1"/>',off:'<path d="M4 4l16 16"/>'};
function syncAgo(t){const m=Math.round((Date.now()-t)/60000);if(m<1)return 'now';if(m<60)return m+'m ago';const h=Math.round(m/60);if(h<24)return h+'h ago';
  return new Date(t).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}
function paintSync(){
  const b=$('#syncBtn');if(!b)return;
  const st=GH.cfg()?S.sync.state:'off',t=Number(ls.get('closet.lastSync'));
  const label={ok:t?syncAgo(t):'Not synced',pending:'Waiting',busy:'Syncing…',err:navigator.onLine?'Error':'Offline',off:'Back up'}[st]||'';
  b.className='syncpill '+st;
  b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 18.5h9.6a4.2 4.2 0 0 0 .6-8.36A5.9 5.9 0 0 0 6.2 9.4a4.6 4.6 0 0 0 1 9.1z"/>${SYNC_MARK[st]||''}</svg><span>${label}</span>`;
  b.setAttribute('aria-label','GitHub sync: '+syncText());
}
function setSync(state,msg=''){S.sync={state,msg};paintSync();const s=$('#syncStatus');if(s)s.textContent=syncText()}
setInterval(paintSync,30000);
function syncText(){
  if(!GH.cfg())return 'Not connected. Your closet is only saved on this device.';
  if(S.sync.state==='busy')return 'Syncing…';
  if(S.sync.state==='pending')return 'You have changes waiting to upload. They sync in a few seconds.';
  if(S.sync.state==='err')return S.sync.msg;
  const t=Number(ls.get('closet.lastSync'));
  return t?`Synced ${new Date(t).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`:'Connected. Not synced yet.';
}
function syncError(e){
  if(!navigator.onLine||e instanceof TypeError)return 'Offline. Changes will sync when you’re back online.';
  if(e.status===401)return 'GitHub rejected the token. It may have expired. Create a new one and reconnect.';
  if(e.status===403)return 'The token can’t write to this repo. Give it “Contents: Read and write” access.';
  if(e.status===404)return 'Can’t find the repo, or the token doesn’t have access to it.';
  return 'Sync failed ('+(e.status||e.message)+'). It will try again on your next change.';
}
const extOf=t=>t==='image/png'?'png':'jpg';
let syncing=null,syncAgain=false,syncTimer=null;
function scheduleSync(delay=2500){if(!GH.cfg())return;if(S.sync.state!=='busy')setSync('pending');clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(),delay)}
function sync(){
  if(!GH.cfg()||!S.ready)return Promise.resolve();
  if(syncing){syncAgain=true;return syncing}
  syncing=(async()=>{
    setSync('busy');
    try{
      for(let attempt=0;attempt<3;attempt++){
        const r=await GH.req('contents/closet.json',{ok404:true});
        let remote0=pick(null),sha=null;
        if(r.status!==404){
          const j=await r.json();sha=j.sha;
          const txt=j.content?new TextDecoder().decode(b64ToBytes(j.content)):await(await GH.req('contents/closet.json',{accept:'application/vnd.github.raw'})).text();
          remote0=pick(JSON.parse(txt));
        }
        const merged=merge(localDoc(),remote0);
        if(stable(merged)!==stable(localDoc()))await applyLocal(merged);
        const folders=[['images',wantedImages(Object.values(merged.items))],['looks',lookImages(Object.values(merged.looks||{}))]],remote={};
        for(const[dir,want]of folders){
          const lr=await GH.req('contents/'+dir,{ok404:true});const m=new Map();
          if(lr.status!==404)for(const f of await lr.json())if(f.type==='file')m.set(f.name.replace(/\.\w+$/,''),{sha:f.sha,name:f.name});
          remote[dir]=m;
          for(const id of want)if(!m.has(id)){
            const b=await idbGet('images',id);if(!b)continue;
            const name=`${id}.${extOf(b.type)}`;
            await putFile(`${dir}/${name}`,{message:dir==='looks'?'Add look':'Add photo',content:b64FromBytes(new Uint8Array(await b.arrayBuffer()))});m.set(id,{sha:null,name});
          }
        }
        if(stable(merged)!==stable(remote0)){
          try{await putFile('closet.json',{message:'Update closet',content:b64FromBytes(new TextEncoder().encode(JSON.stringify({app:'my-closet',version:3,savedAt:new Date().toISOString(),...merged},null,1))),...(sha?{sha}:{})})}
          catch(e){if(e.status===409||e.status===422)continue;throw e}
        }
        for(const[dir,want]of folders){
          const m=remote[dir],need=[...want].filter(id=>!URLS.has(id)&&m.has(id));
          for(let k=0;k<need.length;k++){
            const id=need[k],f=m.get(id);
            if(need.length>3){S.notice=`Downloading ${dir==='looks'?'looks':'photos'} from your backup (${k+1} of ${need.length})…`;if(k%5===0)render()}
            const b=await(await GH.req(`contents/${dir}/${f.name}`,{accept:'application/vnd.github.raw'})).blob();
            const blob=new Blob([b],{type:f.name.endsWith('.png')?'image/png':'image/jpeg'});
            await idbPut('images',id,blob);URLS.set(id,URL.createObjectURL(blob));
          }
          if(need.length>3&&S.notice.startsWith('Downloading'))S.notice='';
          for(const[id,f]of m)if(!want.has(id)&&f.sha)await GH.req(`contents/${dir}/${f.name}`,{method:'DELETE',body:JSON.stringify({message:'Remove photo',sha:f.sha})}).catch(()=>{});
        }
        ls.set('closet.lastSync',String(Date.now()));setSync('ok');render();
        return;
      }
      throw Object.assign(new Error('conflict'),{status:'repo busy'});
    }catch(e){console.warn(e);setSync('err',syncError(e))}
    finally{syncing=null;if(syncAgain){syncAgain=false;scheduleSync(500)}}
  })();
  return syncing;
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-Number(ls.get('closet.lastSync')||0)>60000)scheduleSync(300)});
addEventListener('online',()=>scheduleSync(300));

/* ---------- wear history: past & today count as worn, future = planned ---------- */
function wear(){
  const t=today(),items={},outfits={};
  const add=(map,id,date)=>{const r=map[id]??={worn:[],next:null};if(date<=t)r.worn.push(date);else if(!r.next||date<r.next)r.next=date};
  for(const[date,p]of S.plans){for(const id of p.itemIds||[])add(items,id,date);if(p.outfitId)add(outfits,p.outfitId,date)}
  for(const r of[...Object.values(items),...Object.values(outfits)])r.worn.sort();
  return{items,outfits};
}
const last=r=>r?.worn?.length?r.worn[r.worn.length-1]:null;

/* ---------- outfit board (canvas) ---------- */
// default box per group: [x%, y%, width%, height%] of the 3:4 board
const SLOT={Jackets:[2,6,40,46],Undergarments:[22,2,56,34],Tops:[22,2,56,34],'Full length':[20,2,60,72],Bottoms:[26,35,48,42],Shoes:[30,78,40,19],Bags:[66,42,32,28],Accessories:[72,2,26,18],Other:[2,58,30,28]};
const LAYER=['Jackets','Bottoms','Full length','Tops','Shoes','Bags','Accessories','Other'];
function autoLayout(ids,prev={}){
  const out={},count={};
  let z=Math.max(0,...Object.values(prev).map(p=>p.z||0));
  const slotG=i=>{const t=typeOf(i);return t==='Bags'?'Bags':SHOE_T.includes(t)?'Shoes':UNDER_T.includes(t)?'Undergarments':groupOf(i)};
  const list=ids.filter(id=>S.items.has(id)).sort((a,b)=>LAYER.indexOf(slotG(S.items.get(a)))-LAYER.indexOf(slotG(S.items.get(b))));
  for(const id of list){
    const g=slotG(S.items.get(id));count[g]=(count[g]||0)+1;
    if(prev[id]){out[id]={...prev[id],h:prev[id].h||prev[id].w};continue}
    const[x,y,w,h]=SLOT[g]||SLOT.Other,n=count[g]-1;
    out[id]={x:clamp(x+n*8,-5,100-w/2),y:clamp(y+n*6,0,90),w,h,z:++z};
  }
  return out;
}
function boardInner(L){
  return Object.entries(L).map(([id,p])=>{const it=S.items.get(id);if(!it)return '';
    return `<div class="pc${it.cutout&&hasImg(it)?' cut':''}${hasImg(it)?'':' noimg'}" data-pc="${id}" style="left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h||p.w}%;z-index:${p.z}">${hasImg(it)?img(it.imageId):`<span>${esc(it.name)}</span>`}</div>`}).join('');
}
function boardHTML(ids,layout,cls=''){
  const L=autoLayout(ids,layout||{});
  return `<div class="board ${cls}">${Object.keys(L).length?boardInner(L):'<span class="ini muted" style="position:absolute;inset:0;display:grid;place-items:center">—</span>'}</div>`;
}
function wireBoard(board,getLayout,onChange,onRemove){
  let sel=null;
  const tools=board.parentElement.querySelector('.btools');
  const mark=()=>{board.querySelectorAll('[data-pc]').forEach(p=>p.classList.toggle('sel',p.dataset.pc===sel));if(tools)tools.hidden=!sel};
  const redraw=()=>{board.innerHTML=boardInner(getLayout());mark()};
  board.addEventListener('pointerdown',e=>{
    const pc=e.target.closest('[data-pc]');sel=pc?pc.dataset.pc:null;mark();if(!pc)return;
    e.preventDefault();const L=getLayout(),p=L[sel],r=board.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,ox=p.x,oy=p.y;
    try{pc.setPointerCapture(e.pointerId)}catch(_){}
    const mv=ev=>{p.x=clamp(ox+(ev.clientX-sx)/r.width*100,-p.w/2,100-p.w/2);p.y=clamp(oy+(ev.clientY-sy)/r.height*100,-p.h/2,100-p.h/2);pc.style.left=p.x+'%';pc.style.top=p.y+'%'};
    const up=()=>{pc.removeEventListener('pointermove',mv);pc.removeEventListener('pointerup',up);pc.removeEventListener('pointercancel',up);onChange()};
    pc.addEventListener('pointermove',mv);pc.addEventListener('pointerup',up);pc.addEventListener('pointercancel',up);
  });
  tools?.addEventListener('click',e=>{
    const b=e.target.closest('[data-bt]');if(!b||!sel)return;const L=getLayout(),p=L[sel];if(!p)return;
    const zs=Object.values(L).map(q=>q.z||0);
    const scale=f=>{const nw=clamp(p.w*f,8,120);const k=nw/p.w;p.x+=(p.w-nw)/2;p.y+=(p.h-p.h*k)/2;p.w=nw;p.h=p.h*k};
    ({smaller:()=>scale(.87),bigger:()=>scale(1.15),front:()=>{p.z=Math.max(...zs)+1},back:()=>{Object.values(L).forEach(q=>q.z=(q.z||0)+1);p.z=Math.min(...zs)},
      remove:()=>{const id=sel;sel=null;onRemove(id)}})[b.dataset.bt]();
    redraw();onChange();
  });
  return{redraw,deselect(){sel=null;mark()}};
}
const boardTools=`<div class="btools" hidden><button type="button" data-bt="smaller" aria-label="Make smaller">−</button><button type="button" data-bt="bigger" aria-label="Make bigger">+</button><button type="button" data-bt="front">Front</button><button type="button" data-bt="back">Back</button><button type="button" data-bt="remove">Remove</button></div>`;

/* ---------- views ---------- */
function render(){
  document.querySelectorAll('nav.tabs button').forEach(b=>b.dataset.tab===S.view?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  const fab={closet:'+ Add piece',outfits:'+ New outfit',calendar:'+ Plan a day'}[S.view];
  $('#fab').textContent=fab||'';$('#fab').hidden=!S.ready||!fab;
  if(S.closet!=='all'&&!S.closets.has(S.closet))S.closet='all';
  const its=[...S.items.values()].filter(i=>inCloset(i,S.closet));
  const total=its.reduce((a,i)=>a+(Number(i.price)||0),0);
  {const h=$('header.top h1'),many=S.closets.size>1,nm=S.closet==='all'?'All closets':closetName(S.closet);
   h.innerHTML=`<button type="button" id="closetTitle" class="ctitle" aria-haspopup="dialog" aria-label="${esc(nm)}. Switch or edit closets"><span>${esc(nm)}</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`;
   document.title=nm==='My Closet'?'My Closet':nm+' · My Closet'}
  $('#sub').innerHTML=`${its.length} piece${its.length===1?'':'s'}${total?`<span class="subp"> · ${esc(money(total))}</span>`:''}`;
  let notice=S.notice?`<div class="notice" role="status">${esc(S.notice)}</div>`:'';
  if(!notice&&S.ready&&!GH.cfg()&&S.items.size)notice=`<div class="notice">Your closet is only saved on this device. <button type="button" data-open-sync>Back it up to GitHub</button></div>`;
  const y=window.scrollY;
  $('#view').innerHTML=notice+({closet:closetView,outfits:outfitsView,looks:looksView,shuffle:shuffleView,calendar:calendarView,stats:statsView}[S.view]||closetView)();
  if(S.view==='shuffle')wireShuffle();
  const cats=$('.cats'),selCat=cats?.querySelector('[aria-pressed="true"]');
  if(cats&&selCat&&S.group!=='All')cats.scrollLeft=Math.max(0,selCat.offsetLeft-cats.clientWidth/2+selCat.offsetWidth/2);
  scrollTo(0,y);
}
function closetChips(cur,attr,extra=''){
  const counts={};for(const it of S.items.values()){const c=closetOf(it);counts[c]=(counts[c]||0)+1}
  const list=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  return `<div class="chips closets" role="group" aria-label="Closet">${list.length>1?`<button class="chip" type="button" ${attr}="all" aria-pressed="${cur==='all'}">All closets <small>${S.items.size}</small></button>`:''}${list.map(([id,c])=>`<button class="chip" type="button" ${attr}="${id}" aria-pressed="${cur===id||list.length===1}">${esc(c.name)} <small>${counts[id]||0}</small></button>`).join('')}${extra}</div>`;
}
function closetView(){
  if(!S.ready)return '';
  const untagged=[...S.items.values()].filter(i=>inCloset(i,S.closet)&&!isTagged(i)).length,sortDue=needsSortCheck();
  const top=`<div class="actpair${untagged||sortDue?'':' one'}"><button class="bulkbtn" type="button" id="bulkBtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11M8 16l3-3 2 2 2-2"/></svg>Upload items</button>`
    +(untagged||sortDue?`<button class="bulkbtn" type="button" id="qtBtn" aria-label="Organize${untagged?`: ${untagged} piece${untagged===1?'':'s'} need seasons and dressiness`:''}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>Organize${untagged?' '+untagged:''}</button>`:'')+`</div>`
    ;
  const all=[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet));
  if(!all.length)return top+empty(S.items.size?`${esc(closetName(S.closet))} is empty`:'Your closet is empty','Add your first piece with a photo, price, type, colour and style. Tap “+ Add piece” below.');
  return top+`
    <div class="cats cgrid" role="group" aria-label="Category">${groupRow(all)}</div>
    <div id="subcats">${subcatsHTML(all)}</div>
    <input class="search" id="q" type="search" placeholder="Search your closet" autocomplete="off" autocorrect="off" spellcheck="false" value="${esc(S.q)}" aria-label="Search closet">
    <div id="fsbar">${fsBarHTML()}</div><div id="results">${closetResults()}</div>`;
}
const closetItems=()=>[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet));
function groupRow(all){
  const cnt={};for(const[,i]of all){const g=groupOf(i);cnt[g]=(cnt[g]||0)+1}
  const show=[...MAIN_GROUPS.filter(g=>cnt[g]),...GROUPS.map(g=>g[0]).filter(g=>!MAIN_GROUPS.includes(g)&&cnt[g]),...Object.keys(cnt).filter(g=>!GROUP_OF_GROUP(g))];
  if(S.group!=='All'&&!show.includes(S.group))S.group='All';
  return catBtn('All','All',all.length,'group')+show.map(g=>catBtn(g,g,cnt[g]||0,'group')).join('');
}
const GROUP_OF_GROUP=g=>GROUPS.some(x=>x[0]===g);
function subcatsHTML(all){
  if(S.group==='All')return '';
  const cnt={};for(const[,i]of all)if(groupOf(i)===S.group){const t=typeOf(i);cnt[t]=(cnt[t]||0)+1}
  const known=(GROUPS.find(g=>g[0]===S.group)||[0,[]])[1],types=[...known,...Object.keys(cnt).filter(t=>!known.includes(t))].filter(t=>cnt[t]);
  if(S.type!=='All'&&!types.includes(S.type))S.type='All';
  const n=Object.values(cnt).reduce((a,b)=>a+b,0);
  // small icon buttons for the types in this category (all shown, no sideways scrolling)
  const sub=(val,label,count,icon)=>`<button class="cat" type="button" data-type="${esc(val)}" aria-pressed="${S.type===val}" aria-label="${esc(label)}, ${count}"><span class="cic">${icon}<span class="cn">${count}</span></span><span class="cl">${esc(label)}</span></button>`;
  return `<div class="cats subgrid" role="group" aria-label="${esc(S.group)} types">${sub('All','All '+S.group.toLowerCase(),n,groupIcon(S.group))}${types.map(t=>sub(t,t,cnt[t]||0,typeIcon(t))).join('')}</div>`;
}
// --- Filter & sort ---
const SORTS=[['new','Newest first'],['old','Oldest first'],['name','Name A–Z'],['priceHi','Price: high to low'],['priceLo','Price: low to high'],['most','Most worn'],['least','Least worn'],
  ['longest','Not worn in longest'],['dressHi','Dressiest first'],['dressLo','Most casual first'],['colour','Colour']];
const DRESS_FILTERS=[['casual','Casual (1–4)',1,4],['everyday','Everyday (3–7)',3,7],['dressy','Dressy (6–9)',6,9],['formal','Formal (8–10)',8,10]];
const WORN_FILTERS=[['never','Never worn'],['stale','Not worn in 3 months'],['recent','Worn in the last month'],['leaving','Marked to let go']];
function fPass(id,i,f=S.f,W=wear().items){
  if(f.colours.length&&!itemColours(i).some(c=>f.colours.includes(c)))return false;
  if(f.seasons.length&&!f.seasons.some(s=>fitsSeason(i,s)))return false;
  if(f.dress){const r=DRESS_FILTERS.find(x=>x[0]===f.dress),d=dressOf(i);if(r&&(d<r[2]||d>r[3]))return false}
  if(f.styles.length&&!f.styles.includes(styleOf(i)))return false;
  if(f.worn){const l=last(W[id]);
    if(f.worn==='never'&&l)return false;if(f.worn==='stale'&&l&&daysAgo(l)<90)return false;if(f.worn==='recent'&&!(l&&daysAgo(l)<=31))return false;if(f.worn==='leaving'&&!i.fate)return false}
  return true;
}
const fCount=(f=S.f)=>f.colours.length+f.seasons.length+(f.dress?1:0)+f.styles.length+(f.worn?1:0);
function fsBarHTML(){
  const f=S.f,chips=[...f.colours.map(c=>['colours',c,c]),...f.seasons.map(c=>['seasons',c,(SEASONS.find(x=>x[0]===c)||[])[1]]),...(f.dress?[['dress',f.dress,(DRESS_FILTERS.find(x=>x[0]===f.dress)||[])[1]]]:[]),
    ...f.styles.map(c=>['styles',c,c]),...(f.worn?[['worn',f.worn,(WORN_FILTERS.find(x=>x[0]===f.worn)||[])[1]]]:[])];
  return `<div class="fsrow"><button class="btn sm" type="button" id="fsBtn"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filter &amp; sort${chips.length?` · ${chips.length}`:''}</button>
    <span class="muted fssort">${esc((SORTS.find(x=>x[0]===S.sort)||SORTS[0])[1])}</span></div>
    ${chips.length?`<div class="chips fchips">${chips.map(([k,v,l])=>`<button class="chip" type="button" data-fx="${k}:${esc(v)}" aria-label="Remove ${esc(l)}">${esc(l)} ✕</button>`).join('')}<button class="chip ghost" type="button" data-fx="all">Clear</button></div>`:''}`;
}
function filterSheet(){
  const all=closetItems(),f=JSON.parse(JSON.stringify(S.f));let sort=S.sort||'new';
  const order=GENERIC.map(g=>g[0]),colours=[...new Set(all.flatMap(([,i])=>itemColours(i)))].sort((a,b)=>((order.indexOf(a)+1)||99)-((order.indexOf(b)+1)||99)||a.localeCompare(b));
  const styles=DRESS_WORDS.filter(w=>w&&all.some(([,i])=>styleOf(i)===w));
  const chip=(k,v,l,on,sw)=>`<button class="chip" type="button" data-fk="${k}" data-fv="${esc(v)}" aria-pressed="${on}">${sw?`<span class="sw" style="background:${sw}"></span>`:''}${esc(l)}</button>`;
  const sh=openSheet(`${head('Filter &amp; sort')}
    <div class="field"><span class="lbl">Sort by</span><div class="chips wrap">${SORTS.map(([k,l])=>`<button class="chip" type="button" data-sort="${k}" aria-pressed="${sort===k}">${l}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Colour</span><div class="chips wrap">${colours.map(c=>chip('colours',c,c,f.colours.includes(c),GEN_HEX[c]||okColour(c))).join('')||'<small class="muted">No colours yet</small>'}</div></div>
    <div class="field"><span class="lbl">Season</span><div class="chips wrap">${SEASONS.map(([k,l])=>chip('seasons',k,l,f.seasons.includes(k))).join('')}</div></div>
    <div class="field"><span class="lbl">How dressy</span><div class="chips wrap">${DRESS_FILTERS.map(([k,l])=>chip('dress',k,l,f.dress===k)).join('')}</div></div>
    ${styles.length?`<div class="field"><span class="lbl">Style</span><div class="chips wrap">${styles.map(c=>chip('styles',c,c,f.styles.includes(c))).join('')}</div></div>`:''}
    <div class="field"><span class="lbl">Wear</span><div class="chips wrap">${WORN_FILTERS.map(([k,l])=>chip('worn',k,l,f.worn===k)).join('')}</div></div>
    <div class="btns"><button class="btn primary" type="button" id="fsApply"></button><button class="btn" type="button" id="fsClear">Clear all</button></div>`);
  const W=wear().items;
  const upd=()=>{const n=all.filter(([id,i])=>(S.group==='All'||groupOf(i)===S.group)&&(S.type==='All'||typeOf(i)===S.type)&&fPass(id,i,f,W)).length;sh.querySelector('#fsApply').textContent=`Show ${n} piece${n===1?'':'s'}`;
    sh.querySelectorAll('[data-fk]').forEach(b=>{const k=b.dataset.fk,v=b.dataset.fv;b.setAttribute('aria-pressed',Array.isArray(f[k])?f[k].includes(v):f[k]===v)});
    sh.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sort===sort))};
  sh.addEventListener('click',e=>{
    const c=e.target.closest('[data-fk]');if(c){const k=c.dataset.fk,v=c.dataset.fv;if(Array.isArray(f[k]))f[k]=f[k].includes(v)?f[k].filter(x=>x!==v):[...f[k],v];else f[k]=f[k]===v?'':v;upd();return}
    const so=e.target.closest('[data-sort]');if(so){sort=so.dataset.sort;upd();return}
    if(e.target.closest('#fsClear')){f.colours=[];f.seasons=[];f.dress='';f.styles=[];f.worn='';sort='new';upd();return}
    if(e.target.closest('#fsApply')){S.f=f;S.sort=sort;closeSheet();refreshCloset();scrollTo(0,0)}
  });
  upd();
}
function refreshCloset(){const all=closetItems(),c=$('.cats'),sc=$('#subcats'),fb=$('#fsbar'),r=$('#results');
  if(!r||S.view!=='closet'){render();return}
  c.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.group===S.group));sc.innerHTML=subcatsHTML(all);fb.innerHTML=fsBarHTML();r.innerHTML=closetResults()}

/* Type picker icons: Flaticon icons (free with attribution; authors credited in the Stats tab and README),
   redrawn at one uniform line width. */
const ICON={
  all:'<img class="ico" src="icons/all.png" alt="" draggable="false">',
  activewear:'<img class="ico" src="icons/activewear.png" alt="" draggable="false">',
  bags:'<img class="ico" src="icons/bags.png" alt="" draggable="false">',
  belts:'<img class="ico" src="icons/belts.png" alt="" draggable="false">',
  blazers:'<img class="ico" src="icons/blazers.png" alt="" draggable="false">',
  bodysuits:'<img class="ico" src="icons/bodysuits.png" alt="" draggable="false">',
  cardigans:'<img class="ico" src="icons/cardigans.png" alt="" draggable="false">',
  coats:'<img class="ico" src="icons/coats.png" alt="" draggable="false">',
  dresses:'<img class="ico" src="icons/dresses.png" alt="" draggable="false">',
  footwear:'<img class="ico" src="icons/footwear.png" alt="" draggable="false">',
  heels:'<img class="ico" src="icons/heels.png" alt="" draggable="false">',
  glasses:'<img class="ico" src="icons/glasses.png" alt="" draggable="false">',
  hats:'<img class="ico" src="icons/hats.png" alt="" draggable="false">',
  jackets:'<img class="ico" src="icons/jackets.png" alt="" draggable="false">',
  jeans:'<img class="ico" src="icons/jeans.png" alt="" draggable="false">',
  jewelry:'<img class="ico" src="icons/jewelry.png" alt="" draggable="false">',
  jumpsuits:'<img class="ico" src="icons/jumpsuits.png" alt="" draggable="false">',
  overalls:'<img class="ico" src="icons/overalls.png" alt="" draggable="false">',
  pants:'<img class="ico" src="icons/pants.png" alt="" draggable="false">',
  shorts:'<img class="ico" src="icons/shorts.png" alt="" draggable="false">',
  skirts:'<img class="ico" src="icons/skirts.png" alt="" draggable="false">',
  sweaters:'<img class="ico" src="icons/sweaters.png" alt="" draggable="false">',
  hoodies:'<img class="ico" src="icons/hoodies.png" alt="" draggable="false">',
  tops:'<img class="ico" src="icons/tops.png" alt="" draggable="false">',
  shortsleeves:'<img class="ico" src="icons/shortsleeves.png" alt="" draggable="false">',
  longsleeves:'<img class="ico" src="icons/longsleeves.png" alt="" draggable="false">',
  crewnecks:'<img class="ico" src="icons/crewnecks.png" alt="" draggable="false">',
  leggings:'<img class="ico" src="icons/leggings.png" alt="" draggable="false">',
  rompers:'<img class="ico" src="icons/rompers.png" alt="" draggable="false">',
  bras:'<img class="ico" src="icons/bras.png" alt="" draggable="false">',
  underwear:'<img class="ico" src="icons/underwear.png" alt="" draggable="false">',
  tights:'<img class="ico" src="icons/tights.png" alt="" draggable="false">',
  hair:'<img class="ico" src="icons/hair.png" alt="" draggable="false">',
  grp_tops:'<img class="ico" src="icons/grp_tops.png" alt="" draggable="false">',
  grp_bottoms:'<img class="ico" src="icons/grp_bottoms.png" alt="" draggable="false">',
  grp_fulllength:'<img class="ico" src="icons/grp_fulllength.png" alt="" draggable="false">',
  tanktops:'<img class="ico" src="icons/tanktops.png" alt="" draggable="false">',
  vests:'<img class="ico" src="icons/vests.png" alt="" draggable="false">',
  other:'<img class="ico" src="icons/other.png" alt="" draggable="false">'};
const TYPE_ICON={'Activewear':'activewear','Bags':'bags','Belts':'belts','Blazers':'blazers','Bodysuits':'bodysuits','Cardigans':'cardigans','Coats':'coats',
  'Dresses':'dresses','Footwear':'footwear','Heels':'heels','Glasses':'glasses','Hats':'hats','Jackets':'jackets','Jeans':'jeans','Jewelry':'jewelry','Jumpsuits':'jumpsuits',
  'Overalls':'overalls','Pants':'pants','Shorts':'shorts','Skirts':'skirts','Sweaters':'sweaters','Hoodies':'hoodies','Hair accessories':'hair','Blouses':'tops','Leggings':'leggings','Rompers':'rompers','Bras':'bras','Underwear':'underwear','Tights':'tights','Short sleeves':'shortsleeves','Long sleeves':'longsleeves','Crewnecks':'crewnecks','Tank tops':'tanktops','Vests':'vests','Other':'other'};
const GROUP_ICON={Tops:'grp_tops',Bottoms:'grp_bottoms','Full length':'grp_fulllength',Jackets:'jackets',Shoes:'heels',Accessories:'hats',Other:'other'};
function groupIcon(g){if(g==='All')return ICON.all;return ICON[GROUP_ICON[g]||'other']}
function typeIcon(t){
  if(t==='All')return ICON.all;
  if(TYPE_ICON[t])return ICON[TYPE_ICON[t]];
  const g=[...S.items.values()].find(i=>i.type===t)?.group;return ICON[GROUP_ICON[g]||'other'];
}
function catBtn(val,label,count,kind='type'){
  const on=kind==='group'?S.group===val:S.type===val;
  return `<button class="cat" type="button" data-${kind}="${esc(val)}" aria-pressed="${on}" aria-label="${esc(label)}, ${count}"><span class="cic">${kind==='group'?groupIcon(val):typeIcon(val)}<span class="cn">${count}</span></span><span class="cl">${esc(label)}</span></button>`;
}

function itemCard(id,i,W){
  const r=W[id],l=last(r),c=swatchOf(i),c2=(i.colours2||[]).map(n=>GEN_HEX[n]||okColour(n)).filter(Boolean);
  return `<button class="card" type="button" data-item="${id}">
    <div class="${phCls(i)}">${thumb(i)}</div>
    ${i.price!==''&&i.price!=null?`<span class="tag">${money(i.price)}</span>`:''}
    <div class="nm">${esc(i.name||'Untitled')}</div>
    <div class="meta">${c?`<span class="sws"><span class="sw" style="background:${c}"></span>${c2.map(x=>`<span class="sw sm" style="background:${x}"></span>`).join('')}</span>`:''}<span>${l?`Worn ${r.worn.length}× · ${ago(l)}`:'Not worn yet'}</span></div>
  </button>`;
}
function closetResults(){
  const W=wear().items,q=S.q.toLowerCase();
  let list=[...S.items.entries()].filter(([id,i])=>inCloset(i,S.closet)&&(S.group==='All'||groupOf(i)===S.group)&&(S.type==='All'||typeOf(i)===S.type)&&fPass(id,i,S.f,W)&&(!q||[i.name,...itemColours(i),styleOf(i),typeOf(i),groupOf(i)].join(' ').toLowerCase().includes(q)));
  const sorters={
    new:(a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0),
    priceHi:(a,b)=>(Number(b[1].price)||0)-(Number(a[1].price)||0),
    least:(a,b)=>(W[a[0]]?.worn.length||0)-(W[b[0]]?.worn.length||0),
    longest:(a,b)=>(last(W[a[0]])||'0000').localeCompare(last(W[b[0]])||'0000'),
    name:(a,b)=>(a[1].name||'').localeCompare(b[1].name||''),
    old:(a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0),
    priceLo:(a,b)=>(Number(a[1].price)||Infinity)-(Number(b[1].price)||Infinity),
    most:(a,b)=>(W[b[0]]?.worn.length||0)-(W[a[0]]?.worn.length||0),
    dressHi:(a,b)=>dressOf(b[1])-dressOf(a[1]),dressLo:(a,b)=>dressOf(a[1])-dressOf(b[1]),
    colour:(a,b)=>{const o=GENERIC.map(g=>g[0]);return((o.indexOf(genericName(a[1].colour))+1)||99)-((o.indexOf(genericName(b[1].colour))+1)||99)}};
  list.sort(sorters[S.sort]||sorters.new);
  if(!list.length)return `<p class="muted">Nothing matches those filters.</p>`;
  return `<div class="grid">${list.map(([id,i])=>itemCard(id,i,W)).join('')}</div>`;
}
function empty(h,p){return `<div class="empty"><h2>${h}</h2><p>${p}</p></div>`}

function outfitsView(){
  if(!S.ready)return '';
  const W=wear().outfits;
  const list=[...S.outfits.entries()].sort((a,b)=>(last(W[a[0]])||'0000').localeCompare(last(W[b[0]])||'0000'));
  if(!list.length)return empty('No outfits yet',S.items.size?'Put pieces together on a board, or let Shuffle suggest one.':'Add a few pieces to your closet first, then combine them into outfits.');
  return `<p class="muted" style="margin:0">Sorted by the ones you haven’t worn in the longest.</p><div class="ogrid">${list.map(([id,o])=>{
    const r=W[id],l=last(r);
    const pill=l?(daysAgo(l)>=60?`<span class="pill stale">${daysAgo(l)} days</span>`:''):`<span class="pill">New</span>`;
    return `<button class="card" type="button" data-outfit="${id}">${boardHTML(o.itemIds||[],o.layout)}
      <div class="nm">${esc(o.name||'Outfit')}</div>
      <div class="meta"><span>${l?`Last worn ${fmtDate(l)}`:'Never worn'}</span></div>
      ${r?.next?`<div class="meta"><span>Planned ${fmtDate(r.next)}</span></div>`:''}
      ${pill?`<div>${pill}</div>`:''}
    </button>`}).join('')}</div>`;
}

/* ---------- shuffle ---------- */
const OCCASIONS=[['','Any occasion',1,10],['casual','Casual',1,4],['everyday','Everyday',3,7],['dressy','Dressy',6,9],['formal','Formal',8,10]];
const shufSeason=()=>S.shuf.season==='auto'?currentSeason():S.shuf.season||'';
function shufPool(group,loose){
  const sh=S.shuf,st=sh.style,sea=shufSeason(),oc=OCCASIONS.find(o=>o[0]===sh.occ)||OCCASIONS[0];
  const inPool=i=>{const t=typeOf(i);return group==='Shoes'?SHOE_T.includes(t):group==='Head'?HEAD_T.includes(t):group==='Accessories'?groupOf(i)==='Accessories'&&!SHOE_T.includes(t)&&!UNDER_T.includes(t):groupOf(i)===group};
  const base=[...S.items.entries()].filter(([,i])=>inCloset(i,sh.closet)&&inPool(i)&&(!st||(i.style||'').trim().toLowerCase()===st)&&!i.fate);
  const fit=base.filter(([,i])=>fitsSeason(i,sea)&&dressOf(i)>=oc[2]&&dressOf(i)<=oc[3]);
  // if nothing fits the season/occasion for this slot, fall back rather than leave it empty
  return fit.length||loose===false?fit:base;
}

// Shuffle taste: what you pair together. Pieces worn together on the calendar count as a good pair; 👍/save/wear
// strengthen a pairing, 👎 weakens it, and shuffling past an outfit straight away weakens it a little.
const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const taste=()=>S.prefs.get('taste')||{pairs:{},skips:{}};
async function bumpTaste(ids,dPair,dSkip){
  if(!ids.length)return;const t=JSON.parse(JSON.stringify(taste()));t.pairs??={};t.skips??={};
  for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const k=pairKey(ids[a],ids[b]);t.pairs[k]=Math.max(-3,Math.min(3,(t.pairs[k]||0)+dPair))}
  if(dSkip)for(const id of ids)t.skips[id]=(t.skips[id]||0)+dSkip;
  await saveDoc('prefs','taste',t);
}
function coWear(){const m={};for(const p of S.plans.values()){const ids=[...new Set(p.itemIds||[])];for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const k=pairKey(ids[a],ids[b]);m[k]=(m[k]||0)+1}}return m}
const hueOf=it=>{const hex=it?.colourHex||GEN_HEX[genericName(it?.colour)];if(!hex)return null;const[r,g,b]=hexToRgb(hex).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx-mn<.18)return null;
  const d=mx-mn;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return(h*60+360)%360};
// two loud, clashing colours together are less likely; neutrals go with anything
function harmony(id,chosen){let f=1;const h=hueOf(S.items.get(id));if(h===null)return 1;
  for(const c of chosen){const h2=hueOf(S.items.get(c));if(h2===null)continue;const d=Math.min(Math.abs(h-h2),360-Math.abs(h-h2));if(d>40&&d<150)f*=.7}return f}
function weightedPick(entries,W,chosen=[],ctx=null){
  if(!entries.length)return null;
  const w=entries.map(([id])=>{const l=last(W[id]);let x=!l?1.6:daysAgo(l)<7?.35:daysAgo(l)>45?1.3:1;
    if(ctx){let a=0;const me=S.items.get(id);for(const c of chosen){const k=pairKey(id,c),o=S.items.get(c);a+=Math.max(-2.5,Math.min(2.5,.6*Math.min(3,ctx.cw[k]||0)+(ctx.t.pairs?.[k]||0)+((me?.goes||[]).includes(c)||(o?.goes||[]).includes(id)?1.2:0)));if(me&&o){const gap=Math.abs(dressOf(me)-dressOf(o));if(gap>2)a-=.5*(gap-2)}}
      x*=Math.exp(.7*a)*harmony(id,chosen)/(1+.12*(ctx.t.skips?.[id]||0));if(ctx.under?.has(id)&&!chosen.length)x*=.35}
    return x});
  let r=Math.random()*w.reduce((a,b)=>a+b,0);for(let k=0;k<entries.length;k++){r-=w[k];if(r<=0)return entries[k][0]}return entries[entries.length-1][0];
}
function doShuffle(){
  const sh=S.shuf,W=wear().items,L=sh.locks,slots={};
  for(const k of L)if(sh.slots[k]&&S.items.has(sh.slots[k]))slots[k]=sh.slots[k];
  const P={top:shufPool('Tops'),bottom:shufPool('Bottoms'),one:shufPool('Full length'),shoes:shufPool('Shoes'),outer:shufPool('Jackets'),hat:shufPool('Head'),acc:shufPool('Accessories')};
  let mode;
  if(sh.mode==='sep'&&P.top.length&&P.bottom.length)mode='sep';else if(sh.mode==='one'&&P.one.length)mode='one';
  else if(slots.one)mode='one';else if(slots.top||slots.bottom)mode='sep';
  else{
    // prefer the kind of outfit that actually fits the season and occasion; fall back only if neither does
    const Q={top:shufPool('Tops',false),bottom:shufPool('Bottoms',false),one:shufPool('Full length',false)};
    let canSep=Q.top.length&&Q.bottom.length,canOne=Q.one.length;
    if(canSep||canOne){for(const k of['top','bottom','one'])if(Q[k].length)P[k]=Q[k]}else{canSep=P.top.length&&P.bottom.length;canOne=P.one.length}
    mode=canSep&&canOne?(Math.random()<.3?'one':'sep'):canOne?'one':canSep?'sep':null}
  if(!mode){sh.slots={};sh.err='Add some tops and bottoms (or dresses) to this closet to shuffle outfits.';return}
  sh.err='';
  if(mode==='one'){delete slots.top;delete slots.bottom}else delete slots.one;
  delete slots.hat;L.delete('hat');sh.on.shoes=true;
  for(const k of['outer','acc'])if(!sh.on[k]){delete slots[k];L.delete(k)}
  const want=[...(mode==='one'?['one']:['top','bottom']),...['outer','shoes','acc'].filter(k=>k==='shoes'||sh.on[k])];sh.cur=mode;
  // what each row can scroll through: the pieces that fit (colour then name, so it's easy to browse)
  const ord=GENERIC.map(g=>g[0]),srt=a=>[...a].sort((x,y)=>((ord.indexOf(genericName(x[1].colour))+1)||99)-((ord.indexOf(genericName(y[1].colour))+1)||99)||(x[1].name||'').localeCompare(y[1].name||''));
  sh.pools={};for(const k of want){sh.pools[k]=srt(P[k]).map(([id])=>id);if(slots[k]&&!sh.pools[k].includes(slots[k]))sh.pools[k].unshift(slots[k])}
  const ctx={cw:coWear(),t:taste(),under:new Set([...S.items.values()].flatMap(i=>i.needs||[]))};
  for(const k of want)if(!slots[k]){const id=weightedPick(P[k],W,Object.values(slots),ctx);if(id)slots[k]=id}
  for(const id of Object.values(slots)){const need=needsOf(id);if(!need.length||need.some(n=>Object.values(slots).includes(n)))continue;
    const pickN=weightedPick(need.map(n=>[n,S.items.get(n)]),W,Object.values(slots),ctx);if(pickN){let k='with';let n=2;while(slots[k])k='with'+n++;slots[k]=pickN}}
  sh.shownAt=Date.now();
  sh.slots=slots;for(const k of[...L])if(!slots[k])L.delete(k);
}
const slotName=k=>SLOTNAME[k]||(k.startsWith('with')?'Worn with':k);
const SLOTNAME={top:'Top',bottom:'Bottom',one:'Full length',shoes:'Shoes',outer:'Jacket',hat:'Hat & hair',bag:'Bag',acc:'Accessory'};
// top to bottom: jacket, top, bottom, shoes, then accessories (hats, hair, bags, jewelry…)
const SHUF_ROWS={sep:['outer','top','bottom','shoes','acc'],one:['outer','one','shoes','acc']};
const ROW_EMPTY={top:'No tops here yet',bottom:'No bottoms here yet',one:'No full-length pieces here yet',outer:'No jackets here yet',hat:'No hats or hair accessories yet',acc:'No accessories here yet',shoes:'No shoes here yet'};
const OPTIONAL_ROWS=[['outer','Jacket'],['acc','Accessory']];
const LOCK_SVG='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function shuffleView(){
  if(!S.ready)return '';
  const sh=S.shuf;if(sh.closet!==S.closet){sh.closet=S.closet;sh.cur=null;sh.err='';sh.slots={};sh.locks.clear()}
  if(sh.closet!=='all'&&!S.closets.has(sh.closet))sh.closet='all';
  if(!sh.cur&&!sh.err)doShuffle();
  const withs=Object.entries(sh.slots).filter(([k])=>k.startsWith('with')).map(([,id])=>S.items.get(id)).filter(Boolean);
  const row=k=>{const ids=(sh.pools[k]||[]).filter(id=>S.items.has(id)),on=sh.slots[k],loop=ids.length>1,copies=loop?3:1;
    const card=(id,c)=>{const i=S.items.get(id);return `<div class="scard${id===on&&c===(loop?1:0)?' on':''}" data-cid="${id}" data-copy="${c}"><div class="${phCls(i)}">${thumb(i)}</div><small>${esc(i.name)}</small></div>`};
    return `<div class="srow r-${k}"><span class="srlab">${SLOTNAME[k]}</span>${on?`<button type="button" class="srlock" data-lock="${k}" aria-pressed="${sh.locks.has(k)}" aria-label="${sh.locks.has(k)?'Unlock':'Lock'} ${SLOTNAME[k]}">${LOCK_SVG}</button>`:''}
      ${ids.length?`<div class="scar" data-car="${k}" data-n="${ids.length}" aria-label="${SLOTNAME[k]}: swipe to choose">${Array.from({length:copies},(_,c)=>ids.map(id=>card(id,c)).join('')).join('')}</div>`
        :`<p class="muted srempty">${ROW_EMPTY[k]}</p>`}</div>`};
  return `<div class="row"><select id="shOcc" aria-label="Occasion">${OCCASIONS.map(([k,l])=>`<option value="${k}" ${sh.occ===k?'selected':''}>${l}</option>`).join('')}</select>
      <select id="shSea" aria-label="Season"><option value="auto" ${sh.season==='auto'?'selected':''}>Now: ${(SEASONS.find(x=>x[0]===currentSeason())||[])[1]}</option>${SEASONS.map(([k,l])=>`<option value="${k}" ${sh.season===k?'selected':''}>${l}</option>`).join('')}<option value="" ${sh.season===''?'selected':''}>Any season</option></select>
</div>
    <div class="chips" role="group" aria-label="Outfit kind">${[['mix','Mix it up'],['sep','Top + bottom'],['one','Full length']].map(([k,l])=>`<button class="chip" type="button" data-shmode="${k}" aria-pressed="${sh.mode===k}">${l}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Include in the outfit">${OPTIONAL_ROWS.map(([k,l])=>`<button class="chip tgl" type="button" data-shon="${k}" aria-pressed="${!!sh.on[k]}">${sh.on[k]?'✓ ':''}${l}</button>`).join('')}</div>
    ${sh.err?empty('Nothing to shuffle yet',sh.err):`
    <div class="srows">${(SHUF_ROWS[sh.cur]||SHUF_ROWS.sep).filter(k=>!['outer','acc'].includes(k)||sh.on[k]).map(row).join('')}</div>
    ${withs.length?`<p class="muted" style="margin:0;font-size:13px">Worn with: <b>${withs.map(i=>esc(i.name)).join(', ')}</b></p>`:''}
    <div class="btns"><button class="btn primary" type="button" id="shGo">Shuffle</button><button class="btn" type="button" id="shLike" aria-label="I like this outfit">👍</button><button class="btn" type="button" id="shNope" aria-label="Not for me">👎</button><button class="btn" type="button" id="shSave">Save as outfit</button><button class="btn" type="button" id="shWear">Wear today</button></div>
    <p class="muted" style="margin:0;font-size:12px">Swipe a row to pick a piece, tap the lock to keep it, and Shuffle changes the rest. Shuffle learns from 👍, 👎 and what you save and wear.</p>`}`;
}
// centre a row on its chosen piece (the middle copy, so you can keep swiping both ways)
function centreCar(car,smooth){const id=S.shuf.slots[car.dataset.car],loop=+car.dataset.n>1;
  const c=id&&(car.querySelector(`[data-cid="${id}"][data-copy="${loop?1:0}"]`)||car.querySelector(`[data-cid="${id}"]`));if(!c)return;
  car.querySelectorAll('.scard.on').forEach(x=>x.classList.remove('on'));c.classList.add('on');
  const left=c.offsetLeft-(car.clientWidth-c.offsetWidth)/2;car._prog=true;car.scrollTo({left,behavior:smooth?'smooth':'auto'});setTimeout(()=>{car._prog=false},smooth?700:60)}
// endless rows: when you swipe into the first or last copy, jump invisibly back to the same piece in the middle copy
function settleCar(car){
  const mid=car.scrollLeft+car.clientWidth/2;let best=null,bd=1e9;
  car.querySelectorAll('.scard').forEach(c=>{const d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;best=c}});
  if(!best)return;
  if(+car.dataset.n>1&&best.dataset.copy!=='1'){const twin=car.querySelector(`[data-cid="${best.dataset.cid}"][data-copy="1"]`);if(twin){car.scrollLeft+=twin.offsetLeft-best.offsetLeft;best=twin}}
  car.querySelectorAll('.scard.on').forEach(x=>x.classList.remove('on'));best.classList.add('on');
  const k=car.dataset.car,id=best.dataset.cid;if(S.shuf.slots[k]!==id){S.shuf.slots[k]=id;S.shuf.shownAt=Date.now()}
}
function wireShuffle(){
  const sh=S.shuf,prev=sh._prev;sh._prev=null;
  document.querySelectorAll('.scar').forEach(car=>{
    if(prev&&prev[car.dataset.car]!=null){car.scrollLeft=prev[car.dataset.car];requestAnimationFrame(()=>centreCar(car,true))}else centreCar(car,false);
    let t=null;car.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(()=>{if(!car._prog)settleCar(car)},130)});
    car.addEventListener('click',e=>{const c=e.target.closest('.scard');if(!c)return;car.querySelectorAll('.scard.on').forEach(x=>x.classList.remove('on'));c.classList.add('on');
      const left=c.offsetLeft-(car.clientWidth-c.offsetWidth)/2;car.scrollTo({left,behavior:'smooth'})});
  });
  const spin=()=>{const prev={};document.querySelectorAll('.scar').forEach(c=>prev[c.dataset.car]=c.scrollLeft);sh._prev=prev;doShuffle();render()};
  $('#shGo')?.addEventListener('click',()=>{const free=Object.entries(sh.slots).filter(([k])=>!sh.locks.has(k)).map(([,id])=>id);
    if(free.length&&sh.shownAt&&Date.now()-sh.shownAt<4000)bumpTaste(Object.values(sh.slots),-.1,1).catch(()=>{});spin()});
  $('#shLike')?.addEventListener('click',async()=>{await bumpTaste(Object.values(sh.slots),.6,0);toast('Got it. More outfits like this.')});
  $('#shNope')?.addEventListener('click',async()=>{await bumpTaste(Object.values(sh.slots),-.6,0);spin();toast('Got it. Fewer like that.')});
  $('#shSave')?.addEventListener('click',()=>{bumpTaste(Object.values(sh.slots),.6,0).catch(()=>{});outfitSheet(null,Object.values(sh.slots))});
  $('#shWear')?.addEventListener('click',async e=>{const ids=Object.values(sh.slots);await guard(e.currentTarget,async()=>{bumpTaste(ids,.6,0).catch(()=>{});let oid=matchOutfit(ids);await saveDoc('plans',today(),{itemIds:ids,outfitId:oid,note:S.plans.get(today())?.note||''});toast('Logged for today')})});
  $('#shStyle')?.addEventListener('change',e=>{sh.style=e.target.value;sh.locks.clear();doShuffle();render()});
  $('#shOcc')?.addEventListener('change',e=>{sh.occ=e.target.value;sh.locks.clear();doShuffle();render()});
  $('#shSea')?.addEventListener('change',e=>{sh.season=e.target.value;sh.locks.clear();doShuffle();render()});
}

/* ---------- weather: 7-day forecast from Open-Meteo (free, no account). Location is rounded to about 1 km and kept on this device. ---------- */
const WX={loading:false,err:''};
const wxLoc=()=>{try{return JSON.parse(ls.get('closet.wx.loc')||'null')}catch(e){return null}};
const wxData=()=>{try{return JSON.parse(ls.get('closet.wx.data')||'null')}catch(e){return null}};
const WX_ICON={
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  part:'<circle cx="9" cy="9" r="3.2"/><path d="M9 3.2v1.3M3.2 9h1.3M4.9 4.9l.9.9M13.1 4.9l-.9.9"/><path d="M9.5 19h8a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.8 1.4A2.6 2.6 0 0 0 9.5 19z"/>',
  cloud:'<path d="M7.5 18.5h9.5a4 4 0 0 0 .5-7.97A5.8 5.8 0 0 0 6.4 9.5a4.5 4.5 0 0 0 1.1 9z"/>',
  fog:'<path d="M7.5 13.5h9.5a3.6 3.6 0 0 0 .3-7.2A5.3 5.3 0 0 0 7 5.6a4 4 0 0 0 .5 7.9zM5 17h14M7 20.5h10"/>',
  rain:'<path d="M7.5 14.5h9.5a3.8 3.8 0 0 0 .4-7.6A5.5 5.5 0 0 0 6.9 6.2a4.2 4.2 0 0 0 .6 8.3zM8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
  snow:'<path d="M7.5 14.5h9.5a3.8 3.8 0 0 0 .4-7.6A5.5 5.5 0 0 0 6.9 6.2a4.2 4.2 0 0 0 .6 8.3z"/><path d="M8 18.2v.1M12 19.7v.1M16 18.2v.1M10 21.2v.1M14 21.2v.1"/>',
  storm:'<path d="M7.5 14.5h9.5a3.8 3.8 0 0 0 .4-7.6A5.5 5.5 0 0 0 6.9 6.2a4.2 4.2 0 0 0 .6 8.3zM12.8 15.5l-2 3.2h2.6l-1.6 3"/>'};
function wxKind(c){if(c===0)return['sun','Clear'];if(c<=2)return['part','Partly cloudy'];if(c===3)return['cloud','Cloudy'];if(c===45||c===48)return['fog','Fog'];
  if(c>=95)return['storm','Thunderstorms'];if((c>=71&&c<=77)||c===85||c===86)return['snow','Snow'];if(c>=51&&c<=67)return[c<60?'rain':'rain',c<60?'Drizzle':'Rain'];if(c>=80&&c<=82)return['rain','Showers'];return['cloud','Cloudy']}
const wxSvg=k=>`<svg class="wxi ${k}" viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[k]||WX_ICON.cloud}</svg>`;
// forecast for one day (YYYY-MM-DD) or null
function wxDay(key){const d=wxData();if(!d||!d.days)return null;return d.days.find(x=>x.date===key)||null}
function wxStale(){const d=wxData(),l=wxLoc();if(!l)return false;if(!d||d.lat!==l.lat||d.lon!==l.lon)return true;return Date.now()-d.at>3600000||!d.days.some(x=>x.date===today())}
async function loadWeather(force){
  const l=wxLoc();if(!l||WX.loading||(!force&&!wxStale()))return;
  WX.loading=true;WX.err='';
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('weather '+r.status);const j=await r.json(),D=j.daily;
    const days=D.time.map((date,i)=>({date,code:D.weather_code[i],hi:Math.round(D.temperature_2m_max[i]),lo:Math.round(D.temperature_2m_min[i]),pop:D.precipitation_probability_max?.[i]??null}));
    ls.set('closet.wx.data',JSON.stringify({at:Date.now(),lat:l.lat,lon:l.lon,days}));
  }catch(e){console.warn(e);WX.err=navigator.onLine?'Couldn’t get the forecast right now.':'Offline. Showing the last forecast.'}
  finally{WX.loading=false;if(S.view==='calendar')render()}
}
function wxUseHere(){
  if(!navigator.geolocation){toast('Location isn’t available. Search for your city instead.');return}
  WX.loading=true;render();
  navigator.geolocation.getCurrentPosition(p=>{
    WX.loading=false;WX.setup=false;ls.set('closet.wx.loc',JSON.stringify({lat:Math.round(p.coords.latitude*100)/100,lon:Math.round(p.coords.longitude*100)/100,name:'Your location',src:'user'}));loadWeather(true);
  },()=>{WX.loading=false;WX.err='Location wasn’t allowed. Search for your city instead.';render()},{maximumAge:3600000,timeout:15000});
}
async function geocode(q){
  for(const name of [q,q.split(',')[0]].map(x=>x.trim()).filter((x,i,a)=>x&&a.indexOf(x)===i)){
    const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);const c=(await r.json()).results?.[0];
    if(c)return{lat:Math.round(c.latitude*100)/100,lon:Math.round(c.longitude*100)/100,name:[c.name,c.admin1].filter(Boolean).join(', ')};
  }
  return null;
}
async function wxCity(q){
  q=(q||'').trim();if(!q)return;
  try{const c=await geocode(q);if(!c){toast('Couldn’t find that place. Try a nearby city.');return}
    ls.set('closet.wx.loc',JSON.stringify({...c,src:'user'}));WX.err='';loadWeather(true);
  }catch(e){toast('Couldn’t search right now. Check your connection.')}
}
// No location chosen yet: use the location on the owner's GitHub profile, or Toronto if there isn't one.
const TORONTO={lat:43.65,lon:-79.38,name:'Toronto, Ontario'};
async function wxAuto(){
  const l=wxLoc();if(WX.auto||(l&&!(l.src==='default'&&GH.cfg()&&!WX.ghTried)))return;
  WX.auto=true;let loc=null;
  try{
    const c=GH.cfg();
    if(c){WX.ghTried=true;const r=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${c.token}`,Accept:'application/vnd.github+json'},cache:'no-store'});
      if(r.ok){const where=((await r.json()).location||'').trim();if(where){const g=await geocode(where);if(g)loc={...g,src:'github'}}}}
  }catch(e){console.warn('github location',e)}
  if(!loc&&!l)loc={...TORONTO,src:'default'};
  WX.auto=false;
  if(loc){ls.set('closet.wx.loc',JSON.stringify(loc));loadWeather(true)}
}
function weatherStrip(){
  const l=wxLoc();
  if(!l&&!WX.setup)return `<div class="wx"><p class="muted" style="margin:0;font-size:13px">Getting the forecast…</p></div>`;
  if(WX.setup)return `<div class="wx setup"><div class="wxhead"><b>Weather for the week</b><button class="linkbtn" type="button" data-wx="cancel">Cancel</button></div>
    <p class="muted" style="margin:0;font-size:13px">Pick where the forecast is for. Your location is rounded to about 1 km, kept on this device, and only sent to Open-Meteo, a free weather service.</p>
    ${WX.err?`<p class="muted" style="margin:0;font-size:13px">${esc(WX.err)}</p>`:''}
    <div class="wxset"><button class="btn sm primary" type="button" data-wx="here" ${WX.loading?'disabled':''}>${WX.loading?'Finding you…':'Use my location'}</button>
    <form class="wxcity" data-wxform><input id="wxQ" placeholder="Or type a city" autocomplete="off" aria-label="City"><button class="btn sm" type="submit">Go</button></form></div>
    </div>`;
  const d=wxData(),t=today();
  const days=d?.days?.filter(x=>x.date>=t).slice(0,7)||[];
  return `<div class="wx"><div class="wxhead"><b>${esc(l.name||'Weather')}</b><button class="linkbtn" type="button" data-wx="change">Change</button></div>
    ${days.length?`<div class="wxdays">${days.map(x=>{const[k,lab]=wxKind(x.code),dt=parse(x.date);
      return `<button type="button" class="wxd${x.date===t?' today':''}" data-day="${x.date}" aria-label="${fmtDate(x.date)}: ${lab}, high ${x.hi}°, low ${x.lo}°${x.pop!=null?', '+x.pop+'% chance of rain':''}">
        <small>${x.date===t?'Today':dt.toLocaleDateString('en-CA',{weekday:'short'})}</small>${wxSvg(k)}<b>${x.hi}°</b><small class="lo">${x.lo}°</small>${x.pop>=30?`<small class="pop">${x.pop}%</small>`:''}</button>`}).join('')}</div>`
      :`<p class="muted" style="margin:0;font-size:13px">${WX.loading?'Getting the forecast…':esc(WX.err||'No forecast yet.')}</p>`}
    ${days.length&&WX.err?`<p class="muted" style="margin:0;font-size:12px">${esc(WX.err)}</p>`:''}</div>`;
}
function calendarView(){
  if(!wxLoc()||(wxLoc().src==='default'&&GH.cfg()&&!WX.ghTried))setTimeout(wxAuto,0);else if(wxStale())setTimeout(()=>loadWeather(),0);
  const m=S.month,y=m.getFullYear(),mo=m.getMonth(),t=today();
  const hideWx=false;
  const first=new Date(y,mo,1),start=new Date(y,mo,1-first.getDay());
  let cells='';
  const LK={};for(const l of S.looks.values())if(l.status===LOOK_DONE&&l.date&&URLS.has(l.imageId)&&!LK[l.date])LK[l.date]=l;
  for(let k=0;k<42;k++){
    const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+k),key=ymd(d),p=S.plans.get(key);
    if(k===35&&d.getMonth()!==mo)break;
    let pic=p&&(p.itemIds||[]).map(id=>S.items.get(id)).sort((a,b)=>(a&&groupOf(a)==='Tops'?-1:0)-(b&&groupOf(b)==='Tops'?-1:0)).find(i=>hasImg(i));
    if(LK[key])pic={imageId:LK[key].imageId,cutout:false};
    const has=p&&(p.itemIds||[]).length;
    cells+=`<button type="button" class="day${d.getMonth()!==mo?' out':''}${key===t?' today':''}${key>t?' future':''}${has?' has':''}${pic?' img':''}${pic?.cutout?' cut':''}" data-day="${key}" aria-label="${fmtDate(key)}${has?', '+esc(p.outfitId&&S.outfits.get(p.outfitId)?.name||'outfit planned'):''}">
      <span class="n">${d.getDate()}</span>${(()=>{const w=key>=t&&wxDay(key);return w?`<span class="wt">${w.hi}°</span>`:''})()}${pic?img(pic.imageId):has?'<span class="dot"></span>':''}</button>`;
  }
  const up=[...S.plans.entries()].filter(([d,p])=>d>t&&(p.itemIds||[]).length).sort().slice(0,7);
  const recent=[...S.plans.entries()].filter(([d,p])=>d<=t&&(p.itemIds||[]).length).sort().reverse().slice(0,5);
  const row=([d,p])=>{const o=p.outfitId&&S.outfits.get(p.outfitId);const it=(p.itemIds||[]).map(i=>S.items.get(i)).filter(Boolean);const f=it.find(hasImg)||it[0];
    return `<button class="li" type="button" data-day="${d}"><span class="mini ${f?.cutout&&hasImg(f)?'cut':''}">${thumb(f)}</span><span class="tx"><b>${esc(o?.name||it.map(i=>i.name).join(', ')||'Outfit')}</b><small>${fmtDate(d)} · ${ago(d)}</small></span></button>`};
  return `${hideWx?'':weatherStrip()}<div class="calhead"><button class="iconbtn" type="button" data-mon="-1" aria-label="Previous month">‹</button>
    <h2>${m.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h2>
    <button class="iconbtn" type="button" data-mon="1" aria-label="Next month">›</button></div>
    <div class="cal">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="dow">${d}</div>`).join('')}${cells}</div>
    <div class="legend">Tap a day to plan or log an outfit. Days up to today count as worn; dashed days are planned.${hideWx?' <button class="linkbtn" type="button" data-wx="show">Show the weather</button>':''}</div>
    <h3>Coming up</h3>${up.length?`<div class="list">${up.map(row).join('')}</div>`:'<p class="muted" style="margin:0">Nothing planned yet.</p>'}
    <h3>Recently worn</h3>${recent.length?`<div class="list">${recent.map(row).join('')}</div>`:'<p class="muted" style="margin:0">No outfits logged yet.</p>'}`;
}

/* ---------- stats ---------- */
function statsView(){
  if(!S.ready)return '';
  return declutterCard()+statsBody();
}
function statsBody(){
  const c=S.closet==='all'||S.closets.has(S.closet)?S.closet:'all';  // follows the closet chosen in the title
  const W=wear().items;
  const its=[...S.items.entries()].filter(([,i])=>inCloset(i,c));
  const head='';
  if(!its.length)return head+empty('No stats yet','Add pieces to see what your closet is worth and what you actually wear.');
  const priced=its.filter(([,i])=>Number(i.price)>0);
  const total=priced.reduce((a,[,i])=>a+Number(i.price),0);
  const ids=new Set(its.map(([id])=>id));
  const mon=today().slice(0,7);
  const daysThisMonth=[...S.plans.entries()].filter(([d,p])=>d.startsWith(mon)&&d<=today()&&(p.itemIds||[]).some(i=>ids.has(i))).length;
  const wornCount=id=>W[id]?.worn.length||0;
  const neverOrStale=its.filter(([id])=>{const l=last(W[id]);return !l||daysAgo(l)>=90});
  const usedPct=Math.round((its.length-neverOrStale.length)/its.length*100);
  const bars=(rows,max,fmt)=>`<div class="bars">${rows.map(r=>`<${r.go?`button type="button" data-go="${esc(r.go)}" aria-label="Show ${esc(r.label)}"`:'div'} class="bar${r.go?' barbtn':''}"><span class="bl">${r.sw?`<span class="sw" style="background:${r.sw}"></span>`:''}${esc(r.label)}</span><span class="bt"><span style="width:${Math.max(2,r.v/max*100)}%"></span></span><span class="bv">${fmt(r)}${r.go?' ›':''}</span></${r.go?'button':'div'}>`).join('')}</div>`;
  const byType={};for(const[,i]of its){const t=typeOf(i);(byType[t]??={label:t,v:0,val:0,go:'type:'+t}).v++;byType[t].val+=Number(i.price)||0}
  const typeRows=Object.values(byType).sort((a,b)=>b.v-a.v);
  const byCol={};for(const[,i]of its){const k=genericName(i.colour)||'no colour';(byCol[k]??={label:k,v:0,sw:GEN_HEX[k]||okColour(k),go:'colour:'+k}).v++}
  const colRows=Object.values(byCol).sort((a,b)=>b.v-a.v).slice(0,8);
  const most=its.filter(([id])=>wornCount(id)).sort((a,b)=>wornCount(b[0])-wornCount(a[0])).slice(0,5);
  const cpw=priced.filter(([id])=>wornCount(id)).map(([id,i])=>[id,i,Number(i.price)/wornCount(id)]).sort((a,b)=>a[2]-b[2]).slice(0,5);
  const li=(id,i,sub)=>`<button class="li" type="button" data-item="${id}"><span class="mini ${i.cutout&&hasImg(i)?'cut':''}">${thumb(i)}</span><span class="tx"><b>${esc(i.name)}</b><small>${sub}</small></span></button>`;
  return head+`
    <div class="stats four">
      <div class="stat"><b>${its.length}</b><small>Pieces</small></div>
      <div class="stat"><b>${money(total)||'—'}</b><small>Total spent</small></div>
      <div class="stat"><b>${priced.length?money(Math.round(total/priced.length)):'—'}</b><small>Avg price</small></div>
      <div class="stat"><b>${usedPct}%</b><small>Worn in 90 days</small></div>
    </div>
    <p class="muted" style="margin:0">${daysThisMonth} outfit${daysThisMonth===1?'':'s'} logged this month.</p>
    <h3>By type</h3>${bars(typeRows,typeRows[0].v,r=>`${r.v}${r.val?' · '+money(r.val):''}`)}
    <h3>By colour</h3>${bars(colRows,colRows[0].v,r=>String(r.v))}
    <h3>Most worn</h3>${most.length?`<div class="list">${most.map(([id,i])=>li(id,i,`Worn ${wornCount(id)}× · last ${ago(last(W[id]))}`)).join('')}</div>`:'<p class="muted" style="margin:0">Log outfits on the calendar to see this.</p>'}
    <h3>Best value</h3>${cpw.length?`<div class="list">${cpw.map(([id,i,v])=>li(id,i,`${money(Math.round(v*100)/100)} per wear · ${money(i.price)} total`)).join('')}</div>`:'<p class="muted" style="margin:0">Add prices and log what you wear to see cost per wear.</p>'}
    <h3>Not worn in 90+ days · ${neverOrStale.length}</h3>${neverOrStale.length?`<div class="list">${neverOrStale.slice(0,12).map(([id,i])=>li(id,i,last(W[id])?`Last worn ${fmtDate(last(W[id]))}`:'Never worn')).join('')}</div>`:'<p class="muted" style="margin:0">You’ve worn everything recently.</p>'}
    <p class="credits">Icons from <a href="https://www.flaticon.com" target="_blank" rel="noopener">Flaticon</a> by Magnific, Smashicons, juicy_fish, Adury5711, Hazicon, Nadiinko, Chanut-is-Industries, Pronicon, Victoruler, photo3idea_studio, JoeKanaka, iconnut, bqlqn, Nabila30, Dreamstale and Erifqi Zetiawan Full list in the <a href="https://github.com/AlAgilly/my-closet#credits" target="_blank" rel="noopener">README</a>.</p>`;
}

/* ---------- main view events ---------- */
document.addEventListener('change',e=>{if(e.target.id!=='lookFiles')return;const fs=[...e.target.files];e.target.value='';if(fs.length)importLooks(fs)});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-wxform]');if(!f)return;e.preventDefault();const q=f.querySelector('#wxQ').value;WX.setup=false;wxCity(q)});
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');if(tab){S.view=tab.dataset.tab;ls.set('closet.view',S.view);render();scrollTo(0,0);return}
  if(e.target.closest('#sheetRoot'))return;
  if(e.target.closest('#syncBtn,[data-open-sync]')){syncSheet();return}
  if(e.target.closest('#manageClosets')){closetsSheet();return}
  if(e.target.closest('#closetTitle')){closetSwitcher();return}
  if(e.target.closest('#bulkBtn')){bulkSheet();return}
  if(e.target.closest('#qtBtn')){needsSortCheck()?sortSheet():quickTagSheet();return}
  const lok=e.target.closest('[data-look]');if(lok){lookSheet(lok.dataset.look);return}
  const lf=e.target.closest('[data-lookf]');if(lf){S.lookFilter=lf.dataset.lookf;render();return}
  const dc=e.target.closest('[data-dc]');if(dc){dc.dataset.dc==='start'?declutterSheet():leavingSheet();return}
  const wx=e.target.closest('[data-wx]');if(wx){const a=wx.dataset.wx;if(a==='here')wxUseHere();else if(a==='change'){WX.setup=true;WX.err='';render()}else if(a==='cancel'){WX.setup=false;WX.err='';render()}else if(a==='hide'){ls.set('closet.wx.off','1');render()}else if(a==='show'){ls.set('closet.wx.off',null);WX.setup=true;render()}return}
  const cl=e.target.closest('[data-closet]');if(cl){S.closet=cl.dataset.closet;S.type='All';S.group='All';ls.set('closet.current',S.closet);render();return}
  const sc=e.target.closest('[data-shufcloset]');if(sc){S.shuf.closet=sc.dataset.shufcloset;S.shuf.locks.clear();doShuffle();render();return}
  const stc=e.target.closest('[data-statcloset]');if(stc){S.statsCloset=stc.dataset.statcloset;render();return}
  const so2=e.target.closest('[data-shon]');if(so2){const k=so2.dataset.shon,sh=S.shuf;sh.on[k]=!sh.on[k];try{localStorage.setItem('closet.shufOn',JSON.stringify(sh.on))}catch(_){}doShuffle();render();return}
  const sm=e.target.closest('[data-shmode]');if(sm){S.shuf.mode=sm.dataset.shmode;S.shuf.locks.clear();doShuffle();render();return}
  const so=e.target.closest('[data-shopt]');if(so){const k=so.dataset.shopt;S.shuf[k]=!S.shuf[k];if(!S.shuf[k]){delete S.shuf.slots[k];S.shuf.locks.delete(k)}doShuffle();render();return}
  const lk=e.target.closest('[data-lock]');if(lk){const k=lk.dataset.lock,L=S.shuf.locks;L.has(k)?L.delete(k):L.add(k);lk.setAttribute('aria-pressed',L.has(k));lk.setAttribute('aria-label',(L.has(k)?'Unlock ':'Lock ')+(SLOTNAME[k]||k));return}
  const gr=e.target.closest('[data-group]');if(gr){S.group=gr.dataset.group;S.type='All';refreshCloset();return}
  const ty=e.target.closest('[data-type]');if(ty){S.type=ty.dataset.type;refreshCloset();return}
  if(e.target.closest('#fsBtn')){filterSheet();return}
  const fx=e.target.closest('[data-fx]');if(fx){const v=fx.dataset.fx;if(v==='all')S.f={colours:[],seasons:[],dress:'',styles:[],worn:''};else{const[k,...r]=v.split(':'),x=r.join(':');if(Array.isArray(S.f[k]))S.f[k]=S.f[k].filter(y=>y!==x);else S.f[k]=''}refreshCloset();return}
  const go=e.target.closest('[data-go]');if(go){const[k,...r]=go.dataset.go.split(':'),v=r.join(':');S.view='closet';ls.set('closet.view','closet');S.q='';S.f={colours:[],seasons:[],dress:'',styles:[],worn:''};S.group='All';S.type='All';
    if(k==='type'){S.group=GROUP_OF[v]||[...S.items.values()].find(i=>typeOf(i)===v)?.group||'Other';S.type=v}else if(k==='colour'&&v!=='no colour')S.f.colours=[v];render();scrollTo(0,0);return}

  const it=e.target.closest('[data-item]');if(it){itemSheet(it.dataset.item);return}
  const of=e.target.closest('[data-outfit]');if(of){outfitSheet(of.dataset.outfit);return}
  const dy=e.target.closest('[data-day]');if(dy){daySheet(dy.dataset.day);return}
  const mn=e.target.closest('[data-mon]');if(mn){S.month=new Date(S.month.getFullYear(),S.month.getMonth()+Number(mn.dataset.mon),1);render();return}
});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;const r=$('#results');if(r)r.innerHTML=closetResults()}});
document.addEventListener('change',e=>{if(e.target.closest('#sheetRoot'))return;const id=e.target.id;if(id==='fColour')S.colour=e.target.value;else if(id==='fStyle')S.style=e.target.value;else if(id==='fSeason')S.season=e.target.value;else if(id==='fSort')S.sort=e.target.value;else return;render()});
$('#fab').addEventListener('click',()=>({closet:()=>itemSheet(null),outfits:()=>outfitSheet(null),calendar:()=>daySheet(today())})[S.view]?.());

/* ---------- press and hold an item for quick actions ---------- */
let hold=null,holdFired=false;
function holdCancel(){if(hold){clearTimeout(hold.t);hold.card.classList.remove('pressing');hold=null}}
document.addEventListener('pointerdown',e=>{
  const card=e.target.closest('#view [data-item]');if(!card||e.button>0)return;
  holdCancel();holdFired=false;card.classList.add('pressing');
  hold={card,x:e.clientX,y:e.clientY,t:setTimeout(()=>{holdFired=true;const id=card.dataset.item;holdCancel();try{navigator.vibrate?.(12)}catch(_){}itemActions(id)},500)};
});
document.addEventListener('pointermove',e=>{if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10)holdCancel()});
document.addEventListener('pointerup',holdCancel);document.addEventListener('pointercancel',holdCancel);
addEventListener('scroll',holdCancel,{passive:true});
document.addEventListener('click',e=>{if(holdFired&&e.target.closest('#view [data-item]')){e.stopPropagation();e.preventDefault();holdFired=false}},true);
document.addEventListener('contextmenu',e=>{const card=e.target.closest('#view [data-item]');if(!card)return;e.preventDefault();if(!$('#sheetRoot').firstChild){holdCancel();itemActions(card.dataset.item)}});
function itemActions(id){
  const it=S.items.get(id);if(!it)return;
  const sh=openSheet(`<div class="actrow"><span class="mini ${it.cutout&&hasImg(it)?'cut':''}">${thumb(it)}</span><span class="tx"><b>${esc(it.name||'Untitled')}</b><small>${esc(typeOf(it))}${it.price!=null&&it.price!==''?' · '+money(it.price):''}</small></span></div>
    <div class="actions">
      <button class="btn" type="button" id="aEdit">Edit</button>
      <button class="btn" type="button" id="aWear">Wore it today</button>
      <button class="btn danger" type="button" id="aDel">Delete</button>
      <button class="btn" type="button" data-close>Cancel</button>
    </div>`);
  sh.querySelector('#aEdit').addEventListener('click',()=>{closeSheet();itemSheet(id)});
  const wt=sh.querySelector('#aWear');
  wt.addEventListener('click',()=>guard(wt,async()=>{const t=today(),p=S.plans.get(t);const ids=[...new Set([...(p?.itemIds||[]),id])];await saveDoc('plans',t,{itemIds:ids,outfitId:matchOutfit(ids),note:p?.note||''});closeSheet();toast('Logged for today')}));
  const del=sh.querySelector('#aDel');
  armDelete(del,()=>guard(del,async()=>{await delDoc('items',id);for(const d of imageIdsOf(it))await dropImage(d);closeSheet();toast(`Deleted ${it.name||'item'}`)}));
}

/* ---------- sheets ---------- */
function openSheet(html){
  const scrim=document.createElement('div');scrim.className='scrim';
  scrim.innerHTML=`<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  scrim.addEventListener('click',e=>{if(e.target===scrim||e.target.closest('[data-close]'))closeSheet()});
  $('#sheetRoot').replaceChildren(scrim);document.body.style.overflow='hidden';
  return scrim.querySelector('.sheet');
}
function closeSheet(){$('#sheetRoot').replaceChildren();document.body.style.overflow=''}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#sheetRoot').firstChild)closeSheet()});
const head=t=>`<div class="shead"><h2>${t}</h2><button class="iconbtn" type="button" data-close aria-label="Close">✕</button></div>`;
function armDelete(btn,fn,label='Delete'){btn.addEventListener('click',()=>{if(!btn.classList.contains('armed')){btn.classList.add('armed');btn.textContent='Tap again to confirm';setTimeout(()=>{btn.classList.remove('armed');btn.textContent=label},3500);return}fn()})}
async function guard(btn,fn){btn.disabled=true;try{await fn()}catch(err){console.error(err);toast(err?.name==='QuotaExceededError'?'This device is out of space for the app. Free up storage and try again.':err?.code==='unsupported_type'?'That file type isn’t supported. Try a JPEG or PNG.':'Couldn’t save. Please try again.')}finally{btn.disabled=false}}

function typeOptions(cur){
  const own=[...new Set([...S.items.values()].map(typeOf).filter(t=>!GROUP_OF[t]))];if(cur&&!GROUP_OF[cur]&&!own.includes(cur))own.push(cur);
  return GROUPS.map(([g,ts])=>`<optgroup label="${g}">${ts.map(t=>`<option ${cur===t?'selected':''}>${t}</option>`).join('')}</optgroup>`).join('')+(own.length?`<optgroup label="Your own">${own.map(t=>`<option ${cur===t?'selected':''}>${esc(t)}</option>`).join('')}</optgroup>`:'');
}

function bulkSheet(){
  const closets=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  const defCloset=S.closet!=='all'&&S.closets.has(S.closet)?S.closet:MAIN;
  const sh=openSheet(`${head('Upload items')}
    <p class="muted" style="margin:0">Choose several photos, one piece of clothing per photo. Each photo becomes its own item, with its background removed.</p>
    ${closets.length>1?`<div class="field"><label for="bCloset">Add to closet</label><select id="bCloset">${closets.map(([cid,c])=>`<option value="${cid}" ${cid===defCloset?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`:''}
    <label class="check"><input type="checkbox" id="bAuto" ${ls.get('closet.autoDetect')!=='off'?'checked':''}> Name and sort them automatically</label>
    <label class="btn primary filebtn" id="bPick">Choose photos<input type="file" accept="image/*" multiple id="bFiles"></label>
    <p class="muted" id="bMsg" aria-live="polite" style="margin:0;font-size:13px"></p>
    <div class="list" id="bList"></div>
    <div class="btns" id="bEnd" hidden><button class="btn primary" type="button" id="bSave">Save and close</button></div>`);
  const msg=sh.querySelector('#bMsg'),list=sh.querySelector('#bList');
  const autoEl=sh.querySelector('#bAuto');
  autoEl.addEventListener('change',()=>ls.set('closet.autoDetect',autoEl.checked?null:'off'));
  ml('warm',{rmbg:true}).catch(e=>console.warn('warm',e));
  const created=[];
  sh.querySelector('#bFiles').addEventListener('change',async e=>{
    const files=[...e.target.files];e.target.value='';if(!files.length)return;
    const closetId=sh.querySelector('#bCloset')?.value||defCloset,cut=true,auto=autoEl.checked;
    sh.querySelector('#bPick').hidden=true;autoEl.disabled=true;
    const rows=files.map((f,i)=>{const r=document.createElement('div');r.className='brow';r.innerHTML=`<span class="mini"></span><span class="tx"><b>Photo ${i+1}</b><small>Waiting…</small></span>`;list.append(r);return r});
    for(let i=0;i<files.length;i++){
      const row=rows[i],st=t=>{const sm=row.querySelector('small');if(sm)sm.textContent=t};
      msg.textContent=`Working on ${i+1} of ${files.length}. Keep the app open until it finishes.`;
      let r;try{st('Preparing…');r=await shrink(files[i])}catch(err){st('Skipped: not a supported photo');continue}
      const pv=URL.createObjectURL(r.blob);row.querySelector('.mini').innerHTML=`<img src="${pv}" alt="">`;
      await paintPause();
      if(cut&&!r.cutout){st('Removing background…');await paintPause();try{r={blob:await removeBg(r.blob,m=>msg.textContent=m),cutout:true}}catch(err){console.warn(err)}}
      let g={name:'New piece',type:'Other',group:'Other',colour:'',colourHex:null,colours2:[]};
      if(auto){st('Recognizing…');await paintPause();try{g=await autoDetect(r.blob,r.cutout,m=>msg.textContent=m)}catch(err){console.warn(err)}}
      try{
        const imageId=await addImage(r.blob),iid=newId();
        await saveDoc('items',iid,{name:g.name,price:null,type:g.type,group:g.group,closetId,colour:g.colour,colourHex:g.colourHex||null,colours2:g.colours2||[],style:'',imageId,cutout:r.cutout,createdAt:Date.now()});
        created.push(iid);URL.revokeObjectURL(pv);if(g.emb)idbPut('emb','item:'+imageId,g.emb).catch(()=>{});await paintPause();
        row.innerHTML=`<span class="mini ${r.cutout?'cut':''}">${img(imageId)}</span><span class="tx"><input data-bname="${iid}" value="${esc(g.name)}" aria-label="Name"><select data-btype="${iid}" aria-label="Type">${typeOptions(g.type)}</select></span><input class="bprice" data-bprice="${iid}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="$" aria-label="Price">`;
      }catch(err){console.error(err);st(err?.name==='QuotaExceededError'?'Skipped: this device is out of space':'Skipped: couldn’t save')}
    }
    msg.textContent=created.length?`Added ${created.length} piece${created.length===1?'':'s'}. Fix any names or types below and add prices if you like.`:'No pieces were added.';
    sh.querySelector('#bEnd').hidden=false;
  });
  sh.querySelector('#bSave').addEventListener('click',e=>guard(e.currentTarget,async()=>{
    for(const iid of created){
      const it=S.items.get(iid);if(!it)continue;
      const name=sh.querySelector(`[data-bname="${iid}"]`)?.value.trim()||it.name,type=sh.querySelector(`[data-btype="${iid}"]`)?.value||it.type;
      const pv=sh.querySelector(`[data-bprice="${iid}"]`)?.value,price=pv?Math.round(Number(pv)*100)/100:it.price;
      if(name!==it.name||type!==it.type||price!==it.price)await saveDoc('items',iid,{...it,name,type,group:GROUP_OF[type]||it.group||'Other',price});
    }
    closeSheet();toast(`Added ${created.length} piece${created.length===1?'':'s'}`);
  }));
}

function typeSelect(cur){
  const known=GROUP_OF[cur]||!cur;
  return `<select id="fType">${GROUPS.map(([g,ts])=>`<optgroup label="${g}">${ts.map(t=>`<option ${(cur||'Long sleeves')===t?'selected':''}>${t}</option>`).join('')}</optgroup>`).join('')}
    <optgroup label="Your own">${[...new Set([...S.items.values()].map(typeOf).filter(t=>!GROUP_OF[t]))].map(t=>`<option ${cur===t?'selected':''}>${esc(t)}</option>`).join('')}${!known&&![...S.items.values()].some(i=>i.type===cur)?`<option selected>${esc(cur)}</option>`:''}<option value="__new">New type…</option></optgroup></select>`;
}

// Touch up a cut-out: tapping a spot erases the connected patch of similar colour (leftover background).
async function touchUp(sh,st,done){
  const blob=st.blob||await idbGet('images',st.id);if(!blob){toast('That photo isn’t on this device yet.');return}
  const im=await loadImage(URL.createObjectURL(blob));URL.revokeObjectURL(im.src);
  const W=im.naturalWidth,H=im.naturalHeight,work=document.createElement('canvas');work.width=W;work.height=H;
  const wg=work.getContext('2d');wg.drawImage(im,0,0);let img=wg.getImageData(0,0,W,H);const hist=[];
  const box=sh.querySelector('#touch'),view=sh.querySelector('#touchC'),undo=sh.querySelector('#tUndo');
  const s=Math.min(1,900/Math.max(W,H));view.width=Math.round(W*s);view.height=Math.round(H*s);
  const paint=()=>{wg.putImageData(img,0,0);const g=view.getContext('2d');g.clearRect(0,0,view.width,view.height);g.drawImage(work,0,0,view.width,view.height);undo.disabled=!hist.length};
  paint();box.hidden=false;box.scrollIntoView({block:'center',behavior:'smooth'});
  view.onclick=e=>{
    const r=view.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*W),y=Math.floor((e.clientY-r.top)/r.height*H);
    const d=img.data,N=W*H,seed=y*W+x;if(x<0||y<0||x>=W||y>=H||d[seed*4+3]<30){toast('That spot is already see-through.');return}
    const c0=toLab(d[seed*4],d[seed*4+1],d[seed*4+2]);
    hist.push(new Uint8ClampedArray(d));if(hist.length>4)hist.shift();
    const q=new Int32Array(N),seen=new Uint8Array(N);let qh=0,qt=0;q[qt++]=seed;seen[seed]=1;
    while(qh<qt){const i=q[qh++],o=i*4;d[o+3]=0;const xx=i%W;
      for(const j of[xx>0?i-1:-1,xx<W-1?i+1:-1,i-W,i+W]){if(j<0||j>=N||seen[j])continue;seen[j]=1;const p=j*4;if(d[p+3]<30)continue;
        if(labDist(toLab(d[p],d[p+1],d[p+2]),c0)<16)q[qt++]=j;else if(d[p+3]<200)d[p+3]=0}}
    paint();
  };
  undo.onclick=()=>{if(!hist.length)return;img=new ImageData(hist.pop(),W,H);paint()};
  sh.querySelector('#tCancel').onclick=()=>{box.hidden=true;view.onclick=null};
  sh.querySelector('#tDone').onclick=async()=>{
    view.onclick=null;box.hidden=true;if(!hist.length)return;
    wg.putImageData(img,0,0);try{st.blob=await trimToBlob(work);st.cutout=true;done();toast('Touched up. Save to keep it.')}catch(err){toast('Nothing left to keep. Try Undo next time.')}
  };
}
function itemSheet(id){
  const it=id?S.items.get(id):null;if(id&&!it)return;
  const r=id?wear().items[id]:null,l=last(r),wears=r?.worn.length||0,price=Number(it?.price);
  const inOutfits=id?[...S.outfits.values()].filter(o=>(o.itemIds||[]).includes(id)).length:0;
  const defCloset=it?closetOf(it):(S.closet!=='all'&&S.closets.has(S.closet)?S.closet:MAIN);
  const closets=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  const sh=openSheet(`${head(it?esc(it.name||'Piece'):'Add a piece')}
    ${it?`<div class="stats"><div class="stat"><b>${wears}×</b><small>Worn</small></div><div class="stat"><b>${l?shortAgo(l):'—'}</b><small>Last worn</small></div><div class="stat"><b>${price&&wears?money(price/wears):price?money(price):'—'}</b><small>Cost / wear</small></div></div>
      ${r?.next?`<p class="muted" style="margin:0">Next planned ${fmtDate(r.next)}. In ${inOutfits} outfit${inOutfits===1?'':'s'}.</p>`:inOutfits?`<p class="muted" style="margin:0">In ${inOutfits} outfit${inOutfits===1?'':'s'}.</p>`:''}`:''}
    <div class="photos">${[['front','Front',it?.imageId,it?.cutout],['back','Back',it?.backImageId,it?.backCutout]].map(([k,l,pid,cut])=>`
      <div class="pslot" data-slot="${k}">
        <label class="photo"><div class="ph${cut&&URLS.has(pid)?' cut':''}" data-prev>${pid&&URLS.has(pid)?img(pid):`<span class="hint">Add ${l.toLowerCase()} photo</span>`}</div><input type="file" accept="image/*" data-file aria-label="${l} photo"></label>
        <div class="plabel">${l}</div>
        <span class="plinks"><button class="linkbtn" type="button" data-touch ${pid&&URLS.has(pid)&&cut?'':'hidden'}>Touch up</button><button class="linkbtn" type="button" data-clear ${pid&&URLS.has(pid)?'':'hidden'}>Remove photo</button></span>
      </div>`).join('')}</div>
    <p class="muted" id="cutMsg" aria-live="polite" style="margin:0;font-size:13px"></p>
    <div class="touch" id="touch" hidden><p class="muted" style="margin:0;font-size:13px">Tap any leftover background to erase it. Tap again on other bits, or Undo.</p>
      <canvas id="touchC"></canvas><div class="btns"><button class="btn sm primary" type="button" id="tDone">Done</button><button class="btn sm" type="button" id="tUndo" disabled>Undo</button><button class="btn sm" type="button" id="tCancel">Cancel</button></div></div>
    <div class="field"><label for="fName">Name</label><input id="fName" value="${esc(it?.name)}" placeholder="Black straight-leg jeans" autocomplete="off"></div>
    <div class="two">
      <div class="field"><label for="fType">Type</label>${typeSelect(it?.type)}</div>
      <div class="field"><span class="lblrow"><label for="fPrice">Price ($)</label><button class="taxbtn" type="button" id="addTax" aria-label="Add 13% tax to the price">+tax</button></span><input id="fPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(it?.price)}" placeholder="60"></div>
    </div>
    <div class="two" id="newTypeRow" hidden>
      <div class="field"><label for="fNewType">New type</label><input id="fNewType" placeholder="Polo shirts" autocomplete="off"></div>
      <div class="field"><label for="fGroup">Goes with</label><select id="fGroup">${GROUPS.map(([g])=>`<option>${g}</option>`).join('')}</select></div>
    </div>
    ${closets.length>1?`<div class="field"><label for="fCloset">Closet</label><select id="fCloset">${closets.map(([cid,c])=>`<option value="${cid}" ${cid===defCloset?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`:''}
    <div class="field"><span class="lbl">Main colour</span>
      <div class="colrow"><span class="bigsw" id="mainSw"></span><b id="mainName">Not set</b>
        <label class="btn sm pickbtn">Custom<input type="color" id="mainPick" aria-label="Choose an exact colour"></label>
        <button class="btn sm" type="button" id="fromPhoto">From photo</button></div>
      <div class="swatches" role="group" aria-label="Main colour">${GENERIC.map(([n,h])=>`<button type="button" data-main="${n}" style="background:${h}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      <p class="muted" style="margin:0;font-size:13px">Pick the exact shade with Custom or From photo, then tap a name to call it what you like.</p>
      <div class="eyedrop" id="eyedrop" hidden><p class="muted" style="margin:0;font-size:13px">Tap the part of the photo that shows the main colour.</p><canvas id="eyeCanvas"></canvas><button class="linkbtn" type="button" id="eyeCancel">Cancel</button></div>
    </div>
    <div class="field"><span class="lbl">Secondary colours <small class="muted" style="text-transform:none;letter-spacing:0">(tap all that apply)</small></span>
      <div class="swatches" role="group" aria-label="Secondary colours">${GENERIC.map(([n,h])=>`<button type="button" data-sec="${n}" style="background:${h}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      <p class="muted" id="secNames" style="margin:0;font-size:13px"></p>
    </div>
    ${tagsHTML(it)}
    ${pairsHTML(id)}
    <div class="btns"><button class="btn primary" type="button" id="save">${it?'Save changes':'Add to closet'}</button>
      ${it?`<button class="btn" type="button" id="wearToday">Wore it today</button><button class="btn danger" type="button" id="del">Delete</button>`:''}</div>`);
  // per-slot photo state: id = stored image, blob = new unsaved image, cleared = user removed it
  const P={front:{id:it?.imageId||null,cutout:!!it?.cutout,blob:null},back:{id:it?.backImageId||null,cutout:!!it?.backCutout,blob:null}};
  const cutMsg=sh.querySelector('#cutMsg');
  const TAG={seasons:new Set(it?.seasons||[]),dress:it?.dress??null,touched:false};wireTags(sh,TAG);
  const PR={needs:new Set(it?.needs||[]),goes:new Set(id?goesOf(id):[]),no:new Set(it?.goesNo||[])};wirePairs(sh,id,PR);
  sh.querySelectorAll('[data-slot]').forEach(slot=>{
    const k=slot.dataset.slot,st=P[k],prev=slot.querySelector('[data-prev]'),clr=slot.querySelector('[data-clear]');
    const show=()=>{const has=st.blob||st.id;prev.className='ph'+(has&&st.cutout?' cut':'');
      prev.innerHTML=st.blob?`<img src="${URL.createObjectURL(st.blob)}" alt="">`:st.id?img(st.id):`<span class="hint">Add ${k} photo</span>`;
      clr.hidden=!has;const tb=slot.querySelector('[data-touch]');if(tb)tb.hidden=!(has&&st.cutout);cutMsg.textContent=''};
    slot.querySelector('[data-file]').addEventListener('change',async e=>{
      const f=e.target.files[0];e.target.value='';if(!f)return;
      try{const r=await shrink(f);st.blob=r.blob;st.cutout=r.cutout;show()}catch(err){toast('That file type isn’t supported. Try a JPEG or PNG.');return}
      if(!st.cutout){
        const before=st.blob;
        try{const out=await removeBg(before,m=>cutMsg.textContent=m);if(st.blob===before){st.blob=out;st.cutout=true;show()}}
        catch(err){console.error(err);cutMsg.textContent='Couldn’t remove the background on this photo. Check your connection and choose the photo again.'}
      }
      const nameEl=sh.querySelector('#fName');
      if(k==='front'&&!nameEl.value.trim()&&ls.get('closet.autoDetect')!=='off'){
        try{
          const g=await autoDetect(st.blob,st.cutout,m=>cutMsg.textContent=m);
          if(!nameEl.value.trim())nameEl.value=g.name;
          const tSel=sh.querySelector('#fType');if(!id||!it?.type)tSel.value=g.type;
          if(!COL.name&&g.colour){COL.name=g.colour;COL.hex=g.colourHex;COL.sec=new Set((g.colours2||[]).filter(n=>n!==g.colour));paintCol()}
          cutMsg.textContent=`Detected ${g.name.toLowerCase()} (${g.type}). Change anything that’s wrong.`;
        }catch(err){console.error(err);cutMsg.textContent='Couldn’t recognize the item automatically. Fill in the details below.'}
      }
    });
    clr.addEventListener('click',()=>{st.blob=null;st.id=null;st.cutout=false;show()});
    slot.querySelector('[data-touch]')?.addEventListener('click',()=>touchUp(sh,st,show));
  });
  const tSel=sh.querySelector('#fType');tSel.addEventListener('change',()=>{sh.querySelector('#newTypeRow').hidden=tSel.value!=='__new'});
  // colour state: main (plain name + exact shade) and a set of secondary names
  sh.querySelector('#addTax').addEventListener('click',()=>{const f=sh.querySelector('#fPrice'),v=Number(f.value);
    if(!f.value||!(v>0)){toast('Enter a price first.');return}const nv=Math.round(v*1.13*100)/100;f.value=nv.toFixed(2);toast(`Added 13% tax: $${v.toFixed(2)} → $${nv.toFixed(2)}`)});
  const COL={name:genericName(it?.colour)||'',hex:it?.colourHex||null,named:!!it?.colourNamed,sec:new Set(it?.colours2||[])};
  function paintCol(){
    const sw=COL.hex||GEN_HEX[COL.name]||okColour(COL.name);
    sh.querySelector('#mainSw').style.background=sw||'transparent';sh.querySelector('#mainSw').classList.toggle('empty',!sw);
    sh.querySelector('#mainName').textContent=COL.name?COL.name[0].toUpperCase()+COL.name.slice(1):'Not set';
    if(COL.hex)sh.querySelector('#mainPick').value=COL.hex;
    sh.querySelectorAll('[data-main]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.main===COL.name));
    sh.querySelectorAll('[data-sec]').forEach(b=>b.setAttribute('aria-pressed',COL.sec.has(b.dataset.sec)));
    sh.querySelector('#secNames').textContent=COL.sec.size?[...COL.sec].join(', '):'None';
  }
  sh.querySelectorAll('[data-main]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.main;if(COL.name===n&&COL.named){COL.name='';COL.hex=null;COL.named=false}else{COL.name=n;COL.named=true;COL.sec.delete(n)}paintCol()}));
  sh.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.sec;COL.sec.has(n)?COL.sec.delete(n):COL.sec.add(n);paintCol()}));
  sh.querySelector('#mainPick').addEventListener('input',e=>{COL.hex=e.target.value;if(!COL.named)COL.name=hexToName(COL.hex);COL.sec.delete(COL.name);paintCol()});
  const eye=sh.querySelector('#eyedrop'),ec=sh.querySelector('#eyeCanvas');
  sh.querySelector('#fromPhoto').addEventListener('click',async()=>{
    const st=P.front.blob||P.back.blob?(P.front.blob?P.front:P.back):(P.front.id?P.front:P.back.id?P.back:null);
    if(!st){toast('Add a photo first.');return}
    const blob=st.blob||await idbGet('images',st.id);if(!blob){toast('That photo isn’t on this device yet.');return}
    const im=await loadImage(URL.createObjectURL(blob));const sc=Math.min(1,900/Math.max(im.naturalWidth,im.naturalHeight));
    ec.width=Math.round(im.naturalWidth*sc);ec.height=Math.round(im.naturalHeight*sc);
    const g=ec.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,ec.width,ec.height);g.drawImage(im,0,0,ec.width,ec.height);URL.revokeObjectURL(im.src);
    eye.hidden=false;eye.scrollIntoView({block:'center',behavior:'smooth'});
  });
  sh.querySelector('#eyeCancel').addEventListener('click',()=>{eye.hidden=true});
  ec.addEventListener('click',e=>{
    const r=ec.getBoundingClientRect(),x=Math.round((e.clientX-r.left)/r.width*ec.width),y=Math.round((e.clientY-r.top)/r.height*ec.height);
    const k=3,d=ec.getContext('2d').getImageData(clamp(x-k,0,ec.width-1),clamp(y-k,0,ec.height-1),k*2+1,k*2+1).data;
    let R=0,G=0,B=0,n=0;for(let i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2];n++}
    COL.hex=rgbToHex(R/n,G/n,B/n);if(!COL.named)COL.name=hexToName(COL.hex);COL.sec.delete(COL.name);paintCol();eye.hidden=true;
    toast(COL.named?`Shade picked. Still called ${COL.name}.`:`Main colour set to ${COL.name}`);
  });
  paintCol();
  const save=sh.querySelector('#save');
  save.addEventListener('click',()=>guard(save,async()=>{
    const name=sh.querySelector('#fName').value.trim();if(!name){sh.querySelector('#fName').focus();toast('Give it a name first.');return}
    let type=tSel.value,group=GROUP_OF[type]||it?.group||'Other';
    if(type==='__new'){type=sh.querySelector('#fNewType').value.trim();group=sh.querySelector('#fGroup').value;if(!type){sh.querySelector('#fNewType').focus();toast('Name the new type.');return}}
    const pv=sh.querySelector('#fPrice').value;
    const data={name,price:pv===''?null:Math.round(Number(pv)*100)/100,type,group,closetId:sh.querySelector('#fCloset')?.value||defCloset,colour:COL.name,colourHex:COL.hex||null,colourNamed:COL.named&&!!COL.name,colours2:[...COL.sec].filter(n=>n!==COL.name),style:TAG.dress!=null?dressWord(TAG.dress):(it?.dress!=null?dressWord(it.dress):''),createdAt:it?.createdAt||Date.now()};
    const drop=[];
    for(const[k,idKey,cutKey]of[['front','imageId','cutout'],['back','backImageId','backCutout']]){
      const st=P[k],oldId=it?.[idKey]||null;
      if(st.blob){data[idKey]=await addImage(st.blob);data[cutKey]=st.cutout;if(oldId)drop.push(oldId)}
      else if(st.id){data[idKey]=st.id;data[cutKey]=st.cutout}
      else{data[idKey]=null;data[cutKey]=false;if(oldId)drop.push(oldId)}
    }
    if(TAG.touched||it?.seasons!==undefined)data.seasons=SEASONS.map(x=>x[0]).filter(k=>TAG.seasons.has(k));
    if(TAG.dress!=null)data.dress=TAG.dress;
    data.needs=[...PR.needs].filter(x=>S.items.has(x));data.goes=[...PR.goes].filter(x=>S.items.has(x));data.goesNo=[...PR.no];
    const sid=id||newId();
    await saveDoc('items',sid,{...(it||{}),...data});
    await savePairLinks(sid,PR.goes);
    for(const d of drop)await dropImage(d);
    closeSheet();toast(id?'Saved':`Added to ${closetName(data.closetId)}`);
  }));
  if(it){
    const wt=sh.querySelector('#wearToday');
    wt.addEventListener('click',()=>guard(wt,async()=>{const t=today(),p=S.plans.get(t);const ids=[...new Set([...(p?.itemIds||[]),id])];await saveDoc('plans',t,{itemIds:ids,outfitId:matchOutfit(ids),note:p?.note||''});closeSheet();toast('Logged for today')}));
    const del=sh.querySelector('#del');
    armDelete(del,()=>guard(del,async()=>{await delDoc('items',id);for(const d of imageIdsOf(it))await dropImage(d);closeSheet();toast('Deleted')}));
  }
}

// switch closets from the title; "Edit closets" opens the editor
function closetSwitcher(){
  const counts={};for(const it of S.items.values()){const c=closetOf(it);counts[c]=(counts[c]||0)+1}
  const list=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  const row=(id,name,n)=>`<button type="button" class="li cswitch" data-cs="${id}" aria-pressed="${S.closet===id}"><span class="tx"><b>${esc(name)}</b><small>${n} piece${n===1?'':'s'}</small></span>${S.closet===id?'<span class="ccheck" aria-hidden="true">✓</span>':''}</button>`;
  const sh=openSheet(`${head('Your closets')}<div class="list">${list.length>1?row('all','All closets',S.items.size):''}${list.map(([id,c])=>row(id,c.name,counts[id]||0)).join('')}</div>
    <div class="btns"><button class="btn" type="button" id="csEdit">${list.length>1?'Edit closets':'+ Add a closet'}</button></div>`);
  sh.addEventListener('click',e=>{
    const b=e.target.closest('[data-cs]');if(b){S.closet=b.dataset.cs;S.type='All';S.group='All';ls.set('closet.current',S.closet);closeSheet();render();scrollTo(0,0);return}
    if(e.target.closest('#csEdit')){closeSheet();closetsSheet()}
  });
}
function closetsSheet(){
  const counts={};for(const it of S.items.values()){const c=closetOf(it);counts[c]=(counts[c]||0)+1}
  const list=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  const sh=openSheet(`${head('Your closets')}
    <p class="muted" style="margin:0">Keep separate closets for different places or seasons, like home, dorm or summer.</p>
    <div class="list">${list.map(([id,c])=>`<div class="crow"><input value="${esc(c.name)}" data-cname="${id}" aria-label="Closet name" autocomplete="off"><span class="muted">${counts[id]||0}</span>${list.length>1?`<button class="btn danger sm" type="button" data-cdel="${id}">Delete</button>`:''}</div>`).join('')}</div>
    <div class="crow"><input id="newCloset" placeholder="New closet name" autocomplete="off"><button class="btn primary sm" type="button" id="addCloset">Add</button></div>
    <p class="muted" id="cMsg" style="margin:0" aria-live="polite"></p>
    <div class="btns"><button class="btn primary" type="button" id="cDone">Done</button></div>`);
  const msg=sh.querySelector('#cMsg');
  sh.querySelectorAll('[data-cname]').forEach(inp=>inp.addEventListener('change',async()=>{const v=inp.value.trim(),id=inp.dataset.cname;if(!v){inp.value=S.closets.get(id).name;return}await saveDoc('closets',id,{...S.closets.get(id),name:v});msg.textContent='Renamed.'}));
  sh.querySelectorAll('[data-cdel]').forEach(b=>{const id=b.dataset.cdel;
    if(counts[id]){b.addEventListener('click',()=>{msg.textContent=`Move or delete the ${counts[id]} piece${counts[id]===1?'':'s'} in “${S.closets.get(id).name}” first. Open a piece to change its closet.`});return}
    armDelete(b,async()=>{await delDoc('closets',id);if(S.closet===id){S.closet='all';ls.set('closet.current','all')}closeSheet();closetsSheet()})});
  sh.querySelector('#addCloset').addEventListener('click',async()=>{const v=sh.querySelector('#newCloset').value.trim();if(!v){sh.querySelector('#newCloset').focus();return}const id=newId();await saveDoc('closets',id,{name:v,createdAt:Date.now()});S.closet=id;ls.set('closet.current',id);closeSheet();closetsSheet();toast(`Added ${v}`)});
  sh.querySelector('#cDone').addEventListener('click',closeSheet);
}

function matchOutfit(ids){const k=[...ids].sort().join('|');for(const[oid,o]of S.outfits)if([...(o.itemIds||[])].sort().join('|')===k)return oid;return null}

function pickerHTML(sel){
  if(!S.items.size)return `<p class="muted" style="margin:0">Add pieces to your closet first.</p>`;
  const items=[...S.items.entries()].sort((a,b)=>typeRank(typeOf(a[1]))-typeRank(typeOf(b[1]))||(a[1].name||'').localeCompare(b[1].name||''));
  const multi=S.closets.size>1;
  return `<input class="search" type="search" id="pkQ" placeholder="Search pieces" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Find a piece"><div class="picker" id="picker">${items.map(([id,i])=>`<button type="button" class="pk" data-pk="${id}" data-txt="${esc([i.name,i.colour,styleOf(i),typeOf(i),groupOf(i),multi?closetName(closetOf(i)):''].join(' ').toLowerCase())}" aria-pressed="${sel.has(id)}"><div class="${phCls(i)}">${thumb(i)}</div><small>${esc(i.name)}</small></button>`).join('')}</div>`;
}
function wirePicker(sh,sel,onChange){
  sh.querySelectorAll('[data-pk]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.pk;sel.has(id)?sel.delete(id):sel.add(id);b.setAttribute('aria-pressed',sel.has(id));onChange&&onChange()}));
  const q=sh.querySelector('#pkQ');q&&q.addEventListener('input',()=>{const v=q.value.toLowerCase();sh.querySelectorAll('[data-pk]').forEach(b=>b.hidden=!!v&&!b.dataset.txt.includes(v))});
}

function outfitSheet(id,preset){
  const o=id?S.outfits.get(id):null;if(id&&!o)return;
  const sel=new Set((preset||o?.itemIds||[]).filter(i=>S.items.has(i)));const r=id?wear().outfits[id]:null,l=last(r);
  let layout=autoLayout([...sel],o?.layout||{});
  const cost=ids=>[...ids].reduce((a,i)=>a+(Number(S.items.get(i)?.price)||0),0);
  const sh=openSheet(`${head(o?esc(o.name||'Outfit'):'New outfit')}
    ${o?`<div class="stats"><div class="stat"><b>${l?shortAgo(l):'Never'}</b><small>Last worn</small></div><div class="stat"><b>${r?.worn.length||0}×</b><small>Worn</small></div><div class="stat"><b>${r?.next?parse(r.next).toLocaleDateString('en-CA',{month:'short',day:'numeric'}):'—'}</b><small>Next planned</small></div></div>`:''}
    ${o&&r?.worn.length?`<p class="muted" style="margin:0">Worn on ${r.worn.slice(-6).reverse().map(fmtDate).join(' · ')}</p>`:''}
    <div class="field"><label for="oName">Name</label><input id="oName" value="${esc(o?.name)}" placeholder="Friday dinner" autocomplete="off"></div>
    <div class="boardwrap"><div class="board big edit" id="oBoard"></div>${boardTools}<p class="muted bhint">Drag pieces to arrange them. Tap one to resize or layer it.</p></div>
    <div class="lbl" id="selLbl"></div>
    ${pickerHTML(sel)}
    <div class="field"><label for="oDate">Plan it for</label><input id="oDate" type="date" value="${today()}"></div>
    <div class="btns"><button class="btn primary" type="button" id="save">${o?'Save outfit':'Create outfit'}</button><button class="btn" type="button" id="plan">Save &amp; put on calendar</button>
    ${o?`<button class="btn danger" type="button" id="del">Delete</button>`:''}</div>`);
  const board=sh.querySelector('#oBoard');
  const lbl=()=>{const c=cost(sel);sh.querySelector('#selLbl').textContent=`Pieces · ${sel.size} selected${c?' · '+money(c):''}`};
  const B=wireBoard(board,()=>layout,()=>{},rid=>{sel.delete(rid);delete layout[rid];sh.querySelector(`[data-pk="${rid}"]`)?.setAttribute('aria-pressed','false');lbl()});
  B.redraw();lbl();
  wirePicker(sh,sel,()=>{layout=autoLayout([...sel],layout);B.deselect();B.redraw();lbl()});
  const write=async()=>{
    if(!sel.size){toast('Pick at least one piece.');return null}
    const name=sh.querySelector('#oName').value.trim()||'Outfit '+(S.outfits.size+(o?0:1));
    const oid=id||newId();const lay={};for(const k of sel)if(layout[k])lay[k]=layout[k];
    await saveDoc('outfits',oid,{name,itemIds:[...sel],layout:lay,createdAt:o?.createdAt||Date.now()});return oid;
  };
  const save=sh.querySelector('#save');save.addEventListener('click',()=>guard(save,async()=>{if(await write()){closeSheet();toast('Outfit saved')}}));
  const plan=sh.querySelector('#plan');plan.addEventListener('click',()=>guard(plan,async()=>{
    const d=sh.querySelector('#oDate').value;if(!d){toast('Pick a date.');return}
    const oid=await write();if(!oid)return;
    await saveDoc('plans',d,{itemIds:[...sel],outfitId:oid,note:S.plans.get(d)?.note||''});
    closeSheet();toast(d<=today()?`Logged for ${fmtDate(d)}`:`Planned for ${fmtDate(d)}`);
  }));
  if(o){const del=sh.querySelector('#del');armDelete(del,()=>guard(del,async()=>{await delDoc('outfits',id);closeSheet();toast('Outfit deleted')}))}
}

function daySheet(date){
  const p=S.plans.get(date);const sel=new Set((p?.itemIds||[]).filter(i=>S.items.has(i)));let outfitId=p?.outfitId||null;
  const past=date<=today();
  const outs=[...S.outfits.entries()];
  const sh=openSheet(`${head(esc(fmtDate(date)))}
    ${(()=>{const w=date>=today()&&wxDay(date);if(!w)return '';const[k,lab]=wxKind(w.code);return `<div class="wxline">${wxSvg(k)}<span><b>${lab}</b>, high ${w.hi}° / low ${w.lo}°${w.pop!=null&&w.pop>=10?` · ${w.pop}% chance of rain`:''}</span></div>`})()}
    ${(()=>{const lks=[...S.looks.entries()].filter(([,x])=>x.date===date&&x.status===LOOK_DONE&&URLS.has(x.imageId));return lks.length?`<div class="hscroll">${lks.map(([lid,x])=>`<button type="button" class="lkthumb" data-daylook="${lid}" aria-label="Open photo">${img(x.imageId)}</button>`).join('')}</div>`:''})()}
    <p class="muted" style="margin:0">${past?'Log what you wore. It counts toward “last worn”.':'Plan what you’ll wear.'}</p>
    ${outs.length?`<div class="lbl">Saved outfits</div><div class="hscroll">${outs.map(([oid,o])=>`<button type="button" class="oc" data-oc="${oid}" aria-pressed="${outfitId===oid}">${boardHTML(o.itemIds||[],o.layout)}<small>${esc(o.name)}</small></button>`).join('')}</div>`:''}
    <div class="lbl" id="selLbl"></div>
    ${pickerHTML(sel)}
    <div class="field" id="newWrap"><label for="dNew">Save these pieces as a new outfit (optional)</label><input id="dNew" placeholder="Outfit name" autocomplete="off"></div>
    <div class="field"><label for="dNote">Note</label><input id="dNote" value="${esc(p?.note)}" placeholder="Sarah’s birthday, rain expected…" autocomplete="off"></div>
    <div class="btns"><button class="btn primary" type="button" id="save">${past?'Save':'Plan it'}</button>${p?`<button class="btn danger" type="button" id="del">Clear day</button>`:''}</div>`);
  const sync_=()=>{
    outfitId=matchOutfit(sel);
    sh.querySelectorAll('[data-oc]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.oc===outfitId));
    sh.querySelectorAll('[data-pk]').forEach(b=>b.setAttribute('aria-pressed',sel.has(b.dataset.pk)));
    const o=outfitId&&S.outfits.get(outfitId);
    sh.querySelector('#selLbl').textContent=`Pieces · ${sel.size} selected${o?' · '+o.name:''}`;
    sh.querySelector('#newWrap').hidden=!!outfitId||!sel.size;
  };
  sh.querySelectorAll('[data-oc]').forEach(b=>b.addEventListener('click',()=>{const was=outfitId===b.dataset.oc;sel.clear();if(!was)(S.outfits.get(b.dataset.oc).itemIds||[]).forEach(i=>S.items.has(i)&&sel.add(i));sync_()}));
  wirePicker(sh,sel,sync_);sync_();
  sh.querySelectorAll('[data-daylook]').forEach(b=>b.addEventListener('click',()=>{closeSheet();lookSheet(b.dataset.daylook)}));
  const save=sh.querySelector('#save');save.addEventListener('click',()=>guard(save,async()=>{
    if(!sel.size){toast('Pick an outfit or some pieces.');return}
    let oid=outfitId;const nn=sh.querySelector('#dNew').value.trim();
    if(!oid&&nn){oid=newId();await saveDoc('outfits',oid,{name:nn,itemIds:[...sel],layout:autoLayout([...sel]),createdAt:Date.now()})}
    await saveDoc('plans',date,{itemIds:[...sel],outfitId:oid,note:sh.querySelector('#dNote').value.trim()});
    closeSheet();toast(past?'Logged':'Planned');
  }));
  if(p){const del=sh.querySelector('#del');armDelete(del,()=>guard(del,async()=>{await delDoc('plans',date);closeSheet();toast('Day cleared')}),'Clear day')}
}

function syncSheet(){
  const c=GH.cfg();
  const sh=openSheet(`${head('GitHub sync')}
    <div class="box"><p id="syncStatus">${esc(syncText())}</p></div>
    ${c?`<div class="box"><p>Connected to <code>${esc(c.repo)}</code>. Changes upload a few seconds after you make them, and the app checks for updates from your other devices each time you open it.</p></div>
      <div class="btns"><button class="btn primary" type="button" id="syncNow">Sync now</button><button class="btn danger" type="button" id="disc">Disconnect</button></div>
      <p class="muted" style="margin:0;font-size:13px">Disconnecting removes the token from this device only. Your closet stays on this device and in the repo.</p>`
    :`<div class="box"><p>Back up your closet to your own <b>private</b> GitHub repo, and use it on more than one device. You only do this once per device.</p>
      <ol>
        <li><a href="https://github.com/new" target="_blank" rel="noopener">Create a new repo</a> named <code>closet-data</code>. Set it to <b>Private</b>.</li>
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a fine-grained token</a>. Under Repository access, choose <b>Only select repositories</b> → <code>closet-data</code>. Under Permissions → Repository permissions, set <b>Contents</b> to <b>Read and write</b>. Pick the longest expiration offered.</li>
        <li>Copy the token and paste it below.</li>
      </ol></div>
      <div class="field"><label for="ghRepo">Repository</label><input id="ghRepo" placeholder="your-username/closet-data" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(ls.get('closet.ghRepo')||'')}"></div>
      <div class="field"><label for="ghTok">Token</label><input id="ghTok" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <div class="btns"><button class="btn primary" type="button" id="conn">Connect and sync</button></div>
      <p class="muted" style="margin:0;font-size:13px">The token is stored only on this device and is sent only to GitHub. If you already use the app on another device, connecting merges both closets.</p>`}`);
  if(c){
    const sn=sh.querySelector('#syncNow');sn.addEventListener('click',async()=>{sn.disabled=true;await sync();sn.disabled=false;const s=sh.querySelector('#syncStatus');if(s)s.textContent=syncText()});
    armDelete(sh.querySelector('#disc'),()=>{ls.set('closet.gh',null);ls.set('closet.lastSync',null);setSync('off');closeSheet();render();toast('Disconnected on this device')},'Disconnect');
  }else{
    const b=sh.querySelector('#conn');
    b.addEventListener('click',async()=>{
      const repo=sh.querySelector('#ghRepo').value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/\/+$/,'');
      const token=sh.querySelector('#ghTok').value.trim();
      const st=sh.querySelector('#syncStatus');
      if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){st.textContent='Enter the repo as username/repo-name.';return}
      if(!token){st.textContent='Paste your token.';return}
      b.disabled=true;st.textContent='Checking…';
      try{
        const info=await(await GH.req('',{},{repo,token})).json();
        if(!info.private){st.textContent='That repo is public, so anyone could see your closet. Make it private in the repo’s Settings, then try again.';return}
        if(info.permissions&&info.permissions.push===false){st.textContent='The token can’t write to this repo. Give it “Contents: Read and write” access.';return}
        ls.set('closet.ghRepo',repo);ls.set('closet.gh',JSON.stringify({repo,token}));
        st.textContent='Connected. Syncing…';await sync();closeSheet();render();toast(S.sync.state==='err'?S.sync.msg:'Synced with GitHub');
      }catch(e){st.textContent=syncError(e)}
      finally{b.disabled=false}
    });
  }
}

// Once per item: remove the background from photos that still have one, and tidy older cut-outs
// (fill see-through specks, re-crop so the item fills its tile). fit level 3.
async function refitCutouts(){
  let changed=0,bgDone=0;
  const crashed=ls.get('closet.bgJob');
  if(crashed){
    ls.set('closet.bgJob',null);
    const it=S.items.get(crashed);
    if(it){const v={...it,fit:4,updatedAt:Date.now()};await idbPut('items',crashed,v);S.items.set(crashed,v)}
    console.warn('skipped a photo that stopped the app last time',crashed);
    return; // try the rest next time the app opens
  }
  const bgTotal=[...S.items.values()].filter(it=>(it.fit||0)<4).reduce((n,it)=>n+(it.imageId&&!it.cutout?1:0)+(it.backImageId&&!it.backCutout?1:0),0);
  for(const[iid,it]of[...S.items]){
    if((it.fit||0)>=4)continue;
    const v={...it,fit:4};let failed=false;
    for(const[idKey,cutKey]of[['imageId','cutout'],['backImageId','backCutout']]){
      const id=it[idKey];if(!id)continue;
      const blob=await idbGet('images',id);if(!blob)continue;
      if(!it[cutKey]){
        bgDone++;S.notice=`Removing backgrounds from your photos (${bgDone} of ${bgTotal}). Keep the app open.`;render();
        ls.set('closet.bgJob',iid);
        try{v[idKey]=await addImage(await removeBg(blob,()=>{}));v[cutKey]=true;await dropImage(id)}catch(e){console.warn('auto background',e);failed=true}
        ls.set('closet.bgJob',null);
        continue;
      }
      if((it.fit||0)>=2)continue;
      try{
        let src=blob,touched=false;
        const rep=await repairCutout(blob);if(rep.fixed){src=rep.blob;touched=true}
        const im=await loadImage(URL.createObjectURL(src));
        const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);URL.revokeObjectURL(im.src);
        const out=await trimToBlob(c);const om=await loadImage(URL.createObjectURL(out));URL.revokeObjectURL(om.src);
        if(om.naturalWidth*om.naturalHeight<c.width*c.height*.9){src=out;touched=true}
        if(touched){v[idKey]=await addImage(src);await dropImage(id)}
      }catch(e){console.warn('refit',e)}
    }
    // items saved as grey: recheck the colour with the shading-aware detector (fixes white/black read as grey)
    if((it.fit||0)<4&&!it.colourNamed&&genericName(it.colour)==='grey'&&v.imageId){
      try{const b=await idbGet('images',v.imageId);const col=b&&await detectColour(b,v.cutout);
        if(col&&col.name!=='grey'){const oldWord=/^(light |dark )?grey /i,cap=w=>w[0].toUpperCase()+w.slice(1);
          v.colour=col.name;v.colourHex=col.hex;v.colours2=(v.colours2||[]).filter(c=>c!==col.name);
          if(oldWord.test(v.name||''))v.name=cap(colourWord(col))+' '+v.name.replace(oldWord,'')}}
      catch(e){console.warn('recolour',e)}
    }
    if(!S.items.has(iid))continue;
    if(failed)v.fit=2; // try the background again next time the app opens
    v.updatedAt=Date.now();await idbPut('items',iid,v);S.items.set(iid,v);changed++;
    await new Promise(r=>setTimeout(r,0));
  }
  if(S.notice.startsWith('Removing backgrounds'))S.notice='';
  if(changed){render();scheduleSync()}
}
/* ---------- looks: photos of you wearing your clothes. Confirm the pieces and they're logged on the day the photo was taken ---------- */
const LOOK_DONE='done',LOOK_SKIP='skipped';
// Capture date from a JPEG's EXIF (DateTimeOriginal, else DateTime) as YYYY-MM-DD, or null.
async function exifDate(file){
  try{
    const v=new DataView(await file.slice(0,256*1024).arrayBuffer());
    if(v.getUint16(0)!==0xFFD8)return null;
    let o=2;
    while(o+10<v.byteLength){
      const m=v.getUint16(o),len=v.getUint16(o+2);
      if(m===0xFFE1&&v.getUint32(o+4)===0x45786966){
        const t=o+10,le=v.getUint16(t)===0x4949,u16=p=>v.getUint16(t+p,le),u32=p=>v.getUint32(t+p,le);
        const str=p=>{let s='';for(let i=0;i<19;i++){const c=v.getUint8(t+p+i);if(!c)break;s+=String.fromCharCode(c)}return s};
        const ifd=(p,want)=>{const n=u16(p),out={};for(let i=0;i<n;i++){const e=p+2+i*12,tag=u16(e);if(want.includes(tag))out[tag]=tag===0x8769?u32(e+8):str(u32(e+8))}return out};
        const i0=ifd(u32(4),[0x0132,0x8769]);
        const dt=(i0[0x8769]&&ifd(i0[0x8769],[0x9003])[0x9003])||i0[0x0132];
        const mm=dt&&dt.match(/^(\d{4}):(\d{2}):(\d{2})/);
        return mm&&mm[1]>'1990'?`${mm[1]}-${mm[2]}-${mm[3]}`:null;
      }
      if((m&0xFF00)!==0xFF00||m===0xFFDA)break;
      o+=2+len;
    }
  }catch(e){}
  return null;
}
async function lookImage(file){
  const url=URL.createObjectURL(file);let im;
  try{im=await loadImage(url)}catch(e){throw{code:'unsupported_type'}}finally{URL.revokeObjectURL(url)}
  const s=Math.min(1,1100/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
  c.width=Math.round(im.naturalWidth*s);c.height=Math.round(im.naturalHeight*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
}
async function importLooks(files){
  const sigs=new Set([...S.looks.values()].map(l=>l.sig).filter(Boolean));let added=0,dupes=0,bad=0,undated=0;
  for(let i=0;i<files.length;i++){
    const f=files[i];S.notice=`Adding photos (${i+1} of ${files.length}). Keep the app open.`;render();await paintPause();
    try{
      const ex=await exifDate(f),sig=`${ex||''}|${f.size}`;if(sigs.has(sig)){dupes++;continue}
      const date=ex||ymd(new Date(f.lastModified||Date.now()));if(!ex)undated++;
      const imageId=await addImage(await lookImage(f));
      const lid=newId(),doc={imageId,date,dateGuess:!ex,status:'new',source:'phone',sig,createdAt:Date.now(),updatedAt:Date.now()};
      await idbPut('looks',lid,doc);S.looks.set(lid,doc);sigs.add(sig);added++;
    }catch(e){console.warn(e);bad++}
  }
  S.notice='';S.lookFilter='todo';render();scheduleSync();
  toast([added?`Added ${added} photo${added===1?'':'s'}`:'No new photos',dupes?`${dupes} already here`:'',bad?`${bad} couldn’t be read`:'',undated?`check the date on ${undated}`:''].filter(Boolean).join(' · '));
}
function looksView(){
  if(!S.ready)return '';
  const all=[...S.looks.entries()].sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||'')||(b[1].createdAt||0)-(a[1].createdAt||0));
  const isTodo=l=>l.status!==LOOK_DONE&&l.status!==LOOK_SKIP;
  const todo=all.filter(([,l])=>isTodo(l)),done=all.filter(([,l])=>l.status===LOOK_DONE),skipped=all.filter(([,l])=>l.status===LOOK_SKIP);
  const add=`<label class="bulkbtn filebtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2.5"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8.5 5l1.5-2h4l1.5 2"/></svg>Add photos of you<input type="file" accept="image/*" multiple id="lookFiles"></label>`;
  if(!all.length)return add+empty('No looks yet','Add photos of yourself wearing your clothes. Pick the pieces you’re wearing and they’re logged on the day the photo was taken.');
  const f=['todo','done','skipped','all'].includes(S.lookFilter)?S.lookFilter:'todo';
  const list={todo,done,skipped,all}[f];
  const chip=(k,l,n)=>`<button class="chip" type="button" data-lookf="${k}" aria-pressed="${f===k}">${l} <small>${n}</small></button>`;
  return add+`<div class="chips" role="group" aria-label="Show">${chip('todo','To check',todo.length)}${chip('done','Logged',done.length)}${skipped.length?chip('skipped','Skipped',skipped.length):''}${chip('all','All',all.length)}</div>
    ${f==='todo'&&todo.length?`<p class="muted" style="margin:0;font-size:13px">Tap a photo, check the pieces you’re wearing, and it’s added to that day on the calendar.</p>`:''}
    ${list.length?`<div class="lgrid">${list.map(([id,l])=>`<button type="button" class="look" data-look="${id}" aria-label="Look from ${fmtDate(l.date)}"><div class="ph">${img(l.imageId)}${l.status===LOOK_DONE?'<span class="lbadge" aria-hidden="true">✓</span>':''}</div><small>${fmtDate(l.date)}${l.status===LOOK_DONE&&l.itemIds?.length?` · ${l.itemIds.length} piece${l.itemIds.length===1?'':'s'}`:''}</small></button>`).join('')}</div>`
      :`<p class="muted">${f==='todo'?'All caught up. Every photo has been checked.':'Nothing here yet.'}</p>`}`;
}
async function embStore(key,make){
  let e=null;try{e=await idbGet('emb',key)}catch(_){}
  if(e&&e.ie)return e;e=await make();if(e)try{await idbPut('emb',key,e)}catch(_){}
  return e;
}
// --- best guess of the pieces in a look ---
// 1) a clothing-segmentation model finds each garment you're wearing (top, pants, skirt, dress, shoes, bag…)
// 2) each garment is cut out on white and compared with the pieces of that kind in your closet, by look (CLIP) and by colour
// 3) a piece is pre-ticked only when it's a clear match; otherwise it's just suggested
const cosSim=(a,b)=>{let d=0;for(let k=0;k<a.ie.length;k++)d+=a.ie[k]*b.ie[k];return d/(a.norm*b.norm)};
function toLab(r,g,b){const f=c=>{c/=255;return c>.04045?((c+.055)/1.055)**2.4:c/12.92};const R=f(r),G=f(g),B=f(b);
  const x=(R*.4124+G*.3576+B*.1805)/.95047,y=R*.2126+G*.7152+B*.0722,z=(R*.0193+G*.1192+B*.9505)/1.08883,h=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
  return[116*h(y)-16,500*(h(x)-h(y)),200*(h(y)-h(z))]}
const medLab=px=>{if(!px.length)return null;const L=px.map(p=>toLab(p[0],p[1],p[2]));return[0,1,2].map(k=>L.map(v=>v[k]).sort((a,b)=>a-b)[L.length>>1])};
const dE=(a,b)=>Math.hypot((a[0]-b[0])*.5,a[1]-b[1],a[2]-b[2]);
const isT=(...t)=>i=>t.includes(typeOf(i));
const inG=(...g)=>i=>g.includes(groupOf(i));
const SEG_REGIONS=[
  {key:'top',label:'Top',cls:[4],min:.012,ok:i=>inG('Tops','Jackets')(i)},
  {key:'dress',label:'Dress',cls:[7],min:.02,ok:inG('Full length')},
  {key:'pants',label:'Bottoms',cls:[6],min:.01,ok:i=>(inG('Bottoms')(i)&&!isT('Skirts')(i))||isT('Activewear','Jumpsuits')(i)},
  {key:'skirt',label:'Skirt',cls:[5],min:.008,ok:isT('Skirts','Shorts')},
  {key:'shoes',label:'Shoes',cls:[9,10],min:.0015,ok:isT('Footwear','Heels'),all:true},
  {key:'bag',label:'Bag',cls:[16],min:.003,ok:isT('Bags')},
  {key:'hat',label:'Hat',cls:[1],min:.003,ok:isT('Hats')},
  {key:'glasses',label:'Glasses',cls:[3],min:.001,ok:isT('Glasses')}];
// connected components of the pixels where keep(i) is true; returns arrays of indices, biggest first
function components(w,h,keep){
  const seen=new Uint8Array(w*h),out=[],q=new Int32Array(w*h);
  for(let s=0;s<w*h;s++){if(seen[s]||!keep(s))continue;let qh=0,qt=0;q[qt++]=s;seen[s]=1;
    while(qh<qt){const i=q[qh++],x=i%w;for(const j of[x>0?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<w*h&&!seen[j]&&keep(j)){seen[j]=1;q[qt++]=j}}
    out.push(Array.from(q.subarray(0,qt)))}
  return out.sort((a,b)=>b.length-a.length);
}
async function itemColour(i){
  return embStore('col:'+i.imageId,async()=>{
    const b=await idbGet('images',i.imageId);if(!b)return null;
    const im=await loadImage(URL.createObjectURL(b));URL.revokeObjectURL(im.src);const c=document.createElement('canvas'),s=Math.min(1,160/Math.max(im.naturalWidth,im.naturalHeight));
    c.width=Math.max(1,Math.round(im.naturalWidth*s));c.height=Math.max(1,Math.round(im.naturalHeight*s));const g=c.getContext('2d');g.drawImage(im,0,0,c.width,c.height);
    const d=g.getImageData(0,0,c.width,c.height).data,px=[],cut=!!i.cutout;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const k=(y*c.width+x)*4;if(cut?d[k+3]<200:(x<c.width*.3||x>c.width*.7||y<c.height*.25||y>c.height*.75))continue;px.push([d[k],d[k+1],d[k+2]])}
    const lab=medLab(px);return lab?{ie:[0],norm:1,lab}:null;   // stored in the same cache shape
  });
}

// What the app has learned from your logged looks: for each piece, how it looked in your photos
// (the garment cut-out, kept on this device, and its colour, which syncs) and how often it was suggested but rejected.
async function lookMemory(){
  const worn={},rej={},cnt={};
  for(const l of S.looks.values()){
    for(const id of l.rej||[])rej[id]=(rej[id]||0)+1;
    if(l.status!==LOOK_DONE||!l.learn)continue;
    for(const[key,m]of Object.entries(l.learn)){
      if(!m||!S.items.has(m.item))continue;
      let emb=null;try{emb=await idbGet('emb',`seg:${l.imageId}:${m.p??0}:${key}`)}catch(_){}
      (worn[m.item]??=[]).push({emb:emb&&emb.ie?emb:null,lab:m.lab||null});cnt[m.item]=(cnt[m.item]||0)+1;
    }
  }
  return{worn,rej,cnt};
}
async function guessLook(lid,status){
  const l=S.looks.get(lid);const blob=l&&await idbGet('images',l.imageId);if(!blob)throw new Error('photo not on this device');
  const dl=m=>{if(/Downloading/.test(m))status(m)};
  // where are the clothes?
  status('Finding your clothes in the photo…');
  const{lab,w,h}=await ml('seg',{blob},dl);
  // the people: each sizeable face gives an area below it; clothes far to either side belong to someone else.
  // We try each person and keep the one whose clothes match your closet best.
  const faces=components(w,h,i=>lab[i]===11).filter((f,n,arr)=>f.length>=w*h*.002&&f.length>=arr[0].length*.25).slice(0,3);
  const bands=faces.length?faces.map(f=>{let x0=w,x1=0,y0=h;for(const i of f){const x=i%w,y=(i/w)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y}
    const cx=(x0+x1)/2,fw=Math.max(4,x1-x0+1);return i=>{const x=i%w,y=(i/w)|0;return Math.abs(x-cx)<=fw*2.2&&y>=y0-fw*.5}}):[()=>true];
  const im=await loadImage(URL.createObjectURL(blob));URL.revokeObjectURL(im.src);
  const W=im.naturalWidth,H=im.naturalHeight,sx=W/w,sy=H/h;
  const its=[...S.items.entries()].filter(([,i])=>i.imageId);
  const E={},COL={};let k=0;
  const prep=async ids=>{for(const id of ids){if(E[id]!==undefined)continue;const i=S.items.get(id);let e=null;try{e=await idbGet('emb','item:'+i.imageId)}catch(_){}
    if(!(e&&e.ie)){k++;status(`Getting to know your closet (${k} pieces so far). This only happens once.`);const b=await idbGet('images',i.imageId);if(!b){E[id]=null;continue}e=await embStore('item:'+i.imageId,()=>embedImage(b,dl));await paintPause()}
    E[id]=e;COL[id]=(await itemColour(i))?.lab||null}};
  const MEM=await lookMemory();
  let best=null;
  for(let p=0;p<bands.length;p++){
    const band=bands[p],found=[];
    for(const R of SEG_REGIONS){
      const comps=components(w,h,i=>R.cls.includes(lab[i])&&band(i));if(!comps.length)continue;
      const px=R.all?comps.flat():comps[0];if(px.length<w*h*R.min)continue;
      const cands=its.filter(([,i])=>R.ok(i));if(!cands.length)continue;
      const set=new Uint8Array(w*h);let bx0=w,bx1=0,by0=h,by1=0;for(const i of px){set[i]=1;const x=i%w,y=(i/w)|0;if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y}
      const cw=Math.round((bx1-bx0+1)*sx),ch=Math.round((by1-by0+1)*sy),kk=Math.min(1,360/Math.max(cw,ch));
      const c=document.createElement('canvas');c.width=Math.max(8,Math.round(cw*kk));c.height=Math.max(8,Math.round(ch*kk));const g=c.getContext('2d');
      g.drawImage(im,bx0*sx,by0*sy,cw,ch,0,0,c.width,c.height);
      const d=g.getImageData(0,0,c.width,c.height),pix=[];
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
        const lx=bx0+Math.floor(x/(c.width/(bx1-bx0+1))),ly=by0+Math.floor(y/(c.height/(by1-by0+1))),li=ly*w+lx,o=(y*c.width+x)*4;
        if(!set[li]){d.data[o]=d.data[o+1]=d.data[o+2]=255;continue}
        if(set[li-1]&&set[li+1]&&set[li-w]&&set[li+w]&&((x+y)&1))pix.push([d.data[o],d.data[o+1],d.data[o+2]]);
      }
      g.putImageData(d,0,0);
      const crop=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));
      const emb=await embStore(`seg:${l.imageId}:${p}:${R.key}`,()=>embedImage(crop,dl));
      found.push({R,emb,lab:medLab(pix),cands});
    }
    if(!found.length)continue;
    await prep([...new Set(found.flatMap(f=>f.cands.map(([id])=>id)))]);
    status('Matching your pieces…');
    const regs=[];let total=0;
    for(const f of found){
      const sc=f.cands.filter(([id])=>E[id]).map(([id])=>{const ex=MEM.worn[id]||[];const s=Math.max(cosSim(f.emb,E[id]),...ex.filter(x=>x.emb).map(x=>cosSim(f.emb,x.emb)));const des=[f.lab&&COL[id]?dE(f.lab,COL[id]):30,...ex.filter(x=>x.lab&&f.lab).map(x=>dE(f.lab,x.lab))],de=Math.min(...des);return{id,s,de,ex:ex.length,score:(s-.7)*10-de/7+.15*Math.min(4,ex.length)-.5*Math.min(3,MEM.rej[id]||0)}}).sort((a,b)=>b.score-a.score);
      if(!sc.length)continue;
      const[b1,b2]=sc;regs.push({f,sc,b1,b2});total+=Math.max(-2,b1.score);
    }
    if(regs.length&&(!best||total>best.total))best={total,regs,p};
  }
  if(!best)return{pick:[],ranked:[],regions:[],v:3};
  const pick=[],regions=[];
  for(const{f,sc,b1,b2}of best.regs){
    const sure=((b1.de<=12&&b1.s>=.72)||(b1.ex&&b1.de<=15&&b1.s>=.8))&&(!b2||b1.score-b2.score>=.5);
    if(sure)pick.push(b1.id);
    regions.push({key:f.R.key,label:f.R.label,p:best.p,lab:f.lab?f.lab.map(v=>Math.round(v*10)/10):null,ids:sc.slice(0,5).map(x=>x.id),sure,top:{s:+b1.s.toFixed(3),de:Math.round(b1.de),score:+b1.score.toFixed(2)}});
  }
  return{pick,ranked:regions.flatMap(r=>r.ids),regions,v:3};
}
// remove a logged look's pieces from its day (keeps anything else logged that day)
async function unlogLook(l){
  if(!l||l.status!==LOOK_DONE||!l.date)return;
  const p=S.plans.get(l.date);if(!p)return;
  const otherLooks=[...S.looks.values()].filter(x=>x!==l&&x.status===LOOK_DONE&&x.date===l.date).flatMap(x=>x.itemIds||[]);
  const rest=(p.itemIds||[]).filter(i=>!(l.itemIds||[]).includes(i)||otherLooks.includes(i));
  if(rest.length||p.note)await saveDoc('plans',l.date,{...p,itemIds:rest,outfitId:p.outfitId&&p.outfitId===l.outfitId?null:p.outfitId||null});
  else await delDoc('plans',l.date);
}
const learnedCount=()=>[...S.looks.values()].filter(l=>l.status===LOOK_DONE&&l.learn).length;
function lookSheet(lid){
  const l=S.looks.get(lid);if(!l)return;
  const sel=new Set((l.itemIds||[]).filter(i=>S.items.has(i)));let outfitId=l.outfitId&&S.outfits.has(l.outfitId)?l.outfitId:null,touched=!!sel.size;
  const outs=[...S.outfits.entries()];
  const sh=openSheet(`${head(l.status===LOOK_DONE?'Logged look':'What are you wearing?')}
    <div class="lookph">${img(l.imageId)}</div>
    <div class="field"><label for="lDate">Day you wore it</label><input id="lDate" type="date" value="${l.date||today()}" max="${today()}"></div>
    ${l.dateGuess?`<p class="muted" style="margin:-6px 0 0;font-size:13px">This photo didn’t say when it was taken. Check the date.</p>`:''}
    <div class="lbl">Best guesses <small class="muted" style="text-transform:none;letter-spacing:0">(tap to add or remove${learnedCount()?` · learned from ${learnedCount()} logged look${learnedCount()===1?'':'s'}`:''})</small></div>
    <div class="guess" id="guess"><p class="muted" id="gMsg" style="margin:0;font-size:13px">${S.items.size?'Finding your pieces…':'Add pieces to your closet first.'}</p></div>
    ${outs.length?`<div class="lbl">Or a saved outfit</div><div class="hscroll">${outs.map(([oid,o])=>`<button type="button" class="oc" data-oc="${oid}" aria-pressed="${outfitId===oid}">${boardHTML(o.itemIds||[],o.layout)}<small>${esc(o.name)}</small></button>`).join('')}</div>`:''}
    <div class="lbl" id="selLbl"></div>
    ${pickerHTML(sel)}
    <div class="field"><label for="lNew">Save these pieces as an outfit (optional)</label><input id="lNew" placeholder="Outfit name" autocomplete="off"></div>
    <div class="btns"><button class="btn primary" type="button" id="lSave">${l.status===LOOK_DONE?'Save changes':'Log this look'}</button>
      ${l.status!==LOOK_SKIP?`<button class="btn" type="button" id="lSkip">No clothes to log</button>`:''}
      <button class="btn danger" type="button" id="lDel">Delete photo</button></div>`);
  const sync_=()=>{
    sh.querySelectorAll('[data-pk]').forEach(b=>b.setAttribute('aria-pressed',sel.has(b.dataset.pk)));
    sh.querySelectorAll('[data-gk]').forEach(b=>b.setAttribute('aria-pressed',sel.has(b.dataset.gk)));
    sh.querySelectorAll('[data-oc]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.oc===outfitId));
    sh.querySelector('#selLbl').textContent=`Pieces · ${sel.size} selected`;
  };
  wirePicker(sh,sel,()=>{touched=true;outfitId=null;sync_()});
  sh.querySelectorAll('[data-oc]').forEach(b=>b.addEventListener('click',()=>{touched=true;const was=outfitId===b.dataset.oc;sel.clear();outfitId=was?null:b.dataset.oc;if(!was)(S.outfits.get(b.dataset.oc).itemIds||[]).forEach(i=>S.items.has(i)&&sel.add(i));sync_()}));
  const gbox=sh.querySelector('#guess');
  gbox.addEventListener('click',e=>{const b=e.target.closest('[data-gk]');if(!b)return;touched=true;outfitId=null;const id=b.dataset.gk;sel.has(id)?sel.delete(id):sel.add(id);sync_()});
  sync_();
  if(S.items.size)(async()=>{
    const msg=t=>{const m=sh.querySelector('#gMsg');if(m)m.textContent=t};
    try{
      let g=l.guess&&l.guess.v===3&&l.guessN===S.items.size&&l.guessL===learnedCount()?l.guess:null;
      if(!g){g=await guessLook(lid,msg);const cur=S.looks.get(lid);if(cur){const v={...cur,guess:g,guessN:S.items.size,guessL:learnedCount()};await idbPut('looks',lid,v);S.looks.set(lid,v)}}
      if(!sh.isConnected)return;
      const tile=id=>{const i=S.items.get(id);return `<button type="button" class="gk" data-gk="${id}" aria-pressed="${sel.has(id)}"><div class="${phCls(i)}">${thumb(i)}</div><small>${esc(i.name)}</small></button>`};
      const regs=(g.regions||[]).map(r=>({...r,ids:r.ids.filter(i=>S.items.has(i))})).filter(r=>r.ids.length);
      gbox.innerHTML=regs.length?regs.map(r=>`<div class="gsec"><small>${esc(r.label)}${r.sure?'':' · not sure'}</small><div class="grow">${r.ids.map(tile).join('')}</div></div>`).join('')
        :`<p class="muted" style="margin:0;font-size:13px">Couldn’t spot clothes from your closet clearly in this photo. Pick the pieces below.</p>`;
      if(!touched&&l.status!==LOOK_DONE){g.pick.filter(i=>S.items.has(i)).forEach(i=>sel.add(i));sync_()}
    }catch(e){console.error(e);msg('Couldn’t make a guess for this photo. Pick the pieces below.')}
  })();
  const save=sh.querySelector('#lSave');save.addEventListener('click',()=>guard(save,async()=>{
    const date=sh.querySelector('#lDate').value;if(!date){toast('Pick the day you wore it.');return}
    if(!sel.size){toast('Pick the pieces you’re wearing, or tap “No clothes to log”.');return}
    const nn=sh.querySelector('#lNew').value.trim();
    if(nn){outfitId=newId();await saveDoc('outfits',outfitId,{name:nn,itemIds:[...sel],layout:autoLayout([...sel]),createdAt:Date.now()})}
    const cur=S.looks.get(lid)||l;await unlogLook(cur);
    const p=S.plans.get(date);
    await saveDoc('plans',date,{note:'',...(p||{}),itemIds:[...new Set([...(p?.itemIds||[]),...sel])],outfitId:outfitId||p?.outfitId||null});
    const g0=S.looks.get(lid)?.guess,learn={};
    for(const r of g0?.regions||[]){const R=SEG_REGIONS.find(x=>x.key===r.key);if(!R)continue;
      const m=[...sel].filter(id=>S.items.has(id)&&R.ok(S.items.get(id)));if(m.length===1)learn[r.key]={item:m[0],lab:r.lab||null,p:r.p??0}}
    const rej=(g0?.pick||[]).filter(id=>!sel.has(id));
    await saveDoc('looks',lid,{...S.looks.get(lid),date,itemIds:[...sel],outfitId,status:LOOK_DONE,dateGuess:false,learn,rej});
    closeSheet();toast(`Logged on ${fmtDate(date)}`);
  }));
  const skip=sh.querySelector('#lSkip');skip&&skip.addEventListener('click',()=>guard(skip,async()=>{
    const cur=S.looks.get(lid);await unlogLook(cur);await saveDoc('looks',lid,{...cur,status:LOOK_SKIP,itemIds:[],outfitId:null});closeSheet();toast('Skipped')}));
  const del=sh.querySelector('#lDel');armDelete(del,()=>guard(del,async()=>{
    const cur=S.looks.get(lid);await unlogLook(cur);await delDoc('looks',lid);await dropImage(cur.imageId);closeSheet();toast('Photo deleted')}),'Delete photo');
}

/* ---------- declutter: guided review of pieces to reconsider ---------- */
const FATES={donate:'Donate',sell:'Sell',toss:'Toss'};
function declutterList(){
  const W=wear().items,out=[];const twins={};
  for(const[id,i]of S.items){const c=genericName(i.colour);if(c)(twins[typeOf(i)+'|'+c]??=[]).push(id)}
  for(const[id,i]of S.items){
    if(i.fate||(i.keptAt&&Date.now()-i.keptAt<180*864e5))continue;
    const r=W[id],wears=r?.worn.length||0,l=last(r),age=Math.max(0,Math.round((Date.now()-(i.createdAt||Date.now()))/864e5));
    const why=[];let score=0;
    if(!wears){why.push(age>=30?'Not worn since you added it':'No wears logged yet');score+=age>=30?3:1}
    else if(daysAgo(l)>=90){const mo=Math.round(daysAgo(l)/30);why.push(`Not worn in ${mo} month${mo===1?'':'s'}`);score+=2+Math.min(3,daysAgo(l)/180)}
    else if(wears<=2&&age>=60){why.push(`Worn only ${wears===1?'once':'twice'}`);score+=1.5}
    const sim=(twins[typeOf(i)+'|'+genericName(i.colour)]||[]).filter(x=>x!==id);
    if(sim.length){const mostWorn=Math.max(...sim.map(x=>W[x]?.worn.length||0));
      why.push(`Similar to ${S.items.get(sim[0])?.name||'another piece'}${sim.length>1?` and ${sim.length-1} more`:''}`);score+=mostWorn>=wears?2:.8}
    const sk=taste().skips?.[id]||0;if(sk>=6&&(!l||daysAgo(l)>=60)){why.push(`Passed over ${sk} times in Shuffle`);score+=1}
    const pr=Number(i.price);if(pr>0&&age>=60&&pr/(wears||1)>=40){why.push(`${money(pr/(wears||1))} per wear so far`);score+=1}
    if(score>=1.5||(score>0&&sim.length))out.push({id,why,score});
  }
  return out.sort((a,b)=>b.score-a.score);
}
const DC_Q=['Would you buy it again today?','Does it fit you right now?','Have you reached for it this season?','Does it go with at least three other pieces?','Would you be fine if it was gone tomorrow?','Is it waiting for an occasion that never comes?'];
function declutterSheet(){
  const queue=declutterList();let i=0,counts={keep:0,donate:0,sell:0,toss:0};
  const sh=openSheet(`${head('Declutter')}<div id="dc" class="dc"></div>`);const box=sh.querySelector('#dc');
  const show=()=>{
    while(i<queue.length&&!S.items.has(queue[i].id))i++;
    if(i>=queue.length){
      const n=counts.donate+counts.sell+counts.toss;
      box.innerHTML=`<div class="empty" style="padding:24px 8px"><h2>${queue.length?'All done':'Nothing to reconsider'}</h2><p>${queue.length?`You kept ${counts.keep} and marked ${n} to let go.`:'Log more outfits and looks, and pieces you don’t wear will show up here.'}</p></div>
        <div class="btns">${[...S.items.values()].some(x=>x.fate)?'<button class="btn primary" type="button" data-dcgo>See what’s leaving</button>':''}<button class="btn" type="button" data-dcclose>Close</button></div>`;
      return;
    }
    const{id,why}=queue[i],it=S.items.get(id),W=wear().items[id],wears=W?.worn.length||0,l=last(W),pr=Number(it.price);
    box.innerHTML=`<p class="muted" style="margin:0;font-size:13px">${i+1} of ${queue.length}</p>
      <div class="dcph ${phCls(it)}">${thumb(it)}</div>
      <h3 style="margin:0;text-align:center">${esc(it.name||'Piece')}</h3>
      <div class="dcwhy">${why.map(w=>`<span>${esc(w)}</span>`).join('')}</div>
      <div class="stats"><div class="stat"><b>${wears}×</b><small>Worn</small></div><div class="stat"><b>${l?shortAgo(l):'—'}</b><small>Last worn</small></div><div class="stat"><b>${pr?money(pr):'—'}</b><small>Price</small></div></div>
      <p class="dcq">${DC_Q[i%DC_Q.length]}</p>
      <div class="dcbtns"><button class="btn primary" type="button" data-fate="keep">Keep</button><button class="btn" type="button" data-fate="donate">Donate</button><button class="btn" type="button" data-fate="sell">Sell</button><button class="btn" type="button" data-fate="toss">Toss</button></div>
      <button class="linkbtn" type="button" data-fate="skip">Decide later</button>`;
  };
  box.addEventListener('click',async e=>{
    if(e.target.closest('[data-dcclose]')){closeSheet();return}
    if(e.target.closest('[data-dcgo]')){closeSheet();leavingSheet();return}
    const b=e.target.closest('[data-fate]');if(!b||b.disabled)return;
    const f=b.dataset.fate,id=queue[i]?.id,it=S.items.get(id);
    box.querySelectorAll('[data-fate]').forEach(x=>x.disabled=true);
    try{if(it&&f==='keep'){await saveDoc('items',id,{...it,keptAt:Date.now()});counts.keep++}
      else if(it&&FATES[f]){await saveDoc('items',id,{...it,fate:f,fateAt:Date.now()});counts[f]++}}
    catch(err){console.error(err);toast('Couldn’t save. Please try again.')}
    i++;show();
  });
  show();
}
function leavingSheet(){
  const sh=openSheet(`${head('On the way out')}<div id="lv" class="list"></div>`);const box=sh.querySelector('#lv');
  const show=()=>{
    const rows=[...S.items.entries()].filter(([,i])=>i.fate).sort((a,b)=>(a[1].fate||'').localeCompare(b[1].fate||'')||(b[1].fateAt||0)-(a[1].fateAt||0));
    if(!rows.length){box.innerHTML=`<p class="muted" style="margin:0">Nothing marked to let go.</p>`;return}
    const total=rows.filter(([,i])=>i.fate==='sell').reduce((a,[,i])=>a+(Number(i.price)||0),0);
    box.innerHTML=`<p class="muted" style="margin:0;font-size:13px">When a piece is gone, tap “It’s gone” to remove it from your closet. Its wear history goes with it.${total?` Pieces to sell cost ${money(total)} new.`:''}</p>`+
      rows.map(([id,i])=>`<div class="li lvrow"><span class="mini ${i.cutout&&hasImg(i)?'cut':''}">${thumb(i)}</span><span class="tx"><b>${esc(i.name||'Piece')}</b><small>${FATES[i.fate]||i.fate}</small></span>
        <span class="lvb"><button class="btn sm danger" type="button" data-gone="${id}">It’s gone</button><button class="linkbtn" type="button" data-undo="${id}">Keep it</button></span></div>`).join('');
    box.querySelectorAll('[data-gone]').forEach(b=>armDelete(b,()=>guard(b,async()=>{const id=b.dataset.gone,it=S.items.get(id);if(!it)return;await delDoc('items',id);for(const d of imageIdsOf(it))await dropImage(d);toast(`Removed ${it.name||'piece'}`);show()}),'It’s gone'));
  };
  box.addEventListener('click',async e=>{const u=e.target.closest('[data-undo]');if(!u)return;const it=S.items.get(u.dataset.undo);if(it){const{fate,fateAt,...rest}=it;await saveDoc('items',u.dataset.undo,{...rest,keptAt:Date.now()})}show()});
  show();
}
function declutterCard(){
  if(!S.items.size)return '';
  const n=declutterList().length,out=[...S.items.values()].filter(i=>i.fate).length;
  return `<div class="dccard"><div class="tx"><b>Declutter</b><small>${n?`${n} piece${n===1?'':'s'} to reconsider`:'Nothing to reconsider right now'}${out?` · ${out} on the way out`:''}</small></div>
    <div class="btnrow">${n?'<button class="btn sm primary" type="button" data-dc="start">Start</button>':''}${out?'<button class="btn sm" type="button" data-dc="leaving">Leaving</button>':''}</div></div>`;
}

/* ---------- seasons, dressiness and pairings for each piece ---------- */
const SEASONS=[['winter','Winter','<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.6 12 6.1l2.5-1.5M9.5 19.4 12 17.9l2.5 1.5"/>'],
  ['spring','Spring','<path d="M12 20.5v-8"/><path d="M12 12.5c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5z"/><path d="M12 14.5c0-3-2.6-5.2-6.2-5.2 0 3 2.6 5.2 6.2 5.2z"/>'],
  ['summer','Summer','<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>'],
  ['fall','Fall','<path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14z"/><path d="M5 19l8.5-8.5"/>']];
const seasonIcon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${(SEASONS.find(s=>s[0]===k)||[])[2]||''}</svg>`;
const DRESS_WORDS=['','Working on the car','Lounging at home','Gym & errands','Casual hangout','Everyday / class','Smart casual','Office / dinner out','Date night / party','Wedding guest','Black-tie'];
const dressWord=v=>v?DRESS_WORDS[v]:'Not rated';
// a piece's style is what its dressiness slider says
const styleOf=i=>i&&i.dress!=null?DRESS_WORDS[i.dress]:'';
// fill the track exactly up to the centre of the 26px thumb
const dressFill=(r,v)=>{const p=(v-1)/9*100;r.style.setProperty('--fill',v?`calc(${p}% + ${(.5-p/100)*26}px)`:'0%')};
const isTagged=i=>i.seasons!==undefined||i.dress!=null;
// season right now: from today's forecast when we have it, otherwise from the month (northern hemisphere)
function currentSeason(){
  const w=wxDay(today()),m=new Date().getMonth();
  const bym=m<=1||m===11?'winter':m<=4?'spring':m<=7?'summer':'fall';
  if(w){const t=(w.hi+w.lo)/2;if(t<=4)return'winter';if(t>=20)return'summer';if(bym==='winter'||bym==='summer')return t<12?'fall':'spring'}
  return bym;
}
// untagged pieces use their best guess until you tag them
const seasonsOf=i=>i.seasons!==undefined?i.seasons:guessSeasons(i);
const dressOf=i=>i.dress!=null?i.dress:guessDress(i);
const fitsSeason=(i,s)=>{if(!s)return true;const z=seasonsOf(i);return !z.length||z.includes(s)};
// "goes well with" works both ways; "always wear with" is one way (the shirt needs the undershirt, not the reverse)
const goesOf=id=>{const i=S.items.get(id);const set=new Set((i?.goes||[]).filter(x=>S.items.has(x)));for(const[o,j]of S.items)if((j.goes||[]).includes(id))set.add(o);set.delete(id);return[...set]};
const needsOf=id=>(S.items.get(id)?.needs||[]).filter(x=>S.items.has(x)&&x!==id);
// pieces you've worn with this one at least twice that aren't linked yet
function pairSuggestions(id){
  const i=S.items.get(id);if(!i)return[];const cw=coWear(),have=new Set([...goesOf(id),...needsOf(id),...(i.goesNo||[])]);const out=[];
  for(const[o]of S.items){if(o===id||have.has(o))continue;const n=cw[pairKey(id,o)]||0;if(n>=2)out.push({id:o,n})}
  return out.sort((a,b)=>b.n-a.n).slice(0,6);
}
// starting guesses for Quick tag: from the type and the name
function guessSeasons(i){
  const t=typeOf(i),n=(i.name||'').toLowerCase(),has=(...w)=>w.some(x=>n.includes(x));
  if(has('wool','fleece','puffer','turtleneck','velvet','corduroy','teddy','boots','beanie'))return['fall','winter'];
  if(has('linen','sandal','crochet','swim','shorts'))return['spring','summer'];
  if(['Coats'].includes(t))return['fall','winter'];
  if(['Sweaters','Hoodies','Crewnecks'].includes(t))return['fall','winter','spring'];
  if(t==='Long sleeves')return['spring','fall','winter'];
  if(t==='Short sleeves')return['spring','summer','fall'];
  if(['Cardigans','Jackets','Blazers','Vests'].includes(t))return['spring','fall','winter'];
  if(['Tank tops','Shorts'].includes(t)||has('sleeveless','strappy','cami'))return['spring','summer'];
  if(t==='Dresses')return has('long-sleeve','knit','sweater')?['fall','winter','spring']:['spring','summer','fall'];
  if(t==='Blouses'&&has('long-sleeve'))return['spring','fall','winter'];
  if(t==='Tights')return['fall','winter'];
  if(t==='Rompers')return['spring','summer'];
  return[];
}
function guessDress(i){
  const base={Activewear:1,Hoodies:2,Crewnecks:2,'Short sleeves':3,'Long sleeves':4,Jeans:3,'Tank tops':3,Footwear:3,Shorts:2,'Hair accessories':4,Blouses:6,Leggings:2,Rompers:4,Bras:3,Underwear:3,Tights:5,Sweaters:4,Cardigans:4,Jackets:4,Vests:4,Overalls:3,Bodysuits:5,Pants:5,Skirts:5,Coats:5,
    Bags:5,Belts:5,Hats:3,Glasses:4,Jewelry:6,Dresses:6,Jumpsuits:6,Blazers:7,Heels:7}[typeOf(i)]||4;
  const n=(i.name||'').toLowerCase(),has=(...w)=>w.some(x=>n.includes(x));let d=base;
  if(has('sequin','satin','silk','gown','maxi','lace','velvet','pumps'))d+=2;
  if(has('graphic','fleece','cargo','sweatpants','sweatshirt','joggers','sneakers','ripped','baggy'))d-=1;
  return Math.max(1,Math.min(10,d));
}
// --- the editor section ---
function tagsHTML(i){
  const sel=new Set(i?.seasons||[]),d=i?.dress??null;
  return `<div class="field"><span class="lbl">Seasons <small class="muted" style="text-transform:none;letter-spacing:0">(none picked = any season)</small></span>
      <div class="seasons" role="group" aria-label="Seasons">${SEASONS.map(([k,l])=>`<button type="button" class="sea" data-sea="${k}" aria-pressed="${sel.has(k)}">${seasonIcon(k)}<small>${l}</small></button>`).join('')}</div></div>
    <div class="field"><label for="fDress">How dressy <b id="dressV" class="dressv">${d?`${d} · ${dressWord(d)}`:'Not rated'}</b></label>
      <input type="range" id="fDress" min="1" max="10" step="1" value="${d||5}" class="${d?'':'unset'}" style="--fill:${d?`calc(${(d-1)/9*100}% + ${(.5-(d-1)/9)*26}px)`:'0%'}" aria-valuetext="${d?`${d}, ${dressWord(d)}`:'Not rated'}">
      <div class="dressticks" aria-hidden="true">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<span style="left:calc(${(n-1)/9*100}% + ${(.5-(n-1)/9)*26}px)">${n}</span>`).join('')}</div>
      <div class="dressends"><small>Working on the car</small><small>Black-tie</small></div></div>`;
}
function wireTags(sh,state){
  sh.querySelectorAll('[data-sea]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.sea;state.seasons.has(k)?state.seasons.delete(k):state.seasons.add(k);b.setAttribute('aria-pressed',state.seasons.has(k));state.touched=true}));
  const r=sh.querySelector('#fDress'),v=sh.querySelector('#dressV');
  r.addEventListener('input',()=>{state.dress=Number(r.value);r.classList.remove('unset');dressFill(r,state.dress);v.textContent=`${r.value} · ${dressWord(state.dress)}`;r.setAttribute('aria-valuetext',`${r.value}, ${dressWord(state.dress)}`);state.touched=true});
}
function pairsHTML(id){
  return `<div class="field"><span class="lbl">Always wear with <small class="muted" style="text-transform:none;letter-spacing:0">(any one of these, like an undershirt)</small></span>
      <div class="pairs" id="needRow"></div></div>
    <div class="field"><span class="lbl">Goes well with</span><div class="pairs" id="goesRow"></div><div class="pairs sug" id="goesSug"></div></div>
    <div class="pairpick" id="pairPick" hidden><input class="search" type="search" id="ppQ" placeholder="Search pieces" autocomplete="off" aria-label="Search pieces"><div class="picker" id="ppGrid"></div>
      <button class="btn sm primary" type="button" id="ppDone">Done</button></div>`;
}
function wirePairs(sh,id,state){
  const chip=(x,kind)=>{const i=S.items.get(x);return `<span class="pchip"><span class="mini ${i.cutout&&hasImg(i)?'cut':''}">${thumb(i)}</span><span>${esc(i.name)}</span><button type="button" data-unpair="${kind}:${x}" aria-label="Remove ${esc(i.name)}">✕</button></span>`};
  const paint=()=>{
    sh.querySelector('#needRow').innerHTML=[...state.needs].filter(x=>S.items.has(x)).map(x=>chip(x,'needs')).join('')+`<button class="btn sm" type="button" data-addpair="needs">+ Add</button>`;
    sh.querySelector('#goesRow').innerHTML=[...state.goes].filter(x=>S.items.has(x)).map(x=>chip(x,'goes')).join('')+`<button class="btn sm" type="button" data-addpair="goes">+ Add</button>`;
    const sug=id?pairSuggestions(id).filter(s=>!state.goes.has(s.id)&&!state.needs.has(s.id)&&!state.no.has(s.id)):[];
    sh.querySelector('#goesSug').innerHTML=sug.length?`<small class="muted" style="width:100%">Worn together often:</small>`+sug.map(s=>{const i=S.items.get(s.id);return `<span class="pchip sug"><span class="mini ${i.cutout&&hasImg(i)?'cut':''}">${thumb(i)}</span><span>${esc(i.name)} <small class="muted">${s.n}×</small></span><button type="button" data-sugadd="${s.id}" aria-label="Add">+</button><button type="button" data-sugno="${s.id}" aria-label="Not a pair">✕</button></span>`}).join(''):'';
  };
  let mode=null;const pp=sh.querySelector('#pairPick'),grid=sh.querySelector('#ppGrid');
  const openPick=m=>{mode=m;const set=state[m];
    grid.innerHTML=[...S.items.entries()].filter(([x])=>x!==id).sort((a,b)=>typeRank(typeOf(a[1]))-typeRank(typeOf(b[1]))||(a[1].name||'').localeCompare(b[1].name||''))
      .map(([x,i])=>`<button type="button" class="pk" data-pp="${x}" data-txt="${esc([i.name,i.colour,typeOf(i)].join(' ').toLowerCase())}" aria-pressed="${set.has(x)}"><div class="${phCls(i)}">${thumb(i)}</div><small>${esc(i.name)}</small></button>`).join('');
    pp.hidden=false;sh.querySelector('#ppQ').value='';pp.scrollIntoView({block:'center',behavior:'smooth'})};
  sh.addEventListener('click',e=>{
    const a=e.target.closest('[data-addpair]');if(a){openPick(a.dataset.addpair);return}
    const u=e.target.closest('[data-unpair]');if(u){const[k,x]=u.dataset.unpair.split(':');state[k].delete(x);paint();return}
    const sa=e.target.closest('[data-sugadd]');if(sa){state.goes.add(sa.dataset.sugadd);paint();return}
    const sn=e.target.closest('[data-sugno]');if(sn){state.no.add(sn.dataset.sugno);paint();return}
    const p=e.target.closest('[data-pp]');if(p&&mode){const x=p.dataset.pp,set=state[mode];set.has(x)?set.delete(x):set.add(x);p.setAttribute('aria-pressed',set.has(x));if(mode==='needs')state.goes.delete(x);else state.needs.delete(x);return}
    if(e.target.closest('#ppDone')){pp.hidden=true;mode=null;paint()}
  });
  sh.querySelector('#ppQ').addEventListener('input',e=>{const v=e.target.value.toLowerCase();grid.querySelectorAll('[data-pp]').forEach(b=>b.hidden=!!v&&!b.dataset.txt.includes(v))});
  paint();
}
// save "goes well with" both ways: links removed here are removed from the other piece too
async function savePairLinks(id,goes){
  for(const[o,j]of S.items){if(o===id)continue;const has=(j.goes||[]).includes(id);
    if(has&&!goes.has(o))await saveDoc('items',o,{...j,goes:(j.goes||[]).filter(x=>x!==id)});}
}
// --- Quick tag: seasons and dressiness for every piece, one at a time, with a guess filled in ---
function quickTagSheet(){
  const queue=[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet)&&!isTagged(i)).sort((a,b)=>typeRank(typeOf(a[1]))-typeRank(typeOf(b[1])));let n=0,done=0;
  const sh=openSheet(`${head('Organize')}<div id="qt" class="dc"></div>`);const box=sh.querySelector('#qt');
  const show=()=>{
    while(n<queue.length&&(!S.items.has(queue[n][0])||isTagged(S.items.get(queue[n][0]))))n++;
    if(n>=queue.length){box.innerHTML=`<div class="empty" style="padding:24px 8px"><h2>All tagged</h2><p>${done?`You tagged ${done} piece${done===1?'':'s'}. `:''}Shuffle now picks for the season and the occasion.</p></div><div class="btns"><button class="btn primary" type="button" data-qtclose>Done</button></div>`;return}
    const[id,i]=queue[n],st={seasons:new Set(guessSeasons(i)),dress:guessDress(i)};
    box.innerHTML=`<p class="muted" style="margin:0;font-size:13px"><b>Seasons &amp; dressiness</b> · ${n+1} of ${queue.length} · best guesses are filled in, fix anything that’s off</p>
      <div class="dcph ${phCls(i)}">${thumb(i)}</div><h3 style="margin:0;text-align:center">${esc(i.name||'Piece')}</h3>
      <div class="field"><label for="qtType">Category</label><select id="qtType">${typeOptions(typeOf(i))}</select></div>
      ${tagsHTML({seasons:[...st.seasons],dress:st.dress})}
      <div class="dcbtns"><button class="btn primary" type="button" data-qt="save">Save &amp; next</button><button class="btn" type="button" data-qt="skip">Skip</button></div>`;
    wireTags(box,st);box._st=st;
  };
  box.addEventListener('click',async e=>{
    if(e.target.closest('[data-qtclose]')){closeSheet();return}
    const b=e.target.closest('[data-qt]');if(!b||b.disabled)return;
    if(b.dataset.qt==='save'){const[id]=queue[n],it=S.items.get(id),st=box._st;b.disabled=true;
      const ty=box.querySelector('#qtType')?.value||it.type;try{await saveDoc('items',id,{...it,type:ty,group:GROUP_OF[ty]||it.group,seasons:SEASONS.map(s=>s[0]).filter(k=>st.seasons.has(k)),dress:st.dress});done++}catch(err){toast('Couldn’t save. Please try again.');b.disabled=false;return}}
    n++;show();
  });
  show();
}


/* ---------- sort existing pieces into the newer top categories (you approve each move) ---------- */
const SORT_INTO=['Blouses','Short sleeves','Long sleeves','Crewnecks','Sweaters','Hoodies','Tank tops'];
function sortKeyword(n){n=(n||'').toLowerCase();
  if(/hoodie|zip-up/.test(n))return'Hoodies';if(/crewneck|sweatshirt/.test(n))return'Crewnecks';
  if(/long[- ]?sleeve/.test(n))return'Long sleeves';if(/short[- ]?sleeve|t-shirt|\btee\b/.test(n))return'Short sleeves';
  if(/tank|cami|sleeveless/.test(n))return'Tank tops';if(/blouse|button|shirt\b/.test(n))return'Blouses';return null}
async function sortSuggestions(status){
  const its=[...S.items.entries()].filter(([,i])=>['Blouses','Sweaters','Hoodies'].includes(i.type)&&i.imageId&&URLS.has(i.imageId));
  const T=await clipText('sort3',SORT_INTO.map(t=>`a product photo of ${TYPE_PHRASE[t]}`));const out=[];
  for(let k=0;k<its.length;k++){const[id,i]=its[k];status(`Looking at your tops (${k+1} of ${its.length})…`);
    const kw=sortKeyword(i.name);let to=kw,p=1;
    if(!to){let e=null;try{e=await idbGet('emb','item:'+i.imageId)}catch(_){}
      if(!(e&&e.ie)){const b=await idbGet('images',i.imageId);if(!b)continue;e=await embedImage(b,m=>{if(/Downloading/.test(m))status(m)});try{await idbPut('emb','item:'+i.imageId,e)}catch(_){}}
      const pr=clipProbs(e,T);p=Math.max(...pr);to=SORT_INTO[pr.indexOf(p)];
      if(i.type==='Sweaters'&&to==='Crewnecks'&&p<.6)to=null;   // knit vs sweatshirt is subtle: only when clear
    }
    if(to&&to!==i.type&&p>=.4)out.push({id,to});await paintPause();
  }
  return out;
}
const needsSortCheck=()=>!ls.get('closet.sorted3')&&[...S.items.values()].some(i=>inCloset(i,S.closet)&&['Blouses','Sweaters','Hoodies'].includes(i.type));
function sortSheet(){
  const sh=openSheet(`${head('Organize')}<p class="muted" style="margin:0;font-size:14px"><b>Step 1 · Check categories.</b> These pieces look like they belong in a different category. Move the ones that are right.</p><div id="srt" class="list"><p class="muted" id="srtMsg" style="margin:0">Getting ready…</p></div><div class="btns"><button class="btn primary" type="button" id="srtNext"></button></div>`);
  const nextBtn=sh.querySelector('#srtNext'),hasTags=()=>[...S.items.values()].some(i=>inCloset(i,S.closet)&&!isTagged(i));
  const setNext=()=>{nextBtn.textContent=hasTags()?'Next: seasons & dressiness':'Done'};setNext();
  nextBtn.addEventListener('click',()=>{ls.set('closet.sorted3','1');closeSheet();if(hasTags())quickTagSheet();else render()});
  const box=sh.querySelector('#srt');
  (async()=>{
    let sug=[];try{sug=await sortSuggestions(m=>{const x=sh.querySelector('#srtMsg');if(x)x.textContent=m})}catch(e){console.error(e);box.innerHTML='<p class="muted">Couldn’t look at your tops right now. Try again later.</p>';return}
    ls.set('closet.sorted3','1');
    if(!sh.isConnected)return;
    const paint=()=>{const left=sug.filter(x=>!x.done);
      box.innerHTML=left.length?left.map(x=>{const i=S.items.get(x.id);return `<div class="li lvrow"><span class="mini ${i.cutout&&hasImg(i)?'cut':''}">${thumb(i)}</span><span class="tx"><b>${esc(i.name)}</b><small>${esc(i.type)} → <b>${esc(x.to)}</b></small></span>
        <span class="lvb"><button class="btn sm primary" type="button" data-mv="${x.id}">Move</button><button class="linkbtn" type="button" data-keep="${x.id}">Keep as is</button></span></div>`}).join('')+(left.length>1?`<button class="btn" type="button" data-mvall>Move all ${left.length}</button>`:'')
        :`<p class="muted" style="margin:0">${sug.length?'All sorted.':'Nothing to move. Your pieces are already in the right categories.'}</p>`;setNext()};
    const move=async x=>{const i=S.items.get(x.id);if(i)await saveDoc('items',x.id,{...i,type:x.to,group:GROUP_OF[x.to]||'Tops'});x.done=true};
    box.addEventListener('click',async e=>{
      const m=e.target.closest('[data-mv]');if(m){const x=sug.find(y=>y.id===m.dataset.mv);if(x)await move(x);paint();return}
      const k=e.target.closest('[data-keep]');if(k){const x=sug.find(y=>y.id===k.dataset.keep);if(x)x.done=true;paint();return}
      if(e.target.closest('[data-mvall]')){for(const x of sug.filter(y=>!y.done))await move(x);paint();toast('Moved')}
    });
    paint();
  })();
}

/* ---------- boot ---------- */
render();
(async()=>{
  try{
    IDB=await idbOpen();
    for(const col of COLS)S[col]=await idbAll(col);
    S.deleted=new Map(Object.entries((await idbGet('meta','deleted'))||{}));
    // re-name colours from their saved exact shade with the current rules (fixes earlier beige→orange guesses)
    for(const[iid,it]of S.items){
      if(!it.colourHex||it.colourNamed)continue;const nn=hexToName(it.colourHex),old=genericName(it.colour);if(nn===old)continue;
      const cap=w=>w?w[0].toUpperCase()+w.slice(1):w,word=SINGULAR[it.type]||(it.type||'').toLowerCase();
      const v={...it,colour:nn,colours2:(it.colours2||[]).filter(c=>c!==nn),updatedAt:Date.now()};
      if(it.name===`${cap(old)} ${word}`)v.name=`${cap(nn)} ${word}`;
      await idbPut('items',iid,v);S.items.set(iid,v);
    }
    // retired types -> the owner's categories; auto-made names ("Black heels") follow the new type
    {const MOVE={'Tops':'Blouses','T-shirts':'Short sleeves','Shirts':'Blouses','Sweatpants':'Pants','Sneakers':'Footwear','Boots':'Footwear','Shoes':'Footwear','Flats':'Footwear',
      'Sandals':'Footwear','Loafers':'Footwear','Sunglasses':'Glasses','Watches':'Jewelry','Scarves':'Other','Sleepwear':'Other','Swimwear':'Other'};
     const OLD={'T-shirts':'t-shirt','Shirts':'shirt','Blouses':'blouse','Leggings':'leggings','Sweatpants':'sweatpants','Sneakers':'sneakers','Boots':'boots','Shoes':'shoes','Heels':'heels','Flats':'flats','Sandals':'sandals',
      'Loafers':'loafers','Sunglasses':'sunglasses','Watches':'watch','Scarves':'scarf','Sleepwear':'pajamas','Swimwear':'swimsuit'};
     const cap=w=>w?w[0].toUpperCase()+w.slice(1):w;
     for(const[iid,it]of S.items){const g=GROUP_OF[it.type];if(!MOVE[it.type]&&g&&it.group!==g){const v={...it,group:g,updatedAt:Date.now()};await idbPut('items',iid,v);S.items.set(iid,v);continue}
       const nt=MOVE[it.type];if(!nt)continue;const c=genericName(it.colour),v={...it,type:nt,group:GROUP_OF[nt],updatedAt:Date.now()};
       if(c&&OLD[it.type]&&it.name===`${cap(c)} ${OLD[it.type]}`&&nt!=='Other')v.name=`${cap(c)} ${SINGULAR[nt]}`;await idbPut('items',iid,v);S.items.set(iid,v)}}
    if(!S.closets.has(MAIN)&&!S.deleted.has('closets/'+MAIN)){const c={name:'My Closet',createdAt:1,updatedAt:1};await idbPut('closets',MAIN,c);S.closets.set(MAIN,c)}
    for(const[id,b]of await idbAll('images'))URLS.set(id,URL.createObjectURL(b));
    S.ready=true;
  }catch(e){console.error(e);S.notice='This browser can’t save data (private browsing may be on). Open the app in normal Safari.'}
  setSync(GH.cfg()?'ok':'off');render();
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  if(GH.cfg())sync();
  if(S.ready)setTimeout(()=>refitCutouts().catch(e=>console.warn(e)),1500);
})();
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
