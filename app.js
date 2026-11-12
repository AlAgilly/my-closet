'use strict';
/* My Closet: data lives in this device's IndexedDB and syncs to a private GitHub repo the user owns. */

const GROUPS=[
  ['Tops',['T-shirts','Tank tops','Shirts','Blouses','Sweaters','Hoodies','Cardigans']],
  ['Bottoms',['Jeans','Pants','Shorts','Skirts','Leggings','Sweatpants']],
  ['One-pieces',['Dresses','Jumpsuits']],
  ['Outerwear',['Jackets','Coats','Blazers','Vests']],
  ['Shoes',['Sneakers','Boots','Heels','Flats','Sandals','Loafers']],
  ['Bags',['Bags']],
  ['Accessories',['Hats','Jewelry','Belts','Scarves','Sunglasses','Watches']],
  ['Other',['Activewear','Swimwear','Sleepwear','Other']]];
const GROUP_OF={};GROUPS.forEach(([g,ts])=>ts.forEach(t=>GROUP_OF[t]=g));
const TYPE_ORDER=GROUPS.flatMap(g=>g[1]);
const COLOURS=['black','white','cream','beige','brown','grey','navy','blue','lightblue','green','olive','red','burgundy','pink','purple','yellow','orange','gold','silver'];
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
  const c=okColour(it?.colour);
  return `<span class="ini" ${c?`style="color:${c}"`:''}>${esc((it?.name||'?').trim()[0]?.toUpperCase()||'?')}</span>`;
}
const phCls=it=>'ph'+(it?.cutout&&hasImg(it)?' cut':'');
function toast(msg){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;$('#toastRoot').replaceChildren(t);setTimeout(()=>t.remove(),2600)}

