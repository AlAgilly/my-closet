'use strict';
/* My Closet: data lives in this device's IndexedDB and syncs to a private GitHub repo the user owns. */

const GROUPS=[
  ['Tops',['T-shirts','Tank tops','Bodysuits','Shirts','Sweaters','Hoodies','Cardigans']],
  ['Bottoms',['Jeans','Pants','Shorts','Skirts','Leggings','Sweatpants']],
  ['One-pieces',['Dresses','Jumpsuits']],
  ['Outerwear',['Jackets','Coats','Blazers','Vests']],
  ['Shoes',['Sneakers','Boots','Shoes','Sandals','Loafers']],
  ['Bags',['Bags']],
  ['Accessories',['Hats','Jewelry','Belts','Scarves','Sunglasses','Watches']],
  ['Other',['Activewear','Sleepwear','Other']]];
const GROUP_OF={};GROUPS.forEach(([g,ts])=>ts.forEach(t=>GROUP_OF[t]=g));
const TYPE_ORDER=GROUPS.flatMap(g=>g[1]);
// Generic colour names, each with a display shade. Exact shades are kept as colourHex; names stay simple.
const GENERIC=[['black','#1c1c1e'],['white','#f6f6f4'],['grey','#8e8e93'],['beige','#d8c3a0'],['brown','#7b5234'],['red','#c8302f'],['orange','#ec8a2f'],['yellow','#f2cf45'],['green','#3f8f53'],['blue','#3b74c4'],['navy','#1f2d55'],['purple','#7a4a9c'],['pink','#ec9ab8']];
const GEN_HEX=Object.fromEntries(GENERIC);
const LEGACY={cream:'beige',lightblue:'blue',olive:'green',burgundy:'red',gold:'yellow',silver:'grey',gray:'grey',tan:'beige',khaki:'beige',maroon:'red',teal:'green',denim:'blue'};
const genericName=c=>{c=(c||'').trim().toLowerCase();return GEN_HEX[c]?c:LEGACY[c]||c};
const hexToRgb=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
function rgbToName(r,g,b){
  r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,dl=mx-mn;
  const s=dl===0?0:dl/(1-Math.abs(2*l-1));let h=0;
  if(dl){h=mx===r?((g-b)/dl)%6:mx===g?(b-r)/dl+2:(r-g)/dl+4;h=(h*60+360)%360}
  if(l<.13)return 'black';
  if(s<.12||(s<.2&&l>.25&&l<.85))return l>.86?'white':l<.22?'black':'grey';
  if(l>.9&&(s<.3||h<35||h>=75))return 'white';
  if(h>=15&&h<50){if(s>=.6&&l>=.35&&l<=.78)return h<40?'orange':'yellow';return l<.4?'brown':'beige'}
  if(h<15||h>=345)return l>.72?'pink':(l<.3&&s<.6?'brown':'red');
  if(h<75){if(l<.32)return 'green';return (s<.45&&l>.6)||l>.85?'beige':'yellow'}
  if(h<170)return 'green';
  if(h<250)return l<.3?'navy':'blue';
  if(h<290)return 'purple';
  return 'pink';
}
const hexToName=h=>rgbToName(...hexToRgb(h));
const swatchOf=it=>it?.colourHex||GEN_HEX[genericName(it?.colour)]||okColour(it?.colour);
const itemColours=it=>[genericName(it?.colour),...(it?.colours2||[])].filter(Boolean);
const COLS=['closets','items','outfits','plans'];
const MAIN='main';
const S={closets:new Map(),items:new Map(),outfits:new Map(),plans:new Map(),deleted:new Map(),ready:false,view:'closet',closet:'all',type:'All',q:'',colour:'',style:'',sort:'new',month:new Date(),statsCloset:'all',notice:'',sync:{state:'off',msg:''},
  shuf:{closet:'all',style:'',outer:false,bag:false,acc:false,slots:{},locks:new Set()}};
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
const groupOf=it=>it?.group||GROUP_OF[it?.type]||'Other';
const typeOf=it=>it?.type||'Other';
const typeRank=t=>{const i=TYPE_ORDER.indexOf(t);return i<0?500:i};
const closetOf=it=>S.closets.has(it.closetId)?it.closetId:MAIN;
const closetName=id=>S.closets.get(id)?.name||'My Closet';
const inCloset=(it,c)=>c==='all'||closetOf(it)===c;
const hasImg=it=>it?.imageId&&URLS.has(it.imageId);
const imageIdsOf=it=>[it?.imageId,it?.backImageId].filter(Boolean);
const wantedImages=items=>new Set([...items].flatMap(imageIdsOf));
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
  const r=indexedDB.open('my-closet',2);
  r.onupgradeneeded=()=>{for(const s of[...COLS,'images','meta'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s)};
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
  if(hasAlpha(c))return{blob:await trimToBlob(c),cutout:true};
  return{blob:await new Promise(r=>c.toBlob(r,'image/jpeg',.85)),cutout:false};
}
// Fix see-through specks inside a cut-out. `a` is the alpha channel (one byte per pixel).
// 1) Background = see-through pixels connected to the image border. 2) Small see-through islands
// enclosed by the item become solid; large ones (e.g. inside a bag handle) stay as background.
// 3) Semi-see-through pixels more than 3px from the background become solid (soft outer edges kept).
function cleanAlpha(a,w,h){
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
    if(qt<=maxHole)for(let k=0;k<qt;k++)a[q[k]]=255;else for(let k=0;k<qt;k++)bg[q[k]]=1;
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
let TJS=null;
async function loadT(){if(!TJS){TJS=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js');TJS.env.allowLocalModels=false}return TJS}
let RB=null;
async function removeBg(blob,status){
  if(!RB){
    status('Downloading the cut-out tool. This happens once and is about 45 MB, so Wi-Fi helps…');
    const T=await loadT();
    const model=await T.AutoModel.from_pretrained('briaai/RMBG-1.4',{config:{model_type:'custom'}});
    const processor=await T.AutoProcessor.from_pretrained('briaai/RMBG-1.4',{config:{do_normalize:true,do_pad:false,do_rescale:true,do_resize:true,image_mean:[0.5,0.5,0.5],feature_extractor_type:'ImageFeatureExtractor',image_std:[1,1,1],resample:2,rescale_factor:0.00392156862745098,size:{width:1024,height:1024}}});
    RB={T,model,processor};
  }
  status('Cutting out the background…');
  const url=URL.createObjectURL(blob);
  try{
    const image=await RB.T.RawImage.fromURL(url);
    const{pixel_values}=await RB.processor(image);
    const{output}=await RB.model({input:pixel_values});
    const mask=await RB.T.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width,image.height);
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');
    g.drawImage(await loadImage(url),0,0,c.width,c.height);
    const alpha=Uint8Array.from(mask.data);cleanAlpha(alpha,c.width,c.height);
    const d=g.getImageData(0,0,c.width,c.height);for(let i=0;i<alpha.length;i++)d.data[4*i+3]=alpha[i];g.putImageData(d,0,0);
    return await trimToBlob(c);
  }finally{URL.revokeObjectURL(url)}
}

/* ---------- auto-detect: type (on-device CLIP), colour (pixels), name ---------- */
const TYPE_PHRASE={'T-shirts':'a t-shirt','Tank tops':'a tank top','Bodysuits':'a fitted bodysuit, a one-piece leotard top worn with pants','Shirts':'a shirt or blouse','Sweaters':'a knit sweater','Hoodies':'a hoodie','Cardigans':'a cardigan',
  'Jeans':'a pair of denim jeans','Pants':'a pair of trousers','Shorts':'a pair of shorts','Skirts':'a skirt','Leggings':'a pair of leggings','Sweatpants':'a pair of sweatpants',
  'Dresses':'a dress','Jumpsuits':'a jumpsuit','Jackets':'a jacket','Coats':'a long coat','Blazers':'a blazer','Vests':'a vest',
  'Sneakers':'a pair of sneakers','Boots':'a pair of boots','Shoes':'a pair of dress shoes such as heels, pumps or ballet flats','Sandals':'a pair of sandals','Loafers':'a pair of loafers',
  'Bags':'a handbag','Hats':'a hat','Jewelry':'a piece of jewelry','Belts':'a belt','Scarves':'a scarf','Sunglasses':'a pair of sunglasses','Watches':'a wristwatch',
  'Sleepwear':'a pair of pajamas'};
const SINGULAR={'T-shirts':'t-shirt','Tank tops':'tank top','Bodysuits':'bodysuit','Shirts':'shirt','Sweaters':'sweater','Hoodies':'hoodie','Cardigans':'cardigan','Jeans':'jeans','Pants':'pants','Shorts':'shorts','Skirts':'skirt','Leggings':'leggings','Sweatpants':'sweatpants',
  'Dresses':'dress','Jumpsuits':'jumpsuit','Jackets':'jacket','Coats':'coat','Blazers':'blazer','Vests':'vest','Sneakers':'sneakers','Boots':'boots','Shoes':'shoes','Sandals':'sandals','Loafers':'loafers',
  'Bags':'bag','Hats':'hat','Jewelry':'jewelry','Belts':'belt','Scarves':'scarf','Sunglasses':'sunglasses','Watches':'watch','Swimwear':'swimsuit','Sleepwear':'pajamas'};
let CLIP=null;
async function loadClip(status){
  if(CLIP)return CLIP;
  status&&status('Downloading the item recognizer. This happens once and is about 90 MB, so Wi-Fi helps…');
  const T=await loadT(),M='Xenova/clip-vit-base-patch32';
  const[tok,textModel,proc,vision]=await Promise.all([T.AutoTokenizer.from_pretrained(M),T.CLIPTextModelWithProjection.from_pretrained(M),T.AutoProcessor.from_pretrained(M),T.CLIPVisionModelWithProjection.from_pretrained(M)]);
  const types=Object.keys(TYPE_PHRASE);
  const{text_embeds}=await textModel(tok(types.map(t=>`a product photo of ${TYPE_PHRASE[t]}`),{padding:true,truncation:true}));
  const dim=text_embeds.dims[1],te=text_embeds.data,norms=types.map((_,i)=>Math.hypot(...te.subarray(i*dim,(i+1)*dim)));
  CLIP={T,proc,vision,types,dim,te,norms};return CLIP;
}
async function flatOnWhite(blob){
  const im=await loadImage(URL.createObjectURL(blob));const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0);URL.revokeObjectURL(im.src);
  return await new Promise(r=>c.toBlob(r,'image/jpeg',.9));
}
async function detectType(blob,status){
  const C=await loadClip(status);status&&status('Recognizing the item…');
  const url=URL.createObjectURL(await flatOnWhite(blob));
  try{
    const{pixel_values}=await C.proc(await C.T.RawImage.fromURL(url));
    const{image_embeds}=await C.vision({pixel_values});const ie=image_embeds.data,inorm=Math.hypot(...ie);
    let best=0,bestS=-1;
    C.types.forEach((t,i)=>{let s=0;for(let k=0;k<C.dim;k++)s+=ie[k]*C.te[i*C.dim+k];s/=inorm*C.norms[i];if(s>bestS){bestS=s;best=i}});
    return C.types[best];
  }finally{URL.revokeObjectURL(url)}
}
// Most common colour among the item's pixels (solid pixels for cut-outs, the middle of the photo otherwise), mapped to the nearest named colour.
async function detectColour(blob,cutout){
  const im=await loadImage(URL.createObjectURL(blob));const n=96,c=document.createElement('canvas');c.width=n;c.height=n;const g=c.getContext('2d');
  g.drawImage(im,0,0,n,n);URL.revokeObjectURL(im.src);const d=g.getImageData(0,0,n,n).data;
  const bins=new Map();
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(!cutout&&(x<n*.28||x>n*.72||y<n*.22||y>n*.78))continue;
    const i=(y*n+x)*4;if(d[i+3]<200)continue;
    const k=(d[i]>>5)<<6|(d[i+1]>>5)<<3|(d[i+2]>>5);const b=bins.get(k)||{n:0,r:0,g:0,b:0};b.n++;b.r+=d[i];b.g+=d[i+1];b.b+=d[i+2];bins.set(k,b);
  }
  // group the bins by plain colour name; the biggest group is the main colour, others covering 15%+ are secondary
  const names=new Map();let total=0;
  for(const b of bins.values()){const nm=rgbToName(b.r/b.n,b.g/b.n,b.b/b.n);const e=names.get(nm)||{n:0,top:null};e.n+=b.n;if(!e.top||b.n>e.top.n)e.top=b;names.set(nm,e);total+=b.n}
  const ranked=[...names.entries()].sort((a,b)=>b[1].n-a[1].n);if(!ranked.length)return null;
  const[mainName,m]=ranked[0];
  return{name:mainName,hex:rgbToHex(m.top.r/m.top.n,m.top.g/m.top.n,m.top.b/m.top.n),secondary:ranked.slice(1).filter(([,e])=>e.n/total>=.15).slice(0,2).map(([nm])=>nm)};
}
async function autoDetect(blob,cutout,status){
  const type=await detectType(blob,status);
  const col=await detectColour(blob,cutout).catch(()=>null);
  const word=SINGULAR[type]||type.toLowerCase();
  const name=col?`${col.name[0].toUpperCase()+col.name.slice(1)} ${word}`:word[0].toUpperCase()+word.slice(1);
  return{type,group:GROUP_OF[type]||'Other',colour:col?.name||'',colourHex:col?.hex||null,colours2:col?.secondary||[],name};
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
const pick=o=>({closets:o?.closets||{},items:o?.items||{},outfits:o?.outfits||{},plans:o?.plans||{},deleted:o?.deleted||{}});
const localDoc=()=>({closets:Object.fromEntries(S.closets),items:Object.fromEntries(S.items),outfits:Object.fromEntries(S.outfits),plans:Object.fromEntries(S.plans),deleted:Object.fromEntries(S.deleted)});
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
  const want=wantedImages(S.items.values());
  for(const id of[...URLS.keys()])if(!want.has(id))await dropImage(id);
}
async function putFile(path,body){
  for(let i=0;;i++){try{return await GH.req('contents/'+path,{method:'PUT',body:JSON.stringify(body)})}catch(e){if(i<2&&e.status===409){await new Promise(r=>setTimeout(r,800*(i+1)));continue}throw e}}
}
function setSync(state,msg=''){S.sync={state,msg};const d=$('#syncDot');if(d)d.className='syncdot'+({ok:' ok',busy:' busy',err:' err'}[state]||'');const s=$('#syncStatus');if(s)s.textContent=syncText()}
function syncText(){
  if(!GH.cfg())return 'Not connected. Your closet is only saved on this device.';
  if(S.sync.state==='busy')return 'Syncing…';
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
function scheduleSync(delay=2500){if(!GH.cfg())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(),delay)}
function sync(){
  if(!GH.cfg()||!S.ready)return Promise.resolve();
  if(syncing){syncAgain=true;return syncing}
  syncing=(async()=>{
    setSync('busy');
    try{
      for(let attempt=0;attempt<3;attempt++){
        const r=await GH.req('contents/closet.json',{ok404:true});
        let remote=pick(null),sha=null;
        if(r.status!==404){
          const j=await r.json();sha=j.sha;
          const txt=j.content?new TextDecoder().decode(b64ToBytes(j.content)):await(await GH.req('contents/closet.json',{accept:'application/vnd.github.raw'})).text();
          remote=pick(JSON.parse(txt));
        }
        const merged=merge(localDoc(),remote);
        if(stable(merged)!==stable(localDoc()))await applyLocal(merged);
        const want=wantedImages(Object.values(merged.items));
        const lr=await GH.req('contents/images',{ok404:true});const remoteImgs=new Map();
        if(lr.status!==404)for(const f of await lr.json())if(f.type==='file')remoteImgs.set(f.name.replace(/\.\w+$/,''),{sha:f.sha,name:f.name});
        for(const id of want)if(!remoteImgs.has(id)){
          const b=await idbGet('images',id);if(!b)continue;
          const name=`${id}.${extOf(b.type)}`;
          await putFile(`images/${name}`,{message:'Add photo',content:b64FromBytes(new Uint8Array(await b.arrayBuffer()))});remoteImgs.set(id,{sha:null,name});
        }
        if(stable(merged)!==stable(remote)){
          try{await putFile('closet.json',{message:'Update closet',content:b64FromBytes(new TextEncoder().encode(JSON.stringify({app:'my-closet',version:2,savedAt:new Date().toISOString(),...merged},null,1))),...(sha?{sha}:{})})}
          catch(e){if(e.status===409||e.status===422)continue;throw e}
        }
        for(const id of want)if(!URLS.has(id)&&remoteImgs.has(id)){
          const f=remoteImgs.get(id);
          const b=await(await GH.req(`contents/images/${f.name}`,{accept:'application/vnd.github.raw'})).blob();
          const blob=new Blob([b],{type:f.name.endsWith('.png')?'image/png':'image/jpeg'});
          await idbPut('images',id,blob);URLS.set(id,URL.createObjectURL(blob));
        }
        for(const[id,f]of remoteImgs)if(!want.has(id)&&f.sha)await GH.req(`contents/images/${f.name}`,{method:'DELETE',body:JSON.stringify({message:'Remove photo',sha:f.sha})}).catch(()=>{});
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
const SLOT={Outerwear:[2,6,40,46],Tops:[22,2,56,34],'One-pieces':[20,2,60,72],Bottoms:[26,35,48,42],Shoes:[30,78,40,19],Bags:[66,42,32,28],Accessories:[72,2,26,18],Other:[2,58,30,28]};
const LAYER=['Outerwear','Bottoms','One-pieces','Tops','Shoes','Bags','Accessories','Other'];
function autoLayout(ids,prev={}){
  const out={},count={};
  let z=Math.max(0,...Object.values(prev).map(p=>p.z||0));
  const list=ids.filter(id=>S.items.has(id)).sort((a,b)=>LAYER.indexOf(groupOf(S.items.get(a)))-LAYER.indexOf(groupOf(S.items.get(b))));
  for(const id of list){
    const g=groupOf(S.items.get(id));count[g]=(count[g]||0)+1;
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
  $('#sub').textContent=`${its.length} piece${its.length===1?'':'s'}${total?' · '+money(total):''}`;
  let notice=S.notice?`<div class="notice" role="status">${esc(S.notice)}</div>`:'';
  if(!notice&&S.ready&&!GH.cfg()&&S.items.size)notice=`<div class="notice">Your closet is only saved on this device. <button type="button" data-open-sync>Back it up to GitHub</button></div>`;
  const y=window.scrollY;
  $('#view').innerHTML=notice+({closet:closetView,outfits:outfitsView,shuffle:shuffleView,calendar:calendarView,stats:statsView}[S.view])();
  if(S.view==='shuffle')wireShuffle();
  const cats=$('.cats'),selCat=cats?.querySelector('[aria-pressed="true"]');
  if(cats&&selCat&&S.type!=='All')cats.scrollLeft=Math.max(0,selCat.offsetLeft-cats.clientWidth/2+selCat.offsetWidth/2);
  scrollTo(0,y);
}
function closetChips(cur,attr,extra=''){
  const counts={};for(const it of S.items.values()){const c=closetOf(it);counts[c]=(counts[c]||0)+1}
  const list=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  return `<div class="chips closets" role="group" aria-label="Closet">${list.length>1?`<button class="chip" type="button" ${attr}="all" aria-pressed="${cur==='all'}">All closets <small>${S.items.size}</small></button>`:''}${list.map(([id,c])=>`<button class="chip" type="button" ${attr}="${id}" aria-pressed="${cur===id||list.length===1}">${esc(c.name)} <small>${counts[id]||0}</small></button>`).join('')}${extra}</div>`;
}
function closetView(){
  if(!S.ready)return '';
  const top=closetChips(S.closet,'data-closet',`<button class="chip ghost" type="button" id="manageClosets">${S.closets.size>1?'Edit closets':'+ Add a closet'}</button>`)
    +`<button class="bulkbtn" type="button" id="bulkBtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11M8 16l3-3 2 2 2-2"/></svg>Add many photos at once</button>`;
  const all=[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet));
  if(!all.length)return top+empty(S.items.size?`${esc(closetName(S.closet))} is empty`:'Your closet is empty','Add your first piece with a photo, price, type, colour and style. Tap “+ Add piece” below.');
  const types={};for(const[,i]of all){const t=typeOf(i);types[t]=(types[t]||0)+1}
  if(S.type!=='All'&&!types[S.type])S.type='All';
  const order=GENERIC.map(g=>g[0]);
  const colours=[...new Set(all.flatMap(([,i])=>itemColours(i)))].sort((a,b)=>((order.indexOf(a)+1)||99)-((order.indexOf(b)+1)||99)||a.localeCompare(b));
  const styles=[...new Set(all.map(([,i])=>(i.style||'').trim().toLowerCase()).filter(Boolean))].sort();
  return top+`
    <div class="cats" role="group" aria-label="Type">${catBtn('All','All',all.length)}${Object.keys(types).sort((a,b)=>typeRank(a)-typeRank(b)||a.localeCompare(b)).map(t=>catBtn(t,t,types[t])).join('')}</div>
    <input class="search" id="q" type="search" placeholder="Search name, type, colour, style" value="${esc(S.q)}" aria-label="Search closet">
    <div class="row">
      <select id="fColour" aria-label="Colour"><option value="">All colours</option>${colours.map(c=>`<option ${S.colour===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <select id="fStyle" aria-label="Style"><option value="">All styles</option>${styles.map(c=>`<option ${S.style===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <select id="fSort" aria-label="Sort">${[['new','Newest first'],['priceHi','Price: high to low'],['least','Least worn'],['longest','Not worn in longest'],['name','A–Z']].map(([v,l])=>`<option value="${v}" ${S.sort===v?'selected':''}>${l}</option>`).join('')}</select>
    </div><div id="results">${closetResults()}</div>`;
}
/* Type picker icons. IconPark Outline (Apache-2.0, ByteDance) and Phosphor Thin (MIT, Phosphor Icons),
   strokes thinned to match; tank top is the owner's own drawing; 'all', scarf and sleepwear drawn for this app. */
const ICON={
  all:'<rect x="4" y="4" width="3.6" height="16" rx="1.6"/><rect x="9.6" y="4" width="3.6" height="16" rx="1.6"/><rect x="15.4" y="4.6" width="3.6" height="15.4" rx="1.6" transform="rotate(-14 17.2 12.3)"/>',
  tank:'<g transform="scale(.25)"><path stroke-width="4" d="M31 16 H34 L36 34 Q48 43 60 34 L62 16 H65 L64 36 Q64 41 68 44 L65 78 Q48 81 31 78 L28 44 Q32 41 32 36 Z M31.4 74 Q48 77 64.6 74"/></g>',
  scarf:'<path d="M8 3h8v6.2l-2 2V21h-3.2v-9.6L8 9z"/><path d="M8 6h8M10.8 21v-2M12.4 21v-2M14 21v-2"/>',
  sleep:'<path d="M19 14.5A7.2 7.2 0 1 1 9.5 5a5.8 5.8 0 0 0 9.5 9.5z"/>',
  tshirt:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="m9 9l9-5h12l9 5l4 15l-8 6v14H13V30l-8-6zm4 22v-7m22 7v-7"/></g>',
  bodysuit:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="m6.572 19.575l-2.165-7.217c-.244-.813.048-1.696.765-2.15C8.057 8.377 14.642 5 24 5c9.343 0 15.8 3.366 18.759 5.198c.748.463 1.068 1.377.816 2.22l-2.147 7.157A2 2 0 0 1 39.512 21H36c-1.105 0-2 .891-2 1.996v10.006c0 1.104-.905 2.011-1.973 2.295c-1.299.345-2.952 1.09-4.027 2.703c-2 3-2 6-2 6h-4s0-3-2-6c-1.075-1.613-2.728-2.358-4.027-2.703c-1.068-.284-1.973-1.19-1.973-2.295V22.996A1.996 1.996 0 0 0 12 21H8.488a2 2 0 0 1-1.916-1.425"/><path d="M29.811 5.5a6 6 0 1 1-11.622 0"/><path d="M13.5 6.494A37 37 0 0 1 24 5c4.043 0 7.545.63 10.457 1.494"/></g></g>',
  shirt:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="m6 10l12-6h12l12 6l-2 25h-6v9H14v-9H8zm8 25V20m20 15V20"/><path d="M24 10a6 6 0 0 0 6-6H18a6 6 0 0 0 6 6"/></g></g>',
  sweater:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M37 17v20m-26 0v7h26v-7m-26 0H4V17c0-3 2-6.5 5-9s9-4 9-4h12s6 1.5 9 4s5 6 5 9v20h-7m-26 0V17"/><path d="M30 4a6 6 0 0 1-12 0"/></g></g>',
  hoodie:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M37 22v15m-26 0v7h26v-7m-26 0H4V22c0-3 2-6.5 5-9s7-3 7-3l8 8M11 37V22m26 15h7V22c0-3-2-6.5-5-9s-7-3-7-3l-8 8m0 0v9"/><path d="M9 13c3-2.5 7-3 7-3l8 8l8-8s4 .5 7 3l2-4.5L39 4H9L7 8.5z"/></g></g>',
  cardigan:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M37 17v20m-26 0v7h26v-7m-26 0H4V17c0-3 2-6.5 5-9s7-4 7-4h16s4 1.5 7 4s5 6 5 9v20h-7m-26 0V17m13 0v27m0-27L16 4m16 0l-8 13"/></g>',
  jeans:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M33 44h9L38 4H10L6 44h9l9-25zM24 4v5.5"/><path d="M17 4s0 6-2 8s-6.1 3-6.1 3M31 4s0 6 2 8s6.1 3 6.1 3"/></g></g>',
  pants:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M33 44h9L38 4H10L6 44h9l9-25zM24 4v5.5"/><path d="M17 4s0 6-2 8s-6.1 3-6.1 3M31 4s0 6 2 8s6.1 3 6.1 3"/></g></g>',
  sweatpants:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="m24 19l9 19h9L38 4H10L6 38h9zm10 19l1 6h6v-6zm-21 6H7v-6h7zM24 4l4 7.5M24 4l-4 7.5"/></g>',
  shorts:'<g transform="scale(.5)"><g fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M37 6H11v10L4 33l15 9l5-6l5 6l15-9l-7-17z"/><path fill="currentColor" d="M11 14a2 2 0 1 0 0 4zm26 4a2 2 0 1 0 0-4zm-26 0h26v-4H11z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M37 14v2l1.75 4.25M11 14v2l-1.75 4.25"/></g></g>',
  skirt:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="m12 9l5-5h14l5 5l7 26s-3 9-19 9s-19-9-19-9zm1 33l4-16"/><path d="M5 35s3 9 19 9"/></g></g>',
  leggings:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="m24 19l9 19h9L38 4H10L6 38h9zm10 19l1 6h6v-6zm-21 6H7v-6h7zM24 4l4 7.5M24 4l-4 7.5"/></g>',
  dress:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="m18 18l-4-8h20l-4 8v6l10.5 20H7l11-20zm2-14v6m8-6v6M18 21h12m-12-2v4m12-4v4"/></g>',
  jumpsuit:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="m6.572 19.575l-2.165-7.217c-.244-.813.048-1.696.765-2.15C8.057 8.377 14.642 5 24 5c9.343 0 15.8 3.366 18.759 5.198c.748.463 1.068 1.377.816 2.22l-2.147 7.157A2 2 0 0 1 39.512 21H36c-1.105 0-2 .891-2 1.996v10.006c0 1.104-.905 2.011-1.973 2.295c-1.299.345-2.952 1.09-4.027 2.703c-2 3-2 6-2 6h-4s0-3-2-6c-1.075-1.613-2.728-2.358-4.027-2.703c-1.068-.284-1.973-1.19-1.973-2.295V22.996A1.996 1.996 0 0 0 12 21H8.488a2 2 0 0 1-1.916-1.425"/><path d="M29.811 5.5a6 6 0 1 1-11.622 0"/><path d="M13.5 6.494A37 37 0 0 1 24 5c4.043 0 7.545.63 10.457 1.494"/></g></g>',
  jacket:'<g transform="scale(.5)"><g fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M37 25v12m-26 0v7h26v-7m-26 0H4V18l6.125-5L17 18l7-8l7 8l6.875-5L44 18v19h-7m-26 0V25"/><path d="m17 18l7-8l7 8l11-8l-2.5-6H9l-3 6z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M19 10h5m5 0h-5m0 0l-7 8l-11-8l3-6h30.5l2.5 6l-11 8z"/></g></g>',
  coat:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M12 10c4-1 7-6 7-6h10s3 5.2 7 6l6 21h-8v13H14V31H6z"/><path d="m19 4l5 14l5-14m-5 14v26"/></g></g>',
  blazer:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M37 21v16m-26 0v7h26v-7m-26 0H4V10l14-6h12l14 6v27h-7m-26 0V21M30 4l-6 14m0 0L18 4m6 14v26m6-40l-6 14m0 0L18 4"/><path d="m18 4l-4 8l4 5.5l-2 5.5l8 14m6-33l5 8l-5 5.5l2 5.5l-8 14"/></g></g>',
  vest:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M36 4h-5l-7 20v20h16V19l-4-6zM12 4h5l7 20v20H8V19l4-6z"/></g>',
  sneaker:'<g transform="scale(.09375)"><path fill="currentColor" d="m227.38 132.91l-60.72-20.24A28 28 0 0 1 150 97.53l-23.31-54.41a12 12 0 0 0-15.07-6.4L35.9 64.25A12 12 0 0 0 28 75.53V192a12 12 0 0 0 12 12h200a12 12 0 0 0 12-12v-24.94a36 36 0 0 0-24.62-34.15M38.63 71.77l75.72-27.53a3.8 3.8 0 0 1 1.37-.24a4 4 0 0 1 3.63 2.32L128.17 67l-25.54 9.29A4 4 0 0 0 104 84a4.1 4.1 0 0 0 1.37-.24l25.95-9.44l7.89 18.44l-20.58 7.48A4 4 0 0 0 120 108a4.1 4.1 0 0 0 1.37-.24l21-7.64l.25.6a36.1 36.1 0 0 0 13.52 15.7l-21.5 7.82A4 4 0 0 0 136 132a4.1 4.1 0 0 0 1.37-.24l29.3-10.66l58.18 19.4a28 28 0 0 1 19 23.5H36V75.53a4 4 0 0 1 2.63-3.76M240 196H40a4 4 0 0 1-4-4v-20h208v20a4 4 0 0 1-4 4"/></g>',
  boot:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M19 4h16l-4 32l1.236.618A5 5 0 0 1 35 41.09V44H10v-2l13-6zm1 8h14"/></g>',
  shoes:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M29.183 20C31.264 15.054 36.35 10.667 39 8c1.104.667 5 2.604 5 7c0 4-1.455 7.111-3 8l-5.987 4.191a23 23 0 0 0-6.533 7.01L25 40H4v-4c2.429-1.333 9.82-5.867 13-8c7 4 10.5-4 12.183-8M43 21v19"/></g>',
  sandal:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.1"><path stroke-linejoin="bevel" d="m11.2 6.854l-.708.225c-3.487 1.104-5.536 4.71-4.898 8.312c.73 4.115 1.291 8.04 2.095 11.661c.785 3.537.447 6.689.25 10.032c-.192 3.266 2.409 5.843 5.672 6.07c4.623.321 8.182-4.082 7.297-8.63c-.684-3.516-1.202-7.318-.969-10.024c.25-2.904.277-7.29.23-11.251c-.055-4.616-4.568-7.788-8.968-6.395Zm23.61-1.131l-.77.144c-3.455.648-5.892 3.761-5.926 7.277C28.071 17.701 27.831 22.15 28 26c.156 3.553-.437 6.153-1.017 9.053c-.626 3.13 1.443 6.044 4.54 6.815c4.485 1.116 8.712-2.698 8.577-7.318c-.093-3.175.03-6.512.681-8.95c.79-2.96 1.547-7.903 2.129-12.314c.61-4.632-3.509-8.424-8.1-7.563Z"/><path stroke-linejoin="round" stroke-miterlimit="2" d="M8 29c1-9 6-14 6-14c1.636 2 4 8 6 14m20 1c.5-8-5-16-5-16c-1.636 2-7 5.278-7 11.5"/></g></g>',
  loafer:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M4 29h40v6H4zm3-7c-3 4-3 7-3 7h26v-8c0-2.5-1.5-5.5-5-6s-13.124.5-18 7"/></g>',
  bag:'<g transform="scale(.09375)"><path fill="currentColor" d="m235.92 198.59l-14.26-120a12 12 0 0 0-12-10.59H172v-4a44 44 0 0 0-88 0v4H46.33a12 12 0 0 0-12 10.59l-14.26 120a12 12 0 0 0 2.93 9.35a12.1 12.1 0 0 0 9.08 4.06h191.84a12.1 12.1 0 0 0 9.06-4.06a12 12 0 0 0 2.94-9.35M92 64a36 36 0 0 1 72 0v4H92Zm135 138.63a4.08 4.08 0 0 1-3.08 1.37H32.08a4.08 4.08 0 0 1-3.08-1.37a3.9 3.9 0 0 1-1-3.09l14.25-120a4 4 0 0 1 4-3.54H84v28a4 4 0 0 0 8 0V76h72v28a4 4 0 0 0 8 0V76h37.67a4 4 0 0 1 4.05 3.54l14.25 120a3.9 3.9 0 0 1-.97 3.09"/></g>',
  hat:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M12 10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v10H12zm32 25c-1.108 1.333-2.375 5-7.6 5c-2.737 0-6.456-1.684-11.4-3"/><path d="M4 35s6-9 8-15h24c2 6 8 15 8 15c-6-4-25 5-32 5c-5.5 0-6.833-3.667-8-5"/></g></g>',
  jewelry:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M17 32.41L24 29l7 3.41v7.5L24 44l-7-4.09zM8 4c.455 8.333 6 25 16 25S40 12.784 40 4"/></g>',
  belt:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="m10.565 30.364l-6.364 6.364l7.071 7.071l6.364-6.364m4.243-18.385l14.85-14.849l7.07 7.071l-14.849 14.85"/><path d="M9.859 29.657a2 2 0 0 1 0-2.829l8.485-8.485a2 2 0 0 1 2.828 0l8.485 8.485a2 2 0 0 1 0 2.829l-8.485 8.485a2 2 0 0 1-2.828 0zm15.556-7.071l-7.071 7.07M31.779 9.15l7.07 7.072M26.828 14.1l7.071 7.072m-18.384 0L26.83 32.485"/></g></g>',
  sunglasses:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><circle cx="12" cy="35" r="7"/><circle cx="36" cy="35" r="7"/><path d="M5 34V10.883c0-1.391 0-2.087.378-2.61c.377-.525 1.037-.745 2.357-1.185L11 6m32 28V10.883c0-1.391 0-2.087-.377-2.61c-.378-.525-1.038-.745-2.358-1.185L37 6m-8 28a5 5 0 0 0-10 0"/></g></g>',
  watch:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M34.956 31L31 44H17l-3.956-13m0-14L17 4h14l3.956 13"/><path d="M37 24c0 2.577-.75 4.98-2.044 7A12.99 12.99 0 0 1 24 37a12.99 12.99 0 0 1-10.956-6A12.94 12.94 0 0 1 11 24c0-2.577.75-4.98 2.044-7A12.99 12.99 0 0 1 24 11a12.99 12.99 0 0 1 10.956 6A12.94 12.94 0 0 1 37 24"/><path d="M24 17v7l4 4"/></g></g>',
  active:'<g transform="scale(.5)"><g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2.1"><path d="M30 4a6 6 0 0 1-12 0h-3c-1.105 0-2.002.894-2.032 1.998C12.9 8.57 12.683 12.951 12 15c-.761 2.283-3.839 5.146-5.266 6.383c-.46.398-.734.97-.734 1.578V42a2 2 0 0 0 2 2h32a2 2 0 0 0 2-2V22.961c0-.607-.275-1.18-.734-1.578C39.84 20.146 36.761 17.283 36 15c-.683-2.049-.9-6.43-.968-9.002C35.002 4.894 34.105 4 33 4z"/><path d="M27 24h6v12h-6z"/><path stroke-linecap="round" d="M15 24h6v12h-6m6-6h-6"/></g></g>',
  other:'<g transform="scale(.5)"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M19 13a5 5 0 1 1 5 5v4m20 14H4c0-5 6-14 20-14s20 9 20 14"/></g>'};
const TYPE_ICON={'T-shirts':'tshirt','Tank tops':'tank','Bodysuits':'bodysuit','Shirts':'shirt','Sweaters':'sweater','Hoodies':'hoodie','Cardigans':'cardigan','Jeans':'jeans','Pants':'pants','Shorts':'shorts','Skirts':'skirt','Leggings':'leggings','Sweatpants':'sweatpants',
  'Dresses':'dress','Jumpsuits':'jumpsuit','Jackets':'jacket','Coats':'coat','Blazers':'blazer','Vests':'vest','Sneakers':'sneaker','Boots':'boot','Shoes':'shoes','Sandals':'sandal','Loafers':'loafer',
  'Bags':'bag','Hats':'hat','Jewelry':'jewelry','Belts':'belt','Scarves':'scarf','Sunglasses':'sunglasses','Watches':'watch','Activewear':'active','Sleepwear':'sleep','Other':'other'};
const GROUP_ICON={Tops:'tshirt',Bottoms:'pants','One-pieces':'dress',Outerwear:'jacket',Shoes:'sneaker',Bags:'bag',Accessories:'hat',Other:'other'};
function typeIcon(t){
  if(t==='All')return ICON.all;
  if(TYPE_ICON[t])return ICON[TYPE_ICON[t]];
  const g=[...S.items.values()].find(i=>i.type===t)?.group;return ICON[GROUP_ICON[g]||'other'];
}
function catBtn(val,label,count){
  return `<button class="cat" type="button" data-type="${esc(val)}" aria-pressed="${S.type===val}" aria-label="${esc(label)}, ${count}"><span class="cic"><svg viewBox="0 0 24 24" aria-hidden="true">${typeIcon(val)}</svg><span class="cn">${count}</span></span><span class="cl">${esc(label)}</span></button>`;
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
  let list=[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet)&&(S.type==='All'||typeOf(i)===S.type)&&(!S.colour||itemColours(i).includes(S.colour))&&(!S.style||(i.style||'').trim().toLowerCase()===S.style)&&(!q||[i.name,...itemColours(i),i.style,typeOf(i),groupOf(i)].join(' ').toLowerCase().includes(q)));
  const sorters={
    new:(a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0),
    priceHi:(a,b)=>(Number(b[1].price)||0)-(Number(a[1].price)||0),
    least:(a,b)=>(W[a[0]]?.worn.length||0)-(W[b[0]]?.worn.length||0),
    longest:(a,b)=>(last(W[a[0]])||'0000').localeCompare(last(W[b[0]])||'0000'),
    name:(a,b)=>(a[1].name||'').localeCompare(b[1].name||'')};
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
function shufPool(group){
  const sh=S.shuf,st=sh.style;
  return [...S.items.entries()].filter(([,i])=>inCloset(i,sh.closet)&&groupOf(i)===group&&(!st||(i.style||'').trim().toLowerCase()===st));
}
function weightedPick(entries,W){
  if(!entries.length)return null;
  const w=entries.map(([id])=>{const l=last(W[id]);return !l?1.6:daysAgo(l)<7?.35:1});
  let r=Math.random()*w.reduce((a,b)=>a+b,0);for(let k=0;k<entries.length;k++){r-=w[k];if(r<=0)return entries[k][0]}return entries[entries.length-1][0];
}
function doShuffle(){
  const sh=S.shuf,W=wear().items,L=sh.locks,slots={};
  for(const k of L)if(sh.slots[k]&&S.items.has(sh.slots[k]))slots[k]=sh.slots[k];
  const P={top:shufPool('Tops'),bottom:shufPool('Bottoms'),one:shufPool('One-pieces'),shoes:shufPool('Shoes'),outer:shufPool('Outerwear'),bag:shufPool('Bags'),acc:shufPool('Accessories')};
  let mode;
  if(slots.one)mode='one';else if(slots.top||slots.bottom)mode='sep';
  else{const canSep=P.top.length&&P.bottom.length,canOne=P.one.length;mode=canSep&&canOne?(Math.random()<.3?'one':'sep'):canOne?'one':canSep?'sep':null}
  if(!mode){sh.slots={};sh.err='Add some tops and bottoms (or dresses) to this closet to shuffle outfits.';return}
  sh.err='';
  const want=mode==='one'?['one']:['top','bottom'];want.push('shoes');if(sh.outer)want.push('outer');if(sh.bag)want.push('bag');if(sh.acc)want.push('acc');
  for(const k of want)if(!slots[k]){const id=weightedPick(P[k],W);if(id)slots[k]=id}
  sh.slots=slots;for(const k of[...L])if(!slots[k])L.delete(k);
}
const SLOTNAME={top:'Top',bottom:'Bottom',one:'Dress / jumpsuit',shoes:'Shoes',outer:'Outerwear',bag:'Bag',acc:'Accessory'};
function shuffleView(){
  if(!S.ready)return '';
  const sh=S.shuf;if(sh.closet!=='all'&&!S.closets.has(sh.closet))sh.closet='all';
  if(!Object.keys(sh.slots).length&&!sh.err)doShuffle();
  const styles=[...new Set([...S.items.values()].filter(i=>inCloset(i,sh.closet)).map(i=>(i.style||'').trim().toLowerCase()).filter(Boolean))].sort();
  const ids=Object.values(sh.slots);
  return `${closetChips(sh.closet,'data-shufcloset')}
    <div class="row"><select id="shStyle" aria-label="Style"><option value="">Any style</option>${styles.map(s=>`<option ${sh.style===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
    <div class="chips" role="group" aria-label="Add to the outfit">${[['outer','Outerwear'],['bag','Bag'],['acc','Accessory']].map(([k,l])=>`<button class="chip" type="button" data-shopt="${k}" aria-pressed="${!!sh[k]}">+ ${l}</button>`).join('')}</div>
    ${sh.err?empty('Nothing to shuffle yet',sh.err):`
    ${boardHTML(ids,null,'big')}
    <div class="slots">${Object.entries(sh.slots).map(([k,id])=>{const it=S.items.get(id);return `<div class="slot"><span class="mini ${it?.cutout&&hasImg(it)?'cut':''}">${thumb(it)}</span><span class="tx"><small>${SLOTNAME[k]}</small><b>${esc(it?.name)}</b></span><button type="button" class="lock" data-lock="${k}" aria-pressed="${sh.locks.has(k)}">${sh.locks.has(k)?'Locked':'Lock'}</button></div>`}).join('')}</div>
    <p class="muted" style="margin:0;font-size:13px">Lock the pieces you like, then shuffle the rest. Pieces worn in the last week come up less often.</p>
    <div class="btns"><button class="btn primary" type="button" id="shGo">Shuffle</button><button class="btn" type="button" id="shSave">Save as outfit</button><button class="btn" type="button" id="shWear">Wear today</button></div>`}`;
}
function wireShuffle(){
  const sh=S.shuf;
  $('#shGo')?.addEventListener('click',()=>{doShuffle();render()});
  $('#shSave')?.addEventListener('click',()=>outfitSheet(null,Object.values(sh.slots)));
  $('#shWear')?.addEventListener('click',async e=>{const ids=Object.values(sh.slots);await guard(e.currentTarget,async()=>{let oid=matchOutfit(ids);await saveDoc('plans',today(),{itemIds:ids,outfitId:oid,note:S.plans.get(today())?.note||''});toast('Logged for today')})});
  $('#shStyle')?.addEventListener('change',e=>{sh.style=e.target.value;sh.locks.clear();doShuffle();render()});
}

function calendarView(){
  const m=S.month,y=m.getFullYear(),mo=m.getMonth(),t=today();
  const first=new Date(y,mo,1),start=new Date(y,mo,1-first.getDay());
  let cells='';
  for(let k=0;k<42;k++){
    const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+k),key=ymd(d),p=S.plans.get(key);
    if(k===35&&d.getMonth()!==mo)break;
    const pic=p&&(p.itemIds||[]).map(id=>S.items.get(id)).sort((a,b)=>(a&&groupOf(a)==='Tops'?-1:0)-(b&&groupOf(b)==='Tops'?-1:0)).find(i=>hasImg(i));
    const has=p&&(p.itemIds||[]).length;
    cells+=`<button type="button" class="day${d.getMonth()!==mo?' out':''}${key===t?' today':''}${key>t?' future':''}${has?' has':''}${pic?' img':''}${pic?.cutout?' cut':''}" data-day="${key}" aria-label="${fmtDate(key)}${has?', '+esc(p.outfitId&&S.outfits.get(p.outfitId)?.name||'outfit planned'):''}">
      <span class="n">${d.getDate()}</span>${pic?img(pic.imageId):has?'<span class="dot"></span>':''}</button>`;
  }
  const up=[...S.plans.entries()].filter(([d,p])=>d>t&&(p.itemIds||[]).length).sort().slice(0,7);
  const recent=[...S.plans.entries()].filter(([d,p])=>d<=t&&(p.itemIds||[]).length).sort().reverse().slice(0,5);
  const row=([d,p])=>{const o=p.outfitId&&S.outfits.get(p.outfitId);const it=(p.itemIds||[]).map(i=>S.items.get(i)).filter(Boolean);const f=it.find(hasImg)||it[0];
    return `<button class="li" type="button" data-day="${d}"><span class="mini ${f?.cutout&&hasImg(f)?'cut':''}">${thumb(f)}</span><span class="tx"><b>${esc(o?.name||it.map(i=>i.name).join(', ')||'Outfit')}</b><small>${fmtDate(d)} · ${ago(d)}</small></span></button>`};
  return `<div class="calhead"><button class="iconbtn" type="button" data-mon="-1" aria-label="Previous month">‹</button>
    <h2>${m.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h2>
    <button class="iconbtn" type="button" data-mon="1" aria-label="Next month">›</button></div>
    <div class="cal">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="dow">${d}</div>`).join('')}${cells}</div>
    <div class="legend">Tap a day to plan or log an outfit. Days up to today count as worn; dashed days are planned.</div>
    <h3>Coming up</h3>${up.length?`<div class="list">${up.map(row).join('')}</div>`:'<p class="muted" style="margin:0">Nothing planned yet.</p>'}
    <h3>Recently worn</h3>${recent.length?`<div class="list">${recent.map(row).join('')}</div>`:'<p class="muted" style="margin:0">No outfits logged yet.</p>'}`;
}

/* ---------- stats ---------- */
function statsView(){
  if(!S.ready)return '';
  const c=S.statsCloset==='all'||S.closets.has(S.statsCloset)?S.statsCloset:'all';
  const W=wear().items;
  const its=[...S.items.entries()].filter(([,i])=>inCloset(i,c));
  const head=closetChips(c,'data-statcloset');
  if(!its.length)return head+empty('No stats yet','Add pieces to see what your closet is worth and what you actually wear.');
  const priced=its.filter(([,i])=>Number(i.price)>0);
  const total=priced.reduce((a,[,i])=>a+Number(i.price),0);
  const ids=new Set(its.map(([id])=>id));
  const mon=today().slice(0,7);
  const daysThisMonth=[...S.plans.entries()].filter(([d,p])=>d.startsWith(mon)&&d<=today()&&(p.itemIds||[]).some(i=>ids.has(i))).length;
  const wornCount=id=>W[id]?.worn.length||0;
  const neverOrStale=its.filter(([id])=>{const l=last(W[id]);return !l||daysAgo(l)>=90});
  const usedPct=Math.round((its.length-neverOrStale.length)/its.length*100);
  const bars=(rows,max,fmt)=>`<div class="bars">${rows.map(r=>`<div class="bar"><span class="bl">${r.sw?`<span class="sw" style="background:${r.sw}"></span>`:''}${esc(r.label)}</span><span class="bt"><span style="width:${Math.max(2,r.v/max*100)}%"></span></span><span class="bv">${fmt(r)}</span></div>`).join('')}</div>`;
  const byType={};for(const[,i]of its){const t=typeOf(i);(byType[t]??={label:t,v:0,val:0}).v++;byType[t].val+=Number(i.price)||0}
  const typeRows=Object.values(byType).sort((a,b)=>b.v-a.v);
  const byCol={};for(const[,i]of its){const k=genericName(i.colour)||'no colour';(byCol[k]??={label:k,v:0,sw:GEN_HEX[k]||okColour(k)}).v++}
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
    <h3>Not worn in 90+ days · ${neverOrStale.length}</h3>${neverOrStale.length?`<div class="list">${neverOrStale.slice(0,12).map(([id,i])=>li(id,i,last(W[id])?`Last worn ${fmtDate(last(W[id]))}`:'Never worn')).join('')}</div>`:'<p class="muted" style="margin:0">You’ve worn everything recently.</p>'}`;
}

/* ---------- main view events ---------- */
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');if(tab){S.view=tab.dataset.tab;ls.set('closet.view',S.view);render();scrollTo(0,0);return}
  if(e.target.closest('#sheetRoot'))return;
  if(e.target.closest('#syncBtn,[data-open-sync]')){syncSheet();return}
  if(e.target.closest('#manageClosets')){closetsSheet();return}
  if(e.target.closest('#bulkBtn')){bulkSheet();return}
  const cl=e.target.closest('[data-closet]');if(cl){S.closet=cl.dataset.closet;S.type='All';ls.set('closet.current',S.closet);render();return}
  const sc=e.target.closest('[data-shufcloset]');if(sc){S.shuf.closet=sc.dataset.shufcloset;S.shuf.locks.clear();doShuffle();render();return}
  const stc=e.target.closest('[data-statcloset]');if(stc){S.statsCloset=stc.dataset.statcloset;render();return}
  const so=e.target.closest('[data-shopt]');if(so){const k=so.dataset.shopt;S.shuf[k]=!S.shuf[k];if(!S.shuf[k]){delete S.shuf.slots[k];S.shuf.locks.delete(k)}doShuffle();render();return}
  const lk=e.target.closest('[data-lock]');if(lk){const k=lk.dataset.lock,L=S.shuf.locks;L.has(k)?L.delete(k):L.add(k);render();return}
  const ty=e.target.closest('[data-type]');if(ty){S.type=ty.dataset.type;render();return}
  const it=e.target.closest('[data-item]');if(it){itemSheet(it.dataset.item);return}
  const of=e.target.closest('[data-outfit]');if(of){outfitSheet(of.dataset.outfit);return}
  const dy=e.target.closest('[data-day]');if(dy){daySheet(dy.dataset.day);return}
  const mn=e.target.closest('[data-mon]');if(mn){S.month=new Date(S.month.getFullYear(),S.month.getMonth()+Number(mn.dataset.mon),1);render();return}
});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;const r=$('#results');if(r)r.innerHTML=closetResults()}});
document.addEventListener('change',e=>{if(e.target.closest('#sheetRoot'))return;const id=e.target.id;if(id==='fColour')S.colour=e.target.value;else if(id==='fStyle')S.style=e.target.value;else if(id==='fSort')S.sort=e.target.value;else return;render()});
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
  const sh=openSheet(`${head('Add many pieces')}
    <p class="muted" style="margin:0">Choose several photos, one piece of clothing per photo. Each photo becomes its own item.</p>
    ${closets.length>1?`<div class="field"><label for="bCloset">Add to closet</label><select id="bCloset">${closets.map(([cid,c])=>`<option value="${cid}" ${cid===defCloset?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`:''}
    <label class="check"><input type="checkbox" id="bCut" ${ls.get('closet.bulkCut')!=='off'?'checked':''}> Remove backgrounds</label>
    <label class="check"><input type="checkbox" id="bAuto" ${ls.get('closet.autoDetect')!=='off'?'checked':''}> Name and sort them automatically</label>
    <label class="btn primary filebtn" id="bPick">Choose photos<input type="file" accept="image/*" multiple id="bFiles"></label>
    <p class="muted" id="bMsg" aria-live="polite" style="margin:0;font-size:13px"></p>
    <div class="list" id="bList"></div>
    <div class="btns" id="bEnd" hidden><button class="btn primary" type="button" id="bSave">Save and close</button></div>`);
  const msg=sh.querySelector('#bMsg'),list=sh.querySelector('#bList');
  const cutEl=sh.querySelector('#bCut'),autoEl=sh.querySelector('#bAuto');
  cutEl.addEventListener('change',()=>ls.set('closet.bulkCut',cutEl.checked?null:'off'));
  autoEl.addEventListener('change',()=>ls.set('closet.autoDetect',autoEl.checked?null:'off'));
  const created=[];
  sh.querySelector('#bFiles').addEventListener('change',async e=>{
    const files=[...e.target.files];e.target.value='';if(!files.length)return;
    const closetId=sh.querySelector('#bCloset')?.value||defCloset,cut=cutEl.checked,auto=autoEl.checked;
    sh.querySelector('#bPick').hidden=true;cutEl.disabled=autoEl.disabled=true;
    const rows=files.map((f,i)=>{const r=document.createElement('div');r.className='brow';r.innerHTML=`<span class="mini"></span><span class="tx"><b>Photo ${i+1}</b><small>Waiting…</small></span>`;list.append(r);return r});
    for(let i=0;i<files.length;i++){
      const row=rows[i],st=t=>{row.querySelector('small').textContent=t};
      msg.textContent=`Working on ${i+1} of ${files.length}. Keep the app open until it finishes.`;
      let r;try{st('Preparing…');r=await shrink(files[i])}catch(err){st('Skipped: not a supported photo');continue}
      if(cut&&!r.cutout){st('Removing background…');try{r={blob:await removeBg(r.blob,m=>msg.textContent=m),cutout:true}}catch(err){console.warn(err)}}
      let g={name:'New piece',type:'Other',group:'Other',colour:'',colourHex:null,colours2:[]};
      if(auto){st('Recognizing…');try{g=await autoDetect(r.blob,r.cutout,m=>msg.textContent=m)}catch(err){console.warn(err)}}
      try{
        const imageId=await addImage(r.blob),iid=newId();
        await saveDoc('items',iid,{name:g.name,price:null,type:g.type,group:g.group,closetId,colour:g.colour,colourHex:g.colourHex||null,colours2:g.colours2||[],style:'',imageId,cutout:r.cutout,createdAt:Date.now()});
        created.push(iid);
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
  return `<select id="fType">${GROUPS.map(([g,ts])=>`<optgroup label="${g}">${ts.map(t=>`<option ${(cur||'T-shirts')===t?'selected':''}>${t}</option>`).join('')}</optgroup>`).join('')}
    <optgroup label="Your own">${[...new Set([...S.items.values()].map(typeOf).filter(t=>!GROUP_OF[t]))].map(t=>`<option ${cur===t?'selected':''}>${esc(t)}</option>`).join('')}${!known&&![...S.items.values()].some(i=>i.type===cur)?`<option selected>${esc(cur)}</option>`:''}<option value="__new">New type…</option></optgroup></select>`;
}

function itemSheet(id){
  const it=id?S.items.get(id):null;if(id&&!it)return;
  const r=id?wear().items[id]:null,l=last(r),wears=r?.worn.length||0,price=Number(it?.price);
  const styles=[...new Set([...S.items.values()].map(i=>(i.style||'').trim()).filter(Boolean))];
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
        <button class="btn sm" type="button" data-cut ${pid&&URLS.has(pid)&&!cut?'':'hidden'}>Remove background</button>
        <button class="btn sm" type="button" data-fix ${pid&&URLS.has(pid)&&cut?'':'hidden'}>Clean up specks</button>
        <button class="linkbtn" type="button" data-clear ${pid&&URLS.has(pid)?'':'hidden'}>Remove photo</button>
      </div>`).join('')}</div>
    <p class="muted" id="cutMsg" aria-live="polite" style="margin:0;font-size:13px"></p>
    <div class="field"><label for="fName">Name</label><input id="fName" value="${esc(it?.name)}" placeholder="Black straight-leg jeans" autocomplete="off"></div>
    <div class="two">
      <div class="field"><label for="fType">Type</label>${typeSelect(it?.type)}</div>
      <div class="field"><label for="fPrice">Price ($)</label><input id="fPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(it?.price)}" placeholder="60"></div>
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
      <div class="eyedrop" id="eyedrop" hidden><p class="muted" style="margin:0;font-size:13px">Tap the part of the photo that shows the main colour.</p><canvas id="eyeCanvas"></canvas><button class="linkbtn" type="button" id="eyeCancel">Cancel</button></div>
    </div>
    <div class="field"><span class="lbl">Secondary colours <small class="muted" style="text-transform:none;letter-spacing:0">(tap all that apply)</small></span>
      <div class="swatches" role="group" aria-label="Secondary colours">${GENERIC.map(([n,h])=>`<button type="button" data-sec="${n}" style="background:${h}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
      <p class="muted" id="secNames" style="margin:0;font-size:13px"></p>
    </div>
    <div class="field"><label for="fSty">Style</label><input id="fSty" list="styleList" value="${esc(it?.style)}" placeholder="casual, work, going out…" autocomplete="off">
      <datalist id="styleList">${[...new Set([...styles,'casual','work','going out','athletic','formal','lounge','vintage'])].map(s=>`<option value="${esc(s)}">`).join('')}</datalist></div>
    <div class="btns"><button class="btn primary" type="button" id="save">${it?'Save changes':'Add to closet'}</button>
      ${it?`<button class="btn" type="button" id="wearToday">Wore it today</button><button class="btn danger" type="button" id="del">Delete</button>`:''}</div>`);
  // per-slot photo state: id = stored image, blob = new unsaved image, cleared = user removed it
  const P={front:{id:it?.imageId||null,cutout:!!it?.cutout,blob:null},back:{id:it?.backImageId||null,cutout:!!it?.backCutout,blob:null}};
  const cutMsg=sh.querySelector('#cutMsg');
  sh.querySelectorAll('[data-slot]').forEach(slot=>{
    const k=slot.dataset.slot,st=P[k],prev=slot.querySelector('[data-prev]'),cutB=slot.querySelector('[data-cut]'),fixB=slot.querySelector('[data-fix]'),clr=slot.querySelector('[data-clear]');
    const show=()=>{const has=st.blob||st.id;prev.className='ph'+(has&&st.cutout?' cut':'');
      prev.innerHTML=st.blob?`<img src="${URL.createObjectURL(st.blob)}" alt="">`:st.id?img(st.id):`<span class="hint">Add ${k} photo</span>`;
      cutB.hidden=!has||st.cutout;fixB.hidden=!has||!st.cutout;clr.hidden=!has;cutMsg.textContent=''};
    slot.querySelector('[data-file]').addEventListener('change',async e=>{
      const f=e.target.files[0];e.target.value='';if(!f)return;
      try{const r=await shrink(f);st.blob=r.blob;st.cutout=r.cutout;show()}catch(err){toast('That file type isn’t supported. Try a JPEG or PNG.');return}
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
    fixB.addEventListener('click',async()=>{
      fixB.disabled=true;
      try{const src=st.blob||await idbGet('images',st.id);const r=await repairCutout(src);
        if(!r.fixed){cutMsg.textContent='No specks found in this photo.';return}
        st.blob=r.blob;st.cutout=true;show();cutMsg.textContent=`Filled ${r.fixed.toLocaleString()} speck pixel${r.fixed===1?'':'s'}. Tap Save to keep it.`}
      catch(err){console.error(err);cutMsg.textContent='Couldn’t clean up this photo.'}
      finally{fixB.disabled=false}
    });
    cutB.addEventListener('click',async()=>{
      cutB.disabled=true;
      try{const src=st.blob||await idbGet('images',st.id);st.blob=await removeBg(src,m=>cutMsg.textContent=m);st.cutout=true;show();cutMsg.textContent='Background removed. Tap Save to keep it.'}
      catch(err){console.error(err);cutMsg.textContent=err?.code==='empty'?'Couldn’t find the item in that photo. Try a photo with the piece on a plain background.':'The cut-out tool couldn’t run here. On iPhone you can touch and hold the item in the Photos app, tap Share → Save Image, then choose that picture.'}
      finally{cutB.disabled=false}
    });
  });
  const tSel=sh.querySelector('#fType');tSel.addEventListener('change',()=>{sh.querySelector('#newTypeRow').hidden=tSel.value!=='__new'});
  // colour state: main (plain name + exact shade) and a set of secondary names
  const COL={name:genericName(it?.colour)||'',hex:it?.colourHex||null,sec:new Set(it?.colours2||[])};
  function paintCol(){
    const sw=COL.hex||GEN_HEX[COL.name]||okColour(COL.name);
    sh.querySelector('#mainSw').style.background=sw||'transparent';sh.querySelector('#mainSw').classList.toggle('empty',!sw);
    sh.querySelector('#mainName').textContent=COL.name?COL.name[0].toUpperCase()+COL.name.slice(1):'Not set';
    if(COL.hex)sh.querySelector('#mainPick').value=COL.hex;
    sh.querySelectorAll('[data-main]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.main===COL.name));
    sh.querySelectorAll('[data-sec]').forEach(b=>b.setAttribute('aria-pressed',COL.sec.has(b.dataset.sec)));
    sh.querySelector('#secNames').textContent=COL.sec.size?[...COL.sec].join(', '):'None';
  }
  sh.querySelectorAll('[data-main]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.main;if(COL.name===n&&!COL.hex){COL.name=''}else{COL.name=n;COL.hex=null;COL.sec.delete(n)}paintCol()}));
  sh.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.sec;COL.sec.has(n)?COL.sec.delete(n):COL.sec.add(n);paintCol()}));
  sh.querySelector('#mainPick').addEventListener('input',e=>{COL.hex=e.target.value;COL.name=hexToName(COL.hex);COL.sec.delete(COL.name);paintCol()});
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
    COL.hex=rgbToHex(R/n,G/n,B/n);COL.name=hexToName(COL.hex);COL.sec.delete(COL.name);paintCol();eye.hidden=true;
    toast(`Main colour set to ${COL.name}`);
  });
  paintCol();
  const save=sh.querySelector('#save');
  save.addEventListener('click',()=>guard(save,async()=>{
    const name=sh.querySelector('#fName').value.trim();if(!name){sh.querySelector('#fName').focus();toast('Give it a name first.');return}
    let type=tSel.value,group=GROUP_OF[type]||it?.group||'Other';
    if(type==='__new'){type=sh.querySelector('#fNewType').value.trim();group=sh.querySelector('#fGroup').value;if(!type){sh.querySelector('#fNewType').focus();toast('Name the new type.');return}}
    const pv=sh.querySelector('#fPrice').value;
    const data={name,price:pv===''?null:Math.round(Number(pv)*100)/100,type,group,closetId:sh.querySelector('#fCloset')?.value||defCloset,colour:COL.name,colourHex:COL.hex||null,colours2:[...COL.sec].filter(n=>n!==COL.name),style:sh.querySelector('#fSty').value.trim(),createdAt:it?.createdAt||Date.now()};
    const drop=[];
    for(const[k,idKey,cutKey]of[['front','imageId','cutout'],['back','backImageId','backCutout']]){
      const st=P[k],oldId=it?.[idKey]||null;
      if(st.blob){data[idKey]=await addImage(st.blob);data[cutKey]=st.cutout;if(oldId)drop.push(oldId)}
      else if(st.id){data[idKey]=st.id;data[cutKey]=st.cutout}
      else{data[idKey]=null;data[cutKey]=false;if(oldId)drop.push(oldId)}
    }
    await saveDoc('items',id||newId(),data);
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
  return `<input class="search" type="search" id="pkQ" placeholder="Find a piece by name, type or closet" aria-label="Find a piece"><div class="picker" id="picker">${items.map(([id,i])=>`<button type="button" class="pk" data-pk="${id}" data-txt="${esc([i.name,i.colour,i.style,typeOf(i),groupOf(i),multi?closetName(closetOf(i)):''].join(' ').toLowerCase())}" aria-pressed="${sel.has(id)}"><div class="${phCls(i)}">${thumb(i)}</div><small>${esc(i.name)}</small></button>`).join('')}</div>`;
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

// Re-crop cut-outs saved before the haze fix so every item fills its tile. Runs once per photo.
async function refitCutouts(){
  let changed=0;
  for(const[iid,it]of[...S.items]){
    if(it.fit>=1)continue;
    const v={...it,fit:1};
    for(const[idKey,cutKey]of[['imageId','cutout'],['backImageId','backCutout']]){
      const id=it[idKey];if(!id||!it[cutKey])continue;
      const blob=await idbGet('images',id);if(!blob)continue;
      try{
        const im=await loadImage(URL.createObjectURL(blob));URL.revokeObjectURL(im.src);
        const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
        const out=await trimToBlob(c);const om=await loadImage(URL.createObjectURL(out));URL.revokeObjectURL(om.src);
        if(om.naturalWidth*om.naturalHeight<c.width*c.height*.9){v[idKey]=await addImage(out);await dropImage(id)}
      }catch(e){console.warn('refit',e)}
    }
    if(!S.items.has(iid))continue;
    v.updatedAt=Date.now();await idbPut('items',iid,v);S.items.set(iid,v);changed++;
    await new Promise(r=>setTimeout(r,0));
  }
  if(changed){render();scheduleSync()}
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
      if(!it.colourHex)continue;const nn=hexToName(it.colourHex),old=genericName(it.colour);if(nn===old)continue;
      const cap=w=>w?w[0].toUpperCase()+w.slice(1):w,word=SINGULAR[it.type]||(it.type||'').toLowerCase();
      const v={...it,colour:nn,colours2:(it.colours2||[]).filter(c=>c!==nn),updatedAt:Date.now()};
      if(it.name===`${cap(old)} ${word}`)v.name=`${cap(nn)} ${word}`;
      await idbPut('items',iid,v);S.items.set(iid,v);
    }
    for(const[iid,it]of S.items)if(it.type==='Heels'||it.type==='Flats'){const cap=w=>w?w[0].toUpperCase()+w.slice(1):w,old=it.type.toLowerCase(),c=genericName(it.colour);
      const v={...it,type:'Shoes',group:'Shoes',updatedAt:Date.now()};if(it.name===`${cap(c)} ${old}`)v.name=`${cap(c)} shoes`;await idbPut('items',iid,v);S.items.set(iid,v)}
    for(const[iid,it]of S.items)if(it.type==='Blouses'){const v={...it,type:'Shirts',group:'Tops',updatedAt:Date.now()};await idbPut('items',iid,v);S.items.set(iid,v)}
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