/* ---------- IndexedDB ---------- */
let IDB=null;
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('my-closet',2);r.onupgradeneeded=()=>{for(const s of[...COLS,'images','meta'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
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
async function loadImage(src){const im=new Image();im.src=src;await im.decode();return im}
function hasAlpha(canvas){
  const s=document.createElement('canvas');s.width=64;s.height=64;const g=s.getContext('2d');g.drawImage(canvas,0,0,64,64);
  const d=g.getImageData(0,0,64,64).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]<200)n++;return n>40;
}
async function trimToBlob(c){
  const g=c.getContext('2d');const{width:w,height:h}=c;const d=g.getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>12){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)throw{code:'empty'};
  const pad=Math.round(Math.max(x1-x0,y1-y0)*.03);x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(w-1,x1+pad);y1=Math.min(h-1,y1+pad);
  const o=document.createElement('canvas');o.width=x1-x0+1;o.height=y1-y0+1;o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);
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
let RB=null;
async function removeBg(blob,status){
  if(!RB){
    status('Downloading the cut-out tool. This happens once and is about 45 MB, so Wi-Fi helps…');
    const T=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js');
    T.env.allowLocalModels=false;
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
    const d=g.getImageData(0,0,c.width,c.height);for(let i=0;i<mask.data.length;i++)d.data[4*i+3]=mask.data[i];g.putImageData(d,0,0);
    return await trimToBlob(c);
  }finally{URL.revokeObjectURL(url)}
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
  scrollTo(0,y);
}
function closetChips(cur,attr,extra=''){
  const counts={};for(const it of S.items.values()){const c=closetOf(it);counts[c]=(counts[c]||0)+1}
  const list=[...S.closets.entries()].sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  return `<div class="chips closets" role="group" aria-label="Closet">${list.length>1?`<button class="chip" type="button" ${attr}="all" aria-pressed="${cur==='all'}">All closets <small>${S.items.size}</small></button>`:''}${list.map(([id,c])=>`<button class="chip" type="button" ${attr}="${id}" aria-pressed="${cur===id||list.length===1}">${esc(c.name)} <small>${counts[id]||0}</small></button>`).join('')}${extra}</div>`;
}
function closetView(){
  if(!S.ready)return '';
  const top=closetChips(S.closet,'data-closet',`<button class="chip ghost" type="button" id="manageClosets">${S.closets.size>1?'Edit closets':'+ Add a closet'}</button>`);
  const all=[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet));
  if(!all.length)return top+empty(S.items.size?`${esc(closetName(S.closet))} is empty`:'Your closet is empty','Add your first piece with a photo, price, type, colour and style. Tap “+ Add piece” below.');
  const types={};for(const[,i]of all){const t=typeOf(i);types[t]=(types[t]||0)+1}
  if(S.type!=='All'&&!types[S.type])S.type='All';
  const colours=[...new Set(all.map(([,i])=>(i.colour||'').trim().toLowerCase()).filter(Boolean))].sort();
  const styles=[...new Set(all.map(([,i])=>(i.style||'').trim().toLowerCase()).filter(Boolean))].sort();
  return top+`
    <input class="search" id="q" type="search" placeholder="Search name, type, colour, style" value="${esc(S.q)}" aria-label="Search closet">
    <div class="chips" role="group" aria-label="Type"><button class="chip" type="button" data-type="All" aria-pressed="${S.type==='All'}">All types</button>${Object.keys(types).sort((a,b)=>typeRank(a)-typeRank(b)||a.localeCompare(b)).map(t=>`<button class="chip" type="button" data-type="${esc(t)}" aria-pressed="${S.type===t}">${esc(t)} <small>${types[t]}</small></button>`).join('')}</div>
    <div class="row">
      <select id="fColour" aria-label="Colour"><option value="">All colours</option>${colours.map(c=>`<option ${S.colour===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <select id="fStyle" aria-label="Style"><option value="">All styles</option>${styles.map(c=>`<option ${S.style===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <select id="fSort" aria-label="Sort">${[['new','Newest first'],['priceHi','Price: high to low'],['least','Least worn'],['longest','Not worn in longest'],['name','A–Z']].map(([v,l])=>`<option value="${v}" ${S.sort===v?'selected':''}>${l}</option>`).join('')}</select>
    </div><div id="results">${closetResults()}</div>`;
}
function itemCard(id,i,W){
  const r=W[id],l=last(r),c=okColour(i.colour);
  return `<button class="card" type="button" data-item="${id}">
    <div class="${phCls(i)}">${thumb(i)}</div>
    ${i.price!==''&&i.price!=null?`<span class="tag">${money(i.price)}</span>`:''}
    <div class="nm">${esc(i.name||'Untitled')}</div>
    <div class="meta">${c?`<span class="sw" style="background:${c}"></span>`:''}<span>${l?`Worn ${r.worn.length}× · ${ago(l)}`:'Not worn yet'}</span></div>
  </button>`;
}
function closetResults(){
  const W=wear().items,q=S.q.toLowerCase();
  let list=[...S.items.entries()].filter(([,i])=>inCloset(i,S.closet)&&(S.type==='All'||typeOf(i)===S.type)&&(!S.colour||(i.colour||'').trim().toLowerCase()===S.colour)&&(!S.style||(i.style||'').trim().toLowerCase()===S.style)&&(!q||[i.name,i.colour,i.style,typeOf(i),groupOf(i)].join(' ').toLowerCase().includes(q)));
  const sorters={
    new:(a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0),
    priceHi:(a,b)=>(Number(b[1].price)||0)-(Number(a[1].price)||0),
    least:(a,b)=>(W[a[0]]?.worn.length||0)-(W[b[0]]?.worn.length||0),
    longest:(a,b)=>(last(W[a[0]])||'0000').localeCompare(last(W[b[0]])||'0000'),
    name:(a,b)=>(a[1].name||'').localeCompare(b[1].name||'')};
  list.sort(sorters[S.sort]||sorters.new);
  if(!list.length)return `<p class="muted">Nothing matches those filters.</p>`;
  if(S.type!=='All'||q)return `<div class="grid">${list.map(([id,i])=>itemCard(id,i,W)).join('')}</div>`;
  const by=new Map();for(const e of list){const t=typeOf(e[1]);if(!by.has(t))by.set(t,[]);by.get(t).push(e)}
  return [...by.entries()].sort((a,b)=>typeRank(a[0])-typeRank(b[0])||a[0].localeCompare(b[0])).map(([t,es])=>
    `<section class="tsec"><div class="thead"><h3>${esc(t)}</h3><span class="muted">${es.length}</span></div><div class="grid">${es.map(([id,i])=>itemCard(id,i,W)).join('')}</div></section>`).join('');
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
  const byCol={};for(const[,i]of its){const k=(i.colour||'').trim().toLowerCase()||'no colour';(byCol[k]??={label:k,v:0,sw:okColour(k)}).v++}
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
    <div class="field"><label for="fCol">Colour</label><input id="fCol" value="${esc(it?.colour)}" placeholder="navy" autocomplete="off">
      <div class="swatches">${COLOURS.map(c=>`<button type="button" data-sw="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="field"><label for="fSty">Style</label><input id="fSty" list="styleList" value="${esc(it?.style)}" placeholder="casual, work, going out…" autocomplete="off">
      <datalist id="styleList">${[...new Set([...styles,'casual','work','going out','athletic','formal','lounge','vintage'])].map(s=>`<option value="${esc(s)}">`).join('')}</datalist></div>
    <div class="btns"><button class="btn primary" type="button" id="save">${it?'Save changes':'Add to closet'}</button>
      ${it?`<button class="btn" type="button" id="wearToday">Wore it today</button><button class="btn danger" type="button" id="del">Delete</button>`:''}</div>`);
  // per-slot photo state: id = stored image, blob = new unsaved image, cleared = user removed it
  const P={front:{id:it?.imageId||null,cutout:!!it?.cutout,blob:null},back:{id:it?.backImageId||null,cutout:!!it?.backCutout,blob:null}};
  const cutMsg=sh.querySelector('#cutMsg');
  sh.querySelectorAll('[data-slot]').forEach(slot=>{
    const k=slot.dataset.slot,st=P[k],prev=slot.querySelector('[data-prev]'),cutB=slot.querySelector('[data-cut]'),clr=slot.querySelector('[data-clear]');
    const show=()=>{const has=st.blob||st.id;prev.className='ph'+(has&&st.cutout?' cut':'');
      prev.innerHTML=st.blob?`<img src="${URL.createObjectURL(st.blob)}" alt="">`:st.id?img(st.id):`<span class="hint">Add ${k} photo</span>`;
      cutB.hidden=!has||st.cutout;clr.hidden=!has;cutMsg.textContent=''};
    slot.querySelector('[data-file]').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const r=await shrink(f);st.blob=r.blob;st.cutout=r.cutout;show()}catch(err){toast('That file type isn’t supported. Try a JPEG or PNG.')}});
    clr.addEventListener('click',()=>{st.blob=null;st.id=null;st.cutout=false;show()});
    cutB.addEventListener('click',async()=>{
      cutB.disabled=true;
      try{const src=st.blob||await idbGet('images',st.id);st.blob=await removeBg(src,m=>cutMsg.textContent=m);st.cutout=true;show();cutMsg.textContent='Background removed. Tap Save to keep it.'}
      catch(err){console.error(err);cutMsg.textContent=err?.code==='empty'?'Couldn’t find the item in that photo. Try a photo with the piece on a plain background.':'The cut-out tool couldn’t run here. On iPhone you can touch and hold the item in the Photos app, tap Share → Save Image, then choose that picture.'}
      finally{cutB.disabled=false}
    });
  });
  const tSel=sh.querySelector('#fType');tSel.addEventListener('change',()=>{sh.querySelector('#newTypeRow').hidden=tSel.value!=='__new'});
  sh.querySelectorAll('[data-sw]').forEach(b=>b.addEventListener('click',()=>{sh.querySelector('#fCol').value=b.dataset.sw}));
  const save=sh.querySelector('#save');
  save.addEventListener('click',()=>guard(save,async()=>{
    const name=sh.querySelector('#fName').value.trim();if(!name){sh.querySelector('#fName').focus();toast('Give it a name first.');return}
    let type=tSel.value,group=GROUP_OF[type]||it?.group||'Other';
    if(type==='__new'){type=sh.querySelector('#fNewType').value.trim();group=sh.querySelector('#fGroup').value;if(!type){sh.querySelector('#fNewType').focus();toast('Name the new type.');return}}
    const pv=sh.querySelector('#fPrice').value;
    const data={name,price:pv===''?null:Math.round(Number(pv)*100)/100,type,group,closetId:sh.querySelector('#fCloset')?.value||defCloset,colour:sh.querySelector('#fCol').value.trim(),style:sh.querySelector('#fSty').value.trim(),createdAt:it?.createdAt||Date.now()};
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

/* ---------- boot ---------- */
render();
(async()=>{
  try{
    IDB=await idbOpen();
    for(const col of COLS)S[col]=await idbAll(col);
    S.deleted=new Map(Object.entries((await idbGet('meta','deleted'))||{}));
    if(!S.closets.has(MAIN)&&!S.deleted.has('closets/'+MAIN)){const c={name:'My Closet',createdAt:1,updatedAt:1};await idbPut('closets',MAIN,c);S.closets.set(MAIN,c)}
    for(const[id,b]of await idbAll('images'))URLS.set(id,URL.createObjectURL(b));
    S.ready=true;
  }catch(e){console.error(e);S.notice='This browser can’t save data (private browsing may be on). Open the app in normal Safari.'}
  setSync(GH.cfg()?'ok':'off');render();
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  if(GH.cfg())sync();
})();
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
