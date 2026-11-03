"use strict";
/* ---------- utils ---------- */
const $=(s,el=document)=>el.querySelector(s), $$=(s,el=document)=>[...el.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const br=s=>esc(s).replace(/\n/g,"<br>");
const rid=(n=10)=>{const a="abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";const r=new Uint32Array(n);(crypto.getRandomValues?crypto.getRandomValues(r):r.forEach((_,i)=>r[i]=Math.random()*1e9));for(const x of r)s+=a[x%a.length];return s};
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
// a photo the host picked: a fresh data URL from the editor, or the stored copy on our server
const PHOTO_RE=/^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|\/media\/[A-Za-z0-9._\/-]+)$/;
// GET requests the inline script in <head> started before this file loaded (each can be used once)
const takePre=path=>{const P=window.__pkPre;const r=P&&P[path];if(r)delete P[path];return r||null};

/* ---------- show a design only when its pictures and fonts are ready ----------
   Everything under `root` is held invisible (and its CSS animations paused) until the images it
   uses are downloaded and decoded and its fonts are loaded, then it fades in and the animations
   start from their first frame. `extra` is markup that will appear later (e.g. the card inside an
   envelope): it is measured once in a hidden probe so its pictures are ready too. */
const IMG_CACHE=new Map();
function loadImg(u){
 if(!IMG_CACHE.has(u))IMG_CACHE.set(u,new Promise(res=>{const i=new Image();i.decoding="async";i.onload=()=>{const done=()=>res(i);if(!i.decode)return done();i.decode().then(done,done);setTimeout(done,250)};i.onerror=()=>res(null);i.src=u}));
 return IMG_CACHE.get(u);
}
function assetsOf(root){
 const urls=new Set(),fonts=new Map();
 const addUrls=v=>{if(v&&v!=="none")for(const m of v.matchAll(/url\("?([^")]+)"?\)/g))if(!m[1].startsWith("data:"))urls.add(m[1])};
 const visit=(cs,text)=>{addUrls(cs.backgroundImage);addUrls(cs.maskImage||cs.webkitMaskImage);addUrls(cs.borderImageSource);
  if(text){const k=`${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`;fonts.set(k,((fonts.get(k)||"")+text).slice(0,160))}};
 for(const el of [root,...root.querySelectorAll("*")]){
  if(el.namespaceURI==="http://www.w3.org/2000/svg"&&el.tagName!=="svg"&&el.tagName!=="text"&&el.tagName!=="tspan")continue;
  let text="";for(const n of el.childNodes)if(n.nodeType===3)text+=n.nodeValue.trim();
  visit(getComputedStyle(el),text);
  for(const ps of["::before","::after"]){const c=getComputedStyle(el,ps);if(c.content&&c.content!=="none"&&c.content!=="normal"){addUrls(c.content);visit(c,c.content.startsWith('"')?c.content.slice(1,-1):"")}}
  if(el.tagName==="IMG"&&el.src&&!el.src.startsWith("data:"))urls.add(el.src);
 }
 return{urls,fonts};
}
async function settle(root,extra="",max=6000){
 if(!root)return;
 root.classList.add("pk-wait");
 let probe=null;
 if(extra){probe=document.createElement("div");probe.className="pk-probe";probe.setAttribute("aria-hidden","true");probe.innerHTML=extra;root.appendChild(probe)}
 const{urls,fonts}=assetsOf(root);probe&&probe.remove();
 let loader=null;const slow=setTimeout(()=>{loader=document.createElement("div");loader.className="pk-loader";loader.setAttribute("role","progressbar");loader.setAttribute("aria-label",LANG==="en"?"Loading":"Učitavanje");document.body.appendChild(loader)},400);
 const jobs=[...urls].map(loadImg);
 if(document.fonts&&document.fonts.load)for(const[f,txt]of fonts)jobs.push(document.fonts.load(f,txt||"Aa").catch(()=>{}));
 await Promise.race([Promise.all(jobs),new Promise(r=>setTimeout(r,max))]);
 clearTimeout(slow);if(loader)loader.remove();
 // fade the finished design in as a whole
 root.classList.remove("pk-wait");
 try{performance.mark("pk-ready")}catch(e){}
 if(!matchMedia("(prefers-reduced-motion:reduce)").matches)for(const c of root.children)c.animate&&c.animate([{opacity:0},{opacity:1}],{duration:380,easing:"cubic-bezier(.2,.7,.2,1)"});
}

/* ---------- language ---------- */
let LANG=LS.get("paperlace.lang",null);const LANG_PICKED=!!LANG;if(!["sr","en"].includes(LANG))LANG="sr";
const L=(en,sr)=>LANG==="sr"?sr:en;
const pick=x=>Array.isArray(x)?L(x[0],x[1]):x;
function setLang(l){LANG=l;LS.set("paperlace.lang",l);document.documentElement.lang=l==="sr"?"sr-Latn":"en"}
document.documentElement.lang=LANG==="sr"?"sr-Latn":"en";

const IC={
 copy:'<path d="M9 9h10v10H9z"/><path d="M5 15V5h10"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 chat:'<path d="M4 20l1.5-4A8 8 0 1 1 8 19z"/>',
 share:'<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
 back:'<path d="M15 5l-7 7 7 7"/>',
 cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
 pin:'<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
let toastT;function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2600)}
async function copy(text,input){try{await navigator.clipboard.writeText(text);toast(L("Link copied","Link je kopiran"))}catch(e){if(input){input.focus();input.select();toast(L("Press Ctrl+C or ⌘C to copy","Pritisnite Ctrl+C ili ⌘C da kopirate"))}else toast(L("Copy failed, select the link to copy it","Kopiranje nije uspelo, označite link i kopirajte ga"))}}
function confirmBox(title,msg,okLabel){return new Promise(res=>{const bg=document.createElement("div");bg.className="modal-bg";bg.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="row"><button class="btn btn-line" data-x="0">${L("Cancel","Otkaži")}</button><button class="btn btn-ink" data-x="1">${esc(okLabel)}</button></div></div>`;document.body.appendChild(bg);bg.addEventListener("click",e=>{const x=e.target.closest("[data-x]");if(x||e.target===bg){bg.remove();res(x&&x.dataset.x==="1")}});$("[data-x='1']",bg).focus()})}
const DATES={
 en:{days:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],mon:["January","February","March","April","May","June","July","August","September","October","November","December"]},
 sr:{days:["nedelja","ponedeljak","utorak","sreda","četvrtak","petak","subota"],mon:["januar","februar","mart","april","maj","jun","jul","avgust","septembar","oktobar","novembar","decembar"],monG:["januara","februara","marta","aprila","maja","juna","jula","avgusta","septembra","oktobra","novembra","decembra"]}
};
function pd(iso,lg=LANG){if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;const[y,m,d]=iso.split("-").map(Number);const dt=new Date(y,m-1,d);const D=DATES[lg]||DATES.en;const wd=D.days[dt.getDay()];
 if(lg==="sr")return{dt,y,m,d,wd,mon:D.mon[m-1],full:`${wd}, ${d}. ${D.monG[m-1]} ${y}.`,short:`${d}. ${D.monG[m-1]} ${y}.`};
 return{dt,y,m,d,wd,mon:D.mon[m-1],full:`${wd}, ${d} ${D.mon[m-1]} ${y}`,short:`${d} ${D.mon[m-1]} ${y}`}}

/* ---------- svg helpers ---------- */
let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
const f1=n=>Math.round(n*10)/10;
const TOP=i=>`<svg viewBox="0 0 500 200" preserveAspectRatio="xMidYMin meet" aria-hidden="true">${i}</svg>`;
const BOT=i=>`<svg viewBox="0 0 500 200" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${i}</svg>`;
const BG=i=>`<svg viewBox="0 0 500 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${i}</svg>`;
const flipY=i=>`<g transform="translate(0 200) scale(1 -1)">${i}</g>`;
const flipX=i=>`<g transform="translate(500 0) scale(-1 1)">${i}</g>`;
const spk=(x,y,s,c="m-a",d)=>`<path class="${c} tw" style="--d:${d??f1((x*7+y)%30/10)}s" d="M${f1(x)} ${f1(y-s)}Q${f1(x)} ${f1(y)} ${f1(x+s)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y+s)}Q${f1(x)} ${f1(y)} ${f1(x-s)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y-s)}Z"/>`;
const leaf=(x,y,l,w,r,c,vein=true)=>`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(r)})"><path class="${c}" d="M0 0Q${w} ${-l/2} 0 ${-l}Q${-w} ${-l/2} 0 0Z"/>${vein?`<path class="vn" d="M0 -3V${-l+6}"/>`:""}</g>`;
const flower=(x,y,r,pc,cc,n=5,rot=0)=>{let s=`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot})">`;for(let i=0;i<n;i++)s+=`<ellipse class="${pc}" cx="0" cy="${f1(-r*.52)}" rx="${f1(r*.4)}" ry="${f1(r*.56)}" transform="rotate(${f1(i*360/n)})"/>`;return s+`<circle class="${cc}" r="${f1(r*.24)}"/></g>`};
const rose=(x,y,r,c1,c2)=>`<g transform="translate(${f1(x)} ${f1(y)})"><circle class="${c1}" r="${r}"/><path class="${c2}" style="fill:none;stroke-width:${f1(r/9)};stroke-linecap:round;stroke:var(--c-bg);opacity:.55" d="M${f1(-r*.15)} 0a${f1(r*.15)} ${f1(r*.15)} 0 1 1 ${f1(r*.3)} 0a${f1(r*.38)} ${f1(r*.38)} 0 1 1 ${f1(-r*.6)} ${f1(r*.1)}a${f1(r*.62)} ${f1(r*.62)} 0 0 1 ${f1(r*1.15)} ${f1(-r*.2)}"/></g>`;
const branch=(x,y,len,ang,n,lc,sc,ll=24,lw=8)=>{let s=`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${ang})"><path class="${sc}" d="M0 0Q${f1(len*.12)} ${f1(-len*.5)} 0 ${-len}"/>`;for(let i=1;i<=n;i++){const t=i/(n+1),yy=-len*t,xx=2*(1-t)*t*len*.12;s+=leaf(xx,yy,ll,lw,i%2?48:-48,lc,false)}return s+leaf(0,-len,ll,lw,0,lc,false)+"</g>"};
const euc=(x,y,len,ang,n,c,sc)=>{let s=`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${ang})"><path class="${sc}" d="M0 0Q${f1(len*.15)} ${f1(-len*.5)} 0 ${-len}"/>`;for(let i=1;i<=n;i++){const t=i/(n+1),yy=-len*t,xx=2*(1-t)*t*len*.15,rr=11-i*.6;s+=`<ellipse class="${c}" cx="${f1(xx-rr*.9)}" cy="${f1(yy)}" rx="${f1(rr)}" ry="${f1(rr*.8)}"/><ellipse class="${c} op5" cx="${f1(xx+rr*.9)}" cy="${f1(yy-4)}" rx="${f1(rr)}" ry="${f1(rr*.8)}"/>`}return s+"</g>"};
const stars=(n,s0,c="m-x2",h=700,mx=7)=>{seed=s0;let o="";for(let i=0;i<n;i++){const x=rnd()*500,y=rnd()*h,s=1.5+rnd()*mx,d=f1(rnd()*3);o+=s>5.5?spk(x,y,s,c,d):`<circle class="${c} tw" style="--d:${d}s" cx="${f1(x)}" cy="${f1(y)}" r="${f1(s/3.2)}"/>`}return o};
const fan=(cx,cy,rs=[46,78,110])=>{let s="";rs.forEach(r=>s+=`<path class="l-a" d="M${cx-r} ${cy}A${r} ${r} 0 0 1 ${cx+r} ${cy}"/>`);for(let a=15;a<180;a+=15){const q=a*Math.PI/180;s+=`<line class="l-a" x1="${f1(cx+rs[0]*Math.cos(q))}" y1="${f1(cy-rs[0]*Math.sin(q))}" x2="${f1(cx+rs[rs.length-1]*Math.cos(q))}" y2="${f1(cy-rs[rs.length-1]*Math.sin(q))}"/>`}return s};

/* ---------- motifs ---------- */
const lion=(x,y)=>{let m="";for(let i=0;i<14;i++)m+=`<ellipse class="m-a" cx="0" cy="-44" rx="15" ry="21" transform="rotate(${f1(i*360/14)})"/>`;
 return `<g transform="translate(${x} ${y})">${m}<circle class="m-a" r="44"/><circle class="m-b" cx="-27" cy="-27" r="11"/><circle class="m-b" cx="27" cy="-27" r="11"/><circle class="m-a" cx="-27" cy="-27" r="5"/><circle class="m-a" cx="27" cy="-27" r="5"/><circle class="m-b" r="33"/><circle class="m-s op5" cx="-17" cy="9" r="6"/><circle class="m-s op5" cx="17" cy="9" r="6"/><ellipse class="m-x3" cx="0" cy="12" rx="13" ry="10" opacity=".75"/><circle class="m-i" cx="-12" cy="-6" r="4"/><circle class="m-i" cx="12" cy="-6" r="4"/><path class="m-i" d="M-6 4H6L0 11Z"/><path class="l-i" d="M0 11V15M0 15Q-6 21-10 16M0 15Q6 21 10 16" stroke-width="2"/></g>`};
const car=`<g transform="translate(150 112)"><path class="m-a" d="M0 42Q0 24 18 21L42 18Q56 0 80 0H120Q140 0 156 18L178 22Q196 26 196 42V48Q196 54 190 54H6Q0 54 0 48Z"/><path class="m-x2" d="M52 18Q62 6 80 6H95V18ZM102 6H118Q134 6 144 18H102Z" opacity=".9"/><circle class="m-x2" cx="98" cy="36" r="11"/><text x="98" y="41" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="700" font-size="15" class="m-a">1</text><circle class="m-s" cx="189" cy="34" r="5"/><circle class="m-i" cx="46" cy="54" r="17"/><circle class="m-x2" cx="46" cy="54" r="6"/><circle class="m-i" cx="152" cy="54" r="17"/><circle class="m-x2" cx="152" cy="54" r="6"/><path class="l-i op3" d="M-30 30H-10M-36 42H-12M-26 18H-8" stroke-width="3" stroke-linecap="round"/></g>`;
const coupe=(x,y,r)=>`<g transform="translate(${x} ${y}) rotate(${r})"><path class="m-s" d="M-40 6Q-36 32 0 34Q36 32 40 6Z"/><path class="l-a" stroke-width="2" d="M-46 0Q-40 34 0 36Q40 34 46 0ZM0 36V96M-26 102Q0 92 26 102"/></g>`;
const dove=`<g transform="translate(250 92)"><path class="m-x2" d="M-70 18Q-40 8-12 10Q8-14 40-14Q30-6 34 2Q58 0 74 8Q50 16 30 20Q0 34-34 28Q-52 26-70 18Z" stroke="var(--c-accent)" stroke-width="1.2"/><path class="m-x2" d="M-6 10Q-14-30-58-58Q-44-22-48 2Q-30 8-6 10Z" stroke="var(--c-accent)" stroke-width="1.2"/><path class="m-x2" d="M8 8Q14-36 52-70Q46-30 38-6Z" stroke="var(--c-accent)" stroke-width="1.2"/><circle class="m-i" cx="44" cy="-4" r="2.2"/>${branch(66,4,40,70,3,"m-x1","l-x1",14,5)}</g>`;
const cloud=(x,y,s,c="m-x2")=>`<g transform="translate(${x} ${y}) scale(${s})" class="${c}"><circle cx="0" cy="0" r="18"/><circle cx="20" cy="-8" r="22"/><circle cx="42" cy="2" r="16"/><rect x="0" y="0" width="44" height="16" rx="8"/></g>`;
const MOTIFS={
 jungle(){const L=leaf;return{
  top:TOP(`<g class="fl">${L(-14,40,150,40,120,"m-x2")}${L(10,-12,180,50,148,"m-x1")}${L(76,-16,145,40,168,"m-s")}${L(140,-20,90,24,178,"m-x2")}</g><g class="fl d2">${L(514,40,150,40,240,"m-x2")}${L(490,-12,180,50,212,"m-x1")}${L(424,-16,145,40,192,"m-s")}${L(360,-20,90,24,182,"m-x2")}</g>`),
  bottom:BOT(`${L(-10,215,170,46,32,"m-x1")}${L(60,215,120,32,12,"m-s")}${L(120,210,70,20,4,"m-x2")}${L(510,215,170,46,-32,"m-x1")}${L(440,215,120,32,-12,"m-s")}${L(380,210,70,20,-4,"m-x2")}<g class="bobs">${lion(250,128)}</g>`)}},
 castle(){return{
  bg:BG(stars(46,7,"m-x2",560)),
  top:TOP(`<circle class="m-a" cx="420" cy="64" r="30"/><circle class="m-g" cx="434" cy="54" r="27"/>${spk(80,50,9,"m-a")}${spk(360,40,6,"m-x3")}${spk(150,90,5,"m-x3")}`),
  bottom:BOT(`<path class="m-b" d="M0 200V172Q120 140 250 160Q380 140 500 172V200Z"/><g transform="translate(0 18)"><g class="m-x1"><rect x="168" y="104" width="164" height="90"/><rect x="146" y="74" width="44" height="120"/><rect x="310" y="74" width="44" height="120"/><rect x="224" y="54" width="52" height="140"/>${[0,1,2,3,4,5,6,7].map(i=>`<rect x="${172+i*20}" y="96" width="10" height="10"/>`).join("")}</g><g class="m-s"><path d="M140 76L168 22L196 76Z"/><path d="M304 76L332 22L360 76Z"/><path d="M218 56L250 -6L282 56Z"/></g><path class="l-i" d="M168 22V8M332 22V8" stroke-width="1.5"/><path class="m-a" d="M168 8L184 13L168 18ZM332 8L348 13L332 18Z"/><path class="m-g" d="M234 194V166Q250 146 266 166V194Z"/><g class="m-a tw"><path d="M160 110v-10a8 8 0 0 1 16 0v10z"/><path d="M324 110v-10a8 8 0 0 1 16 0v10z"/><path d="M242 96v-12a8 8 0 0 1 16 0v12z"/></g></g>`)}},
 princess(){return{
  top:TOP(`<g transform="translate(250 120)"><path class="m-a" d="M-74 0L-86-62L-42-26L0-80L42-26L86-62L74 0Z"/><rect class="m-a" x="-78" y="-4" width="156" height="18" rx="4"/><circle class="m-x1" cx="-86" cy="-62" r="8"/><circle class="m-x1" cx="0" cy="-80" r="9"/><circle class="m-x1" cx="86" cy="-62" r="8"/><circle class="m-x3" cx="-40" cy="5" r="5"/><circle class="m-x1" cx="0" cy="5" r="6"/><circle class="m-x3" cx="40" cy="5" r="5"/></g>${spk(110,70,10)}${spk(392,62,12)}${spk(150,140,6,"m-x1")}${spk(350,150,7,"m-x1")}`),
  bottom:BOT(`${Array.from({length:15},(_,i)=>`<circle class="m-b" cx="${i*36+4}" cy="200" r="24"/><circle class="m-a op5" cx="${i*36+4}" cy="170" r="2.5"/>`).join("")}<g transform="translate(250 130) scale(1.6)"><path class="m-x1" d="M0 6C-8-3-15 6 0 17C15 6 8-3 0 6Z"/></g>${spk(120,120,6)}${spk(380,116,8)}`)}},
 blossom(){const cl=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})">${leaf(-30,30,70,22,-120,"m-x1")}${leaf(40,-10,60,18,80,"m-x2")}${leaf(10,40,60,18,160,"m-x2")}${flower(0,0,58,"m-a","m-x3",5,10)}${flower(66,30,40,"m-s","m-x3",5,40)}${flower(-50,-36,34,"m-s","m-x3",5)}${flower(30,-58,24,"m-a","m-x3",5,20)}<circle class="m-x1" cx="-60" cy="40" r="5"/><circle class="m-a" cx="90" cy="-20" r="4"/></g>`;return{
  top:TOP(`<g class="fl">${cl(40,26,1)}</g><g class="fl d2">${cl(470,10,.7)}</g>`),
  bottom:BOT(`<g class="fl d2">${cl(460,200,1)}</g><g class="fl">${cl(30,196,.6)}</g>`)}},
 cars(){const pts=Array.from({length:13},(_,i)=>{const t=i/12;return[500*t,(1-t)*(1-t)*24+2*(1-t)*t*84+t*t*24]});const cls=["m-a","m-s","m-x3"];return{
  bg:BG(`${cloud(70,250,1.1)}${cloud(380,330,.9)}${cloud(220,470,.7)}`),
  top:TOP(`<path class="l-i" d="M0 24Q250 144 500 24" stroke-width="1.5"/>${pts.slice(0,12).map((p,i)=>`<path class="${cls[i%3]}" d="M${f1(p[0]+8)} ${f1(p[1]+2)}L${f1(p[0]+36)} ${f1(p[1]+6)}L${f1(p[0]+20)} ${f1(p[1]+36)}Z"/>`).join("")}`),
  bottom:BOT(`<rect class="m-x1" x="0" y="164" width="500" height="40"/><path class="l-x2" d="M0 184H500" stroke-dasharray="22 16" stroke-width="3"/><g transform="translate(420 150)"><path class="m-s" d="M-10 16L0-16L10 16Z"/><rect class="m-x2" x="-6" y="-2" width="12" height="4"/><rect class="m-s" x="-14" y="14" width="28" height="4"/></g><g class="drive">${car}</g>`)}},
 noir(){return{
  top:TOP(flipY(`${fan(250,200)}<path class="l-a" d="M30 200V150M470 200V150M22 200V170M478 200V170"/>`)+`<circle class="m-a" cx="250" cy="18" r="3"/>`),
  bottom:BOT(`${fan(250,200)}<path class="l-a" d="M30 200V150M470 200V150M22 200V170M478 200V170"/>`)}},
 champagne(){seed=3;let b="";for(let i=0;i<26;i++){const x=150+rnd()*200,y=560+rnd()*120,r=2+rnd()*5;b+=`<circle class="l-a bub" style="--d:${f1(-rnd()*7)}s" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>`}return{
  bg:BG(b),
  top:TOP(`${spk(250,40,12)}${spk(205,62,6)}${spk(298,58,7)}<path class="l-a" d="M150 42H222M278 42H350"/>`),
  bottom:BOT(`${coupe(214,74,-14)}${coupe(286,74,14)}${spk(250,36,11)}${spk(226,22,5)}${spk(276,18,6)}`)}},
 emerald(){const c=`<path class="l-a" d="M18 130V18H130M30 118V30H118M42 72V42H72"/><rect class="m-a" x="38" y="38" width="8" height="8" transform="rotate(45 42 42)"/>`;const t=`${c}${flipX(c)}<rect class="l-a" x="236" y="26" width="28" height="28" transform="rotate(45 250 40)"/><rect class="m-a" x="244" y="34" width="12" height="12" transform="rotate(45 250 40)"/><path class="l-a" d="M150 40H226M274 40H350"/>`;return{top:TOP(t),bottom:BOT(flipY(t))}},
 marble(){seed=11;let v="";for(let i=0;i<9;i++){let x=rnd()*500,y=rnd()*700;v+=`<path class="l-x1" style="stroke-width:${f1(.6+rnd()*1.4)};opacity:${f1(.25+rnd()*.35)}" d="M${f1(x)} ${f1(y)}C${f1(x+80+rnd()*80)} ${f1(y+40-rnd()*80)} ${f1(x+120)} ${f1(y+120)} ${f1(x+240+rnd()*80)} ${f1(y+60+rnd()*80)}"/>`}const t=`<path class="l-a" d="M140 48H226M274 48H360"/><circle class="l-a" cx="250" cy="48" r="16"/><circle class="m-a" cx="250" cy="48" r="4"/>${spk(250,48,0.1)}`;return{bg:BG(v),top:TOP(t),bottom:BOT(flipY(t))}},
 starlit(){return{
  bg:BG(stars(80,21,"m-x2")),
  top:TOP(`<circle class="m-x1" cx="250" cy="62" r="26"/><circle class="m-g" cx="262" cy="54" r="23" style="fill:var(--c-bg2)"/><polyline class="l-a" points="90,40 130,72 176,58 208,96" opacity=".7"/><polyline class="l-a" points="292,96 330,62 372,78 410,36" opacity=".7"/>${[[90,40],[130,72],[176,58],[208,96],[292,96],[330,62],[372,78],[410,36]].map(([x,y])=>`<circle class="m-a tw" style="--d:${(x%7)/3}s" cx="${x}" cy="${y}" r="3"/>`).join("")}`),
  bottom:BOT(`<path class="l-a" d="M100 150H400" opacity=".6"/>${spk(250,150,10,"m-x1")}${spk(150,132,4)}${spk(350,132,4)}`)}},
 garden(){let g="";const N=11;for(let i=0;i<=N;i++){const t=i/N,x=30+440*t,y=26+Math.sin(Math.PI*t)*64,ang=Math.atan2(64*Math.PI*Math.cos(Math.PI*t),440)*180/Math.PI;g+=leaf(x,y,40,13,ang+90+(i%2?30:-30),i%2?"m-x1":"m-x2",false)}for(let i=0;i<=N;i+=2){const t=i/N,x=30+440*t,y=26+Math.sin(Math.PI*t)*64;g+=i%4===0?rose(x,y,i===6?24:17,"m-a","l-a"):flower(x,y,26,"m-s","m-x3",5,i*13)}g+=rose(250,90,26,"m-a","l-a");return{
  top:TOP(`<g class="fl">${g}</g>`),
  bottom:BOT(`<g transform="translate(0 40)">${leaf(250,150,60,18,-60,"m-x1",false)}${leaf(250,150,60,18,60,"m-x1",false)}${leaf(250,150,50,16,-20,"m-x2",false)}${leaf(250,150,50,16,20,"m-x2",false)}${rose(250,138,18,"m-a","l-a")}${flower(222,146,18,"m-s","m-x3")}${flower(278,146,18,"m-s","m-x3")}</g>`)}},
 olive(){const ol=(x,y,len,ang,n)=>branch(x,y,len,ang,n,"m-s","l-x1",30,8);const olives=(pts)=>pts.map(([x,y])=>`<ellipse class="m-x1" cx="${x}" cy="${y}" rx="6" ry="8.5"/>`).join("");return{
  top:TOP(`<g class="fl">${ol(246,128,150,-62,7)}${flipX(ol(246,128,150,-62,7))}${olives([[180,86],[150,70],[320,86],[350,70]])}</g>`),
  bottom:BOT(`${ol(250,170,140,-90,6)}${flipX(ol(250,170,140,-90,6))}${olives([[160,150],[340,150]])}`)}},
 ivory(t,d){const fl=`<path class="l-a" d="M14 120Q14 14 120 14M28 92Q30 30 92 28M14 120q14-6 18 6M120 14q-6 14 6 18" stroke-width="1.6"/><circle class="m-a" cx="34" cy="34" r="3.5"/>`;const a=(d.partner1||"A").trim().charAt(0).toUpperCase(),b=(d.partner2||"S").trim().charAt(0).toUpperCase();return{
  top:TOP(`${fl}${flipX(fl)}<circle class="l-a" cx="250" cy="70" r="40"/><circle class="l-a" cx="250" cy="70" r="34" opacity=".5"/><text x="250" y="84" text-anchor="middle" font-family="Pinyon Script,cursive" font-size="40" class="m-a">${esc(a)}${esc(b)}</text>`),
  bottom:BOT(flipY(`${fl}${flipX(fl)}`))}},
 gatsby(){let r="";for(let a=195;a<=345;a+=7.5){const q=a*Math.PI/180,L=(Math.round(a/7.5)%2)?62:92;r+=`<line class="l-a" x1="${f1(250+32*Math.cos(q))}" y1="${f1(192+32*Math.sin(q))}" x2="${f1(250+L*Math.cos(q))}" y2="${f1(192+L*Math.sin(q))}"/>`}const t=`${r}<path class="m-a" d="M224 192A26 26 0 0 1 276 192Z"/><path class="l-a" d="M30 192H200M300 192H470M50 182H196M304 182H450"/><path class="l-a" d="M30 192V120M470 192V120M40 182V136M460 182V136"/>`;return{top:TOP(flipY(t)),bottom:BOT(t)}},
 dustyblue(){return{
  top:TOP(`<g class="fl">${euc(-6,-6,170,140,7,"m-x1","l-x1")}${euc(40,-10,120,165,5,"m-x2","l-x1")}</g><g class="fl d2">${euc(506,-6,170,220,7,"m-x1","l-x1")}${euc(460,-10,120,195,5,"m-x2","l-x1")}</g>`),
  bottom:BOT(`<g class="fl d2">${euc(-6,206,160,40,7,"m-x1","l-x1")}${euc(506,206,160,-40,7,"m-x1","l-x1")}</g>${flower(250,176,18,"m-s","m-a",6)}${flower(226,184,12,"m-x2","m-a",6)}${flower(274,184,12,"m-x2","m-a",6)}`)}},
 christening(){return{
  bg:BG(`<g class="op5">${cloud(-10,620,1.6,"m-b")}${cloud(360,650,1.4,"m-b")}${cloud(180,680,1.2,"m-b")}</g>`),
  top:TOP(`<g class="bobs">${dove}</g>${spk(120,60,7)}${spk(390,120,6)}${spk(400,40,4)}`),
  bottom:BOT(`<path class="l-a" d="M150 130H230M270 130H350"/><path class="l-a" d="M250 112V150M238 124H262" stroke-width="2"/>`)}},
 storybook(t,d){const curl=`<g fill="none" stroke="var(--c-accent)" stroke-width="1.6" stroke-linecap="round"><path class="draw" pathLength="1" d="M22 150C22 70 50 32 130 24"/><path class="draw" pathLength="1" d="M22 100c0-22 16-34 34-26 14 6 8 26-6 22"/><path class="draw" pathLength="1" d="M74 24c-16-6-30 6-22 20 8 10 22 2 18-8"/><path class="draw" pathLength="1" d="M130 24H196"/></g>${leaf(40,124,16,6,30,"m-a",false)}${leaf(30,146,13,5,-24,"m-a",false)}${leaf(102,42,15,6,64,"m-a",false)}${leaf(150,30,13,5,112,"m-a",false)}<circle cx="31" cy="31" r="3.5" class="m-a"/>`;
 const bow=`<g transform="translate(250 30)"><path d="M0 2C-24-20-56-18-54 2C-52 20-22 14 0 2Z" class="m-s" stroke="var(--c-accent)" stroke-width="1.4"/><path d="M0 2C24-20 56-18 54 2C52 20 22 14 0 2Z" class="m-s" stroke="var(--c-accent)" stroke-width="1.4"/><path d="M-4 6C-12 28-20 44-34 60L-24 58L-20 68C-8 50 0 30 2 8Z" class="m-s" stroke="var(--c-accent)" stroke-width="1.2"/><path d="M4 6C12 28 20 44 34 60L24 58L20 68C8 50 0 30-2 8Z" class="m-s" stroke="var(--c-accent)" stroke-width="1.2"/><ellipse rx="8" ry="7" cy="2" class="m-a"/></g>`;
 const slipper=`<g transform="translate(206 118)"><path d="M4 34C2 20 14 12 30 14C46 16 60 20 74 6C80 0 88 2 88 10C88 22 80 34 64 36C48 38 30 38 20 36L16 56H11L10 36Z" class="m-x3" stroke="var(--c-accent)" stroke-width="1.4" fill-opacity=".55"/><path d="M24 22C40 24 56 24 70 12" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9"/></g>${spk(196,118,6,"m-a")}${spk(304,112,5,"m-a")}${spk(286,150,4,"m-x1")}`;
 return{top:TOP(curl+flipX(curl)+bow),bottom:BOT(flipY(curl+flipX(curl))+slipper)}},
 cherry(){return{}},
 vinyl(){return{}},
 era(){return{}},
 art(){return{}},
 celebration(){seed=5;let c="";const cl=["m-a","m-s","m-x1","m-x2"];for(let i=0;i<46;i++){const x=rnd()*500,y=rnd()*700,w=4+rnd()*7;c+=`<rect class="${cl[i%4]} fall" style="--d:${f1(-rnd()*9)}s" x="${f1(x)}" y="${f1(y-700)}" width="${f1(w)}" height="${f1(w*1.8)}" rx="1.5"/>`}const bal=(x,y,cls,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path class="l-i op5" d="M0 34Q-8 60 4 90"/><ellipse class="${cls}" cx="0" cy="0" rx="26" ry="32"/><path class="${cls}" d="M-5 31H5L0 38Z"/><ellipse fill="#fff" opacity=".35" cx="-9" cy="-12" rx="6" ry="9"/></g>`;return{
  bg:BG(c),
  top:TOP(`<path class="l-x1" d="M0 30Q60 70 120 30T240 30" stroke-width="3"/><path class="l-x2" style="stroke-width:3" d="M260 40Q320 80 380 40T500 40"/><path class="l-a" style="stroke-width:3" d="M0 60Q80 100 160 60" opacity=".7"/><path class="l-a" style="stroke-width:3" d="M340 70Q420 110 500 70" opacity=".7"/>`),
  bottom:BOT(`<g class="bobs">${bal(52,110,"m-a")}${bal(100,130,"m-s",.8)}</g><g class="fl d2">${bal(448,110,"m-x1")}${bal(400,132,"m-x2",.8)}</g>`)}}
};

/* ---------- fields + templates ---------- */
const FD={
 childName:{l:["Child's name","Ime deteta"],g:"who"}, name:{l:["Celebrant's name","Ime slavljenika"],g:"who"},
 partner1:{l:["First partner","Mladenka"],g:"who"}, partner2:{l:["Second partner","Mladoženja"],g:"who"},
 photo5:{l:["Photo on the back of the card","Fotografija na poleđini pozivnice"],t:"photo",g:"back",max:620}, backMsg:{l:["Message on the back","Poruka na poleđini"],t:"area",g:"back"},
 dayPlan:{l:["Schedule of the day (one item per line)","Program dana (svaka stavka u novom redu)"],t:"area",g:"details",ph:["16:30 Ceremony","16:30 Venčanje"]}, stay:{l:["Accommodation","Smeštaj"],t:"area",g:"details"}, gifts:{l:["Gifts","Pokloni"],t:"area",g:"details"},
 hKick:{l:["Opening line","Uvodni red"],g:"who"}, hName:{l:["Name as written on the card","Ime kako piše na pozivnici"],g:"who",ph:["e.g. Irina's","npr. Irinin"]}, hAge:{l:["Which birthday","Koji rođendan"],g:"who",ph:["e.g. 4.","npr. 4."]}, hOcc:{l:["Celebration","Proslava"],g:"who"},
 p1Last:{l:["Bride's surname","Prezime mladenke"],g:"who"}, p2Last:{l:["Groom's surname","Prezime mladoženje"],g:"who"}, estLine:{l:["Closing line","Završna rečenica"],g:"words"},
 occasion:{l:["Occasion","Povod"],g:"who",ph:["e.g. Our 25th Anniversary","npr. Naša 25. godišnjica braka"]}, hostNames:{l:["Hosted by","Domaćini"],g:"who"},
 date:{l:["Date","Datum"],t:"date",g:"when"}, time:{l:["Start time","Vreme početka"],t:"time",g:"when"},
 ceremonyTime:{l:["Ceremony time","Vreme venčanja"],t:"time",g:"when"}, receptionTime:{l:["Reception time","Vreme proslave"],t:"time",g:"when"},
 venue:{l:["Venue","Mesto"],g:"where"}, church:{l:["Church","Crkva"],g:"where"}, ceremonyVenue:{l:["Ceremony venue","Mesto venčanja"],g:"where"},
 receptionVenue:{l:["Reception venue","Mesto proslave"],g:"where"}, address:{l:["Address","Adresa"],g:"where"},
 message:{l:["Message","Poruka"],t:"area",g:"words"}, hosts:{l:["Signed by","Potpis"],g:"words"}, dressCode:{l:["Dress code","Dress code"],g:"words"},
 rsvpBy:{l:["Reply by","Potvrda dolaska do"],t:"date",g:"replies"},
 photo:{l:["Main photo","Glavna fotografija"],t:"photo",g:"photos",max:900}, photo1:{l:["Strip photo 1","Fotografija 1"],t:"photo",g:"photos",max:380}, photo2:{l:["Strip photo 2","Fotografija 2"],t:"photo",g:"photos",max:380}, photo3:{l:["Strip photo 3","Fotografija 3"],t:"photo",g:"photos",max:380}, photo4:{l:["Strip photo 4","Fotografija 4"],t:"photo",g:"photos",max:380},
 story1Year:{l:["Song 1 · place and year","Pesma 1 · mesto i godina"],g:"story"}, story1Title:{l:["Song 1 · title","Pesma 1 · naslov"],g:"story"}, story1Text:{l:["Song 1 · the story","Pesma 1 · priča"],t:"area",g:"story"},
 story2Year:{l:["Song 2 · place and year","Pesma 2 · mesto i godina"],g:"story"}, story2Title:{l:["Song 2 · title","Pesma 2 · naslov"],g:"story"}, story2Text:{l:["Song 2 · the story","Pesma 2 · priča"],t:"area",g:"story"},
 story4Year:{l:["Moment 4 · when","Trenutak 4 · kada"],g:"story"}, story4Title:{l:["Moment 4 · title","Trenutak 4 · naslov"],g:"story"}, story4Text:{l:["Moment 4 · text","Trenutak 4 · tekst"],t:"area",g:"story"},
 story3Year:{l:["Song 3 · place and year","Pesma 3 · mesto i godina"],g:"story"}, story3Title:{l:["Song 3 · title","Pesma 3 · naslov"],g:"story"}, story3Text:{l:["Song 3 · the story","Pesma 3 · priča"],t:"area",g:"story"},
 plan1Time:{l:["Time","Vreme"],t:"time",g:"plan"}, plan1Title:{l:["Programme item 1","Stavka programa 1"],g:"plan"}, plan2Time:{l:["Time","Vreme"],t:"time",g:"plan"}, plan2Title:{l:["Programme item 2","Stavka programa 2"],g:"plan"},
 plan3Time:{l:["Time","Vreme"],t:"time",g:"plan"}, plan3Title:{l:["Programme item 3","Stavka programa 3"],g:"plan"}, plan4Time:{l:["Time","Vreme"],t:"time",g:"plan"}, plan4Title:{l:["Programme item 4","Stavka programa 4"],g:"plan"},
 age:{l:["Age","Godine"],g:"who"}, headline:{l:["Headline (leave empty to spell out the age)","Naslov (prazno = godine slovima)"],g:"who"},
 tagline:{l:["Script line","Red u rukopisu"],g:"words"}, extras:{l:["Bottom line","Donji red"],g:"words",ph:["Drinks · Dancing · Good company","Piće · Ples · Dobro društvo"]},
 rsvpContact:{l:["Phone for replies","Telefon za odgovore"],g:"replies"},
 brand:{l:["Host or company","Domaćin ili firma"],g:"who"}, brandSub:{l:["Small line under the name","Mali red ispod imena"],g:"who",ph:["e.g. EVENTS & DECOR","npr. EVENTS & DECOR"]},
 inviteLine:{l:["Invites you to","Uvodni red"],g:"words"}, title:{l:["Headline (new line = Enter)","Naslov (novi red = Enter)"],t:"area",g:"words"},
 num1:{l:["First number","Prvi broj"],g:"who"}, name1:{l:["Name under the first number","Ime ispod prvog broja"],g:"who"}, label1:{l:["Small text under it","Mali tekst ispod"],g:"who"},
 num2:{l:["Second number (optional)","Drugi broj (nije obavezno)"],g:"who"}, name2:{l:["Name under the second number","Ime ispod drugog broja"],g:"who"}, label2:{l:["Small text under it (new line = Enter)","Mali tekst ispod (novi red = Enter)"],t:"area",g:"who"},
 signoff:{l:["Closing line","Završni pozdrav"],g:"words"},
 hyT1:{l:["Headline · first line","Naslov · prvi red"],g:"who"}, hyT2:{l:["Headline · second line (yellow)","Naslov · drugi red (žuto)"],g:"who"}, hyJoin:{l:["Line under the headline","Red ispod naslova"],t:"area",g:"words"},
 birthDate:{l:["Date of birth","Datum rođenja"],t:"date",g:"who"}, birthTime:{l:["Time of birth","Vreme rođenja"],t:"time",g:"who"},
 birthWeight:{l:["Birth weight","Težina na rođenju"],g:"who",ph:["e.g. 3,400 g","npr. 3.400 g"]}, birthLength:{l:["Birth length","Dužina na rođenju"],g:"who",ph:["e.g. 52 cm","npr. 52 cm"]},
 nameMeaning:{l:["What the name means","Šta znači ime"],t:"area",g:"words"},
 route1:{l:["Directions · step 1","Kako stići · korak 1"],g:"where"}, route2:{l:["Directions · step 2","Kako stići · korak 2"],g:"where"}, route3:{l:["Directions · step 3","Kako stići · korak 3"],g:"where"},
 venueNote:{l:["Note about the venue","Napomena o mestu"],g:"where",ph:["e.g. Free parking for guests","npr. Besplatan parking za goste"]}, intro:{l:["Why we celebrate","Zašto slavimo"],t:"area",g:"words"},
 songName:{l:["Our song (artist – title)","Naša pesma (izvođač – naziv)"],g:"music"}, songLink:{l:["Link to the song (optional)","Link do pesme (nije obavezno)"],g:"music",ph:["https://youtube.com/…","https://youtube.com/…"]}
};
const GROUPS={who:["Who we're celebrating","Koga slavimo"],photos:["Photos","Fotografije"],when:["When","Kada"],where:["Where","Gde"],words:["Your words","Vaše reči"],story:["Our story","Naša priča"],plan:["Programme","Program večeri"],back:["Back of the card","Poleđina pozivnice"],details:["Second card: details","Druga kartica: detalji"],music:["Music","Muzika"],replies:["Replies","Odgovori"]};
const LAYOUT={
 gold:{fields:["partner1","partner2","age","songName","message","date","time","venue","address","dressCode","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","plan1Time","plan1Title","plan2Time","plan2Title","plan3Time","plan3Title","plan4Time","plan4Title","signoff","rsvpBy"],
  labels:{partner1:["Wife's name","Ime supruge"],partner2:["Husband's name","Ime supruga"],age:["Years together","Koliko godina slavite"],songName:["Your song (shown on the page)","Vaša pesma (piše na stranici)"],message:["Invitation text","Tekst pozivnice"],story1Year:["Track A1 · year","Pesma A1 · godina"],story1Title:["Track A1 · title","Pesma A1 · naslov"],story1Text:["Track A1 · text","Pesma A1 · tekst"],story2Year:["Track A2 · year","Pesma A2 · godina"],story2Title:["Track A2 · title","Pesma A2 · naslov"],story2Text:["Track A2 · text","Pesma A2 · tekst"],story3Year:["Track A3 · year","Pesma A3 · godina"],story3Title:["Track A3 · title","Pesma A3 · naslov"],story3Text:["Track A3 · text","Pesma A3 · tekst"],plan1Title:["Track B1","Pesma B1"],plan2Title:["Track B2","Pesma B2"],plan3Title:["Track B3","Pesma B3"],plan4Title:["Track B4","Pesma B4"]},def:{
  en:{partner1:"Milica",partner2:"Dragan",age:"25",songName:"Đorđe Balašević – Ne lomite mi bagrenje",message:"Twenty-five years ago we put on our first record together. It is still playing. Join us for an evening of dinner, music and dancing to celebrate our silver anniversary.",date:"2027-10-09",time:"19:30",venue:"Hotel Moskva, Crystal Hall",address:"Terazije 20, Belgrade",dressCode:"Elegant, a touch of gold welcome",story1Year:"1999",story1Title:"First dance",story1Text:"A school reunion, a slow song and a question asked far too quietly.",story2Year:"2002",story2Title:"I do",story2Text:"A small church, a big family and a cake that leaned to one side.",story3Year:"2027",story3Title:"Still dancing",story3Text:"Two children, one dog and the same song on repeat.",plan1Time:"19:30",plan1Title:"Welcome drinks",plan2Time:"20:30",plan2Title:"Dinner",plan3Time:"22:00",plan3Title:"Our song, then the dance floor is yours",plan4Time:"23:30",plan4Title:"Anniversary cake",signoff:"Thank you for being part of our song",rsvpBy:"2027-09-20"},
  sr:{partner1:"Milica",partner2:"Dragan",age:"25",songName:"Đorđe Balašević – Ne lomite mi bagrenje",message:"Pre dvadeset pet godina pustili smo našu prvu ploču. Još uvek svira. Pridružite nam se na večeri uz muziku i ples, da zajedno proslavimo srebrnu godišnjicu braka.",date:"2027-10-09",time:"19:30",venue:"Hotel Moskva, Kristalna sala",address:"Terazije 20, Beograd",dressCode:"Elegantno, uz malo zlata",story1Year:"1999.",story1Title:"Prvi ples",story1Text:"Proslava mature, spora pesma i pitanje postavljeno previše tiho.",story2Year:"2002.",story2Title:"Da",story2Text:"Mala crkva, velika porodica i torta koja se nagnula na jednu stranu.",story3Year:"2027.",story3Title:"I dalje plešemo",story3Text:"Dvoje dece, jedan pas i ista pesma na ponavljanju.",plan1Time:"19:30",plan1Title:"Doček i koktel",plan2Time:"20:30",plan2Title:"Svečana večera",plan3Time:"22:00",plan3Title:"Naša pesma, a zatim podijum je vaš",plan4Time:"23:30",plan4Title:"Torta za godišnjicu",signoff:"Hvala što ste deo naše pesme",rsvpBy:"2027-09-20"}}},
 balloon:{fields:["childName","age","message","date","time","venue","address","dressCode","plan1Time","plan1Title","plan2Time","plan2Title","plan3Time","plan3Title","plan4Time","plan4Title","rsvpContact","hosts","signoff","rsvpBy"],
  labels:{dressCode:["Theme or what to wear","Tema ili šta obući"],hosts:["Signed by","Potpis"],message:["Invitation text","Tekst pozivnice"],plan1Title:["Party plan 1","Plan žurke 1"],plan2Title:["Party plan 2","Plan žurke 2"],plan3Title:["Party plan 3","Plan žurke 3"],plan4Title:["Party plan 4","Plan žurke 4"]},def:{
  en:{childName:"Mia",age:"5",message:"Balloons are ready, the cake is almost done and the music is on! Come and celebrate with me, there will be games, surprises and lots of laughter.",date:"2027-04-17",time:"17:00",venue:"Playroom Konfeti",address:"Bulevar Mihajla Pupina 10, Novi Sad",dressCode:"Wear something colourful!",plan1Time:"17:00",plan1Title:"Welcome and balloon games",plan2Time:"17:45",plan2Title:"Magic show",plan3Time:"18:30",plan3Title:"Cake and candles",plan4Time:"19:00",plan4Title:"Dancing and surprises",rsvpContact:"064 123 4567",hosts:"Mia, mum and dad",signoff:"See you at the party!",rsvpBy:"2027-04-10"},
  sr:{childName:"Mia",age:"5",message:"Baloni su spremni, torta je skoro gotova, a muzika već svira! Dođi da zajedno proslavimo, biće igara, iznenađenja i mnogo smeha.",date:"2027-04-17",time:"17:00",venue:"Igraonica Konfeti",address:"Bulevar Mihajla Pupina 10, Novi Sad",dressCode:"Obuci nešto šareno!",plan1Time:"17:00",plan1Title:"Doček i igre sa balonima",plan2Time:"17:45",plan2Title:"Mađioničarska predstava",plan3Time:"18:30",plan3Title:"Torta i svećice",plan4Time:"19:00",plan4Title:"Ples i iznenađenja",rsvpContact:"064 123 4567",hosts:"Mia, mama i tata",signoff:"Vidimo se na žurci!",rsvpBy:"2027-04-10"}}},
 sky:{fields:["partner1","partner2","message","date","ceremonyTime","venue","address","dressCode","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","plan1Time","plan1Title","plan2Time","plan2Title","plan3Time","plan3Title","plan4Time","plan4Title","signoff","rsvpBy"],
  labels:{partner1:["Bride's name","Ime mladenke"],partner2:["Groom's name","Ime mladoženje"],ceremonyTime:["Time","Vreme"],message:["Invitation text","Tekst pozivnice"],story1Year:["Star 1 · when","Zvezda 1 · kada"],story1Title:["Star 1 · title","Zvezda 1 · naslov"],story1Text:["Star 1 · text","Zvezda 1 · tekst"],story2Year:["Star 2 · when","Zvezda 2 · kada"],story2Title:["Star 2 · title","Zvezda 2 · naslov"],story2Text:["Star 2 · text","Zvezda 2 · tekst"],story3Year:["Star 3 · when","Zvezda 3 · kada"],story3Title:["Star 3 · title","Zvezda 3 · naslov"],story3Text:["Star 3 · text","Zvezda 3 · tekst"]},def:{
  en:{partner1:"Nina",partner2:"Stefan",message:"On the night we met, the sky above Belgrade was full of stars. Now we would love you to stand with us under the same sky as we say our yes.",date:"2027-08-14",ceremonyTime:"19:30",venue:"Vila Zvezdara",address:"Mite Ružića 4, Belgrade",dressCode:"Evening wear, midnight blue welcome",story1Year:"Belgrade, 2019",story1Title:"The first star",story1Text:"A summer rooftop, a borrowed jacket and a conversation that lasted until sunrise.",story2Year:"Kopaonik, 2022",story2Title:"Our own constellation",story2Text:"A cabin, a telescope and the night we named a star after each other.",story3Year:"Novi Sad, 2026",story3Title:"Yes, under the sky",story3Text:"A ring, a falling star and the easiest question ever answered.",plan1Time:"19:30",plan1Title:"Ceremony in the garden",plan2Time:"20:30",plan2Title:"Cocktails under the stars",plan3Time:"21:30",plan3Title:"Dinner",plan4Time:"23:00",plan4Title:"First dance and party",signoff:"Under the same stars, with you",rsvpBy:"2027-07-15"},
  sr:{partner1:"Nina",partner2:"Stefan",message:"One noći kada smo se upoznali, nebo iznad Beograda bilo je puno zvezda. Sada bismo voleli da pod istim nebom budete uz nas kada izgovorimo „da“.",date:"2027-08-14",ceremonyTime:"19:30",venue:"Vila Zvezdara",address:"Mite Ružića 4, Beograd",dressCode:"Večernje, dobrodošla ponoćno plava",story1Year:"Beograd, 2019.",story1Title:"Prva zvezda",story1Text:"Letnja terasa, pozajmljena jakna i razgovor koji je trajao do svitanja.",story2Year:"Kopaonik, 2022.",story2Title:"Naše sazvežđe",story2Text:"Brvnara, teleskop i noć kada smo jedno drugome dali ime zvezde.",story3Year:"Novi Sad, 2026.",story3Title:"„Da“ pod nebom",story3Text:"Prsten, zvezda padalica i najlakše pitanje na koje je ikada odgovoreno.",plan1Time:"19:30",plan1Title:"Venčanje u vrtu",plan2Time:"20:30",plan2Title:"Koktel pod zvezdama",plan3Time:"21:30",plan3Title:"Svečana večera",plan4Time:"23:00",plan4Title:"Prvi ples i žurka",signoff:"Pod istim zvezdama, sa vama",rsvpBy:"2027-07-15"}}},
 letter:{fields:["partner1","partner2","message","date","venue","address","dressCode","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","plan1Time","plan1Title","plan2Time","plan2Title","plan3Time","plan3Title","plan4Time","plan4Title","rsvpBy"],labels:{message:["Your letter to the guests","Vaše pismo gostima"],story1Year:["Letter 1 · place and year","Pismo 1 · mesto i godina"],story1Title:["Letter 1 · title","Pismo 1 · naslov"],story1Text:["Letter 1 · text","Pismo 1 · tekst"],story2Year:["Letter 2 · place and year","Pismo 2 · mesto i godina"],story2Title:["Letter 2 · title","Pismo 2 · naslov"],story2Text:["Letter 2 · text","Pismo 2 · tekst"],story3Year:["Letter 3 · place and year","Pismo 3 · mesto i godina"],story3Title:["Letter 3 · title","Pismo 3 · naslov"],story3Text:["Letter 3 · text","Pismo 3 · tekst"]},def:{
  en:{partner1:"Sara",partner2:"Vuk",message:"Some stories are written slowly, one letter at a time. Ours has reached its most beautiful page, and we would love you to be there when we sign it with a yes.\nCome and celebrate with us a day we have dreamed about for a long time.",date:"2027-06-19",venue:"Villa Lavanda",address:"Fruška gora, Sremski Karlovci",dressCode:"Elegant, soft pastel shades",story1Year:"Novi Sad, 2018",story1Title:"The first letter",story1Text:"A note left in a borrowed book, a phone number and a reply that took three whole days.",story2Year:"Rovinj, 2021",story2Title:"Postcards from the sea",story2Text:"Our first trip together, sunsets on the old pier and a postcard we sent ourselves.",story3Year:"Vienna, 2025",story3Title:"The question",story3Text:"Snow, a small café and one handwritten question at the bottom of a cup: will you?",plan1Time:"16:00",plan1Title:"Welcome in the garden",plan2Time:"17:00",plan2Title:"Ceremony under the old linden",plan3Time:"19:00",plan3Title:"Dinner and toasts",plan4Time:"21:30",plan4Title:"First dance and cake",rsvpBy:"2027-05-20"},
  sr:{partner1:"Sara",partner2:"Vuk",message:"Neke priče se pišu polako, pismo po pismo. Naša je stigla do svoje najlepše stranice i voleli bismo da budete tu kada je potpišemo sa „da“.\nDođite da zajedno proslavimo dan o kome dugo sanjamo.",date:"2027-06-19",venue:"Vila Lavanda",address:"Fruška gora, Sremski Karlovci",dressCode:"Elegantno, nežne pastelne boje",story1Year:"Novi Sad, 2018.",story1Title:"Prvo pismo",story1Text:"Poruka ostavljena u pozajmljenoj knjizi, jedan broj telefona i odgovor koji je čekao cela tri dana.",story2Year:"Rovinj, 2021.",story2Title:"Razglednice sa mora",story2Text:"Prvo zajedničko putovanje, zalasci sunca na starom molu i razglednica koju smo poslali sami sebi.",story3Year:"Beč, 2025.",story3Title:"Pitanje",story3Text:"Sneg, mali kafić i jedno pitanje napisano rukom na dnu šolje: hoćeš li?",plan1Time:"16:00",plan1Title:"Doček gostiju u vrtu",plan2Time:"17:00",plan2Title:"Venčanje pod starom lipom",plan3Time:"19:00",plan3Title:"Svečana večera i zdravice",plan4Time:"21:30",plan4Title:"Prvi ples i torta",rsvpBy:"2027-05-20"}}},
 estate:{fields:["partner1","p1Last","partner2","p2Last","date","ceremonyTime","ceremonyVenue","address","estLine","rsvpBy"],labels:{partner1:["Bride's name","Ime mladenke"],partner2:["Groom's name","Ime mladoženje"],ceremonyTime:["Time","Vreme"],ceremonyVenue:["Venue","Mesto"]},def:{
  en:{partner1:"Isidora",p1Last:"Vuković",partner2:"Aleksandar",p2Last:"Simić",date:"2027-10-02",ceremonyTime:"16:30",ceremonyVenue:"Zelengora Estate",address:"27 Vinogradska Street, Sremski Karlovci",estLine:"Reception to follow",rsvpBy:"2027-09-01",backMsg:"We can't wait to spend this day with you.",dayPlan:"16:30 Garden ceremony\n17:30 Cocktails on the terrace\n19:00 Dinner\n21:00 First dance and party",dressCode:"Formal, shades of green and cream are welcome",stay:"We have reserved rooms for guests at a hotel in Sremski Karlovci. Write to us and we will send you the details.",gifts:"Your presence is the best gift. If you would like to give something, a contribution to our honeymoon would make us very happy."},
  sr:{partner1:"Isidora",p1Last:"Vuković",partner2:"Aleksandar",p2Last:"Simić",date:"2027-10-02",ceremonyTime:"16:30",ceremonyVenue:"Imanje Zelengora",address:"Vinogradska 27, Sremski Karlovci",estLine:"Proslava nakon venčanja",rsvpBy:"2027-09-01",backMsg:"Jedva čekamo da ovaj dan provedemo sa vama.",dayPlan:"16:30 Venčanje u vrtu\n17:30 Koktel na terasi\n19:00 Svečana večera\n21:00 Prvi ples i žurka",dressCode:"Svečano, nijanse zelene i krem su dobrodošle",stay:"Za goste smo rezervisali sobe u hotelu u Sremskim Karlovcima. Pišite nam i poslaćemo vam detalje.",gifts:"Vaše prisustvo je najlepši poklon. Ako želite da nas darujete, biće nam drago da nam pomognete da uštedimo za medeni mesec."}}},
 picture:{fields:["childName","date","time","venue","address","rsvpBy"],def:{
  en:{childName:"Ilija",date:"2027-07-10",time:"15:00",venue:"Hotel Hedonic, Ceremonial hall",address:"",rsvpBy:"2027-07-01"},
  sr:{childName:"Ilija",date:"2027-07-10",time:"15:00",venue:"Hotel Hedonic, Svečana sala",address:"",rsvpBy:"2027-07-01"}}},
 rip:{fields:["name","age","message","date","time","venue","address","dressCode","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","story4Year","story4Title","story4Text","photo1","photo2","photo3","photo4","hosts","rsvpBy"],
  labels:{message:["Cheerful obituary text","Tekst vesele čitulje"],hosts:["Seeing them off (signature)","Ispraćaju ih (potpis)"],story1Year:["Memory 1 · year","Uspomena 1 · godina"],story1Title:["Memory 1 · title","Uspomena 1 · naslov"],story1Text:["Memory 1 · text","Uspomena 1 · tekst"],story2Year:["Memory 2 · year","Uspomena 2 · godina"],story2Title:["Memory 2 · title","Uspomena 2 · naslov"],story2Text:["Memory 2 · text","Uspomena 2 · tekst"],story3Year:["Memory 3 · year","Uspomena 3 · godina"],story3Title:["Memory 3 · title","Uspomena 3 · naslov"],story3Text:["Memory 3 · text","Uspomena 3 · tekst"],story4Year:["Memory 4 · year","Uspomena 4 · godina"],story4Title:["Memory 4 · title","Uspomena 4 · naslov"],story4Text:["Memory 4 · text","Uspomena 4 · tekst"],photo1:["Photo 1 (obituary)","Fotografija 1 (za čitulju)"],photo2:["Photo 2","Fotografija 2"],photo3:["Photo 3","Fotografija 3"],photo4:["Photo 4","Fotografija 4"]},def:{
  en:{name:"Jovana",age:"30",message:"After a long and wild battle with parties, early mornings and countless 'just one more', they have left us for good. We will see them off with dignity: with music, drinks and dancing until dawn.",date:"2027-03-20",time:"21:00",venue:"Club Noir",address:"Cetinjska 15, Belgrade",dressCode:"All black, please",story1Year:"2017",story1Title:"First flat",story1Text:"Three flatmates, one fridge and a lot of instant soup.",story2Year:"2019",story2Title:"Graduation",story2Text:"Finally! Mum cried, we celebrated for three days.",story3Year:"2022",story3Title:"The big adventure",story3Text:"One backpack, one ticket and a lot of courage.",story4Year:"2025",story4Title:"A grown-up?",story4Text:"Bought my first vacuum cleaner. And was happy about it.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Jovana and friends",rsvpBy:"2027-03-10"},
  sr:{name:"Jovana",age:"30",message:"Posle duge i burne borbe sa žurkama, ranim jutrima i nebrojenim „samo još jednom“, zauvek su nas napustile. Ispratićemo ih dostojanstveno: uz muziku, piće i ples do zore.",date:"2027-03-20",time:"21:00",venue:"Klub Noir",address:"Cetinjska 15, Beograd",dressCode:"Obavezno crno",story1Year:"2017",story1Title:"Prvi stan",story1Text:"Tri cimera, jedan frižider i mnogo instant supa.",story2Year:"2019",story2Title:"Diploma",story2Text:"Konačno! Mama je plakala, a mi slavili tri dana.",story3Year:"2022",story3Title:"Velika avantura",story3Text:"Jedan ranac, jedna karta i mnogo hrabrosti.",story4Year:"2025",story4Title:"Odrasla?",story4Text:"Kupila prvi usisivač. I bila srećna zbog toga.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Jovana i prijatelji",rsvpBy:"2027-03-10"}}},
 bloom:{fields:["childName","age","message","date","time","venue","address","birthDate","birthTime","birthWeight","birthLength","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","story4Year","story4Title","story4Text","photo1","photo2","photo3","photo4","hosts","rsvpBy"],
  labels:{message:["Invitation text","Tekst pozivnice"],hosts:["Signed by","Potpis"],story1Year:["Moment 1 · when","Trenutak 1 · kada"],story1Title:["Moment 1 · title","Trenutak 1 · naslov"],story1Text:["Moment 1 · text","Trenutak 1 · tekst"],story2Year:["Moment 2 · when","Trenutak 2 · kada"],story2Title:["Moment 2 · title","Trenutak 2 · naslov"],story2Text:["Moment 2 · text","Trenutak 2 · tekst"],story3Year:["Moment 3 · when","Trenutak 3 · kada"],story3Title:["Moment 3 · title","Trenutak 3 · naslov"],story3Text:["Moment 3 · text","Trenutak 3 · tekst"],story4Year:["Moment 4 · when","Trenutak 4 · kada"],story4Title:["Moment 4 · title","Trenutak 4 · naslov"],story4Text:["Moment 4 · text","Trenutak 4 · tekst"],photo1:["Photo 1","Fotografija 1"],photo2:["Photo 2","Fotografija 2"],photo3:["Photo 3","Fotografija 3"],photo4:["Photo 4","Fotografija 4"]},def:{
  en:{childName:"Mila",age:"1",message:"Our little flower Mila is turning one! Come and celebrate with us over cake, flowers and lots of smiles.",date:"2027-05-15",time:"17:00",venue:"Rose Garden Restaurant",address:"Kneza Miloša 18, Belgrade",birthDate:"2026-05-15",birthTime:"06:40",birthWeight:"3,250 g",birthLength:"50 cm",story1Year:"Month 1",story1Title:"First smile",story1Text:"The first real smile, and the whole home burst into bloom.",story2Year:"Month 5",story2Title:"First giggle",story2Text:"A ringing little laugh we recorded a hundred times.",story3Year:"Month 7",story3Title:"First tooth",story3Text:"A tiny white pearl and a few sleepless nights.",story4Year:"Month 11",story4Title:"First steps",story4Text:"Three brave steps toward the flowers in the garden.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Mila, mum and dad",rsvpBy:"2027-05-05"},
  sr:{childName:"Mila",age:"1",message:"Naš mali cvet Mila puni prvu godinu! Dođite da zajedno proslavimo uz tortu, cveće i mnogo osmeha.",date:"2027-05-15",time:"17:00",venue:"Restoran Ružičnjak",address:"Kneza Miloša 18, Beograd",birthDate:"2026-05-15",birthTime:"06:40",birthWeight:"3.250 g",birthLength:"50 cm",story1Year:"1. mesec",story1Title:"Prvi osmeh",story1Text:"Prvi pravi osmeh i ceo dom je procvetao.",story2Year:"5. mesec",story2Title:"Prvi kikot",story2Text:"Zvonki smeh koji smo snimili sto puta.",story3Year:"7. mesec",story3Title:"Prvi zubić",story3Text:"Mali beli biser i nekoliko neprospavanih noći.",story4Year:"11. mesec",story4Title:"Prvi koraci",story4Text:"Tri hrabra koraka ka cveću u bašti.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Mila, mama i tata",rsvpBy:"2027-05-05"}}},
 plane:{fields:["childName","age","message","date","time","venue","address","birthDate","birthTime","birthWeight","birthLength","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","story4Year","story4Title","story4Text","photo1","photo2","photo3","photo4","hosts","rsvpBy"],
  labels:{message:["Invitation text","Tekst pozivnice"],hosts:["Signed by","Potpis"],story1Year:["Moment 1 · when","Trenutak 1 · kada"],story1Title:["Moment 1 · title","Trenutak 1 · naslov"],story1Text:["Moment 1 · text","Trenutak 1 · tekst"],story2Year:["Moment 2 · when","Trenutak 2 · kada"],story2Title:["Moment 2 · title","Trenutak 2 · naslov"],story2Text:["Moment 2 · text","Trenutak 2 · tekst"],story3Year:["Moment 3 · when","Trenutak 3 · kada"],story3Title:["Moment 3 · title","Trenutak 3 · naslov"],story3Text:["Moment 3 · text","Trenutak 3 · tekst"],story4Year:["Moment 4 · when","Trenutak 4 · kada"],story4Title:["Moment 4 · title","Trenutak 4 · naslov"],story4Text:["Moment 4 · text","Trenutak 4 · tekst"],photo1:["Photo 1","Fotografija 1"],photo2:["Photo 2","Fotografija 2"],photo3:["Photo 3","Fotografija 3"],photo4:["Photo 4","Fotografija 4"]},def:{
  en:{childName:"Luka",age:"1",message:"Our little pilot Luka is turning one! Come aboard for a flight full of cake, balloons and big smiles.",date:"2027-06-12",time:"17:00",venue:"Cloud Nine Playroom",address:"Liberation Blvd 45, Novi Sad",birthDate:"2026-06-12",birthTime:"09:15",birthWeight:"3,600 g",birthLength:"53 cm",story1Year:"Month 1",story1Title:"First smile",story1Text:"The first real smile, and the whole crew melted.",story2Year:"Month 4",story2Title:"First roll",story2Text:"From back to tummy in one brave manoeuvre.",story3Year:"Month 8",story3Title:"First airplane",story3Text:"Spotted a real plane in the sky and waved to it for an hour.",story4Year:"Month 11",story4Title:"First steps",story4Text:"Three wobbly steps, and then a proud landing in mum's arms.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Luka, mum and dad",rsvpBy:"2027-06-01"},
  sr:{childName:"Luka",age:"1",message:"Naš mali pilot Luka puni prvu godinu! Ukrcajte se sa nama na let pun torte, balona i velikih osmeha.",date:"2027-06-12",time:"17:00",venue:"Igraonica Oblačić",address:"Bulevar oslobođenja 45, Novi Sad",birthDate:"2026-06-12",birthTime:"09:15",birthWeight:"3.600 g",birthLength:"53 cm",story1Year:"1. mesec",story1Title:"Prvi osmeh",story1Text:"Prvi pravi osmeh i cela posada se istopila.",story2Year:"4. mesec",story2Title:"Prvo okretanje",story2Text:"Sa leđa na stomak u jednom hrabrom manevru.",story3Year:"8. mesec",story3Title:"Prvi avion",story3Text:"Ugledao je pravi avion na nebu i mahao mu ceo sat.",story4Year:"11. mesec",story4Title:"Prvi koraci",story4Text:"Tri nesigurna koraka, pa ponosno sletanje u mamin zagrljaj.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Luka, mama i tata",rsvpBy:"2027-06-01"}}},
 honey:{fields:["childName","age","hyT1","hyT2","hyJoin","message","date","time","venue","address","birthDate","birthTime","birthWeight","birthLength","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","story4Year","story4Title","story4Text","photo1","photo2","photo3","photo4","rsvpContact","hosts","signoff","rsvpBy"],
  labels:{tagline:["Nickname line","Nadimak (npr. Naša mala pčelica)"],message:["Invitation text","Tekst pozivnice"],hosts:["Signed by","Potpis"],story1Year:["Moment 1 · when","Trenutak 1 · kada"],story1Title:["Moment 1 · title","Trenutak 1 · naslov"],story1Text:["Moment 1 · text","Trenutak 1 · tekst"],story2Year:["Moment 2 · when","Trenutak 2 · kada"],story2Title:["Moment 2 · title","Trenutak 2 · naslov"],story2Text:["Moment 2 · text","Trenutak 2 · tekst"],story3Year:["Moment 3 · when","Trenutak 3 · kada"],story3Title:["Moment 3 · title","Trenutak 3 · naslov"],story3Text:["Moment 3 · text","Trenutak 3 · tekst"],story4Year:["Moment 4 · when","Trenutak 4 · kada"],story4Title:["Moment 4 · title","Trenutak 4 · naslov"],story4Text:["Moment 4 · text","Trenutak 4 · tekst"],photo1:["Photo 1","Fotografija 1"],photo2:["Photo 2","Fotografija 2"],photo3:["Photo 3","Fotografija 3"],photo4:["Photo 4","Fotografija 4"]},def:{
  en:{childName:"Nikolina",age:"1",hyT1:"Nikolina's first",hyT2:"bee-day",hyJoin:"Join us for a\nbuzzing celebration!",rsvpContact:"064 123 4567",signoff:"We can't wait to\ncelebrate with you!",tagline:"Our little honeybee",message:"Our sweetest little bee Nikolina is turning one! Come buzz by for cake, balloons and a whole lot of honey-sweet hugs.",date:"2027-05-22",time:"17:00",venue:"Honey Garden",address:"Linden Street 12, Belgrade",birthDate:"2026-05-22",birthTime:"07:40",birthWeight:"3,350 g",birthLength:"51 cm",story1Year:"Month 1",story1Title:"First smile",story1Text:"The first real smile, and the whole house melted.",story2Year:"Month 6",story2Title:"First tastes",story2Text:"Apple, carrot and a very serious face for every new spoon.",story3Year:"Month 7",story3Title:"First tooth",story3Text:"A tiny white surprise, a few sleepless nights and a brand new smile.",story4Year:"Month 11",story4Title:"First steps",story4Text:"Three wobbly steps toward the balloons, and then a proud giggle.",photo1:"",photo2:"",photo3:"",photo4:"",route1:"Take the main road toward the park",route2:"Turn right after the bakery",route3:"Look for the yellow balloons on the gate",hosts:"Nikolina, mum and dad",rsvpBy:"2027-05-10"},
  sr:{childName:"Nikolina",age:"1",hyT1:"Nikolinin prvi",hyT2:"rođendan",hyJoin:"Pridružite nam se\nna zujavom slavlju!",rsvpContact:"064 123 4567",signoff:"Radujemo se slavlju\nsa vama!",tagline:"Naša mala pčelica",message:"Naša najslađa pčelica Nikolina puni prvu godinu! Doletite na tortu, balone i mnogo medenih zagrljaja.",date:"2027-05-22",time:"17:00",venue:"Medena bašta",address:"Ulica Lipa 12, Beograd",birthDate:"2026-05-22",birthTime:"07:40",birthWeight:"3.350 g",birthLength:"51 cm",story1Year:"1. mesec",story1Title:"Prvi osmeh",story1Text:"Prvi pravi osmeh i cela kuća se istopila.",story2Year:"6. mesec",story2Title:"Prvi zalogaji",story2Text:"Jabuka, šargarepa i vrlo ozbiljno lice za svaku novu kašičicu.",story3Year:"7. mesec",story3Title:"Prvi zubić",story3Text:"Malo belo iznenađenje, nekoliko neprospavanih noći i potpuno novi osmeh.",story4Year:"11. mesec",story4Title:"Prvi koraci",story4Text:"Tri nesigurna koraka ka balonima, pa ponosni kikot.",photo1:"",photo2:"",photo3:"",photo4:"",route1:"Krenite glavnim putem prema parku",route2:"Skrenite desno posle pekare",route3:"Tražite žute balone na kapiji",hosts:"Nikolina, mama i tata",rsvpBy:"2027-05-10"}}},
 lace:{fields:["partner1","partner2","hosts","message","date","ceremonyTime","ceremonyVenue","receptionTime","receptionVenue","address","dressCode","rsvpBy"],labels:{hosts:["Opening line","Uvodna rečenica"]},def:{
  en:{partner1:"Sofia",partner2:"Andrew",hosts:"Together with their families",message:"request the honour of your presence at the celebration of their marriage",date:"2027-09-18",ceremonyTime:"16:00",ceremonyVenue:"St. Sava Church",receptionTime:"19:00",receptionVenue:"Hotel Moskva, Crystal Hall",address:"Belgrade",dressCode:"Black tie",rsvpBy:"2027-08-15"},
  sr:{partner1:"Sofija",partner2:"Andrej",hosts:"Zajedno sa svojim porodicama",message:"imaju čast da vas pozovu na proslavu svog venčanja",date:"2027-09-18",ceremonyTime:"16:00",ceremonyVenue:"Hram Svetog Save",receptionTime:"19:00",receptionVenue:"Hotel Moskva, Kristalna sala",address:"Beograd",dressCode:"Svečano",rsvpBy:"2027-08-15"}}},
 bow:{fields:["partner1","partner2","message","date","ceremonyTime","venue","address","venueNote","plan1Time","plan1Title","plan2Time","plan2Title","plan3Time","plan3Title","plan4Time","plan4Title","dressCode","signoff","rsvpBy"],labels:{message:["Invitation text","Tekst pozivnice"],ceremonyTime:["Ceremony time","Vreme venčanja"],signoff:["Closing line","Završna poruka"]},def:{
  en:{partner1:"Mila",partner2:"Luka",message:"With full hearts we invite you to share the day we tie the knot.",date:"2027-06-12",ceremonyTime:"17:00",venue:"Villa Oliva",address:"Herceg Novi, Montenegro",venueNote:"Free parking for guests",plan1Time:"17:00",plan1Title:"Ceremony on the terrace above the sea",plan2Time:"18:00",plan2Title:"Welcome drinks and photos",plan3Time:"19:30",plan3Title:"Dinner under the stars",plan4Time:"22:00",plan4Title:"Cake, first dance and celebration until dawn",dressCode:"Formal",signoff:"We can't wait to celebrate with you",rsvpBy:"2027-05-15"},
  sr:{partner1:"Mila",partner2:"Luka",message:"Puna srca pozivamo vas da sa nama podelite dan kada vezujemo našu mašnu zauvek.",date:"2027-06-12",ceremonyTime:"17:00",venue:"Vila Oliva",address:"Herceg Novi, Crna Gora",venueNote:"Besplatan parking za goste",plan1Time:"17:00",plan1Title:"Venčanje na terasi iznad mora",plan2Time:"18:00",plan2Title:"Koktel dobrodošlice i fotografisanje",plan3Time:"19:30",plan3Title:"Večera pod zvezdama",plan4Time:"22:00",plan4Title:"Torta, prvi ples i slavlje do zore",dressCode:"Svečano",signoff:"Radujemo se što ćemo slaviti sa vama",rsvpBy:"2027-05-15"}}},
 discop:{fields:["brand","brandSub","inviteLine","title","num1","name1","label1","num2","name2","label2","message","intro","dressCode","date","time","venue","address","signoff","rsvpBy"],
  labels:{photo:["Host photo","Fotografija domaćina"],tagline:["Host's words","Reči domaćina"],photo1:["Chapter 1 photo","Fotografija za poglavlje 1"],photo2:["Chapter 2 photo","Fotografija za poglavlje 2"],photo3:["Chapter 3 photo","Fotografija za poglavlje 3"],story1Year:["Chapter 1 · year","Poglavlje 1 · godina"],story1Title:["Chapter 1 · title","Poglavlje 1 · naslov"],story1Text:["Chapter 1 · text","Poglavlje 1 · tekst"],story2Year:["Chapter 2 · year","Poglavlje 2 · godina"],story2Title:["Chapter 2 · title","Poglavlje 2 · naslov"],story2Text:["Chapter 2 · text","Poglavlje 2 · tekst"],story3Year:["Chapter 3 · year","Poglavlje 3 · godina"],story3Title:["Chapter 3 · title","Poglavlje 3 · naslov"],story3Text:["Chapter 3 · text","Poglavlje 3 · tekst"]},def:{
  en:{brand:"Sweet & Shiny",brandSub:"EVENTS & DECOR",inviteLine:"invites you to a",title:"BIRTHDAY\nPARTY",num1:"36",name1:"Marko",label1:"BIRTHDAY",num2:"5",name2:"Sweet & Shiny",label2:"YEARS\nIN BUSINESS",photo:"",tagline:"For years I've been part of your most beautiful celebrations. Now it's time to celebrate mine together!",message:"Join us to celebrate\none very special evening!",intro:"This year we celebrate twice!\nMy 36th birthday and 5 years of Sweet & Shiny. Behind us are years of hard work, smiles, challenges and dreams come true. That's why I want to spend this special evening with the people who are part of my story.",
   story1Year:"2021",story1Title:"The first table",story1Text:"A few candles, white roses and one tiny disco ball. That's how Sweet & Shiny began, with one table and a big wish for every celebration to sparkle.",photo1:"",
   story2Year:"2023",story2Title:"Bigger halls, bigger dreams",story2Text:"Weddings, birthdays, christenings… Year after year, more of you trusted us with your most important moments.",photo2:"",
   story3Year:"2026",story3Title:"Five years of sparkle",story3Text:"Today we celebrate you, everyone who has been part of this story, and Marko's 35th birthday along the way.",photo3:"",
   plan1Time:"20:00",plan1Title:"Welcome and cocktails",plan2Time:"21:00",plan2Title:"Dinner",plan3Time:"22:30",plan3Title:"Cake and a toast to 35 & 5",plan4Time:"23:00",plan4Title:"Disco till dawn",dressCode:"Elegant",
   date:"2026-11-28",time:"20:00",venue:"Dom kulture",address:"Novi Banovci",signoff:"See you there!",rsvpBy:"2026-11-15"},
  sr:{brand:"Slatko & Sjajno",brandSub:"EVENTS & DECOR",inviteLine:"vas poziva na",title:"ROĐENDANSKU\nŽURKU",num1:"36",name1:"Marko",label1:"ROĐENDAN",num2:"5",name2:"Slatko & Sjajno",label2:"GODINA\nPOSTOJANJA",photo:"",tagline:"Godinama sam bio deo vaših najlepših proslava. Sada je vreme da zajedno proslavimo i moju!",message:"Pozivamo vas da zajedno proslavimo\njedno posebno veče!",intro:"Ove godine slavimo duplo!\nMoj 36. rođendan i 5 godina Slatko & Sjajno. Iza nas su godine truda, osmeha, izazova i ostvarenih snova. Zato želim da ovo posebno veče provedem sa ljudima koji su deo moje priče.",
   story1Year:"2021",story1Title:"Prvi sto",story1Text:"Nekoliko sveća, bele ruže i jedna mala disko kugla. Tako je počelo Slatko & Sjajno, sa jednim stolom i velikom željom da svako slavlje zablista.",photo1:"",
   story2Year:"2023",story2Title:"Veće sale, veći snovi",story2Text:"Venčanja, rođendani, krštenja… Iz godine u godinu, sve više vas nam je poverilo svoje najvažnije trenutke.",photo2:"",
   story3Year:"2026",story3Title:"Pet godina sjaja",story3Text:"Danas slavimo vas, sve koji ste bili deo ove priče, a usput i Markov 36. rođendan.",photo3:"",
   plan1Time:"20:00",plan1Title:"Doček i koktel dobrodošlice",plan2Time:"21:00",plan2Title:"Večera",plan3Time:"22:30",plan3Title:"Torta i zdravica za 35 & 5",plan4Time:"23:00",plan4Title:"Disko do zore",dressCode:"Elegantno",
   date:"2026-11-28",time:"20:00",venue:"Dom kulture",address:"Novi Banovci",signoff:"Vidimo se!",rsvpBy:"2026-11-15"}}},
 disco:{fields:["brand","brandSub","inviteLine","title","num1","name1","label1","num2","name2","label2","message","date","time","venue","address","signoff","rsvpBy"],def:{
  en:{brand:"Sweet & Shiny",brandSub:"EVENTS & DECOR",inviteLine:"invites you to a",title:"BIRTHDAY\nPARTY",num1:"35",name1:"Marko",label1:"BIRTHDAY",num2:"5",name2:"Sweet & Shiny",label2:"YEARS\nIN BUSINESS",message:"Join us to celebrate\none very special evening!",date:"2026-11-28",time:"20:00",venue:"Dom kulture",address:"Novi Banovci",signoff:"See you there!",rsvpBy:""},
  sr:{brand:"Slatko & Sjajno",brandSub:"EVENTS & DECOR",inviteLine:"vas poziva na",title:"ROĐENDANSKU\nŽURKU",num1:"35",name1:"Marko",label1:"ROĐENDAN",num2:"5",name2:"Slatko & Sjajno",label2:"GODINA\nPOSTOJANJA",message:"Pozivamo vas da zajedno proslavimo\njedno posebno veče!",date:"2026-11-28",time:"20:00",venue:"Dom kulture",address:"Novi Banovci",signoff:"Vidimo se!",rsvpBy:""}}},
 first:{fields:["childName","date","time","venue","address","message","hosts","rsvpBy"],def:{
  en:{childName:"Mia",date:"2027-03-14",time:"16:00",venue:"Little Garden Café",address:"12 Linden Street, Belgrade",message:"Our little one is turning one! Come share cake, giggles and a whole lot of love.",hosts:"With love, Ana & Marko",rsvpBy:"2027-03-01"},
  sr:{childName:"Mia",date:"2027-03-14",time:"16:00",venue:"Kafe Mali vrt",address:"Ulica Lipa 12, Beograd",message:"Naše malo sunce puni prvu godinu! Dođite na tortu, osmehe i mnogo ljubavi.",hosts:"S ljubavlju, Ana i Marko",rsvpBy:"2027-03-01"}}},
 eighteen:{fields:["name","date","time","venue","address","dressCode","message","rsvpBy"],def:{
  en:{name:"Isabella",date:"2027-06-19",time:"20:00",venue:"The Grand Terrace",address:"Knez Mihailova 10, Belgrade",dressCode:"Black tie",message:"Eighteen years, one unforgettable night. Join me for dinner, music and dancing as I begin a new chapter.",rsvpBy:"2027-06-01"},
  sr:{name:"Isidora",date:"2027-06-19",time:"20:00",venue:"Grand terasa",address:"Knez Mihailova 10, Beograd",dressCode:"Svečano",message:"Osamnaest godina, jedno nezaboravno veče. Pridružite mi se na večeri, uz muziku i ples, dok počinjem novo poglavlje.",rsvpBy:"2027-06-01"}}},
 wedding:{fields:["partner1","partner2","hosts","message","date","ceremonyTime","ceremonyVenue","receptionTime","receptionVenue","address","dressCode","rsvpBy"],labels:{hosts:["Opening line","Uvodna rečenica"]},def:{
  en:{partner1:"Ana",partner2:"Stefan",hosts:"Together with their families",message:"request the pleasure of your company at the celebration of their marriage",date:"2027-09-11",ceremonyTime:"15:00",ceremonyVenue:"St. Mark's Church",receptionTime:"18:00",receptionVenue:"Villa Maria",address:"Tašmajdan Park, Belgrade",dressCode:"Formal",rsvpBy:"2027-08-01"},
  sr:{partner1:"Ana",partner2:"Stefan",hosts:"Zajedno sa svojim porodicama",message:"imaju čast i zadovoljstvo da vas pozovu na proslavu svog venčanja",date:"2027-09-11",ceremonyTime:"15:00",ceremonyVenue:"Crkva Svetog Marka",receptionTime:"18:00",receptionVenue:"Vila Marija",address:"Tašmajdanski park, Beograd",dressCode:"Svečano",rsvpBy:"2027-08-01"}}},
 era:{fields:["name","age","headline","photo","date","time","venue","address","tagline","extras","rsvpContact","rsvpBy"],labels:{photo:["Your photo","Vaša fotografija"]},def:{
  en:{name:"Ella",age:"18",headline:"",tagline:"a new chapter",date:"2027-06-26",time:"21:00",venue:"The Rooftop",address:"10 Kneza Miloša, Belgrade",extras:"Drinks · Dancing · Good company",rsvpContact:"064 123 4567",rsvpBy:"2027-06-15"},
  sr:{name:"Lena",age:"18",headline:"",tagline:"novo poglavlje",date:"2027-06-26",time:"21:00",venue:"Rooftop bar",address:"Kneza Miloša 10, Beograd",extras:"Piće · Ples · Dobro društvo",rsvpContact:"064 123 4567",rsvpBy:"2027-06-15"}}},
 vinyl:{fields:["partner1","partner2","message","date","venue","address","dressCode","story1Year","story1Title","story1Text","story2Year","story2Title","story2Text","story3Year","story3Title","story3Text","plan1Time","plan1Title","plan2Time","plan2Title","plan3Time","plan3Title","plan4Time","plan4Title","songName","songLink","rsvpBy"],labels:{message:["Liner notes (your intro)","Beleške sa omota (uvodna poruka)"]},def:{
  en:{partner1:"Ana",partner2:"Stefan",message:"We met over a song, and we've been writing one together ever since. This autumn it reaches its most beautiful chorus, and we'd love you to hear it live, with us.",date:"2027-09-12",venue:"Villa Maslina",address:"Topčider, Belgrade",dressCode:"Formal",story1Year:"Belgrade, 2019",story1Title:"The first note",story1Text:"A concert, the same row, the same favourite song, and a conversation that lasted until morning.",story2Year:"Kotor, 2022",story2Title:"The chorus",story2Text:"Our first summer together, the old town, and a record we bought at a flea market without owning a record player.",story3Year:"Lisbon, 2025",story3Title:"The ring",story3Text:"Fado in a tiny tavern, one question and the shortest answer in the world: yes.",plan1Time:"17:00",plan1Title:"Welcome drinks",plan2Time:"18:00",plan2Title:"The ceremony",plan3Time:"19:30",plan3Title:"Dinner is served",plan4Time:"22:00",plan4Title:"First dance & cake",songName:"Etta James – At Last",songLink:"",rsvpBy:"2027-08-15"},
  sr:{partner1:"Ana",partner2:"Stefan",message:"Upoznali smo se uz jednu pesmu, a od tada pišemo zajedničku. Ove jeseni dobija svoj najlepši refren i voleli bismo da ga čujete uživo, sa nama.",date:"2027-09-12",venue:"Vila Maslina",address:"Topčider, Beograd",dressCode:"Svečano",story1Year:"Beograd, 2019.",story1Title:"Prvi takt",story1Text:"Koncert, isti red, ista omiljena pesma i jedan razgovor koji je trajao do jutra.",story2Year:"Kotor, 2022.",story2Title:"Refren",story2Text:"Prvo zajedničko leto, stari grad i ploča koju smo kupili na buvljaku, iako nemamo gramofon.",story3Year:"Lisabon, 2025.",story3Title:"Prsten",story3Text:"Fado u maloj taverni, jedno pitanje i najkraći odgovor na svetu: da.",plan1Time:"17:00",plan1Title:"Doček gostiju",plan2Time:"18:00",plan2Title:"Venčanje",plan3Time:"19:30",plan3Title:"Svečana večera",plan4Time:"22:00",plan4Title:"Prvi ples i torta",songName:"Etta James – At Last",songLink:"",rsvpBy:"2027-08-15"}}},
 cherry:{fields:["name","photo","photo1","photo2","photo3","photo4","date","time","venue","address","dressCode","message","rsvpBy"],def:{
  en:{name:"Ella Petrović",date:"2027-12-23",time:"21:00",venue:"Hotel Moskva terrace bar",address:"Terazije 20, Belgrade",dressCode:"Cherry red",message:"Join us for an evening full of laughter, music and moments we'll remember for a long time.",rsvpBy:"2027-12-10"},
  sr:{name:"Lena Petrović",date:"2027-12-23",time:"21:00",venue:"Hotel Moskva, bar na terasi",address:"Terazije 20, Beograd",dressCode:"Crvena boja",message:"Pridružite nam se na večeri punoj smeha, muzike i trenutaka koje ćemo dugo pamtiti.",rsvpBy:"2027-12-10"}}},
 christening:{fields:["childName","date","time","church","receptionVenue","address","message","hosts","rsvpBy"],def:{
  en:{childName:"Petar",date:"2027-05-02",time:"11:00",church:"St. Sava Church",receptionVenue:"Restaurant Kalemegdan",address:"Krušedolska 2a, Belgrade",message:"With joy in our hearts, we invite you to share in the blessing of our son.",hosts:"Jelena & Nikola",rsvpBy:"2027-04-15"},
  sr:{childName:"Petar",date:"2027-05-02",time:"11:00",church:"Hram Svetog Save",receptionVenue:"Restoran Kalemegdan",address:"Krušedolska 2a, Beograd",message:"Sa radošću u srcu pozivamo vas da sa nama podelite blagoslov našeg sina.",hosts:"Jelena i Nikola",rsvpBy:"2027-04-15"}}},
 celebration:{fields:["occasion","hostNames","date","time","venue","address","dressCode","message","rsvpBy"],def:{
  en:{occasion:"Our 25th Anniversary",hostNames:"Milica & Dragan",date:"2027-10-09",time:"19:30",venue:"Hotel Moskva Ballroom",address:"Terazije 20, Belgrade",dressCode:"Cocktail attire",message:"Twenty-five years of laughter and love. Please join us for an evening of dinner, music and dancing.",rsvpBy:"2027-09-20"},
  sr:{occasion:"Naša 25. godišnjica braka",hostNames:"Milica i Dragan",date:"2027-10-09",time:"19:30",venue:"Hotel Moskva, svečana sala",address:"Terazije 20, Beograd",dressCode:"Koktel",message:"Dvadeset pet godina smeha i ljubavi. Pridružite nam se na večeri uz muziku i ples.",rsvpBy:"2027-09-20"}}}
};
// Mali dino asks for the same details as the other first-birthday story pages
LAYOUT.dino={...LAYOUT.bloom,def:{
 en:{childName:"Luka",age:"1",message:"Our little dino Luka is turning one! Stomp over for cake, games and lots of happy roars.",date:"2027-06-05",time:"17:00",venue:"Jungle Playroom",address:"Mihajla Pupina 10, Novi Sad",birthDate:"2026-06-05",birthTime:"08:20",birthWeight:"3,480 g",birthLength:"52 cm",story1Year:"Month 1",story1Title:"First smile",story1Text:"The first real smile, and the whole house roared with joy.",story2Year:"Month 4",story2Title:"First roll",story2Text:"From back to tummy, like a proper little dinosaur.",story3Year:"Month 8",story3Title:"First tooth",story3Text:"One tiny white tooth and a very serious T-rex grin.",story4Year:"Month 11",story4Title:"First steps",story4Text:"Three wobbly steps and a proud little rawr.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Luka with Mum and Dad",rsvpBy:"2027-05-25"},
 sr:{childName:"Luka",age:"1",message:"Naš mali dino Luka puni prvu godinu! Dođite da zajedno proslavimo uz tortu, igru i mnogo veselog rikanja.",date:"2027-06-05",time:"17:00",venue:"Igraonica Džungla",address:"Mihajla Pupina 10, Novi Sad",birthDate:"2026-06-05",birthTime:"08:20",birthWeight:"3.480 g",birthLength:"52 cm",story1Year:"1. mesec",story1Title:"Prvi osmeh",story1Text:"Prvi pravi osmeh i cela kuća je zaurlala od sreće.",story2Year:"4. mesec",story2Title:"Prvo okretanje",story2Text:"Sa leđa na stomak, kao pravi mali dinosaurus.",story3Year:"8. mesec",story3Title:"Prvi zubić",story3Text:"Jedan mali beli zub i vrlo ozbiljan osmeh malog T-reksa.",story4Year:"11. mesec",story4Title:"Prvi koraci",story4Text:"Tri nesigurna koraka i jedno ponosno „rawr“.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Luka sa mamom i tatom",rsvpBy:"2027-05-25"}}};
const CATS={first:["First birthday","Prvi rođendan"],eighteen:["18th birthday","18. rođendan"],wedding:["Wedding","Venčanje"],other:["Christening & baby","Krštenje i beba"],birthday:["Birthday","Rođendan"]};
const CAT_SUB={birthday:["Birthdays of every age","Rođendani svih uzrasta"],first:["Sweet and cheerful for the very first candle","Slatko i veselo za prvu svećicu"],eighteen:["Grown-up glamour for coming of age","Elegancija za punoletstvo"],wedding:["Timeless stationery for the big day","Bezvremenski dizajn za veliki dan"],other:["Christenings, anniversaries, graduations and more","Krštenja, godišnjice, diplome i još mnogo toga"]};
const catName=c=>pick(CATS[c]);
const fnt=(d,s,b)=>({d,s,b});
/* ---------- packages ---------- */
const TIERS={
 basic:{n:["Basic","Osnovna"],eur:10,rsd:"1.190",tag:["Simple elegance that leaves an impression.","Jednostavna elegancija koja ostavlja utisak."],
  desc:["Everything you need to invite your guests in a modern and special way.","Sve što vam je potrebno da svoje goste pozovete na moderan i poseban način."],
  feat:[["Carefully designed illustrations","Pažljivo osmišljene ilustracije"],["Subtle animations and elegant visual effects","Suptilne animacije i elegantni vizuelni efekti"],["Online RSVP and guest overview","Online potvrda dolaska (RSVP) i pregled gostiju"],["Countdown to the celebration","Odbrojavanje do proslave"],["Interactive location map and add to calendar","Interaktivna mapa lokacije i dodavanje u kalendar"],["A personal link for every guest","Personalizovani link za svakog gosta"]]},
 envelope:{n:["Plus","Plus"],eur:19,rsd:"2.190",tag:["An invitation that surprises the moment it opens.","Pozivnica koja iznenađuje već pri otvaranju."],
  desc:["All the benefits of the Basic package, with an extra touch of elegance and interactivity.","Sve prednosti Osnovnog paketa, uz dodatnu dozu elegancije i interaktivnosti."],
  feat:[["Everything in the Basic package","Sve funkcionalnosti Osnovnog paketa"],["A digital envelope with a wax seal and decorative details","Digitalna koverta sa voštanim pečatom i dekorativnim detaljima"],["An extra card with the programme, dress code, accommodation or gift details","Dodatna kartica sa programom proslave, pravilima oblačenja, informacijama o smeštaju ili poklonima"],["The invitation turns over to show your photo or a personal message on the back","Efekat okretanja pozivnice sa vašom fotografijom ili ličnom porukom na poleđini"],["Preview the opening animation before sending it to guests","Pregled animacije otvaranja pre slanja gostima"]]},
 premium:{n:["Premium","Premium"],eur:26,rsd:"3.090",was:{eur:30,rsd:"3.490"},tag:["More than an invitation. An experience to remember.","Više od pozivnice. Doživljaj koji se pamti."],
  desc:["For those who want every detail of their celebration to be special. A unique digital experience that brings together elegance, emotion and interactivity.","Za one koji žele da svaki detalj njihove proslave bude poseban. Jedinstveno digitalno iskustvo koje spaja eleganciju, emociju i interaktivnost."],
  feat:[["A luxurious interactive opening","Luksuzno interaktivno otvaranje pozivnice"],["A personal page with your story, photos and the programme","Personalizovana stranica sa vašom pričom, fotografijama i programom proslave"],["Music that plays while guests view the invitation","Muzička podloga koja prati pregled pozivnice"],["Countdown to the celebration, interactive map and calendar","Odbrojavanje do proslave, interaktivna mapa i kalendar"],["Personal links for guests and RSVP tracking","Personalizovani linkovi za goste i praćenje potvrda dolaska"],["Download the invitation as a JPG","Mogućnost preuzimanja pozivnice u JPG formatu"]]}
};
const TIER_KEYS=["basic","envelope","premium"];
const tierName=k=>pick(TIERS[k].n);
// a package on sale (was) shows its old price struck through next to the new one
const priceTxt=k=>{const T_=TIERS[k],w=T_.was;return w?`<s class="was">${w.rsd} din · ${w.eur} €</s> <span class="now">${T_.rsd} din · ${T_.eur} €</span>`:`${T_.rsd} din · ${T_.eur} €`};
const rsdTxt=k=>`${TIERS[k].rsd} din${TIERS[k].was?` (${L("sale","akcija")})`:""}`;
// the newest designs come first, newest of all at the front; everything else keeps its usual order
const NEWEST=["p_tale","p_news","e_cherry","e_kiss","b_ruby","p_bow","p_dino","b_lav","b_euca","b_bless","b_dino","b_champ","p_honey"];
const SHOW=()=>{const all=T.filter(t=>TIER_KEYS.includes(t.tier)&&!t.off);return[...NEWEST.map(id=>all.find(t=>t.id===id)).filter(Boolean),...all.filter(t=>!NEWEST.includes(t.id))]};
// the home page collection starts with these, then the rest of the designs follow
const RAIL_FIRST=["b_esp","p_gold","p_rip","p_honey"];
const RAIL=()=>{const all=SHOW();return[...RAIL_FIRST.map(id=>all.find(t=>t.id===id)).filter(Boolean),...all.filter(t=>!RAIL_FIRST.includes(t.id))]};
let PAYCFG={recipient:"",account:"",bank:"",phone:"",note:""};
const T=[
 {id:"b_esp",tier:"basic",cat:"birthday",layout:"picture",art:"esp",fx:"",motif:"art",kind:"picture",ttl:["{n}'s 22nd birthday","{n} – 22. rođendan"],def:{en:{childName:"Kristina",date:"2026-04-11",time:"19:00",venue:"Belleville Yacht Club",address:"831 E Huron River Dr., Van Buren Twp",rsvpBy:"2026-04-04"},sr:{childName:"Kristina",date:"2026-04-11",time:"19:00",venue:"Belleville Yacht Club",address:"831 E Huron River Dr., Van Buren Twp",rsvpBy:"2026-04-04"}},labels:{childName:["Name","Ime"]},name:["Espresso martini","Espreso martini"],tag:["A watercolour espresso martini with a black satin bow, for a grown-up birthday","Akvarelni espreso martini sa crnom satenskom mašnom, za rođendan odraslih"],pal:{bg:"#FBF9F6",bg2:"#EFE6DC",ink:"#1C1A18",accent:"#7A4A2A",soft:"#EFE6DC",x1:"#7A4A2A",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Cormorant Garamond',serif")},
 {id:"b_sea",tier:"basic",cat:"birthday",layout:"picture",art:"sea",fx:"twinkle",motif:"art",kind:"picture",ttl:["{n}'s 4th birthday","{n} – 4. rođendan"],fields:["hKick","hName","hAge","hOcc","date","time","venue","address","rsvpBy"],def:{en:{hKick:"You are invited to",hName:"Irina's",hAge:"4th",hOcc:"Birthday",date:"2027-07-17",time:"15:30",venue:"Igraonica Klinci",address:"Ulica 123, Belgrade",rsvpBy:""},sr:{hKick:"Pozivamo vas na",hName:"Irinin",hAge:"4.",hOcc:"Rođendan",date:"2027-07-17",time:"15:30",venue:"Igraonica Klinci",address:"Ulica 123, Beograd",rsvpBy:""}},name:["Under the sea","Morska bajka"],tag:["A watercolour sea with a mermaid tail, whale, dolphins and a pearl shell","Akvarelno more sa repom sirene, kitom, delfinima i školjkom sa biserom"],pal:{bg:"#F3E9F5",bg2:"#E2F2F2",ink:"#1F4FA8",accent:"#8E5BB0",soft:"#E2F2F2",x1:"#8E5BB0",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Cormorant Garamond',serif")},
 {id:"b_ilija",tier:"basic",cat:"first",layout:"picture",art:"ilija",fx:"twinkle",motif:"art",kind:"picture",name:["Carousel","Vrtuljak"],tag:["A watercolour carousel with balloons and horses, for a first birthday and christening","Akvarelni vrtuljak sa balonima i konjićima, za prvi rođendan i krštenje"],pal:{bg:"#FBF8F3",bg2:"#E4ECF4",ink:"#4E6E8E",accent:"#B08A5A",soft:"#E4ECF4",x1:"#B08A5A",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Cormorant Garamond',serif")},
 {id:"b_rose",tier:"basic",cat:"wedding",layout:"wedding",art:"b1",fx:"petals",motif:"art",kind:"bas",def:{en:{partner1:"Ana",partner2:"Stefan",hosts:"Together with their families",message:"request the pleasure of your company\nat the celebration of their marriage",date:"2027-09-11",ceremonyTime:"15:00",ceremonyVenue:"St. Mark's Church",receptionTime:"18:00",receptionVenue:"Villa Maria",address:"Tašmajdan Park, Belgrade",dressCode:"Formal",rsvpBy:"2027-08-01"},sr:{partner1:"Ana",partner2:"Stefan",hosts:"Zajedno sa svojim porodicama",message:"imaju čast i zadovoljstvo da vas pozovu\nna proslavu svog venčanja",date:"2027-09-11",ceremonyTime:"15:00",ceremonyVenue:"Crkva Svetog Marka",receptionTime:"18:00",receptionVenue:"Vila Marija",address:"Tašmajdanski park, Beograd",dressCode:"Svečano",rsvpBy:"2027-08-01"}},name:["White Rose","Bela ruža"],tag:["Watercolour garden roses and eucalyptus, with your names in an elegant hand and petals drifting over the card","Akvarel baštenskih ruža i eukaliptusa, sa vašim imenima ispisanim krasopisom i laticama koje padaju preko pozivnice"],pt:30,pb:20,pl:22,pr:8,pal:{bg:"#F7F1E6",bg2:"#EADFCB",ink:"#3B3A33",accent:"#97804F",soft:"#E8DFCC",x1:"#97804F",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Bodoni Moda',serif","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"b_olive",tier:"basic",cat:"wedding",layout:"wedding",art:"b2",fx:"dust",motif:"art",kind:"bas",def:{en:{partner1:"Milica",partner2:"Nikola",hosts:"Save the date",message:"We are getting married by the sea and would love to celebrate with you.",date:"2027-06-12",ceremonyTime:"17:00",ceremonyVenue:"Church of St. Sava, Budva",receptionTime:"19:30",receptionVenue:"Restaurant Maslina",address:"Old Town, Budva",dressCode:"Summer elegant",rsvpBy:"2027-05-15"},sr:{partner1:"Milica",partner2:"Nikola",hosts:"Sačuvajte datum",message:"Venčavamo se uz more i voleli bismo da ovaj dan proslavimo sa vama.",date:"2027-06-12",ceremonyTime:"17:00",ceremonyVenue:"Crkva Svetog Save, Budva",receptionTime:"19:30",receptionVenue:"Restoran Maslina",address:"Stari grad, Budva",dressCode:"Letnje elegantno",rsvpBy:"2027-05-15"}},name:["Olive Branch","Maslinova grana"],tag:["Mediterranean olives on linen paper, with a modern layout for a wedding by the sea","Mediteranske masline na lanenom papiru, u modernom rasporedu za venčanje uz more"],pt:14,pb:12,pl:11,pr:30,pal:{bg:"#F4F1E8",bg2:"#E5E0CF",ink:"#39402F",accent:"#6E7B4B",soft:"#DDE2CC",x1:"#6E7B4B",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"b_bunny",tier:"basic",cat:"first",layout:"first",art:"b3",fx:"balloons",motif:"art",kind:"bas",name:["Bunny & Balloons","Zeka i baloni"],tag:["A soft watercolour bunny with pastel balloons, for a first birthday, with a little balloon that floats on the card","Nežni zeka u akvarelu sa pastelnim balonima, za prvi rođendan, sa balončićem koji lebdi na pozivnici"],pt:6,pb:22,pl:38,pr:5,pal:{bg:"#FBEDEC",bg2:"#F3D3D2",ink:"#6B4450",accent:"#C98B8F",soft:"#F3D3D2",x1:"#C98B8F",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Playfair Display',serif","'Parisienne',cursive","'Quicksand',sans-serif")},
 {id:"b_balloon",tier:"basic",off:1,cat:"first",layout:"first",art:"b4",fx:"clouds",motif:"art",kind:"soft",name:["Up & Away","Leteći balon"],tag:["Vintage hot-air balloons among the clouds","Baloni na vrući vazduh među oblacima"],pt:38,pb:17,pl:12,pr:12,pal:{bg:"#EEF3F6",bg2:"#D7E3EC",ink:"#2F4A5E",accent:"#6E8FA8",soft:"#D7E3EC",x1:"#6E8FA8",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Playfair Display',serif","'Great Vibes',cursive","'Quicksand',sans-serif")},
 {id:"b_gold",tier:"basic",cat:"eighteen",layout:"eighteen",art:"b5",fx:"stars",motif:"art",kind:"bas",name:["Golden Night","Zlatna noć"],tag:["Black cardstock with shimmering gold confetti and a gold-foil 18 that catches the light","Crni karton sa zlatnim konfetama i zlatnim brojem 18 koji se presijava"],pt:17,pb:15,pl:16,pr:16,pal:{bg:"#0B0B0B",bg2:"#1A1A1A",ink:"#F3E9D2",accent:"#D9B26A",soft:"#7E6A44",x1:"#D9B26A",x2:"#F3E9D2",x3:"#000000"},font:fnt("'Bodoni Moda',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"b_dove",tier:"basic",cat:"wedding",layout:"wedding",art:"b6",fx:"dust",motif:"art",kind:"bas",def:{en:{partner1:"Jelena",partner2:"Marko",hosts:"With joy in our hearts",message:"we invite you to share the day\nwe say \"I do\"",date:"2027-05-22",ceremonyTime:"16:00",ceremonyVenue:"Church of St. George",receptionTime:"19:00",receptionVenue:"Hotel Crystal Garden",address:"Bulevar Kralja Aleksandra 12, Belgrade",dressCode:"Formal, light colours",rsvpBy:"2027-05-01"},sr:{partner1:"Jelena",partner2:"Marko",hosts:"S radošću u srcu",message:"pozivamo vas da sa nama podelite\ndan kada kažemo „da“",date:"2027-05-22",ceremonyTime:"16:00",ceremonyVenue:"Crkva Svetog Đorđa",receptionTime:"19:00",receptionVenue:"Hotel Kristalni vrt",address:"Bulevar kralja Aleksandra 12, Beograd",dressCode:"Svečano, svetle boje",rsvpBy:"2027-05-01"}},name:["Dove","Golubica"],tag:["A white dove and baby's breath in soft blue, for a gentle, classic wedding","Bela golubica i gipsofila u nežno plavoj, za nežno, klasično venčanje"],pt:28,pb:22,pl:13,pr:13,pal:{bg:"#F2F6FA",bg2:"#DCE6F0",ink:"#33465C",accent:"#7F9DBD",soft:"#CBDCEC",x1:"#B9A26A",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"b_lav",tier:"basic",cat:"wedding",layout:"wedding",art:"blav",fx:"dust",motif:"art",kind:"bas",def:{en:{partner1:"Sara",partner2:"Vuk",hosts:"Together with their families",message:"invite you to celebrate their wedding\namong the lavender",date:"2027-07-03",ceremonyTime:"17:00",ceremonyVenue:"Chapel of St. Peter",receptionTime:"19:30",receptionVenue:"Lavender Estate Vršac",address:"Vinogradarska 4, Vršac",dressCode:"Summer formal",rsvpBy:"2027-06-10"},sr:{partner1:"Sara",partner2:"Vuk",hosts:"Zajedno sa svojim porodicama",message:"vas pozivaju da proslavite njihovo venčanje\nmeđu lavandama",date:"2027-07-03",ceremonyTime:"17:00",ceremonyVenue:"Kapela Svetog Petra",receptionTime:"19:30",receptionVenue:"Imanje Lavanda, Vršac",address:"Vinogradarska 4, Vršac",dressCode:"Letnje svečano",rsvpBy:"2027-06-10"}},name:["Lavender","Lavanda"],tag:["Watercolour Provence lavender with delicate lilac lettering, for a summer wedding","Akvarel provansalske lavande sa nežnim lila slovima, za letnje venčanje"],pt:23,pb:32,pl:12,pr:12,pal:{bg:"#F8F4EE",bg2:"#ECE6F0",ink:"#4E4762",accent:"#8A7BB0",soft:"#ECE6F0",x1:"#8A7BB0",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"b_euca",tier:"basic",cat:"wedding",layout:"wedding",art:"beuca",fx:"dust",motif:"art",kind:"bas",def:{en:{partner1:"Katarina",partner2:"Filip",hosts:"Please join us for the wedding of",message:"",date:"2027-10-09",ceremonyTime:"16:00",ceremonyVenue:"Church of St. Nicholas",receptionTime:"19:00",receptionVenue:"Hotel Metropol",address:"Bulevar kralja Aleksandra 69, Belgrade",dressCode:"Black tie",rsvpBy:"2027-09-15"},sr:{partner1:"Katarina",partner2:"Filip",hosts:"Pozivamo vas na venčanje",message:"",date:"2027-10-09",ceremonyTime:"16:00",ceremonyVenue:"Crkva Svetog Nikole",receptionTime:"19:00",receptionVenue:"Hotel Metropol",address:"Bulevar kralja Aleksandra 69, Beograd",dressCode:"Svečano",rsvpBy:"2027-09-15"}},name:["Eucalyptus","Eukaliptus"],tag:["Watercolour eucalyptus over a fine gold arch, a modern and minimal wedding","Akvarel eukaliptusa preko tankog zlatnog luka, za moderno i jednostavno venčanje"],pt:34,pb:34,pl:18,pr:18,pal:{bg:"#FAF8F4",bg2:"#E6ECE6",ink:"#2F3A34",accent:"#B59650",soft:"#E6ECE6",x1:"#B59650",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Gilda Display',serif","'Mrs Saint Delafield',cursive","'Jost',sans-serif")},
 {id:"b_bless",tier:"basic",cat:"other",layout:"christening",art:"bbless",fx:"dust",motif:"art",kind:"bas",def:{en:{childName:"Andrej",date:"2027-04-18",time:"11:00",church:"Church of St. Sava",receptionVenue:"Restaurant Zlatni bokal",address:"Skadarska 26, Belgrade",message:"With joy and gratitude we invite you to share the day of our son's baptism.",hosts:"Milica and Stefan",rsvpBy:"2027-04-05"},sr:{childName:"Andrej",date:"2027-04-18",time:"11:00",church:"Hram Svetog Save",receptionVenue:"Restoran Zlatni bokal",address:"Skadarska 26, Beograd",message:"Sa radošću i zahvalnošću pozivamo vas da sa nama podelite dan krštenja našeg sina.",hosts:"Milica i Stefan",rsvpBy:"2027-04-05"}},name:["Blessing","Blagoslov"],tag:["A wreath of white roses and baby's breath around a small gold cross, for a christening","Venac belih ruža i gipsofile oko malog zlatnog krstića, za krštenje"],pt:47,pb:16,pl:13,pr:13,pal:{bg:"#F6F9FC",bg2:"#E3ECF4",ink:"#34465A",accent:"#B39556",soft:"#E3ECF4",x1:"#B39556",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"b_dino",tier:"basic",cat:"birthday",layout:"balloon",art:"bdino",fx:"",motif:"art",kind:"bas",fields:["childName","age","date","time","venue","address","message","hosts","rsvpBy"],def:{en:{childName:"Luka",age:"5",date:"2027-05-15",time:"17:00",venue:"Dino Park Playroom",address:"Vojvode Stepe 120, Belgrade",message:"Stomp, roar and party with us! There will be cake, games and lots of dinosaur fun.",hosts:"Mum and Dad",rsvpBy:"2027-05-05"},sr:{childName:"Luka",age:"5",date:"2027-05-15",time:"17:00",venue:"Igraonica Dino park",address:"Vojvode Stepe 120, Beograd",message:"Dođi da tapkamo, ričemo i slavimo zajedno! Čekaju nas torta, igre i mnogo dino zabave.",hosts:"Mama i tata",rsvpBy:"2027-05-05"}},labels:{hosts:["Signed by","Potpis"]},name:["Dino Party","Dino žurka"],tag:["Friendly watercolour dinosaurs among palm trees, for a kids' birthday of any age","Simpatični akvarelni dinosaurusi među palmama, za dečji rođendan bilo kog uzrasta"],pt:9,pb:66,pl:10,pr:10,pal:{bg:"#FBF7EC",bg2:"#E7F0E2",ink:"#2F4A33",accent:"#E28A3A",soft:"#E7F0E2",x1:"#E28A3A",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Baloo 2',sans-serif","'Caveat',cursive","'Baloo 2',sans-serif")},
 {id:"b_champ",tier:"basic",cat:"birthday",layout:"era",art:"bchamp",fx:"stars",motif:"art",kind:"bas",fields:["name","age","date","time","venue","address","dressCode","message","rsvpBy"],def:{en:{name:"Jelena",age:"40",date:"2027-11-13",time:"20:00",venue:"Rooftop Lounge Skyline",address:"Kneza Miloša 2, Belgrade",dressCode:"Cocktail chic",message:"Forty years, one sparkling night. Raise a glass with me!",rsvpBy:"2027-11-01"},sr:{name:"Jelena",age:"40",date:"2027-11-13",time:"20:00",venue:"Rooftop Lounge Skyline",address:"Kneza Miloša 2, Beograd",dressCode:"Koktel elegancija",message:"Četrdeset godina, jedno penušavo veče. Podignite čašu sa mnom!",rsvpBy:"2027-11-01"}},name:["Champagne","Šampanjac"],tag:["Two champagne glasses in a toast with gold confetti, for a grown-up birthday of any age","Dve čaše šampanjca u zdravici uz zlatne konfete, za rođendan odraslih bilo koje godine"],pt:11,pb:28,pl:11,pr:30,pal:{bg:"#FBEEEA",bg2:"#F4DCD4",ink:"#4A2F2C",accent:"#B8924C",soft:"#F4DCD4",x1:"#B8924C",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Bodoni Moda',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"b_ruby",tier:"basic",cat:"eighteen",layout:"eighteen",art:"bruby",fx:"stars",motif:"art",kind:"bas",fields:["name","age","date","time","venue","address","message","rsvpBy"],def:{en:{name:"Anabela",age:"18",date:"2027-02-06",time:"20:30",venue:"Restoran Aura",address:"Bulevar kralja Aleksandra 15, Belgrade",message:"I can't wait to celebrate with you!",rsvpBy:"2027-01-25"},sr:{name:"Anabela",age:"18",date:"2027-02-06",time:"20:30",venue:"Restoran Aura",address:"Bulevar kralja Aleksandra 15, Beograd",message:"Jedva čekam da proslavimo zajedno!",rsvpBy:"2027-01-25"}},labels:{age:["Which birthday","Koji rođendan"]},name:["Burgundy Glow","Bordo sjaj"],tag:["Burgundy silk, rose-gold glitter, a giant glittering number and a hand-written 'Birthday' that writes itself as the invitation opens","Bordo svila, ružičasto-zlatne šljokice, veliki svetlucavi broj i reč „Rođendan“ koja se sama ispisuje dok se pozivnica otvara"],pt:61,pb:5,pl:27,pr:5,pal:{bg:"#2A0A10",bg2:"#3D1018",ink:"#F3E6DA",accent:"#D4A46E",soft:"#5A2630",x1:"#D4A46E",x2:"#F3E6DA",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Mrs Saint Delafield',cursive","'Jost',sans-serif")},
 {id:"e_estate",tier:"envelope",exp:"plus",op:"gates",cat:"wedding",layout:"estate",art:"estate",liner:"l6",seal:"seal2",fx:"dust",env:"#ECE5D6",motif:"art",kind:"estate",name:["The Estate","Imanje"],tag:["A laurel crest with your monogram and a manor garden at dusk, in an ivory envelope with a gold seal","Lovorov grb sa vašim inicijalima i vrt starog imanja, u krem koverti sa zlatnim pečatom"],pt:43,pb:55,pl:11,pr:11,pal:{bg:"#F6F0E3",bg2:"#ECE5D6",ink:"#3D4630",accent:"#A88A4E",soft:"#E7E0CC",x1:"#A88A4E",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cinzel',serif","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"e_lemon",tier:"envelope",exp:"plus",op:"shutters",cat:"wedding",layout:"estate",art:"lemon",liner:"l7",seal:"seal2",fx:"dust",env:"#2C4A8E",motif:"art",kind:"estate",def:{en:{partner1:"Milica",p1Last:"Petrović",partner2:"Luka",p2Last:"Jovanović",date:"2028-06-17",ceremonyTime:"18:00",ceremonyVenue:"Villa Limun",address:"12 Pet Danica Promenade, Herceg Novi",estLine:"Celebration by the sea to follow",rsvpBy:"2028-05-15",backMsg:"See you by the sea!",dayPlan:"18:00 Ceremony on the terrace\n19:00 Sunset cocktails\n20:30 Dinner\n22:00 Cake and dancing",dressCode:"Summer elegant, light colours",stay:"We recommend staying in Herceg Novi. We are happy to help with bookings.",gifts:"Having you with us is the best gift. If you would like to give something, a contribution to our honeymoon would make us very happy."},sr:{partner1:"Milica",p1Last:"Petrović",partner2:"Luka",p2Last:"Jovanović",date:"2028-06-17",ceremonyTime:"18:00",ceremonyVenue:"Vila Limun",address:"Šetalište pet Danica 12, Herceg Novi",estLine:"Proslava uz more nakon venčanja",rsvpBy:"2028-05-15",backMsg:"Vidimo se uz more!",dayPlan:"18:00 Venčanje na terasi\n19:00 Koktel uz zalazak sunca\n20:30 Večera\n22:00 Torta i ples",dressCode:"Letnje elegantno, svetle boje",stay:"Preporučujemo smeštaj u Herceg Novom. Rado ćemo vam pomoći oko rezervacije.",gifts:"Najlepši poklon je da budete sa nama. Ako želite da nas darujete, biće nam drago da nam pomognete za medeni mesec."}},name:["Lemon Tiles","Limunovi"],tag:["Blue Mediterranean tiles and lemon branches, in a cobalt envelope with a gold seal","Plave mediteranske pločice i grane limuna, u kobalt koverti sa zlatnim pečatom"],pt:30,pb:44,pl:13,pr:13,pal:{bg:"#FBFAF6",bg2:"#E6ECF7",ink:"#1F3F8F",accent:"#C79A1E",soft:"#E6ECF7",x1:"#C79A1E",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Parisienne',cursive","'Cormorant Garamond',serif")},
 {id:"e_rouge",tier:"envelope",exp:"plus",op:"box",cat:"wedding",layout:"estate",art:"rouge",liner:"l8",seal:"seal2",fx:"petals",env:"#5B1524",motif:"art",kind:"estate",def:{en:{partner1:"Jelena",p1Last:"Marković",partner2:"Nikola",p2Last:"Đorđević",date:"2027-12-11",ceremonyTime:"19:00",ceremonyVenue:"Zlatni Dvor Restaurant",address:"12 Kneza Miloša, Belgrade",estLine:"Dinner and dancing until dawn",rsvpBy:"2027-11-15",backMsg:"Thank you for being part of our story.",dayPlan:"19:00 Welcome and champagne\n19:30 Ceremony\n20:30 Dinner\n22:00 First dance",dressCode:"Black tie, dark and burgundy shades",stay:"We have arranged a discount at a hotel in central Belgrade for guests from out of town.",gifts:"Your presence is the best gift. If you would like to give something, a contribution towards our first home would make us very happy."},sr:{partner1:"Jelena",p1Last:"Marković",partner2:"Nikola",p2Last:"Đorđević",date:"2027-12-11",ceremonyTime:"19:00",ceremonyVenue:"Restoran Zlatni dvor",address:"Kneza Miloša 12, Beograd",estLine:"Uz večeru i ples do zore",rsvpBy:"2027-11-15",backMsg:"Hvala što ste deo naše priče.",dayPlan:"19:00 Doček gostiju i šampanjac\n19:30 Venčanje\n20:30 Svečana večera\n22:00 Prvi ples",dressCode:"Black tie, tamne i bordo nijanse",stay:"Za goste iz drugih gradova obezbedili smo popust u hotelu u centru Beograda.",gifts:"Vaše prisustvo je najlepši poklon. Ako želite da nas darujete, biće nam drago da nam pomognete da uštedimo za zajednički dom."}},name:["Burgundy Roses","Bordo ruže"],tag:["Dark roses and gold lines on burgundy paper, for an evening wedding","Tamne ruže i zlatne linije na bordo papiru, za večernje venčanje"],pt:33,pb:36,pl:15,pr:15,pal:{bg:"#5B1524",bg2:"#3E0E19",ink:"#F3E6D3",accent:"#D4AF6A",soft:"#7A2433",x1:"#D4AF6A",x2:"#F3E6D3",x3:"#000000"},font:fnt("'Playfair Display',serif","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
  {id:"e_peony",tier:"envelope",exp:"plus",op:"bloom",cat:"wedding",layout:"wedding",art:"e1",liner:"l1",seal:"seal1",fx:"petals",env:"#EFE2D8",motif:"art",kind:"classic",name:["Peony Garden","Vrt božura"],tag:["Blush peonies, a burgundy seal and falling petals","Rozi božuri, bordo pečat i latice koje padaju"],pt:33,pb:22,pl:19,pr:12,pal:{bg:"#F8F2EA",bg2:"#EFE2D8",ink:"#4B3A3A",accent:"#A8636E",soft:"#F0D5D6",x1:"#A8636E",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Pinyon Script',cursive","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"e_night",tier:"envelope",exp:"plus",op:"clock",cat:"eighteen",layout:"eighteen",art:"e2",liner:"l2",seal:"seal2",fx:"stars",env:"#161B30",motif:"art",kind:"deco",name:["Midnight","Ponoć"],tag:["A gold-sealed navy envelope and a twinkling sky","Teget koverta sa zlatnim pečatom i zvezdano nebo"],pt:24,pb:22,pl:11,pr:11,pal:{bg:"#0D1222",bg2:"#161B30",ink:"#F1E8D0",accent:"#D8B46A",soft:"#6E6340",x1:"#D8B46A",x2:"#F1E8D0",x3:"#000000"},font:fnt("'Cinzel',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"e_lamb",tier:"envelope",exp:"plus",op:"clouds",cat:"other",layout:"christening",art:"e3",liner:"l3",seal:"seal3",fx:"clouds",env:"#D9E5F1",motif:"art",kind:"classic",name:["Little Cloud","Oblačak"],tag:["A sleeping lamb on a cloud, for christenings and babies","Uspavano jagnje na oblaku, za krštenja i bebe"],pt:19,pb:37,pl:11,pr:11,pal:{bg:"#EEF4FA",bg2:"#D9E5F1",ink:"#34506A",accent:"#7E9CBA",soft:"#CBDCEC",x1:"#B9A26A",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Playfair Display',serif","'Great Vibes',cursive","'Quicksand',sans-serif")},
 {id:"e_picnic",tier:"envelope",exp:"plus",op:"napkin",cat:"first",layout:"first",art:"e4",liner:"l4",seal:"seal4",fx:"dust",env:"#E6E1CB",motif:"art",kind:"bas",name:["Teddy Picnic","Medeni piknik"],tag:["A teddy bear and bunny picnic: the invitation arrives wrapped in a gingham napkin that unfolds when the seal is touched","Piknik medveda i zeke: pozivnica stiže umotana u kockastu salvetu koja se razmota kada dodirnete pečat"],pt:5,pb:50,pl:9,pr:9,pal:{bg:"#FBF5E6",bg2:"#E6E1CB",ink:"#5A4632",accent:"#8C9B6B",soft:"#E4E8D5",x1:"#C99A55",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Playfair Display',serif","'Parisienne',cursive","'Quicksand',sans-serif")},
 {id:"e_lace",tier:"envelope",exp:"plus",op:"lace",cat:"wedding",layout:"lace",opener:"lace",art:"lacecard",motif:"art",kind:"lace",name:["White Lace","Bela čipka"],tag:["Burgundy paper under white lace: guests break the seal and the lace slides away to reveal gold calligraphy","Bordo papir pod belom čipkom: gost lomi pečat, čipka klizi i otkriva zlatnu kaligrafiju"],pt:15,pb:13,pl:15,pr:15,pal:{bg:"#6E1E2A",bg2:"#4E1420",ink:"#F1DDA8",accent:"#D9B26A",soft:"#8A2E3B",x1:"#D9B26A",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Cormorant Garamond',serif","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"e_disco",tier:"envelope",exp:"plus",op:"tinsel",cat:"birthday",layout:"disco",art:"dc",liner:"l5",seal:"seal5",fx:"disco",env:"#D8D9DC",motif:"art",kind:"disco",name:["Disco Night","Disko veče"],tag:["Mirror balls, silver tinsel and chrome numbers, for birthdays and anniversaries","Disko kugle, srebrne rese i hromirani brojevi, za rođendane i jubileje"],pt:8,pb:7,pl:15,pr:15,pal:{bg:"#F4F1EC",bg2:"#DCDBD8",ink:"#141414",accent:"#3A3A3D",soft:"#E6E4E0",x1:"#9A9CA1",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Bodoni Moda',serif","'Great Vibes',cursive","'Playfair Display',serif")},
 {id:"e_kiss",tier:"envelope",exp:"plus",op:"kiss",cat:"eighteen",layout:"eighteen",art:"ksbg",liner:"kspaper",seal:"kslips",fx:"",env:"#EFE7DA",motif:"art",kind:"bas",fields:["name","age","photo","date","time","venue","address","rsvpBy","backMsg","dayPlan","dressCode"],labels:{age:["Which birthday","Koji rođendan"],photo:["Childhood photo (optional)","Fotografija iz detinjstva (nije obavezno)"]},def:{en:{name:"Nina",age:"18",photo:"",date:"2027-08-18",time:"20:00",venue:"Restaurant Sjaj",address:"Kneza Mihaila 12, Belgrade",rsvpBy:"2027-08-08",backMsg:"One night, lots of sparkle and the best company. Don't miss it!",dayPlan:"20:00 Welcome drinks\n21:00 Dinner\n22:30 Cake\n23:00 Disco until dawn",dressCode:"Red, silver and sparkly"},sr:{name:"Nina",age:"18",photo:"",date:"2027-08-18",time:"20:00",venue:"Restoran Sjaj",address:"Kneza Mihaila 12, Beograd",rsvpBy:"2027-08-08",backMsg:"Jedna noć, puno sjaja i najbolje društvo. Ne propustite!",dayPlan:"20:00 Doček gostiju\n21:00 Večera\n22:30 Torta\n23:00 Disko do zore",dressCode:"Crveno, srebrno i sjajno"}},name:["Disco Kiss","Disko poljubac"],tag:["A collage of silver sequins, a red lipstick kiss, chrome balloon numbers and your childhood photo in a party hat, sealed in an envelope with a kiss","Kolaž srebrnih šljokica, crvenog poljupca, hromiranih balona sa brojem i vaše fotografije iz detinjstva sa kapicom, u koverti zapečaćenoj poljupcem"],pt:57,pb:40,pl:15,pr:15,pal:{bg:"#F7F1E6",bg2:"#EFE7DA",ink:"#8B1A14",accent:"#A3231A",soft:"#E9DFD0",x1:"#A3231A",x2:"#FFFFFF",x3:"#C9CCD3"},font:fnt("'Playfair Display',serif","'Great Vibes',cursive","'Lora',serif")},
 {id:"e_cherry",tier:"envelope",exp:"plus",op:"kiss",hint:["Touch the bow to open the envelope","Dodirnite mašnu da otvorite kovertu"],cat:"birthday",layout:"eighteen",art:"chbg",liner:"chsatin",seal:"chbow",fx:"",env:"#141012",motif:"art",kind:"bas",fields:["name","date","time","venue","address","rsvpBy","backMsg","dayPlan","dressCode"],def:{en:{name:"Lana Petrović",date:"2027-09-18",time:"19:00",venue:"Lounge bar Trešnja",address:"Strahinjića bana 21, Belgrade",rsvpBy:"2027-09-08",backMsg:"Bring your red dress and your best mood, an unforgettable night is waiting for us!",dayPlan:"19:00 Welcome cocktails\n20:30 Dinner\n22:00 Cake\n22:30 Party",dressCode:"Black and red"},sr:{name:"Lana Petrović",date:"2027-09-18",time:"19:00",venue:"Lounge bar Trešnja",address:"Strahinjića bana 21, Beograd",rsvpBy:"2027-09-08",backMsg:"Spremite crvenu haljinu i dobro raspoloženje, čeka nas nezaboravno veče!",dayPlan:"19:00 Doček i kokteli\n20:30 Večera\n22:00 Torta\n22:30 Žurka",dressCode:"Crno i crveno"}},name:["Cherries & Satin","Trešnje i saten"],tag:["Black and burgundy with satin bows, glitter kisses and cherry martinis, in a black envelope tied with a satin bow","Crno i bordo, sa satenskim mašnama, šljokičastim poljupcima i martinijem sa trešnjom, u crnoj koverti sa satenskom mašnom"],pt:17,pb:8,pl:16,pr:16,pal:{bg:"#140B0D",bg2:"#211014",ink:"#EADCD3",accent:"#B3222A",soft:"#3A1A20",x1:"#B3222A",x2:"#EADCD3",x3:"#7A1520"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Lora',serif")},
 {id:"p_letter",tier:"premium",cat:"wedding",layout:"letter",exp:"letter",motif:"art",kind:"letter",name:["Love Letter","Ljubavno pismo"],tag:["A wedding told as old-century letters: guests untie the bundle, break the wax seal and watch your letter being written in ink, then your story in letters, the programme and a telegram with the details","Venčanje ispričano kao prepiska iz prošlog veka: gost odvezuje svežanj pisama, lomi voštani pečat i gleda kako se vaše pismo ispisuje mastilom, a zatim vaša priča u pismima, program i telegram sa detaljima"],pt:8,pb:8,pl:8,pr:8,pal:{bg:"#1B120C",bg2:"#3D2618",ink:"#2B1B10",accent:"#7A1E22",soft:"#ECDCB8",x1:"#7A1E22",x2:"#ECDCB8",x3:"#CFA862"},font:fnt("'Cormorant Garamond',serif","'Parisienne',cursive","'Cormorant Garamond',serif")},
 {id:"p_rip",tier:"premium",cat:"birthday",layout:"rip",exp:"rip",photos:true,art:"rpcard",motif:"art",kind:"rip",name:["RIP Twenties","R.I.P. dvadesete"],tag:["A witty 30th: guests light a candle to see off your twenties, read a cheerful obituary, remember the best years, and the party ends in gold confetti","Duhovit 30. rođendan: gost pali svećicu i ispraća vaše dvadesete, čita veselu čitulju, seća se najboljih godina, a sve se završava zlatnim konfetama"],pt:9,pb:9,pl:13,pr:13,pal:{bg:"#0F0E0E",bg2:"#1A1717",ink:"#EDE6DA",accent:"#C9A45C",soft:"#221E1D",x1:"#C9A45C",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Cinzel',serif","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"p_bloom",tier:"premium",cat:"first",layout:"bloom",exp:"bloom",photos:true,art:"blcard",motif:"art",kind:"bloom",name:["Little Bloom","Mali cvet"],tag:["A first birthday in blush flowers: guests open a seed packet and petals burst out, how she grew on garden tags, her first year as a blooming stem, photos in arched frames and a countdown","Prvi rođendan u nežnom cveću: gost otvara kesicu semena i iz nje izleti latice, kako je rasla na baštenskim etiketama, prva godina kao stabljika koja cveta, fotografije u lučnim ramovima i odbrojavanje"],pt:9,pb:9,pl:13,pr:13,pal:{bg:"#FBF3EE",bg2:"#F3DCD8",ink:"#7E5258",accent:"#C98B92",soft:"#F7E6E3",x1:"#C98B92",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Playfair Display',serif","'Parisienne',cursive","'Quicksand',sans-serif")},
 {id:"p_plane",tier:"premium",cat:"first",layout:"plane",exp:"plane",photos:true,art:"plcard",motif:"art",kind:"plane",name:["First Flight","Prvi let"],tag:["A first birthday for a little pilot: guests tear their boarding pass to take off, flight details of the birth, first-year route, photos in plane windows and a countdown to take-off","Prvi rođendan za malog pilota: gost otkida kartu za ukrcavanje i poleće, podaci o letu od rođenja, ruta prve godine, fotografije u prozorima aviona i odbrojavanje do poletanja"],pt:9,pb:9,pl:13,pr:13,pal:{bg:"#FBF6EC",bg2:"#DCE8F2",ink:"#3E5A78",accent:"#B5643C",soft:"#E8F0F6",x1:"#B5643C",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Fredoka',sans-serif","'Caveat',cursive","'Quicksand',sans-serif")},
 {id:"p_honey",tier:"premium",cat:"first",layout:"honey",exp:"honey",photos:true,art:"hycard",motif:"art",kind:"honey",name:["Little Bee","Mala pčelica"],tag:["A first birthday with a little bee: she wakes on a daisy and flies you into the invitation, birth details, first-year moments, photos and a countdown to the party","Prvi rođendan sa malom pčelicom: budi se na cvetu i odvodi vas do pozivnice, podaci o rođenju, prvi trenuci, fotografije i odbrojavanje do žurke"],pt:9,pb:9,pl:13,pr:13,pal:{bg:"#FBF4E3",bg2:"#F3E2B8",ink:"#5A3E1E",accent:"#C98A1B",soft:"#F6E7C1",x1:"#C98A1B",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Playfair Display',serif","'Parisienne',cursive","'Quicksand',sans-serif")},
 {id:"p_dino",tier:"premium",cat:"first",layout:"dino",exp:"dino",photos:true,art:"pdcard",motif:"art",kind:"bas",name:["Little Dino","Mali dino"],tag:["A first birthday for a little dino: tap the egg until it hatches, jungle leaves sweep in the invitation, then birth details, a trail of first-year footprints, photos and music","Prvi rođendan za malog dinosaurusa: kucnite jaje dok se ne izlegne, lišće džungle donosi pozivnicu, a zatim podaci o rođenju, tragovi prve godine, fotografije i muzika"],pt:19,pb:62,pl:11,pr:11,pal:{bg:"#F6F2E2",bg2:"#E4ECD8",ink:"#34452F",accent:"#4F7A45",soft:"#E4ECD8",x1:"#C9A46A",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Fredoka',sans-serif","'Caveat',cursive","'Quicksand',sans-serif")},
 {id:"p_news",tier:"premium",cat:"birthday",layout:"eighteen",exp:"news",photos:true,motif:"art",kind:"bas",fields:["name","tagline","headline","message","date","time","venue","address","rsvpBy","photo","photo2","photo3","photo4","dayPlan","dressCode","hosts"],labels:{tagline:["Script line over the headline","Red u rukopisu preko naslova"],headline:["Headline under the photo","Naslov ispod fotografije"],message:["The story","Tekst vesti"],photo:["Front page photo","Glavna fotografija na naslovnoj strani"],photo2:["Small front page photo","Mala fotografija na naslovnoj strani"],photo3:["Archive photo 1","Fotografija iz arhive 1"],photo4:["Archive photo 2","Fotografija iz arhive 2"],hosts:["Editor in chief (signature)","Glavni urednik (potpis)"]},def:{en:{name:"Milica",tagline:"It's party time",headline:"Cheers to the birthday girl!",message:"We've planned **an unforgettable night** filled with _good vibes, music, laughter_ and all the birthday magic! From _dancing_ to _delicious bites_, come ready to **celebrate**, snap pics and **make memories** that last. It's going to be _that_ kind of party.",date:"2027-02-17",time:"20:00",venue:"Grand Hall",address:"Bulevar oslobođenja 56, Novi Sad",rsvpBy:"2027-02-10",photo:"",photo2:"",photo3:"",photo4:"",dayPlan:"20:00 Welcome champagne\n21:00 Dinner\n22:30 Cake and a toast\n23:00 Dancing until dawn",dressCode:"Black and white, with a little sparkle",hosts:"Milica and friends"},sr:{name:"Milica",tagline:"Vreme je za žurku",headline:"Živela slavljenica!",message:"Spremili smo **nezaboravno veče** uz _dobru muziku, smeh_ i svu rođendansku čaroliju! Od _plesa_ do _slatkih zalogaja_, dođite spremni da **slavite**, slikate se i **pravite uspomene**. Biće to _ona_ žurka.",date:"2027-02-17",time:"20:00",venue:"Grand sala",address:"Bulevar oslobođenja 56, Novi Sad",rsvpBy:"2027-02-10",photo:"",photo2:"",photo3:"",photo4:"",dayPlan:"20:00 Doček uz šampanjac\n21:00 Večera\n22:30 Torta i zdravica\n23:00 Ples do zore",dressCode:"Crno-belo, uz malo sjaja",hosts:"Milica i društvo"}},name:["The Birthday Times","Rođendanske novine"],tag:["A birthday special edition: the newspaper spins in like an old film headline, then a front page with your photos, the story, the programme, an archive of photos, a countdown and music","Specijalno rođendansko izdanje: novine se zavrte kao u starim filmovima, a zatim naslovna strana sa vašim fotografijama, vest, program večeri, arhiva fotografija, odbrojavanje i muzika"],pt:4.5,pb:4,pl:6,pr:6,pal:{bg:"#FBFBFA",bg2:"#ECECEA",ink:"#141414",accent:"#B3221E",soft:"#ECECEA",x1:"#141414",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Playfair Display',serif","'Great Vibes',cursive","'Lora',serif")},
 {id:"p_tale",tier:"premium",cat:"first",layout:"bloom",exp:"tale",photos:true,art:"tlcard",fx:"stars",motif:"art",kind:"bas",labels:{message:["Invitation text","Tekst pozivnice"],hosts:["Signed by","Potpis"],story1Year:["Chapter 1 · name","Poglavlje 1 · naziv"],story1Title:["Chapter 1 · title","Poglavlje 1 · naslov"],story1Text:["Chapter 1 · the story","Poglavlje 1 · priča"],photo1:["Chapter 1 · photo (optional)","Poglavlje 1 · fotografija (nije obavezno)"],story2Year:["Chapter 2 · name","Poglavlje 2 · naziv"],story2Title:["Chapter 2 · title","Poglavlje 2 · naslov"],story2Text:["Chapter 2 · the story","Poglavlje 2 · priča"],photo2:["Chapter 2 · photo (optional)","Poglavlje 2 · fotografija (nije obavezno)"],story3Year:["Chapter 3 · name","Poglavlje 3 · naziv"],story3Title:["Chapter 3 · title","Poglavlje 3 · naslov"],story3Text:["Chapter 3 · the story","Poglavlje 3 · priča"],photo3:["Chapter 3 · photo (optional)","Poglavlje 3 · fotografija (nije obavezno)"],story4Year:["Chapter 4 · name","Poglavlje 4 · naziv"],story4Title:["Chapter 4 · title","Poglavlje 4 · naslov"],story4Text:["Chapter 4 · the story","Poglavlje 4 · priča"],photo4:["Chapter 4 · photo (optional)","Poglavlje 4 · fotografija (nije obavezno)"]},def:{en:{childName:"Sofia",age:"1",message:"Our little princess Sofia is turning one! Please join us at her birthday ball to celebrate her very first big day.",date:"2027-07-10",time:"18:00",venue:"Villa Fairytale",address:"Kneza Miloša 44, Belgrade",birthDate:"2026-07-10",birthTime:"07:45",birthWeight:"3,250 g",birthLength:"50 cm",story1Year:"Chapter one",story1Title:"The first smile",story1Text:"One sunny morning the little princess smiled, and the whole castle shone with joy.",story2Year:"Chapter two",story2Title:"The first tooth",story2Text:"A tiny pearl appeared, and the princess set off to taste every strawberry in the kingdom.",story3Year:"Chapter three",story3Title:"The first steps",story3Text:"Holding Mum's and Dad's hands, she took three brave steps through the castle garden.",story4Year:"Chapter four",story4Title:"The first word",story4Text:"First she said “Mama”, then “Dada”, and then “more!” the moment she saw the cake.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Sofia with Mum and Dad",rsvpBy:"2027-06-30"},sr:{childName:"Sofija",age:"1",message:"Naša mala princeza Sofija puni prvu godinu! Pozivamo vas na rođendanski bal da zajedno proslavimo njen prvi veliki dan.",date:"2027-07-10",time:"18:00",venue:"Vila Bajka",address:"Kneza Miloša 44, Beograd",birthDate:"2026-07-10",birthTime:"07:45",birthWeight:"3.250 g",birthLength:"50 cm",story1Year:"Poglavlje prvo",story1Title:"Prvi osmeh",story1Text:"Jednog sunčanog jutra mala princeza se nasmejala, a ceo dvorac je zasijao od sreće.",story2Year:"Poglavlje drugo",story2Title:"Prvi zubić",story2Text:"Pojavio se mali biser, a princeza je odmah krenula da proba sve jagode u kraljevstvu.",story3Year:"Poglavlje treće",story3Title:"Prvi koraci",story3Text:"Uz ruku mame i tate napravila je tri hrabra koraka kroz dvorsku baštu.",story4Year:"Poglavlje četvrto",story4Title:"Prva reč",story4Text:"Prvo je rekla „mama“, pa „tata“, a onda „još!“ čim je ugledala tortu.",photo1:"",photo2:"",photo3:"",photo4:"",hosts:"Sofija sa mamom i tatom",rsvpBy:"2027-06-30"}},name:["Once Upon a Time","Bila jednom"],tag:["A first birthday told as a storybook: the book opens and every page turns like paper, from the day the little princess was born through her first year, to the invitation to her birthday ball","Prvi rođendan ispričan kao bajka: knjiga se otvara i stranice se okreću kao prave, od dana kada se mala princeza rodila, kroz njenu prvu godinu, do poziva na rođendanski bal"],pt:0,pb:0,pl:0,pr:0,pal:{bg:"#FBF5EA",bg2:"#F4E3DE",ink:"#5B4636",accent:"#B88A4A",soft:"#F4E3DE",x1:"#D9A3A8",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cinzel Decorative',serif","'Great Vibes',cursive","'Cormorant Garamond',serif")},
 {id:"p_gold",tier:"premium",cat:"other",layout:"gold",exp:"gold",motif:"art",kind:"gold",name:["Gold Record","Zlatna ploča"],tag:["An anniversary on a gold record: guests drop the needle on a 3D turntable and your years together spin up, with your story as side A","Godišnjica na zlatnoj ploči: gost spusti iglu na 3D gramofon i vaše godine zajedno se zavrte, uz vašu priču kao stranu A"],pt:8,pb:8,pl:10,pr:10,pal:{bg:"#1C0D10",bg2:"#3A1520",ink:"#F3E3BC",accent:"#E8C77E",soft:"#4E0F1B",x1:"#E8C77E",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Bodoni Moda',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"p_balloon",tier:"premium",cat:"birthday",layout:"balloon",exp:"balloon",motif:"art",kind:"balloon",name:["Balloon Party","Baloni"],tag:["Guests pop 3D balloons to open the invitation, with confetti, music, the party plan and a countdown","Gost pucka 3D balone da otvori pozivnicu, uz konfete, muziku, plan žurke i odbrojavanje"],pt:8,pb:8,pl:10,pr:10,pal:{bg:"#FFF6F1",bg2:"#FCE3EA",ink:"#3D3355",accent:"#F07A98",soft:"#FCE3EA",x1:"#FFCB6B",x2:"#8FD3C1",x3:"#9EC2F7"},font:fnt("'Fredoka',sans-serif","'Fredoka',sans-serif","'Nunito',sans-serif")},
 {id:"p_sky",tier:"premium",cat:"wedding",layout:"sky",exp:"sky",motif:"art",kind:"sky",name:["Starry Night","Zvezdana noć"],tag:["A live night sky: guests touch the stars and they gather into your initials, with your story, programme and music","Živo noćno nebo: gost dodirne zvezde i one se slože u vaše inicijale, uz vašu priču, program i muziku"],pt:8,pb:8,pl:10,pr:10,pal:{bg:"#070B1A",bg2:"#151C3D",ink:"#EEF0FF",accent:"#E8C77E",soft:"#1B2347",x1:"#E8C77E",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Cormorant Garamond',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"p_bow",tier:"premium",cat:"wedding",layout:"bow",exp:"bow",art:"sbcard",motif:"art",kind:"bas",name:["Satin Bow","Satenska mašna"],tag:["A wedding that arrives in a gift box tied with a satin bow: guests pull the ribbon, lift the lid and the invitation rises from the tissue paper, then the day unrolls along a satin ribbon","Venčanje koje stiže u poklon kutiji vezanoj satenskom mašnom: gost povuče traku, podigne poklopac i pozivnica izranja iz svilenog papira, a zatim se dan odmotava duž satenske trake"],pt:21,pb:13,pl:14,pr:14,pal:{bg:"#F3EFE7",bg2:"#E6DDCD",ink:"#2B2622",accent:"#9C8158",soft:"#EDE5D8",x1:"#9C8158",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Cormorant Garamond',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"p_disco",tier:"premium",cat:"birthday",layout:"discop",exp:"disco",photos:true,art:"pdimg",motif:"art",kind:"disco",name:["Disco Jubilee","Disko jubilej"],tag:["36 & 5: a birthday and an anniversary as one disco night, with a photo and music","36 & 5: rođendan i jubilej kao jedna disko noć, sa fotografijom i muzikom"],pt:8,pb:7,pl:15,pr:15,pal:{bg:"#EFEFEF",bg2:"#1A1A1C",ink:"#111111",accent:"#3A3A3D",soft:"#E6E4E0",x1:"#9A9CA1",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Bodoni Moda',serif","'Great Vibes',cursive","'Playfair Display',serif")},
 {id:"storybook",cat:"first",layout:"first",story:true,name:["Fairytale Storybook","Bajkovita knjiga"],tag:["An animated storybook that opens for your guests","Animirana knjiga bajki koja se otvara pred gostima"],motif:"storybook",kind:"story",pt:27,pb:28,pal:{bg:"#F4E9D6",bg2:"#E9D8BC",ink:"#34405F",accent:"#5A78AE",soft:"#DCE6F3",x1:"#C6A15B",x2:"#FFFFFF",x3:"#C9DAF0"},font:fnt("'Cinzel Decorative','Cinzel',serif","'Pinyon Script',cursive","'Cormorant Garamond',serif"),def:{en:{childName:"Sofia",time:"18:00",venue:"The Royal Ballroom",message:"Put on your finest gown and your sparkliest crown, and join us for a royal celebration.",hosts:"With love, Ana & Marko"},sr:{childName:"Sofija",time:"18:00",venue:"Kraljevska balska dvorana",message:"Obucite najlepšu haljinu, stavite najsjajniju krunu i pridružite nam se na kraljevskoj proslavi.",hosts:"S ljubavlju, Ana i Marko"}}},
 {id:"jungle",cat:"first",layout:"first",name:["Wild One","Džungla"],tag:["Jungle leaves and a friendly lion","Tropsko lišće i veseli lavić"],motif:"jungle",kind:"play",pt:31,pb:36,pal:{bg:"#F4ECD6",bg2:"#F3C873",ink:"#24412F",accent:"#D48A2A",soft:"#86A86F",x1:"#3E6B47",x2:"#AFC890",x3:"#FFFFFF"},font:fnt("'Fredoka',sans-serif","'Fredoka',sans-serif","'Quicksand',sans-serif"),def:{en:{childName:"Leo"},sr:{childName:"Vuk"}}},
 {id:"castle",cat:"first",layout:"first",name:["Enchanted Castle","Začarani dvorac"],tag:["A starlit fairytale castle","Bajkoviti dvorac pod zvezdama"],motif:"castle",kind:"fairy",pt:24,pb:37,pal:{bg:"#28214D",bg2:"#3B3274",ink:"#F6F0FF",accent:"#EBC66E",soft:"#C3B2F5",x1:"#8C78E0",x2:"#FFFFFF",x3:"#F9DDF2"},font:fnt("'Cinzel',serif","'Great Vibes',cursive","'Quicksand',sans-serif"),def:{en:{childName:"Sofia"},sr:{childName:"Sofija"}}},
 {id:"princess",cat:"first",layout:"first",name:["Little Princess","Mala princeza"],tag:["Blush pink, a gold crown, soft lace","Nežno roze, zlatna kruna i čipka"],motif:"princess",kind:"soft",pt:29,pb:24,pal:{bg:"#FCEEF0",bg2:"#F6D3DB",ink:"#6A3546",accent:"#C49650",soft:"#F1B8C5",x1:"#E0849B",x2:"#FFFFFF",x3:"#FFF7F8"},font:fnt("'Parisienne',cursive","'Parisienne',cursive","'Quicksand',sans-serif"),def:{en:{childName:"Mila"},sr:{childName:"Mila"}}},
 {id:"blossom",cat:"first",layout:"first",name:["Blooming One","Cvetni rođendan"],tag:["Peach florals and sage leaves","Cveće boje breskve i listovi žalfije"],motif:"blossom",kind:"soft",pt:27,pb:25,pal:{bg:"#FFF7F1",bg2:"#FBE4D6",ink:"#5B4636",accent:"#DE8B74",soft:"#F4C2B0",x1:"#8FA982",x2:"#C3D5B7",x3:"#F2CF74"},font:fnt("'Great Vibes',cursive","'Great Vibes',cursive","'Quicksand',sans-serif"),def:{en:{childName:"Lily"},sr:{childName:"Lena"}}},
 {id:"cars",cat:"first",layout:"first",name:["Ready, Set, One","Mali vozač"],tag:["A little red car on the open road","Crveni autić na otvorenom putu"],motif:"cars",kind:"play",pt:25,pb:38,pal:{bg:"#EAF4FB",bg2:"#CFE5F4",ink:"#173A5E",accent:"#E0463A",soft:"#F5C443",x1:"#3B4A5A",x2:"#FFFFFF",x3:"#5FA8D3"},font:fnt("'Baloo 2',sans-serif","'Baloo 2',sans-serif","'Quicksand',sans-serif"),def:{en:{childName:"Luka"},sr:{childName:"Luka"}}},
 {id:"noir",cat:"eighteen",layout:"eighteen",name:["Noir & Gold","Crno i zlatno"],tag:["Art deco fans on black","Art deko lepeze na crnoj podlozi"],motif:"noir",kind:"deco",frame:"double",pt:24,pb:23,pal:{bg:"#121112",bg2:"#1D1B1A",ink:"#F2E8D2",accent:"#C9A45C",soft:"#7E6A44",x1:"#C9A45C",x2:"#F2E8D2",x3:"#000000"},font:fnt("'Cinzel',serif","'Pinyon Script',cursive","'Jost',sans-serif"),def:{en:{name:"Nina"},sr:{name:"Nina"}}},
 {id:"champagne",cat:"eighteen",layout:"eighteen",name:["Champagne Toast","Šampanjac"],tag:["Clinking coupes and rising bubbles","Čaše koje se kucaju i mehurići"],motif:"champagne",kind:"classic",frame:"thin",pt:20,pb:33,pal:{bg:"#F8EFE7",bg2:"#EEDFD0",ink:"#4A3A31",accent:"#B08955",soft:"#EBCBBB",x1:"#FFFFFF",x2:"#D9B88A",x3:"#FFFFFF"},font:fnt("'Bodoni Moda',serif","'Great Vibes',cursive","'Jost',sans-serif"),def:{en:{name:"Isabella"},sr:{name:"Isidora"}}},
 {id:"emerald",cat:"eighteen",layout:"eighteen",name:["Emerald Night","Smaragdna noć"],tag:["Deep green with gilded deco corners","Tamnozelena sa zlatnim uglovima"],motif:"emerald",kind:"deco",pt:20,pb:20,pal:{bg:"#0F3A2E",bg2:"#155040",ink:"#F1EAD6",accent:"#D3B270",soft:"#3E7A63",x1:"#D3B270",x2:"#F1EAD6",x3:"#000000"},font:fnt("'Marcellus',serif","'Pinyon Script',cursive","'Jost',sans-serif"),def:{en:{name:"Elena"},sr:{name:"Elena"}}},
 {id:"marble",cat:"eighteen",layout:"eighteen",name:["Marble Muse","Mermerna muza"],tag:["White marble veined with rose gold","Beli mermer i ružičasto zlato"],motif:"marble",kind:"classic",frame:"thin",pt:18,pb:18,pal:{bg:"#FBF9F8",bg2:"#ECE5E2",ink:"#3A3335",accent:"#B07C86",soft:"#DCC3C7",x1:"#B9B1AF",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif"),def:{en:{name:"Sara"},sr:{name:"Sara"}}},
 {id:"starlit",cat:"eighteen",layout:"eighteen",name:["Starlit Eighteen","Zvezdana noć"],tag:["Midnight navy and silver constellations","Ponoćno plava i srebrna sazvežđa"],motif:"starlit",kind:"classic",pt:22,pb:18,pal:{bg:"#0D1830",bg2:"#1A2B4D",ink:"#EEF2FA",accent:"#C9D4EA",soft:"#7D8FB8",x1:"#F0D9A0",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Playfair Display',serif","'Great Vibes',cursive","'Jost',sans-serif"),def:{en:{name:"Maya"},sr:{name:"Maja"}}},
 {id:"era",cat:"eighteen",layout:"era",photos:true,name:["Night Edition","Noćno izdanje"],tag:["A magazine-style cover with your black-and-white photo","Naslovna strana u stilu magazina sa vašom crno-belom fotografijom"],motif:"era",kind:"era",pal:{bg:"#FBFAF7",bg2:"#151515",ink:"#151515",accent:"#B8975A",soft:"#E9E3D6",x1:"#B8975A",x2:"#FFFFFF",x3:"#000000"},font:fnt("'Bodoni Moda',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"cherry",cat:"eighteen",layout:"cherry",name:["Cherry Script","Trešnja"],tag:["Cherry-red script with your own photos","Crvena kaligrafija sa vašim fotografijama"],motif:"cherry",kind:"cherry",photos:true,pal:{bg:"#E4DCD7",bg2:"#D3C3BB",ink:"#8C1219",accent:"#8C1219",soft:"#E9DCD5",x1:"#8C1219",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Mrs Saint Delafield',cursive","'Mrs Saint Delafield',cursive","'Jost',sans-serif")},
 {id:"vinyl",tier:"premium",cat:"wedding",layout:"vinyl",exp:"vinyl",name:["Our Song","Naša pesma"],tag:["A wedding told like a record: tracklist, setlist, ticket and a music box","Venčanje ispričano kao ploča: spisak pesama, setlista, ulaznica i muzička kutija"],motif:"vinyl",kind:"vinyl",pal:{bg:"#F1E8D8",bg2:"#E3D4BC",ink:"#221C18",accent:"#7E2633",soft:"#E8D5C0",x1:"#E9CF98",x2:"#FFFFFF",x3:"#1B1714"},font:fnt("'Bodoni Moda',serif","'Bodoni Moda',serif","'Manrope',sans-serif")},
 {id:"garden",cat:"wedding",layout:"wedding",name:["Garden Romance","Romantični vrt"],tag:["A garland of roses and wildflowers","Venac ruža i poljskog cveća"],motif:"garden",kind:"classic",pt:23,pb:15,pal:{bg:"#FFFDF9",bg2:"#F5EEE6",ink:"#4A3E3A",accent:"#C08591",soft:"#EDC7CB",x1:"#8FA78A",x2:"#B9CBB2",x3:"#EAD49F"},font:fnt("'Pinyon Script',cursive","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"olive",cat:"wedding",layout:"wedding",name:["Olive Grove","Maslinjak"],tag:["Mediterranean olive branches","Mediteranske maslinove grančice"],motif:"olive",kind:"classic",pt:22,pb:17,pal:{bg:"#F5F4EC",bg2:"#E8E7DA",ink:"#3C4333",accent:"#74844C",soft:"#A6B385",x1:"#4E5C3A",x2:"#C3CBA7",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"ivory",cat:"wedding",layout:"wedding",name:["Ivory Classic","Klasična elegancija"],tag:["Double frame with a gold monogram","Dupli okvir i zlatni monogram"],motif:"ivory",kind:"classic",frame:"double",pt:25,pb:16,pal:{bg:"#FBF9F3",bg2:"#F1ECE0",ink:"#3A362E",accent:"#AD925B",soft:"#DCCFAD",x1:"#AD925B",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Pinyon Script',cursive","'Pinyon Script',cursive","'Cormorant Garamond',serif")},
 {id:"gatsby",cat:"wedding",layout:"wedding",name:["Gatsby Gala","Getsbi gala"],tag:["Gilded sunbursts on black","Zlatni zraci na crnoj podlozi"],motif:"gatsby",kind:"deco",pt:22,pb:20,pal:{bg:"#0D0D0D",bg2:"#191714",ink:"#EADCB8",accent:"#D3AE62",soft:"#7A663B",x1:"#D3AE62",x2:"#EADCB8",x3:"#000000"},font:fnt("'Marcellus',serif","'Pinyon Script',cursive","'Jost',sans-serif")},
 {id:"dustyblue",cat:"wedding",layout:"wedding",name:["Dusty Blue","Nežno plava"],tag:["A soft arch framed in eucalyptus","Nežni luk uokviren eukaliptusom"],motif:"dustyblue",kind:"classic",arch:true,pt:22,pb:15,pal:{bg:"#EDF1F5",bg2:"#DCE5EE",ink:"#2E3D4B",accent:"#6E8AA4",soft:"#B6C7D6",x1:"#86A393",x2:"#AFC3B6",x3:"#FFFFFF"},font:fnt("'Parisienne',cursive","'Parisienne',cursive","'Cormorant Garamond',serif")},
 {id:"christening",cat:"other",layout:"christening",name:["Christening","Krštenje"],tag:["Soft blue skies and a white dove","Nežno plavo nebo i bela golubica"],motif:"christening",kind:"classic",pt:30,pb:20,pal:{bg:"#F4F8FC",bg2:"#E1EBF5",ink:"#33465C",accent:"#8AA6C6",soft:"#CBDCEC",x1:"#B9A26A",x2:"#FFFFFF",x3:"#FFFFFF"},font:fnt("'Cormorant Garamond',serif","'Great Vibes',cursive","'Jost',sans-serif")},
 {id:"celebration",cat:"other",layout:"celebration",name:["Any Occasion","Za svaku priliku"],tag:["Confetti for anniversaries, graduations and more","Konfete za godišnjice, diplome i još mnogo toga"],motif:"celebration",kind:"classic",pt:20,pb:30,pal:{bg:"#221D43",bg2:"#352D66",ink:"#FFF5E6",accent:"#F2B544",soft:"#F07F73",x1:"#5CC8C2",x2:"#B89DF2",x3:"#FFFFFF"},font:fnt("'Bodoni Moda',serif","'Great Vibes',cursive","'Jost',sans-serif")}
];
const TM=Object.fromEntries(T.map(t=>[t.id,t]));
const tName=t=>pick(t.name),tTag=t=>pick(t.tag);
const ENV_EXTRA=["photo5","backMsg","dayPlan","dressCode","stay","gifts"];
const fieldsOf=t=>t.fields?t.fields:t.tier==="envelope"?[...LAYOUT[t.layout].fields,...ENV_EXTRA.filter(k=>!LAYOUT[t.layout].fields.includes(k))]:LAYOUT[t.layout].fields;
const defaultsOf=(t,lg=LANG)=>({...LAYOUT[t.layout].def[lg],...((t.def||{})[lg]||{})});
const labelOf=(t,k)=>pick((t.labels||{})[k]||(LAYOUT[t.layout].labels||{})[k]||FD[k].l);
function titleOf(t,d){const lg=(d&&d.lang)||LANG;d={...defaultsOf(t,lg),...d};const S=lg==="sr";switch(t.layout){
 case"wedding":return`${d.partner1||"?"} & ${d.partner2||"?"}`;
 case"vinyl":return`${d.partner1||"?"} & ${d.partner2||"?"}`;
 case"rip":{const a=parseInt(d.age)||30;return S?`${d.name||""} – ${a}. rođendan`:`${d.name||""}'s ${ordEn(a)} birthday`}
 case"bloom":{const a=parseInt(d.age)||1;return S?`${d.childName||""} – ${a}. rođendan`:`${d.childName||""}'s ${ordEn(a)} birthday`}
 case"plane":case"dino":{const a=parseInt(d.age)||1;return S?`${d.childName||""} – ${a}. rođendan`:`${d.childName||""}'s ${ordEn(a)} birthday`}
 case"balloon":{const a=parseInt(d.age)||5;return S?`${d.childName||""} – ${a}. rođendan`:`${d.childName||""}'s ${ordEn(a)} birthday`}
 case"honey":{const a=parseInt(d.age)||1;return S?`${d.childName||""} – ${a}. rođendan`:`${d.childName||""}'s ${ordEn(a)} birthday`}
  case"picture":{if(d.hName)return [d.hName,d.hAge,(d.hOcc||"").toLocaleLowerCase()].filter(Boolean).join(" ");const tt=t.ttl||["{n}'s first birthday and christening","{n} – prvi rođendan i krštenje"];return (S?tt[1]:tt[0]).replace("{n}",d.childName||"")}
  case"estate":return S?`Venčanje – ${d.partner1||""} i ${d.partner2||""}`:`The wedding of ${d.partner1||""} & ${d.partner2||""}`;
  case"letter":return S?`Venčanje – ${d.partner1||""} i ${d.partner2||""}`:`The wedding of ${d.partner1||""} & ${d.partner2||""}`;
  case"gold":{const y=parseInt(d.age)||0;return S?`${d.partner1||""} i ${d.partner2||""}${y?` – ${y} godina braka`:" – godišnjica"}`:`${d.partner1||""} & ${d.partner2||""}${y?` – ${y} years`:" – anniversary"}`}
  case"bow":case"lace":case"sky":return`${d.partner1||""} & ${d.partner2||""}`;
  case"disco":case"discop":{const a=parseInt(d.num1)||0;const nm=d.name1||d.brand||"";return S?`${nm}${a?` – ${a}. rođendan`:" – žurka"}`:`${nm}${a?`'s ${ordEn(a)} birthday`:"'s party"}`}
  case"era":{const a=parseInt(d.age)||0;return S?`${d.name||"Slavljenik"} – ${a?a+". ":""}rođendan`:`${d.name||"Someone"}'s ${a?ordEn(a)+" ":""}birthday`}
 case"cherry":case"eighteen":return S?`${d.name||"Slavljenik"} – 18. rođendan`:`${d.name||"Someone"}'s 18th`;
 case"first":return S?`${d.childName||"Mališan"} – prvi rođendan`:`${d.childName||"Little one"}'s first birthday`;
 case"christening":return S?`Krštenje – ${d.childName||"beba"}`:`${d.childName||"Baby"}'s christening`;
 default:return d.occasion||(S?"Proslava":"Celebration")}}

const ordEn=n=>n+((n%100>=11&&n%100<=13)?"th":["th","st","nd","rd"][n%10]||"th");
function numWords(n,lg){n=parseInt(n);if(!(n>0&&n<100))return"";
 if(lg==="sr"){const u=["","jedan","dva","tri","četiri","pet","šest","sedam","osam","devet"],te=["deset","jedanaest","dvanaest","trinaest","četrnaest","petnaest","šesnaest","sedamnaest","osamnaest","devetnaest"],tn=["","","dvadeset","trideset","četrdeset","pedeset","šezdeset","sedamdeset","osamdeset","devedeset"];
  if(n<10)return u[n];if(n<20)return te[n-10];return tn[Math.floor(n/10)]+(n%10?" "+u[n%10]:"")}
 const u=["","one","two","three","four","five","six","seven","eight","nine"],te=["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"],tn=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
 if(n<10)return u[n];if(n<20)return te[n-10];return tn[Math.floor(n/10)]+(n%10?"-"+u[n%10]:"")}
const SKY=(()=>{seed=27;let b="";let x=0;while(x<300){const w=14+rnd()*26,h=40+rnd()*110,c=["#161616","#1d1d1d","#232323"][Math.floor(rnd()*3)];b+=`<rect x="${f1(x)}" y="${f1(200-h)}" width="${f1(w)}" height="${f1(h)}" fill="${c}"/>`;for(let wy=200-h+8;wy<196;wy+=9)for(let wx=x+4;wx<x+w-4;wx+=7)if(rnd()>.55)b+=`<rect x="${f1(wx)}" y="${f1(wy)}" width="2.2" height="2.6" fill="#E6E6E6" opacity="${f1(.35+rnd()*.6)}"/>`;x+=w+1}
 return`<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="300" height="200" fill="#3a3a3a"/>${b}</svg>`})();
/* ---------- card layouts drawn around one design's picture (Osnovna, and Medeni piknik) ---------- */
// a small gold flourish for the storybook
const TL_ORN=`<svg viewBox="0 0 120 20" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" aria-hidden="true"><path d="M4 10H46M74 10H116"/><path d="M60 4l4 6-4 6-4-6z" fill="currentColor"/><path d="M46 10c4-6 9-6 9-1 0 3-4 3-4 0M74 10c-4-6-9-6-9-1 0 3 4 3 4 0M46 10c4 6 9 6 9 1M74 10c-4 6-9 6-9 1"/></svg>`;
// **bold** and _italic_ in the newspaper story
const nzRich=s=>br(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[\s(>])_(.+?)_(?=[\s.,!?;:)<]|$)/g,"$1<i>$2</i>");
const bsFit=(max,k,s)=>Math.min(max,k/Math.max(1,s.length)).toFixed(2);
const bsMon=(dt,cl)=>cl==="sr"?DATES.sr.monG[dt.m-1]:dt.mon;
const bsDay=(dt,cl)=>cl==="sr"?`${dt.d}. ${bsMon(dt,cl)} ${dt.y}.`:`${dt.mon} ${dt.d}, ${dt.y}`;
const bsEv=(v,C)=>[["ceremonyTime","ceremonyVenue",C("Ceremony","Venčanje")],["receptionTime","receptionVenue",C("Reception","Proslava")]].filter(e=>v(e[0])||v(e[1]));
const bsFoot=(v,rs,C,Q,c)=>`${v("dressCode")?`<p ${Q(c,"dressCode")}>Dress code · ${esc(v("dressCode"))}</p>`:""}${rs?`<p ${Q(c,"rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`;
const DN_FOOT='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 38c-7 0-11-4-11-10 0-5 5-8 11-8s11 3 11 8c0 6-4 10-11 10z"/><path d="M9.5 19C6 18 3.6 12.6 5.6 9.4c3.4.2 6.4 5 5.6 9.4zM20 16.4c-2.2 0-3.4-6.4-2.2-11.6 2.4-1.2 4.6 3.4 4.6 7.6 0 2.4-1 4-2.4 4zM30.5 19c3.5-1 5.9-6.4 3.9-9.6-3.4.2-6.4 5-5.6 9.4z"/></svg>';
const BO_LEAF='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14C3 7 8 3 14 2 13 8 9 13 2 14Z" fill="currentColor"/><path d="M3.4 12.6 11.4 4.6" stroke="#fff" stroke-width=".8" opacity=".55"/></svg>';
const BAS={
 b_rose:({v,dt,rs,cl,C,Q,S})=>{const ev=bsEv(v,C);
  return`${v("hosts")?`<p ${Q("br-k","hosts")}>${esc(v("hosts"))}</p>`:""}
  ${(v("partner1")+v("partner2")).length<=14?`<h2 ${S("br-n one","partner1",`font-size:${bsFit(12.5,150,v("partner1")+v("partner2")+"xxx")}cqw`)}><span>${esc(v("partner1"))}</span><em>&amp;</em><span>${esc(v("partner2"))}</span></h2>`:`<h2 ${Q("br-n","partner1")}><span style="font-size:${bsFit(12,150,v("partner1"))}cqw">${esc(v("partner1"))}</span><em>&amp;</em><span style="font-size:${bsFit(12,150,v("partner2"))}cqw">${esc(v("partner2"))}</span></h2>`}
  ${v("message")?`<p ${Q("br-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("br-d","date")}><span>${esc(dt.wd)}</span><b>${dt.d}</b><span>${esc(bsMon(dt,cl))}<br>${dt.y}${cl==="sr"?".":""}</span></div>`:""}
  ${ev.length?`<div ${Q("br-ev"+(ev.length<2?" one":""))}>${ev.map(e=>`<div data-f="${e[1]}"><h4>${e[2]}</h4>${v(e[0])?`<b>${esc(v(e[0]))}</b>`:""}<span>${esc(v(e[1]))}</span></div>`).join("")}</div>`:""}
  ${v("address")?`<p ${Q("br-a","address")}>${esc(v("address"))}</p>`:""}${bsFoot(v,rs,C,Q,"br-s")}`},
 b_olive:({v,dt,rs,cl,C,Q,S})=>{const ev=bsEv(v,C);const lg=Math.max(v("partner1").length,v("partner2").length+2);
  return`${v("hosts")?`<p ${Q("bo-k","hosts")}>${esc(v("hosts"))}</p>`:""}
  <h2 ${S("bo-n","partner1",`font-size:${bsFit(15,74,"x".repeat(lg))}cqw`)}><span>${esc(v("partner1"))}</span><span><em>&amp;</em>${esc(v("partner2"))}</span></h2>
  <i class="bo-rule r" style="--n:2" aria-hidden="true"></i>
  ${v("message")?`<p ${Q("bo-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("bo-d","date")}><b>${String(dt.d).padStart(2,"0")}.${String(dt.m).padStart(2,"0")}.</b><span><small>${esc(dt.wd)}</small>${dt.y}${cl==="sr"?".":""}</span></div>`:""}
  ${ev.length?`<ul ${Q("bo-ev")}>${ev.map(e=>`<li data-f="${e[1]}">${BO_LEAF}<span><small>${e[2]}${v(e[0])?` · ${esc(v(e[0]))}`:""}</small>${esc(v(e[1]))}</span></li>`).join("")}</ul>`:""}
  ${v("address")?`<p ${Q("bo-a","address")}>${esc(v("address"))}</p>`:""}${bsFoot(v,rs,C,Q,"bo-s")}`},
 b_dove:({v,dt,rs,cl,C,Q,S})=>{const ev=bsEv(v,C);
  return`${v("hosts")?`<p ${Q("bv-k","hosts")}>${esc(v("hosts"))}</p>`:""}
  <h2 ${Q("bv-n","partner1")}><span style="font-size:${bsFit(9.5,58,v("partner1"))}cqw">${esc(v("partner1"))}</span><em>${C("&amp;","i")}</em><span style="font-size:${bsFit(9.5,58,v("partner2"))}cqw">${esc(v("partner2"))}</span></h2>
  ${v("message")?`<p ${Q("bv-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("bv-md","date")}><small>${esc(dt.wd)}</small><b>${dt.d}</b><span>${esc(bsMon(dt,cl))}</span><small>${dt.y}${cl==="sr"?".":""}</small></div>`:""}
  ${ev.length?`<div ${Q("bv-ev"+(ev.length<2?" one":""))}>${ev.map(e=>`<div data-f="${e[1]}"><h4>${e[2]}</h4>${v(e[0])?`<b>${esc(v(e[0]))}</b>`:""}<span>${esc(v(e[1]))}</span></div>`).join("")}</div>`:""}
  ${v("address")?`<p ${Q("bv-a","address")}>${esc(v("address"))}</p>`:""}${bsFoot(v,rs,C,Q,"bv-s")}`},
 b_bunny:({v,dt,rs,cl,C,Q,S})=>`<p ${Q("bb-k")}>${C("Join us to celebrate","Pozivamo vas na proslavu")}</p>
  <h2 ${S("bb-n","childName",`font-size:${bsFit(17,70,v("childName"))}cqw`)}>${esc(v("childName"))}</h2>
  <div ${Q("bb-age")}><span class="bb-bal" aria-hidden="true"></span><b>1</b></div>
  <p ${Q("bb-occ")}>${C("first birthday","prvi rođendan")}</p>
  ${dt?`<p ${Q("bb-d","date")}>${esc(dt.wd)}, ${esc(bsDay(dt,cl))}${v("time")?`<span data-f="time">${C("at","u")} ${esc(v("time"))}${cl==="sr"?" časova":""}</span>`:""}</p>`:""}
  ${v("venue")||v("address")?`<p ${Q("bb-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${v("message")?`<p ${Q("bb-m","message")}>${br(v("message"))}</p>`:""}
  ${v("hosts")?`<p ${Q("bb-h","hosts")}>${esc(v("hosts"))}</p>`:""}
  ${rs?`<p ${Q("bb-s","rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`,
 p_bow:({v,dt,rs,cl,C,Q,S})=>{const one=(v("partner1")+v("partner2")).length<=12;
  return`<p ${Q("sc-k")}>${C("We're getting married","Venčavamo se")}</p>
  ${one?`<h2 ${S("sc-n one","partner1",`font-size:${bsFit(13,150,v("partner1")+v("partner2")+"xxx")}cqw`)}><span>${esc(v("partner1"))}</span><em>&amp;</em><span>${esc(v("partner2"))}</span></h2>`:`<h2 ${Q("sc-n","partner1")}><span style="font-size:${bsFit(12.5,150,v("partner1"))}cqw">${esc(v("partner1"))}</span><em>&amp;</em><span style="font-size:${bsFit(12.5,150,v("partner2"))}cqw">${esc(v("partner2"))}</span></h2>`}
  ${v("message")?`<p ${Q("sc-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("sc-d","date")}><small>${esc(dt.wd)}</small><b>${String(dt.d).padStart(2,"0")}<i></i>${String(dt.m).padStart(2,"0")}<i></i>${dt.y}</b>${v("ceremonyTime")?`<small data-f="ceremonyTime">${C("at","u")} ${esc(v("ceremonyTime"))}${cl==="sr"?" časova":""}</small>`:""}</div>`:""}
  ${v("venue")||v("address")?`<p ${Q("sc-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${rs?`<p ${Q("sc-s","rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`},
 b_lav:({v,dt,rs,cl,C,Q,S})=>{const ev=bsEv(v,C);
  return`${v("hosts")?`<p ${Q("bl-k","hosts")}>${esc(v("hosts"))}</p>`:""}
  <h2 ${Q("bl-n","partner1")}><span style="font-size:${bsFit(12.5,72,v("partner1"))}cqw">${esc(v("partner1"))}</span><em>&amp;</em><span style="font-size:${bsFit(12.5,72,v("partner2"))}cqw">${esc(v("partner2"))}</span></h2>
  ${v("message")?`<p ${Q("bl-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("bl-d","date")}><small>${esc(dt.wd)}</small><b>${String(dt.d).padStart(2,"0")}<i>·</i>${String(dt.m).padStart(2,"0")}<i>·</i>${dt.y}</b></div>`:""}
  ${ev.length?`<div ${Q("bl-ev"+(ev.length<2?" one":""))}>${ev.map(e=>`<div data-f="${e[1]}"><h4>${e[2]}</h4>${v(e[0])?`<b>${esc(v(e[0]))}</b>`:""}<span>${esc(v(e[1]))}</span></div>`).join("")}</div>`:""}
  ${v("address")?`<p ${Q("bl-a","address")}>${esc(v("address"))}</p>`:""}${bsFoot(v,rs,C,Q,"bl-s")}`},
 b_euca:({v,dt,rs,cl,C,Q,S})=>{const ev=bsEv(v,C);
  return`${v("hosts")?`<p ${Q("be-k","hosts")}>${esc(v("hosts"))}</p>`:""}
  <h2 ${Q("be-n","partner1")}><span style="font-size:${bsFit(8.6,64,v("partner1"))}cqw">${esc(v("partner1"))}</span><em>&amp;</em><span style="font-size:${bsFit(8.6,64,v("partner2"))}cqw">${esc(v("partner2"))}</span></h2>
  ${v("message")?`<p ${Q("be-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("be-d","date")}><span>${esc(dt.wd)}</span><b>${dt.d}</b><span>${esc(bsMon(dt,cl))} ${dt.y}${cl==="sr"?".":""}</span></div>`:""}
  ${ev.length?`<div ${Q("be-ev")}>${ev.map(e=>`<p data-f="${e[1]}"><small>${e[2]}${v(e[0])?` · ${esc(v(e[0]))}`:""}</small>${esc(v(e[1]))}</p>`).join("")}</div>`:""}
  ${v("address")?`<p ${Q("be-a","address")}>${esc(v("address"))}</p>`:""}${bsFoot(v,rs,C,Q,"be-s")}`},
 b_bless:({v,dt,rs,cl,C,Q,S})=>{const ev=[["time","church",C("Christening","Krštenje")],["","receptionVenue",C("Celebration","Proslava")]].filter(e=>v(e[1])||(e[0]&&v(e[0])));
  return`<p ${Q("bs-k")}>${C("Please join us for the christening of","Pozivamo vas na krštenje")}</p>
  <h2 ${S("bs-n","childName",`font-size:${bsFit(17,80,v("childName"))}cqw`)}>${esc(v("childName"))}</h2>
  ${v("message")?`<p ${Q("bs-m","message")}>${br(v("message"))}</p>`:""}
  ${dt?`<div ${Q("bs-d","date")}><span>${esc(dt.wd)}</span><b>${dt.d}. ${esc(bsMon(dt,cl))}</b><span>${dt.y}${cl==="sr"?".":""}</span></div>`:""}
  ${ev.length?`<div ${Q("bs-ev"+(ev.length<2?" one":""))}>${ev.map(e=>`<div data-f="${e[1]}"><h4>${e[2]}</h4>${e[0]&&v(e[0])?`<b>${esc(v(e[0]))}</b>`:""}<span>${esc(v(e[1]))}</span></div>`).join("")}</div>`:""}
  ${v("address")?`<p ${Q("bs-a","address")}>${esc(v("address"))}</p>`:""}
  ${v("hosts")?`<p ${Q("bs-h","hosts")}>${esc(v("hosts"))}</p>`:""}
  ${rs?`<p ${Q("bs-s","rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`},
 b_dino:({v,dt,rs,cl,C,Q,S})=>{const a=parseInt(v("age"))||"";
  return`<p ${Q("bn-k")}>${C("Roar! Join us for a dino party","Rrrrr! Pozivamo te na dino žurku")}</p>
  <h2 ${S("bn-n","childName",`font-size:${bsFit(16,74,v("childName"))}cqw`)}>${esc(v("childName"))}</h2>
  ${a?`<div ${Q("bn-age","age")}><span class="bn-egg" aria-hidden="true"></span><b>${a}</b><span class="bn-t">${C(`${ordEn(a)} birthday`,`${a}. rođendan`)}</span></div>`:""}
  ${dt?`<p ${Q("bn-d","date")}>${esc(dt.wd)}, ${esc(bsDay(dt,cl))}${v("time")?` · <span data-f="time">${esc(v("time"))}${cl==="sr"?"h":""}</span>`:""}</p>`:""}
  ${v("venue")||v("address")?`<p ${Q("bn-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${v("message")?`<p ${Q("bn-m","message")}>${br(v("message"))}</p>`:""}
  ${v("hosts")?`<p ${Q("bn-h","hosts")}>${esc(v("hosts"))}</p>`:""}
  ${rs?`<p ${Q("bn-s","rsvpBy")}>${C("Please reply by","Javite nam do")} ${esc(rs.short)}</p>`:""}`},
 b_champ:({v,dt,rs,cl,C,Q,S})=>{const a=parseInt(v("age"))||"";
  return`<p ${Q("bc-k")}>${C("Let's celebrate","Pozivam vas da proslavimo")}</p>
  <h2 ${S("bc-n","name",`font-size:${bsFit(15,80,v("name"))}cqw`)}>${esc(v("name"))}</h2>
  ${a?`<div ${Q("bc-age","age")}><b>${a}</b><span>${C("years","godina")}<br>${C("of sparkle","sjaja")}</span></div>`:""}
  ${dt?`<p ${Q("bc-d","date")}><b>${esc(bsDay(dt,cl))}</b>${esc(dt.wd)}${v("time")?` · <span data-f="time">${esc(v("time"))}${cl==="sr"?"h":""}</span>`:""}</p>`:""}
  ${v("venue")||v("address")?`<p ${Q("bc-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${v("message")?`<p ${Q("bc-m","message")}>${br(v("message"))}</p>`:""}${bsFoot(v,rs,C,Q,"bc-s")}`},
 p_tale:({v,dt,rs,cl,C,Q,S})=>{const a=parseInt(v("age"))||1;const nm=esc(v("childName"));
  return`<p ${Q("tc-k")}>${C("A storybook for a first year","Bajka o prvoj godini")}</p>
  <span ${Q("tc-orn")} aria-hidden="true">${TL_ORN}</span>
  <h2 ${Q("tc-t","age")}><span>${C("Once","Bila")}</span><span>${C("upon a","jednom")}</span><b>${a===1?C("ONE","JEDNA"):a}</b></h2>
  ${nm?`<div ${Q("tc-rib","childName")}><svg viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24H60V74H0L15 49Z" fill="#E2B6B2"/><path d="M400 24H340V74H400L385 49Z" fill="#E2B6B2"/><path d="M46 60L60 74V60Z" fill="#B98683"/><path d="M354 60L340 74V60Z" fill="#B98683"/><path d="M46 10Q200 2 354 10V60Q200 52 46 60Z" fill="#EFCBC7" stroke="#C99A8E" stroke-width="1.2"/></svg><p>${C(`a first birthday story for <b>${nm}</b>`,`<b>${nm}</b> puni ${a===1?"prvu godinu":a+". godinu"}`)}</p></div>`:""}
  ${dt?`<p ${Q("tc-d","date")}><span class="wd">${esc(dt.wd.charAt(0).toUpperCase()+dt.wd.slice(1))}</span>, ${cl==="sr"?`${dt.d}. ${esc(bsMon(dt,cl))}`:`${esc(dt.mon)} ${dt.d}`}${v("time")?`<span data-f="time">${C("at","u")} ${esc(v("time"))}${cl==="sr"?" h":""}</span>`:""}</p>`:""}
  <span class="tc-div r" aria-hidden="true">♥</span>
  ${v("venue")||v("address")?`<p ${Q("tc-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${rs?`<p ${Q("tc-s","rsvpBy")}>RSVP · ${C("by","do")} ${esc(rs.short)}</p>`:""}
  <p class="tc-sign" aria-hidden="true">${C("a little story<br>begins here…","mala bajka<br>počinje<br>ovde…")}</p>
  <p class="tc-band" aria-hidden="true">${C("Cake · Wishes · Happily ever after","Torta · Želje · Srećno do kraja")}</p>`},
 p_news:({v,dt,rs,cl,C,Q,S})=>{const img=k=>PHOTO_RE.test(v(k))?`url('${v(k)}')`:"";const hd=C("BREAKING NEWS","UDARNA VEST");
  return`<div class="nc-mast" aria-hidden="true"><i></i><p><span>${C("Special edition","Specijalno izdanje")}</span><b>${C("The Birthday Times","Rođendanske novine")}</b><span>${C("Price: one hug","Cena: jedan zagrljaj")}</span></p></div>
  <div ${Q("nc-hd","tagline")}><b style="font-size:${bsFit(21,220,hd)}cqw">${hd}</b>${v("tagline")?`<em>${esc(v("tagline"))}</em>`:""}</div>
  <figure ${S("nc-ph","photo",`--p:${img("photo")||"var(--a-nzph1)"}`)}><i></i></figure>
  ${v("name")?`<p ${Q("nc-cap","name")}>${C("Pictured","Na fotografiji")}: ${C("the birthday star","slavljenica")} <b>${esc(v("name"))}</b> ${C("and friends","i društvo")}</p>`:""}
  ${v("headline")?`<h2 ${S("nc-h2","headline",`font-size:${bsFit(8.6,180,v("headline"))}cqw`)}>${esc(v("headline"))}</h2>`:""}
  <div class="nc-row">
   <figure ${S("nc-ph2","photo2",`--p:${img("photo2")||"var(--a-nzph2)"}`)}><i></i></figure>
   <div class="nc-box"><div class="nc-b1">${dt?`<p ${Q("nc-d","date")}>${dt.d} ${esc(dt.mon.slice(0,3).toUpperCase())}</p>`:""}${v("venue")||v("address")?`<p ${Q("nc-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}${v("time")?`<p ${Q("nc-t","time")}>${esc(v("time"))}${cl==="sr"?" h":""}</p>`:""}</div>
    <p ${Q("nc-rs","rsvpBy")}><b>RSVP</b>${rs?`<span>${C("by","do")} ${rs.d}.${rs.m}.</span>`:""}</p></div>
   <div ${Q("nc-col","message")}>${v("message")?`<p>${nzRich(v("message"))}</p>`:"<p></p>"}<p class="nc-lp">${C("Let's party!","Vidimo se na žurci!")}</p></div>
  </div>
  <span class="nc-foot" aria-hidden="true"></span>`},
 e_cherry:({v,dt,rs,cl,C,Q,S})=>{const w=v("name").split(/\s+/).filter(Boolean);const nm=w.length>2?[w[0],w.slice(1).join(" ")]:w;
  const it=(c,dl)=>`<span class="ks-it ${c}" style="--dl:${dl}ms" aria-hidden="true"></span>`;
  const g=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  return`<span class="ch-frame" aria-hidden="true"></span>
  ${it("ch-bow a",150)}${it("ch-lips a",450)}${it("ch-mart a",350)}${it("ch-bow b",650)}${it("ch-mart b",850)}${it("ch-lips c",950)}
  <p ${Q("ch-k")}>${C("You're invited to my","Pozivam vas na")}</p>
  <h2 ${Q("ch-t"+(cl==="sr"?" sr":""))}><span>${C("BIRTHDAY","ROĐENDANSKU")}</span><em class="ch-w">${C("Party","žurku")}</em></h2>
  <span ${Q("ch-orn")} aria-hidden="true"><i></i><svg viewBox="0 0 24 20"><path d="M12 2c-2 2-5 6-6.5 10M12 2c1 3 3 7 6 9.6" fill="none" stroke="#B3222A" stroke-width="1.1"/><circle cx="6" cy="14" r="4" fill="#B3222A"/><circle cx="18" cy="13.4" r="4" fill="#8E1A22"/></svg><i></i></span>
  <p ${Q("ch-l")}>${C("Come and celebrate<br>with me","Dođite da slavimo<br>zajedno")}</p>
  ${nm.length?`<h3 ${S("ch-n","name",`font-size:${bsFit(17,92,nm.reduce((a,b)=>a.length>b.length?a:b,""))}cqw`)}>${nm.map((x,i)=>`<span class="ch-w" style="--wd:${i+1}">${esc(x)}</span>`).join("")}</h3>`:""}
  <div ${Q("ch-info","date")}>${dt?`<div>${g('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>')}<span>${cl==="sr"?`${dt.d}. ${esc(bsMon(dt,cl))}`:`${esc(dt.mon)} ${dt.d}`}</span></div>`:""}${v("time")?`<div data-f="time">${g('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')}<span>${esc(v("time"))}${cl==="sr"?" h":""}</span></div>`:""}${v("venue")||v("address")?`<div data-f="venue">${g('<path d="M12 21s-6.5-6.4-6.5-11a6.5 6.5 0 0 1 13 0c0 4.6-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>')}<span>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<small data-f="address">${esc(v("address"))}</small>`:""}</span></div>`:""}</div>
  <span ${Q("ch-rule")} aria-hidden="true"></span>
  <div ${Q("ch-s","rsvpBy")}>${g('<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 10h18M12 10v10M12 10c-1.6-4.2-6.4-4.2-5.6-1.4.5 1.4 5.6 1.4 5.6 1.4zm0 0c1.6-4.2 6.4-4.2 5.6-1.4-.5 1.4-5.6 1.4-5.6 1.4z"/>')}<p>${C("Your presence means a lot to me,","Vaše prisustvo mi je važno,")}<br><b>${rs?C(`please reply by ${esc(rs.short)}`,`potvrdite dolazak do ${esc(rs.short)}`):C("please let me know","potvrdite dolazak")}</b></p></div>`},
 e_kiss:({v,dt,rs,cl,C,Q,S})=>{const a=String(parseInt(v("age"))||"");const ph=PHOTO_RE.test(v("photo"))?v("photo"):"";const nm=v("name")+(cl==="sr"||!v("name")?"":"’s");
  const it=(c,dl)=>`<span class="ks-it ${c}" style="--dl:${dl}ms" aria-hidden="true"></span>`;
  return`${it("ks-mart",250)}${it("ks-sst",900)}${it("ks-lips",400)}${it("ks-rst",1050)}${it("ks-ball2",700)}
  ${a?`<span ${S("ks-age","age",`--k:${a.length}`)} aria-hidden="true">${[...a].map((x,i)=>`<i style="--d:var(--a-ksd${x});--i:${i}"></i>`).join("")}</span>`:""}
  ${it("ks-ball",550)}${it("ks-hearts",650)}
  <span ${Q("ks-me"+(ph?" has":""),"photo")} aria-hidden="true">${ph?`<img src="${esc(ph)}" alt="">`:""}<i class="ks-hat"></i></span>
  <h2 ${S("ks-n","name",`font-size:${bsFit(13,74,nm)}cqw`)}>${esc(nm)}</h2>
  <p ${Q("ks-sc")}>${C("Birthday","slavi rođendan")}</p>
  ${dt?`<div ${Q("ks-d","date")}><span>${esc(dt.wd)}</span><b>${dt.d}<small>${esc(bsMon(dt,cl))}</small></b><span data-f="time">${v("time")?esc(v("time").replace(":",".")):dt.y}</span></div>`:""}
  ${v("venue")||v("address")?`<div ${Q("ks-v","venue")}><svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 26s-8-8.6-8-14.2a8 8 0 0 1 16 0C20 17.4 12 26 12 26z"/><circle cx="12" cy="11.8" r="3"/><path d="M5.5 28.6c1.6.9 4 1.4 6.5 1.4s4.9-.5 6.5-1.4"/></svg><p>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p></div>`:""}
  ${rs?`<p ${Q("ks-s","rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`},
 b_ruby:({v,dt,rs,cl,C,Q,S})=>{const a=parseInt(v("age"))||"";const p2=n=>String(n).padStart(2,"0");
  // the gold line runs up the left edge and "Rođendan" is written on it, letter by letter
  const line=`<svg viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 20C90 28 170 12 260 19S430 27 520 18 580 16 600 19"/></svg>`;
  return`${a?`<b ${Q("ru-age","age")} aria-hidden="true">${a}</b>`:""}
  <div class="ru-wbox" aria-hidden="true"><span class="ru-w"><i class="ru-ln a">${line}</i><span class="ru-t">${C("Birthday",`Ro<span class="ru-dj">d</span>endan`)}</span><i class="ru-pen"></i><i class="ru-ln b">${line}</i></span></div>
  <p ${Q("ru-k")}>${C("Join me for my","Pozivam vas na svoj")}</p>
  <h2 ${S("ru-n","name",`font-size:${bsFit(6.6,46,v("name"))}cqw`)}>${esc(v("name"))}</h2>
  ${a?`<p ${Q("ru-o","age")}>${cl==="sr"?`${a}. rođendan`:`${ordEn(a)} birthday`}</p>`:""}
  ${dt?`<div ${Q("ru-d"+(v("time")?"":" one"),"date")}><div><b>${p2(dt.d)}.${p2(dt.m)}.${dt.y}</b><small>${C("Date","Datum")}</small></div>${v("time")?`<i></i><div data-f="time"><b>${esc(v("time"))}</b><small>${C("Time","Vreme")}</small></div>`:""}</div>`:""}
  ${v("venue")||v("address")?`<div ${Q("ru-v","venue")}><svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 26s-8-8.6-8-14.2a8 8 0 0 1 16 0C20 17.4 12 26 12 26z"/><circle cx="12" cy="11.8" r="3"/><path d="M5.5 28.6c1.6.9 4 1.4 6.5 1.4s4.9-.5 6.5-1.4"/></svg><div>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}<small>${C("Location","Mesto")}</small></div></div>`:""}
  ${v("message")?`<p ${Q("ru-m","message")}>${br(v("message"))}</p>`:""}
  ${rs?`<p ${Q("ru-s","rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}
  <span ${Q("ru-h")}><svg viewBox="0 0 160 16" aria-hidden="true"><path class="l" d="M68 8H4M92 8h64"/><path class="h" d="M80 13.4s-6.4-3.8-6.4-7.8a3.3 3.3 0 0 1 6.4-1.5 3.3 3.3 0 0 1 6.4 1.5c0 4-6.4 7.8-6.4 7.8z"/></svg></span>`},
 p_dino:({v,dt,rs,cl,C,Q,S})=>{const a=parseInt(v("age"))||1;const ORD=["","prvi","drugi","treći","četvrti","peti"];
  return`<p ${Q("pd-k")}>${C("Our little dino","Naš mali dino")}</p>
  <h2 ${S("pd-n","childName",`font-size:${bsFit(19,82,v("childName"))}cqw`)}>${esc(v("childName"))}</h2>
  <p ${Q("pd-age","age")}>${cl==="sr"?`slavi <b>${ORD[a]||a+"."}</b> rođendan`:`is celebrating <b>${a===1?"one":ordEn(a)}</b>`}</p>
  <span class="pd-fp r" style="--n:3" aria-hidden="true">${DN_FOOT}${DN_FOOT}${DN_FOOT}</span>
  ${dt?`<p ${Q("pd-d","date")}>${esc(dt.wd)} <b>${cl==="sr"?`${dt.d}. ${esc(dt.mon)}`:`${esc(dt.mon)} ${dt.d}`}</b>${v("time")?` <span data-f="time">${esc(v("time"))}${cl==="sr"?"h":""}</span>`:""}</p>`:""}
  ${v("venue")||v("address")||rs?`<div ${Q("pd-side","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}${rs?`<small data-f="rsvpBy">${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</small>`:""}</div>`:""}`},
 e_picnic:({v,dt,rs,cl,C,Q,S})=>`<p ${Q("pk-k")}>${C("You're invited to a birthday picnic","Pozivamo vas na rođendanski piknik")}</p>
  <h2 ${S("pk-n","childName",`font-size:${bsFit(17.5,88,v("childName"))}cqw`)}>${esc(v("childName"))}</h2>
  <div ${Q("pk-age")}><span class="pk-badge" aria-hidden="true"><b>1</b></span><span>${C("first birthday","prvi rođendan")}</span></div>
  ${dt?`<p ${Q("pk-d","date")}><span>${esc(dt.wd)}</span><i></i><b>${cl==="sr"?`${dt.d}. ${esc(bsMon(dt,cl))}`:`${esc(dt.mon)} ${dt.d}`}</b><i></i><span data-f="time">${v("time")?esc(v("time"))+(cl==="sr"?" h":""):dt.y}</span></p>`:""}
  ${v("venue")||v("address")?`<p ${Q("pk-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${v("message")?`<p ${Q("pk-m","message")}>${br(v("message"))}</p>`:""}
  ${v("hosts")?`<p ${Q("pk-h","hosts")}>${esc(v("hosts"))}</p>`:""}
  ${rs?`<p ${Q("pk-s","rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`,
 b_gold:({v,dt,rs,cl,C,Q,S})=>`<p ${Q("bg-k")}>${C("You are invited to celebrate","Pozivam vas na proslavu")}</p>
  <div ${Q("bg-hero","name")}><b aria-hidden="true">18</b><h2 style="font-size:${bsFit(15,72,v("name"))}cqw">${esc(v("name"))}</h2></div>
  <p ${Q("bg-occ")}>${C("Eighteenth birthday","Osamnaesti rođendan")}</p>
  ${dt?`<div ${Q("bg-d","date")}><span>${esc(dt.wd)}</span><b>${dt.d}. ${esc(bsMon(dt,cl))}</b><span data-f="time">${v("time")?esc(v("time")):dt.y}</span></div>`:""}
  ${v("venue")||v("address")?`<p ${Q("bg-v","venue")}>${v("venue")?`<b>${esc(v("venue"))}</b>`:""}${v("address")?`<span data-f="address">${esc(v("address"))}</span>`:""}</p>`:""}
  ${v("message")?`<p ${Q("bg-m","message")}>${br(v("message"))}</p>`:""}${bsFoot(v,rs,C,Q,"bg-s")}`
};
// Disko poljubac: tap a balloon, the kiss, a star or the disco ball and it bounces with a little glitter
document.addEventListener("pointerdown",e=>{const it=e.target.closest?.(":is(.tid-e_kiss,.tid-e_cherry) :is(.ks-it,.ks-age i,.ks-me)");const c=it&&it.closest(".tid-e_kiss,.tid-e_cherry");if(!it||!(c.classList.contains("animate")||c.closest(".pq.read"))||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
 it.animate({scale:[1,1.2,.92,1.05,1]},{duration:650,easing:"ease-out"});
 const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;
 for(let i=0;i<12;i++){const s=document.createElement("i"),an=Math.random()*Math.PI*2,d=5+Math.random()*11;s.className="ru-spark ks-spark"+(i%3?"":" red");s.style.cssText=`left:${f1(x)}%;top:${f1(y)}%;--dx:${f1(Math.cos(an)*d)}cqw;--dy:${f1(Math.sin(an)*d-3)}cqw;--s:${f1(.6+Math.random()*1.3)}cqw;--t:${Math.round(650+Math.random()*550)}ms`;c.appendChild(s);s.addEventListener("animationend",()=>s.remove())}});
// Bordo sjaj: wherever you tap the open card, a little gold glitter bursts out
document.addEventListener("pointerdown",e=>{const c=e.target.closest?.(".tid-b_ruby.animate");if(!c||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
 const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;
 for(let i=0;i<16;i++){const s=document.createElement("i"),a=Math.random()*Math.PI*2,d=5+Math.random()*13;s.className="ru-spark";s.style.cssText=`left:${f1(x)}%;top:${f1(y)}%;--dx:${f1(Math.cos(a)*d)}cqw;--dy:${f1(Math.sin(a)*d-4)}cqw;--s:${f1(.5+Math.random()*1.3)}cqw;--t:${Math.round(700+Math.random()*600)}ms`;c.appendChild(s);s.addEventListener("animationend",()=>s.remove())}});
/* ---------- card renderer ---------- */
function renderCard(t,d,o={}){
 const cl=(d&&d.lang)||o.lang||LANG;const C=(en,sr)=>cl==="sr"?sr:en;
 d=d||defaultsOf(t,cl);const p=t.pal,f=t.font;let n=0;const R=k=>`class="r" style="--n:${n++}"${k?` data-f="${k}"`:""}`;
 const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rs=pd(v("rsvpBy"),cl);
 const div=`<div class="i-div r" style="--n:${n}"><i></i></div>`;
 const place=(a,b,k)=>(a||b)?`<p class="i-place" ${R(k)}>${a?`<b>${esc(a)}</b>`:""}${b?`<span>${esc(b)}</span>`:""}</p>`:"";
 const cols=tm=>dt?`<div class="i-cols" ${R("date")}><span>${esc(dt.wd)}</span><span class="mid"><b>${dt.d}${cl==="sr"?".":""}</b><i>${esc(dt.mon)} ${dt.y}${cl==="sr"?".":""}</i></span><span>${tm?esc(tm):"&nbsp;"}</span></div>`:"";
 const rsvp=rs?`<p class="i-small" ${R("rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:"";
 const msg=v("message")?`<p class="i-msg" ${R("message")}>${br(v("message"))}</p>`:"";
 const dress=v("dressCode")?`<p class="i-small" ${R("dressCode")}>Dress code · ${esc(v("dressCode"))}</p>`:"";
 const at=tm=>tm?`<span>${C("at","u")} ${esc(tm)}</span>`:"";
 let body="";
 switch(t.story?"story":BAS[t.id]?"bas":t.layout){
  case"estate":{const Q=(c,k)=>R(k).replace('class="r"','class="r '+c+'"');const a1=(v("partner1")[0]||"").toUpperCase(),a2=(v("partner2")[0]||"").toUpperCase();const tm=v("ceremonyTime");
   body=`<div class="es-mono" aria-hidden="true"><span>${esc(a1)}</span><span>${esc(a2)}</span></div>
   <p ${Q("es-k")}>${C("The marriage of","Venčanje")}</p>
   <h2 ${Q("es-n","partner1")}>${esc(v("partner1"))}</h2>${v("p1Last")?`<p ${Q("es-s","p1Last")}>${esc(v("p1Last"))}</p>`:""}
   <p ${Q("es-and")}>${C("and","i")}</p>
   <h2 ${Q("es-n","partner2")}>${esc(v("partner2"))}</h2>${v("p2Last")?`<p ${Q("es-s","p2Last")}>${esc(v("p2Last"))}</p>`:""}
   <span ${Q("es-orn")}><svg viewBox="0 0 120 12" aria-hidden="true"><path d="M2 6H46M74 6H118" stroke="currentColor" stroke-width=".8"/><path d="M60 1.2 63.6 6 60 10.8 56.4 6Z" fill="currentColor"/><path d="M48 6c3-3.2 6-3.2 8.4 0-2.4 3.2-5.4 3.2-8.4 0ZM72 6c-3-3.2-6-3.2-8.4 0 2.4 3.2 5.4 3.2 8.4 0Z" fill="none" stroke="currentColor" stroke-width=".8"/></svg></span>
   ${dt?`<p ${Q("es-d","date")}>${esc(dt.full)}</p>`:""}${tm?`<p ${Q("es-d","ceremonyTime")}>${C("at ","u ")}${esc(tm)}${cl==="sr"?" časova":""}</p>`:""}
   <span ${Q("es-orn")}><svg viewBox="0 0 120 12" aria-hidden="true"><path d="M2 6H46M74 6H118" stroke="currentColor" stroke-width=".8"/><path d="M60 1.2 63.6 6 60 10.8 56.4 6Z" fill="currentColor"/><path d="M48 6c3-3.2 6-3.2 8.4 0-2.4 3.2-5.4 3.2-8.4 0ZM72 6c-3-3.2-6-3.2-8.4 0 2.4 3.2 5.4 3.2 8.4 0Z" fill="none" stroke="currentColor" stroke-width=".8"/></svg></span>
   ${v("ceremonyVenue")?`<p ${Q("es-v","ceremonyVenue")}>${esc(v("ceremonyVenue"))}</p>`:""}${v("address")?`<p ${Q("es-a","address")}>${esc(v("address"))}</p>`:""}
   ${v("estLine")?`<p ${Q("es-sc","estLine")}>${esc(v("estLine"))}</p>`:""}`;break}
  case"letter":{const Q=(c,k)=>R(k).replace('class="r"','class="r '+c+'"');body=letterCard(d,cl,Q);break}
  case"bas":{const Q=(c,k)=>R(k).replace('class="r"','class="r '+c+'"'),S=(c,k,st)=>Q(c,k).replace('style="','style="'+st+";");body=BAS[t.id]({v,dt,rs,cl,C,Q,S});break}
  case"picture":{body=`<div class="pic-layers" aria-hidden="true">${PICL[t.id]||""}</div>${PIC_TXT[t.id]?PIC_TXT[t.id](v,dt,cl,R):""}<span class="pic-shine" aria-hidden="true"></span>`;break}
  case"rip":{const Q=(c,k)=>R(k).replace('class="r"','class="r '+c+'"');body=ripCard(d,cl,Q);break}
  case"bloom":{const Q=(c,k)=>R(k).replace('class="r"','class="r '+c+'"');body=bloomCard(d,cl,Q);break}
  case"plane":{const Q=(c,k)=>R(k).replace('class="r"','class="r '+c+'"');body=planeCard(d,cl,Q);break}
  case"honey":{const mon=dt?(cl==="sr"?DATES.sr.monG[dt.m-1]:dt.mon):"";const rsS=rs?(cl==="sr"?`${rs.d}. ${DATES.sr.monG[rs.m-1]}`:`${dt?"":""}${rs.d} ${DATES.en.mon[rs.m-1]}`):"";
   body=`<p class="bd-k r" style="--n:0">${C("You're invited to","Pozvani ste na")}</p><span class="bd-heart r" style="--n:1"><svg viewBox="0 0 60 26" aria-hidden="true"><path d="M30 22s-7-4.4-7-9.2a3.9 3.9 0 0 1 7-2.3 3.9 3.9 0 0 1 7 2.3c0 4.8-7 9.2-7 9.2z" fill="#1e1a14"/><path d="M14 8l-6-3M15 14H7M47 8l6-3M46 14h8" stroke="#f2b51c" stroke-width="2.4" stroke-linecap="round"/></svg></span>
   <h2 class="bd-t1 r" data-f="hyT1" style="--n:2;font-size:${f1(Math.min(12,150/Math.max((v("hyT1")||v("childName")).length,1)))}cqw">${esc(v("hyT1")||v("childName"))}</h2>${v("hyT2")?`<p class="bd-t2 r" data-f="hyT2" style="--n:3;font-size:${f1(Math.min(21,150/Math.max(v("hyT2").length,1)))}cqw">${esc(v("hyT2"))}</p>`:""}<span class="bd-dash r" style="--n:4"><svg viewBox="0 0 240 30" aria-hidden="true"><path d="M8 22 C60 26 96 24 112 16 C122 10 116 2 110 6 C104 10 112 18 120 18 C128 18 136 10 130 6 C124 2 118 10 128 16 C144 24 186 26 232 20" fill="none" stroke="#1e1a14" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round"/></svg></span>
   ${v("hyJoin")?`<p class="bd-join r" data-f="hyJoin" style="--n:5">${br(v("hyJoin"))}</p>`:""}
   <div class="bd-cols r" style="--n:6"><div data-f="date">${dt?`<small>${esc(dt.wd)}</small><b>${dt.d}</b><small>${esc(mon)}</small>`:""}</div><div data-f="time">${v("time")?`<small>${esc(v("time"))}${cl==="sr"?"h":""}</small>`:""}<i><svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 20s-9-5.4-9-11.3A5 5 0 0 1 12 6a5 5 0 0 1 9 2.7C21 14.6 12 20 12 20z" fill="#f2b51c"/></svg></i>${v("venue")?`<span>${esc(v("venue"))}</span>`:""}${v("address")?`<span>${esc(v("address"))}</span>`:""}</div><div data-f="rsvpBy"><small>${C("RSVP","Potvrda")}</small>${rsS?`<span>${C("by","do")} ${esc(rsS)}</span>`:""}${v("rsvpContact")?`<span>${esc(v("rsvpContact"))}</span>`:""}</div></div>
   ${v("signoff")?`<p class="bd-sign r" data-f="signoff" style="--n:7">${br(v("signoff"))}</p>`:""}`;break}
  case"lace":{const n1=esc(v("partner1")),n2=esc(v("partner2"));const ini=esc(((v("partner1")[0]||"")+"&"+(v("partner2")[0]||"")).toUpperCase());const dl=dt?(cl==="sr"?`${esc(dt.wd)}, ${dt.d}. ${esc(DATES.sr.monG?DATES.sr.monG[dt.m-1]:dt.mon)} ${dt.y}.`:`${esc(dt.wd)}, ${esc(dt.mon)} ${dt.d}, ${dt.y}`):"";
   const cer=[v("ceremonyTime")&&`${C("Ceremony","Venčanje")} ${esc(v("ceremonyTime"))}`,v("ceremonyVenue")&&esc(v("ceremonyVenue"))].filter(Boolean).join(" · ");const rec=[v("receptionTime")&&`${C("Reception","Proslava")} ${esc(v("receptionTime"))}`,v("receptionVenue")&&esc(v("receptionVenue"))].filter(Boolean).join(" · ");
   body=`<div class="lc-mono r" style="--n:0"><svg class="lc-wr" viewBox="0 0 120 110" aria-hidden="true"><defs><linearGradient id="lcG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a8"/><stop offset=".45" stop-color="#c99a4b"/><stop offset=".7" stop-color="#f3dc9c"/><stop offset="1" stop-color="#a87a35"/></linearGradient></defs><g fill="url(#lcG)">${Array.from({length:8},(_,k)=>{const th=(108+k*17)*Math.PI/180,x=60+42*Math.cos(th),y=54+42*Math.sin(th),r=(108+k*17+90);const xr=120-x;return`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7.5" ry="2.8" transform="rotate(${(r+25).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/><ellipse cx="${xr.toFixed(1)}" cy="${y.toFixed(1)}" rx="7.5" ry="2.8" transform="rotate(${(-r-25).toFixed(0)} ${xr.toFixed(1)} ${y.toFixed(1)})"/>`}).join("")}</g><path d="M48 97 q12 -8 24 0 M60 94 q-6 8 -10 14 M60 94 q6 8 10 14" stroke="url(#lcG)" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg><b>${ini}</b></div>${v("hosts")?`<p class="lc-cap r" ${R("hosts")}>${esc(v("hosts"))}</p>`:""}<h2 class="lc-names r" data-f="partner1" style="--n:${n++}"><span>${n1}</span><em>&amp;</em><span>${n2}</span></h2>${v("message")?`<p class="lc-msg r" ${R("message")}>${esc(v("message"))}</p>`:""}${dl?`<p class="lc-date r" ${R("date")}>${dl}</p>`:""}<i class="lc-rule r" style="--n:${n++}"></i>${cer?`<p class="lc-ev r" ${R("ceremonyVenue")}>${cer}</p>`:""}${rec?`<p class="lc-ev r" ${R("receptionVenue")}>${rec}</p>`:""}${v("address")?`<p class="lc-small r" ${R("address")}>${esc(v("address"))}</p>`:""}${v("dressCode")?`<p class="lc-small r" ${R("dressCode")}>Dress code · ${esc(v("dressCode"))}</p>`:""}${rs?`<p class="lc-small r" ${R("rsvpBy")}>${C("Kindly reply by","Molimo potvrdite dolazak do")} ${esc(rs.short)}</p>`:""}`;break}
  case"gold":{const n1=esc(v("partner1")),n2=esc(v("partner2"));const y=parseInt(v("age"))||0;const dots=dt?`${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}`:"";
   body=`<span class="gc-disc" aria-hidden="true"><span class="gc-lab"><b>${y||"♥"}</b><small>${y?C("years","godina"):""}</small></span></span><p class="gc-k r" style="--n:0">${C("Our anniversary","Naša godišnjica")}</p><h2 class="gc-names r" data-f="partner1" style="--n:1">${n1}<em>&amp;</em>${n2}</h2>${dots?`<p class="gc-date r" data-f="date" style="--n:2">${dots}</p>`:""}${v("venue")?`<p class="gc-ven r" data-f="venue" style="--n:3">${esc(v("venue"))}</p>`:""}`;break}
  case"balloon":{const age=parseInt(v("age"))||"";
   body=`<span class="bc-b b1" aria-hidden="true"></span><span class="bc-b b2" aria-hidden="true"></span><span class="bc-b b3" aria-hidden="true"></span><span class="bc-b b4" aria-hidden="true"></span><p class="bc-k r" style="--n:0">${C("Birthday party","Rođendanska žurka")}</p><h2 class="bc-name r" data-f="childName" style="--n:1">${esc(v("childName"))}</h2>${age?`<p class="bc-age r" data-f="age" style="--n:2">${age}</p>`:""}${dt?`<p class="bc-date r" data-f="date" style="--n:3">${dt.d}. ${esc(dt.mon)}${v("time")?` · ${esc(v("time"))}`:""}</p>`:""}${v("venue")?`<p class="bc-ven r" data-f="venue" style="--n:4">${esc(v("venue"))}</p>`:""}`;break}
  case"sky":{const n1=esc(v("partner1")),n2=esc(v("partner2"));const dots=dt?`${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}`:"";
   body=`<span class="zc-stars" aria-hidden="true"></span><p class="zc-ini r" style="--n:0">${esc(skyInitials(d))}</p><p class="zc-k r" style="--n:1">${C("We're getting married","Venčavamo se")}</p><h2 class="zc-names r" data-f="partner1" style="--n:2">${n1}<em>&amp;</em>${n2}</h2>${dots?`<p class="zc-date r" data-f="date" style="--n:3">${dots}</p>`:""}${v("venue")?`<p class="zc-ven r" data-f="venue" style="--n:4">${esc(v("venue"))}</p>`:""}`;break}
  case"disco":case"discop":{const lines=v("title").split(/\n+/).map(x=>x.trim()).filter(Boolean);const lw=Math.max(1,...lines.map(x=>x.length));const tfs=Math.min(11,86/lw);
   const two=!!(v("num2")||v("name2"));const ns=Math.min(two?23:30,(two?46:60)/Math.max(1,v("num1").length,v("num2").length));
   const col=(nu,na,la,k)=>`<div class="dz-col">${v(nu)?`<b class="dz-num" data-f="${nu}">${esc(v(nu))}</b>`:""}${v(na)?`<em class="dz-name" data-f="${na}" style="font-size:${f1(Math.min(8.6,(two?30:62)/(Math.max(v(na).length,1)*.43)))}cqw">${esc(v(na))}</em>`:""}${v(la)?`<span class="dz-lab" data-f="${la}">${br(v(la))}</span>`:""}</div>`;
   const ic={cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" stroke-width="2.2" stroke-linecap="round"/></svg>',clk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/></svg>',pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>'};
   const info=[dt?`<div data-f="date">${ic.cal}<b>${dt.d}${cl==="sr"?".":""}</b><small>${esc(dt.mon.toUpperCase())}</small></div>`:"",v("time")?`<div data-f="time">${ic.clk}<small>${C("STARTS AT","POČETAK U")}</small><b>${esc(v("time"))}</b></div>`:"",(v("venue")||v("address"))?`<div data-f="venue">${ic.pin}<span>${esc(v("venue"))}</span><span>${esc(v("address"))}</span></div>`:""].filter(Boolean);
   body=`<div class="dz-glow" aria-hidden="true"></div>
   ${v("brand")?`<p class="dz-brand" ${R("brand")}>${esc(v("brand"))}</p>`:""}${v("brandSub")?`<p class="dz-sub" ${R("brandSub")}><i></i><span>${esc(v("brandSub"))}</span><i></i></p>`:""}
   ${v("inviteLine")?`<p class="dz-inv" ${R("inviteLine")}>${esc(v("inviteLine"))}</p>`:""}${lines.length?`<h2 class="dz-title r" data-f="title" style="--n:${n++};font-size:${f1(tfs)}cqw">${lines.map(esc).join("<br>")}</h2>`:""}
   <div class="dz-nums${two?"":" one"} r" style="--n:${n++};--ns:${f1(ns)}cqw">${col("num1","name1","label1")}${two?`<span class="dz-amp"><i></i><b>&amp;</b><i></i></span>${col("num2","name2","label2")}`:""}</div>
   ${v("message")?`<p class="dz-msg" ${R("message")}>${br(v("message"))}</p>`:""}
   <p class="dz-div r" style="--n:${n++}"><i></i><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0C10.6 6.5 13.5 9.4 20 10 13.5 10.6 10.6 13.5 10 20 9.4 13.5 6.5 10.6 0 10 6.5 9.4 9.4 6.5 10 0Z" fill="currentColor"/></svg><i></i></p>
   ${info.length?`<div class="dz-info r" style="--n:${n++};--c:${info.length}">${info.join("")}</div>`:""}
   ${v("signoff")?`<p class="dz-sign" ${R("signoff")}>${esc(v("signoff"))}</p>`:""}<p class="dz-heart r" style="--n:${n++}"><i></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.1 3 4.5 6.6 4.5c2.2 0 3.7 1.2 5.4 3.2 1.7-2 3.2-3.2 5.4-3.2 3.6 0 5.7 3.6 4.2 7.1C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg><i></i></p>${rsvp}`;break}
  case"era":{const hl=(v("headline")||numWords(v("age"),cl)).toUpperCase();const fs=Math.min(13.5,118/Math.max(hl.length,1));const a=parseInt(v("age"))||0;const nm=v("name");
   const line=cl==="sr"?`${nm}${a?` · ${a}. rođendan`:""}`:`${nm}${nm?"'s ":""}${a?ordEn(a)+" ":""}Birthday`;
   const u=v("photo");const okImg=PHOTO_RE.test(u);
   const rsS=rs?(cl==="sr"?`${rs.d}. ${DATES.sr.monG[rs.m-1]}`:`${DATES.en.mon[rs.m-1]} ${ordEn(rs.d)}`):"";
   const ex=v("extras").split(/\s*[·•|]\s*/).filter(Boolean).map(esc).join("<i>•</i>");
   body=`${hl?`<h2 class="er-hl r" data-f="${v("headline")?"headline":"age"}" style="font-size:${f1(fs)}cqw;--n:0">${esc(hl)}</h2>`:""}${v("tagline")?`<div class="er-tag r" data-f="tagline" style="--n:1"><span></span><em>${esc(v("tagline"))}</em><span></span></div>`:`<span class="er-rule" style="margin-top:2cqw"></span>`}
   <div class="er-ph r" data-f="photo" style="--n:2">${okImg?`<img src="${u}" alt="">`:`${SKY}<span class="hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>${C("Your photo here","Ovde ide vaša fotografija")}</span>`}</div>
   <span class="er-rule"></span><p class="er-cap r" style="--n:3">${C("Come celebrate with me","Proslavite sa mnom")}</p>${line.trim()?`<p class="er-name r" data-f="name" style="--n:4">${esc(line)}</p>`:""}
   <div class="er-info r" style="--n:5"><div data-f="date">${dt?`<span>${esc(dt.wd)}</span><span>${esc(dt.mon)}</span><b>${dt.d}</b>`:""}${v("time")?`<span>${esc(v("time"))}</span>`:""}</div><div data-f="venue">${v("venue")?`<span>${esc(v("venue"))}</span>`:""}${v("address")?`<span>${esc(v("address"))}</span>`:""}</div><div data-f="rsvpContact"><span>${C("RSVP","Potvrda")}</span>${v("rsvpContact")?`<span>${esc(v("rsvpContact"))}</span>`:""}${rsS?`<span>${C("by","do")} ${esc(rsS)}</span>`:""}</div></div>
   ${ex?`<span class="er-rule"></span><p class="er-ex r" data-f="extras" style="--n:6">${ex}</p>`:""}`;break}
  case"vinyl":{const n1=esc(v("partner1")),n2=esc(v("partner2")),ini=esc(((v("partner1")[0]||"")+(v("partner2")[0]||"")).toUpperCase());
   body=`<div class="vy-top" aria-hidden="true"><span class="vy-disc"></span><span class="vy-sleeve"><b>${ini}</b><small>${C("Side A","Strana A")}${dt?" · "+dt.y:""}</small></span></div><p class="vy-mono" ${R()}>${C("Side A · Our wedding","Strana A · Naše venčanje")}</p><h2 class="vy-names" ${R("partner1")}>${n1}<em>&amp;</em>${n2}</h2>${dt?`<p class="vy-date" ${R("date")}>${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}</p>`:""}${place(v("venue"),v("address"),"venue").replace('class="i-place"','class="vy-venue"')}${v("songName")?`<p class="vy-song" ${R("songName")}>♪ ${esc(v("songName"))}</p>`:""}${rs?`<p class="vy-mono sm" ${R("rsvpBy")}>${C("RSVP by","Potvrda do")} ${esc(rs.short)}</p>`:""}`;break}
  case"cherry":{const cam=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>`;
   const ph=k=>{const u=v(k);return`<div class="ph" data-f="${k}">${PHOTO_RE.test(u)?`<img src="${u}" alt="">`:`<span style="color:var(--c-ink)">${cam}</span>`}</div>`};
   const w=C(["Happy","Birthday"],["Srećan","Rođendan"]);const num=dt?`${dt.d}.${dt.m}.${dt.y}.`.replace(/\.$/,cl==="sr"?".":""):"";
   body=`<div class="ch-top"><p class="ch-hello r" style="--n:0">${C("Hello","Dragi")}<b>${C("everyone","prijatelji")}</b></p><span class="ch-rule"></span>${v("message")?`<p class="ch-msg r" data-f="message" style="--n:1">${esc(v("message"))}</p>`:""}</div>
   <div class="ch-mid"><div class="ch-script" aria-hidden="true"><span>${w[0]}</span><span>${w[1]}</span><span>${w[0]}</span><span>${w[1]}</span></div>
   <div class="ch-polaroid">${ph("photo")}</div><div class="ch-strip">${ph("photo1")}${ph("photo2")}${ph("photo3")}${ph("photo4")}</div>
   <div class="ch-name r" data-f="name" style="--n:2"><b>${esc(v("name"))}</b><span>${C("Eighteenth birthday","Osamnaesti rođendan")}</span></div></div>
   <div class="ch-bottom"><div class="r" data-f="time" style="--n:3">${v("time")?`<b>${esc(v("time"))}</b>`:""}${v("venue")?`<span>${C("at","u")} ${esc(v("venue"))}</span>`:""}${v("address")?`<span>${esc(v("address"))}</span>`:""}</div>
   <div class="ch-cherry" aria-hidden="true"><svg viewBox="0 0 60 72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M30 20C27 32 21 42 16 51M30 20C33 32 39 42 44 51"/><circle cx="15" cy="58" r="9" fill="currentColor" fill-opacity=".14"/><circle cx="45" cy="58" r="9" fill="currentColor" fill-opacity=".14"/><path d="M30 20c-8-11-19-11-19-4s11 7 19 4zM30 20c8-11 19-11 19-4s-11 7-19 4z"/><path d="M28 22l-7 11M32 22l7 11"/><path d="M10 55q2-3 5-3M40 55q2-3 5-3"/></svg></div>
   <div class="rt r" data-f="date" style="--n:4">${num?`<b>${num}</b>`:""}${v("dressCode")?`<span>Dress code: ${esc(v("dressCode"))}</span>`:""}</div></div>
   ${rs?`<p class="ch-rsvp r" data-f="rsvpBy" style="--n:5">${C("RSVP by","Potvrda dolaska do")} ${esc(rs.short)}</p>`:""}`;break}
  case"story":body=`<p class="i-eye" ${R()}>${C("Once upon a time…","Bilo jednom…")}</p>${v("childName")?`<h2 class="i-name" ${R("childName")}>${esc(v("childName"))}</h2>`:""}<p class="i-cap" ${R()}>${C("is turning one","puni prvu godinu")}</p>${div}${msg}${dt?`<p class="i-date" ${R("date")}>${esc(dt.full)}</p>`:""}${v("time")?`<p class="i-small" ${R("time")}>${C("Promptly at","Tačno u")} ${esc(v("time"))}</p>`:""}${place(v("venue"),v("address"),"venue")}${rs?`<p class="i-small" ${R("rsvpBy")}>${C("Please RSVP before the clock strikes midnight, by","Potvrdite dolazak pre nego što sat otkuca ponoć, do")} ${esc(rs.short)}</p>`:""}${v("hosts")?`<p class="i-eye r" data-f="hosts" style="font-size:5.4cqw;--n:${n++}">${esc(v("hosts"))}</p>`:""}`;break;
  case"first":body=`<p class="i-eye" ${R()}>${C("Join us to celebrate","Pridružite nam se na proslavi")}</p>${v("childName")?`<h2 class="i-name" ${R("childName")}>${esc(v("childName"))}</h2>`:""}<div class="i-age" ${R()}><span class="i-num">1<sup>${C("st",".")}</sup></span><span class="i-cap">${C("Birthday","rođendan")}</span></div>${dt?`<p class="i-when" ${R("date")}><b>${esc(dt.full)}</b>${at(v("time"))}</p>`:""}${place(v("venue"),v("address"),"venue")}${msg}${v("hosts")?`<p class="i-eye r" data-f="hosts" style="font-size:4.6cqw;--n:${n++}">${esc(v("hosts"))}</p>`:""}${rsvp}`;break;
  case"eighteen":body=`<p class="i-cap" ${R()}>${C("You are invited to celebrate","Pozivamo vas na proslavu")}</p>${v("name")?`<h2 class="i-name" ${R("name")}>${esc(v("name"))}</h2>`:""}<div class="i-age" ${R()}><span class="i-num">18</span><span class="i-cap">${C("Eighteenth birthday","Osamnaesti rođendan")}</span></div>${cols(v("time"))}${place(v("venue"),v("address"),"venue")}${msg}${dress}${rsvp}`;break;
  case"wedding":{const cer=v("ceremonyVenue")||v("ceremonyTime"),rec=v("receptionVenue")||v("receptionTime");body=`${v("hosts")?`<p class="i-cap" ${R("hosts")}>${esc(v("hosts"))}</p>`:""}<h2 class="i-names" ${R("partner1")}><span>${esc(v("partner1"))}</span><em>&amp;</em><span>${esc(v("partner2"))}</span></h2>${msg}${cols("")}<div class="i-ev${cer&&rec?"":" one"}" ${R()}>${cer?`<div><h4>${C("Ceremony","Venčanje")}</h4><p>${v("ceremonyTime")?`<b>${esc(v("ceremonyTime"))}</b>`:""}${esc(v("ceremonyVenue"))}</p></div>`:""}${rec?`<div><h4>${C("Reception","Proslava")}</h4><p>${v("receptionTime")?`<b>${esc(v("receptionTime"))}</b>`:""}${esc(v("receptionVenue"))}</p></div>`:""}</div>${v("address")?`<p class="i-small" ${R("address")}>${esc(v("address"))}</p>`:""}${dress}${rsvp}`;break}
  case"christening":body=`<p class="i-eye" ${R()}>${C("Please join us for the christening of","Pozivamo vas na krštenje")}</p>${v("childName")?`<h2 class="i-name" ${R("childName")}>${esc(v("childName"))}</h2>`:""}${div}${cols(v("time"))}<div class="i-ev${v("church")&&v("receptionVenue")?"":" one"}" ${R()}>${v("church")?`<div><h4>${C("Blessing","Krštenje")}</h4><p>${esc(v("church"))}</p></div>`:""}${v("receptionVenue")?`<div><h4>${C("Celebration","Proslava")}</h4><p>${esc(v("receptionVenue"))}</p></div>`:""}</div>${v("address")?`<p class="i-small" ${R("address")}>${esc(v("address"))}</p>`:""}${msg}${v("hosts")?`<p class="i-eye r" data-f="hosts" style="font-size:5cqw;--n:${n++}">${esc(v("hosts"))}</p>`:""}${rsvp}`;break;
  default:body=`<p class="i-eye" ${R()}>${C("You're invited","Pozvani ste")}</p>${v("occasion")?`<h2 class="i-name" ${R("occasion")} style="font-size:9.5cqw">${esc(v("occasion"))}</h2>`:""}${v("hostNames")?`<p class="i-cap" ${R("hostNames")}>${C("Hosted by","Domaćini:")} ${esc(v("hostNames"))}</p>`:""}${div}${cols(v("time"))}${place(v("venue"),v("address"),"venue")}${msg}${dress}${rsvp}`;
 }
 const m=MOTIFS[t.motif](t,d);
 const style=`--c-bg:${p.bg};--c-bg2:${p.bg2};--c-ink:${p.ink};--c-accent:${p.accent};--c-soft:${p.soft};--c-x1:${p.x1};--c-x2:${p.x2};--c-x3:${p.x3};--f-d:${f.d};--f-s:${f.s};--f-b:${f.b};--pt:${t.pt||24};--pb:${t.pb||22};--pl:${t.pl||10};--pr:${t.pr||10}${t.art?`;--art:var(--a-${t.art})`:""}`;
 return `<div class="inv-c${o.fixed?" fixed":""}"><article class="inv inv-${t.motif} k-${t.kind} tid-${t.id}${t.tier?" tier-"+t.tier:""}${t.frame?" fr-"+t.frame:""}${t.arch?" arch":""}${t.art?" has-art":""}${o.anim?" animate":""}" style="${style}" lang="${cl==="sr"?"sr-Latn":"en"}" aria-label="${esc(titleOf(t,{...d,lang:cl}))}"><div class="inv-bg">${m.bg||""}</div><div class="inv-top">${m.top||""}</div><div class="inv-body">${body}</div><div class="inv-bot">${m.bottom||""}</div>${t.fx&&(o.anim||o.fx)?fxHTML(t.fx):""}</article></div>`;
}

/* ---------- data layer ---------- */
function statsOf(gs){const s={invited:gs.length,opened:0,yes:0,no:0,pending:0,people:0};for(const g of gs){if(g.openedAt||g.status!=="pending")s.opened++;if(g.status==="yes"){s.yes++;s.people+=Number(g.count)||1}else if(g.status==="no")s.no++;else s.pending++}return s}
const Remote={
 kind:"server",
 async q(method,path,body){const h={"X-Lang":LANG};if(body)h["Content-Type"]="application/json";const pre=method==="GET"&&takePre(path);const r=(pre&&await pre.catch(()=>null))||await fetch("/api"+path,{method,headers:h,body:body?JSON.stringify(body):undefined,credentials:"same-origin"});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||L("Something went wrong. Please try again.","Nešto nije u redu. Pokušajte ponovo."));return j},
 me(){return this.q("GET","/me").then(j=>j.user)},
 signup(name,email,password){return this.q("POST","/auth/signup",{name,email,password}).then(j=>j.user)},
 login(email,password){return this.q("POST","/auth/login",{email,password}).then(j=>j.user)},
 logout(){return this.q("POST","/auth/logout")},
 list(){return this.q("GET","/invitations").then(j=>j.invitations)},
 get(id){return this.q("GET","/invitations/"+id)},
 create(templateId,data){return this.q("POST","/invitations",{templateId,data}).then(j=>j.invitation)},
 update(id,templateId,data){return this.q("PUT","/invitations/"+id,{templateId,data}).then(j=>j.invitation)},
 remove(id){return this.q("DELETE","/invitations/"+id)},
 config(){return this.q("GET","/config")},
 adminList(){return this.q("GET","/admin/invitations").then(j=>j.invitations)},
 adminUsers(){return this.q("GET","/admin/users").then(j=>j.users)},
 preview(id,b){return this.q("POST",`/invitations/${id}/preview`,b)},
 adminUserPw(id){return this.q("POST",`/admin/users/${id}/password`).then(j=>j.password)},
 sendRequest(r){return this.q("POST","/requests",r)},
 adminRequests(){return this.q("GET","/admin/requests").then(j=>j.requests)},
 adminRequestSet(id,status){return this.q("POST",`/admin/requests/${id}/status`,{status})},
 adminSet(id,status){return this.q("POST",`/admin/invitations/${id}/status`,{status})},
 addGuest(id,name,contact){return this.q("POST",`/invitations/${id}/guests`,{name,contact}).then(j=>j.guest)},
 removeGuest(id,gid){return this.q("DELETE",`/invitations/${id}/guests/${gid}`)},
 updateGuest(id,gid,b){return this.q("PATCH",`/invitations/${id}/guests/${gid}`,b).then(j=>j.guest)},
 pub(slug,token){return this.q("GET",`/public/${slug}${token?"?g="+encodeURIComponent(token):""}`)},
 rsvp(slug,body){return this.q("POST",`/public/${slug}/rsvp`,body)},
 link(slug,token){return `${location.origin}/i/${slug}${token?"?g="+token:""}`}
};
async function hashPw(pw,salt){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+":"+pw));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch(e){let h=0;for(const c of salt+pw)h=(h*31+c.charCodeAt(0))|0;return"x"+h}}
const Local={
 kind:"local",db:null,
 load(){if(!this.db)this.db=LS.get("paperlace.db",{users:[],invites:[],guests:[]});return this.db},
 save(){try{localStorage.setItem("paperlace.db",JSON.stringify(this.db))}catch(e){if(e&&e.name==="QuotaExceededError")throw new Error(L("This browser is out of storage space. Use fewer photos.","Pregledač nema dovoljno prostora. Koristite manje fotografija."))}},
 uid(){return LS.get("paperlace.session",null)},
 user(){const id=this.uid();const u=this.load().users.find(u=>u.id===id);return u?{id:u.id,name:u.name,email:u.email}:null},
 need(){const u=this.user();if(!u)throw new Error(L("Please sign in to continue.","Prijavite se da biste nastavili."));return u},
 own(id){const u=this.need();const inv=this.load().invites.find(i=>i.id===id&&i.ownerId===u.id);if(!inv)throw new Error(L("We couldn't find that invitation.","Nismo pronašli tu pozivnicu."));return inv},
 async me(){return this.user()},
 async signup(name,email,password){name=(name||"").trim();email=(email||"").trim().toLowerCase();if(!name)throw new Error(L("Please enter your name.","Unesite svoje ime."));if(!/^\S+@\S+\.\S+$/.test(email))throw new Error(L("Please enter a valid email address.","Unesite ispravnu imejl adresu."));if((password||"").length<8)throw new Error(L("Use at least 8 characters for your password.","Lozinka mora imati najmanje 8 karaktera."));const db=this.load();if(db.users.some(u=>u.email===email))throw new Error(L("An account with this email already exists. Sign in instead.","Nalog sa ovom imejl adresom već postoji. Prijavite se."));const salt=rid(12),u={id:rid(12),name,email,salt,hash:await hashPw(password,salt),createdAt:Date.now()};db.users.push(u);this.save();LS.set("paperlace.session",u.id);return this.user()},
 async login(email,password){email=(email||"").trim().toLowerCase();const u=this.load().users.find(u=>u.email===email);if(!u||u.hash!==await hashPw(password||"",u.salt))throw new Error(L("That email and password don't match. Try again.","Imejl i lozinka se ne poklapaju. Pokušajte ponovo."));LS.set("paperlace.session",u.id);return this.user()},
 async logout(){LS.del("paperlace.session")},
 async list(){const u=this.need(),db=this.load();return db.invites.filter(i=>i.ownerId===u.id).sort((a,b)=>b.createdAt-a.createdAt).map(i=>({...i,stats:statsOf(db.guests.filter(g=>g.invitationId===i.id))}))},
 async get(id){const inv=this.own(id);const gs=this.load().guests.filter(g=>g.invitationId===id).sort((a,b)=>a.createdAt-b.createdAt);return{invitation:inv,guests:gs,stats:statsOf(gs)}},
 async create(templateId,data){const u=this.need();const tt=TM[templateId];const inv={id:rid(10),slug:rid(8),ownerId:u.id,templateId,data,tier:tt&&tt.tier||null,status:tt&&tt.tier&&PAYMENTS?"pending":"active",createdAt:Date.now(),updatedAt:Date.now(),views:0};this.load().invites.push(inv);this.save();return inv},
 async update(id,templateId,data){const inv=this.own(id);Object.assign(inv,{templateId,data,updatedAt:Date.now()});this.save();return inv},
 async setStatus(id,st){const inv=this.own(id);inv.status=st;this.save();return inv},
 async sendRequest(r){const db=this.load();db.requests=db.requests||[];db.requests.push({...r,id:Math.random().toString(36).slice(2,10),createdAt:Date.now(),status:"new"});this.save();return{ok:true}},
 async adminRequests(){return(this.load().requests||[]).slice().reverse()},
 async adminRequestSet(id,st){const x=(this.load().requests||[]).find(r=>r.id===id);if(x){x.status=st;this.save()}return{ok:true}},
 async remove(id){this.own(id);const db=this.load();db.invites=db.invites.filter(i=>i.id!==id);db.guests=db.guests.filter(g=>g.invitationId!==id);this.save();return{ok:true}},
 async addGuest(id,name,contact){this.own(id);name=(name||"").trim();if(!name)throw new Error(L("Please enter the guest's name.","Unesite ime gosta."));const g={id:rid(10),invitationId:id,token:rid(12),name,contact:(contact||"").trim(),status:"pending",count:1,note:"",source:"personal",createdAt:Date.now(),openedAt:null,respondedAt:null};this.load().guests.push(g);this.save();return g},
 async updateGuest(id,gid,b){this.own(id);const db=this.load();const g=db.guests.find(x=>x.id===gid&&x.invitationId===id);if(!g)throw new Error(L("We couldn't find that guest.","Nismo pronašli tog gosta."));if((b.name||"").trim())g.name=b.name.trim().slice(0,80);if(["yes","no","pending"].includes(b.status)){g.status=b.status;if(b.status!=="pending"&&!g.respondedAt)g.respondedAt=Date.now();if(b.status==="pending")g.respondedAt=null}g.count=g.status==="yes"?Math.max(1,Math.min(50,parseInt(b.count)||1)):g.status==="no"?0:1;this.save();return g},
 async removeGuest(id,gid){this.own(id);const db=this.load();db.guests=db.guests.filter(g=>!(g.id===gid&&g.invitationId===id));this.save();return{ok:true}},
 async pub(slug,token){const db=this.load();const inv=db.invites.find(i=>i.slug===slug);if(!inv)throw new Error(L("This invitation doesn't exist or was removed by the host.","Ova pozivnica ne postoji ili ju je domaćin uklonio."));if(PAYMENTS&&inv.status==="pending"&&!(this.user()&&this.user().id===inv.ownerId))return{inactive:true};inv.views=(inv.views||0)+1;let g=token?db.guests.find(x=>x.token===token&&x.invitationId===inv.id):null;if(g&&!g.openedAt)g.openedAt=Date.now();this.save();return{invitation:{slug:inv.slug,templateId:inv.templateId,data:inv.data},guest:g?{name:g.name,status:g.status,count:g.count,note:g.note,token:g.token,source:g.source}:null}},
 async rsvp(slug,b){const db=this.load();const inv=db.invites.find(i=>i.slug===slug);if(!inv)throw new Error(L("This invitation doesn't exist anymore.","Ova pozivnica više ne postoji."));if(!["yes","no"].includes(b.status))throw new Error(L("Please choose whether you can attend.","Izaberite da li dolazite."));let g=b.token?db.guests.find(x=>x.token===b.token&&x.invitationId===inv.id):null;if(!g){const name=(b.name||"").trim();if(!name)throw new Error(L("Please tell the host your name.","Napišite domaćinu svoje ime."));g={id:rid(10),invitationId:inv.id,token:rid(12),name,contact:"",source:"link",createdAt:Date.now(),openedAt:Date.now()};db.guests.push(g)}else if(b.name&&g.source==="link")g.name=String(b.name).trim().slice(0,80)||g.name;Object.assign(g,{status:b.status,count:b.status==="yes"?Math.max(1,Math.min(20,Number(b.count)||1)):0,note:String(b.note||"").slice(0,500),respondedAt:Date.now()});this.save();return{token:g.token,guest:{name:g.name,status:g.status,count:g.count,note:g.note,token:g.token,source:g.source}}},
 link(slug,token){return `${location.href.split("#")[0]}#invite-${slug}${token?"-"+token:""}`}
};
let API=location.protocol==="file:"?Local:Remote,ME=null;

/* ---------- storybook (animated invitation) ---------- */
const STORY={
 castle:(id)=>`<svg class="st-art" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
 <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9D9E8"/><stop offset=".5" stop-color="#F2E9D8"/><stop offset="1" stop-color="#EEE1C8"/></linearGradient>
 <radialGradient id="${id}sun" cx=".55" cy=".3" r=".55"><stop offset="0" stop-color="#FFF7E4" stop-opacity=".95"/><stop offset="1" stop-color="#FFF7E4" stop-opacity="0"/></radialGradient>
 <radialGradient id="${id}vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#7A5A30" stop-opacity="0"/><stop offset="1" stop-color="#7A5A30" stop-opacity=".35"/></radialGradient>
 <filter id="${id}wc" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
 <filter id="${id}bl"><feGaussianBlur stdDeviation="7"/></filter>
 </defs>
 <rect width="360" height="640" fill="url(#${id}sky)"/><rect width="360" height="640" fill="url(#${id}sun)"/>
 <g filter="url(#${id}bl)" fill="#fff" opacity=".85" class="st-clouds"><ellipse cx="70" cy="150" rx="70" ry="20"/><ellipse cx="110" cy="138" rx="40" ry="18"/><ellipse cx="290" cy="110" rx="80" ry="22"/><ellipse cx="250" cy="200" rx="50" ry="14"/></g>
 <path d="M0 330L50 290L95 312L150 262L210 300L262 268L320 296L360 280V640H0Z" fill="#B7C7D8" opacity=".7"/>
 <path d="M0 395Q90 352 180 382T360 366V640H0Z" fill="#BCC99E"/>
 <g filter="url(#${id}wc)">
  <rect x="118" y="300" width="124" height="86" fill="#EEE7DB"/>
  ${[[106,24,252,48],[230,24,252,48],[142,22,222,58],[196,22,222,58],[166,28,168,86]].map(([x,w,top,h])=>`<rect x="${x}" y="${top}" width="${w}" height="${386-top}" fill="#F7F2E9"/><rect x="${x+w*.62}" y="${top}" width="${w*.38}" height="${386-top}" fill="#DCD2C2" opacity=".7"/><path d="M${x-4} ${top}L${x+w/2} ${top-h}L${x+w+4} ${top}Z" fill="#7C96BD"/><path d="M${x-4} ${top}L${x+w/2} ${top-h}L${x+w/2} ${top}Z" fill="#9AB1D0"/><path d="M${x+w/2} ${top-h}v-12" stroke="#B9965A" stroke-width="1.4"/><path d="M${x+w/2} ${top-h-12}l9 3-9 3z" fill="#C6A15B"/><path d="M${x+w/2-3} ${top+20}v-6a3 3 0 0 1 6 0v6z" fill="#8EA7C7"/>`).join("")}
  ${[0,1,2,3,4,5].map(i=>`<rect x="${120+i*21}" y="292" width="11" height="9" fill="#EEE7DB"/>`).join("")}
  <path d="M168 386v-30a12 12 0 0 1 24 0v30z" fill="#7F93AC"/>
 </g>
 <path d="M0 455Q120 418 220 452T360 438V640H0Z" fill="#A4B784"/>
 <path d="M180 386C158 430 214 470 172 520S150 600 196 640" fill="none" stroke="#EADCBF" stroke-width="20" stroke-linecap="round"/>
 <path d="M0 528C80 506 140 566 222 546S330 506 360 524" fill="none" stroke="#A9C9D9" stroke-width="13" opacity=".85"/>
 ${[[40,440,22],[66,452,16],[300,430,24],[326,446,16],[22,560,30],[338,580,28]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#7F9968"/><circle cx="${x-r*.3}" cy="${y-r*.35}" r="${r*.55}" fill="#93AC7C"/>`).join("")}
 <path d="M0 600Q100 570 200 596T360 590V640H0Z" fill="#8FA672"/>
 <rect width="360" height="640" fill="url(#${id}vig)"/></svg>`,
 clock:(id)=>`<svg class="st-art" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
 <linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2945"/><stop offset="1" stop-color="#3E5378"/></linearGradient>
 <radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient></defs>
 <rect width="360" height="640" fill="url(#${id}n)"/>
 ${(()=>{seed=9;let s="";for(let i=0;i<60;i++){const x=rnd()*360,y=rnd()*330,r=.6+rnd()*1.6;s+=`<circle class="tw" style="--d:${f1(rnd()*3)}s" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#fff"/>`}return s})()}
 <g transform="translate(0 116)"><path d="M60 640V430h40v-30l20-30 20 30v30h20" fill="#2E3E5E"/><path d="M300 640V440h-40v-40l-20-30-20 30v40" fill="#2E3E5E"/>
 <rect x="128" y="250" width="104" height="400" fill="#E7E1D5"/><rect x="196" y="250" width="36" height="400" fill="#CFC6B6"/>
 <path d="M116 252L180 70L244 252Z" fill="#8E9FBD"/><path d="M116 252L180 70L180 252Z" fill="#A6B5CF"/><path d="M180 70v-22" stroke="#C6A15B" stroke-width="2"/><circle cx="180" cy="44" r="4" fill="#C6A15B"/>
 <rect x="122" y="246" width="116" height="10" fill="#D6CDBD"/>
 <circle cx="180" cy="320" r="78" fill="url(#${id}g)"/>
 <circle cx="180" cy="320" r="44" fill="#FBF8F0" stroke="#C6A15B" stroke-width="4"/>
 ${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return`<line x1="${f1(180+36*Math.sin(a))}" y1="${f1(320-36*Math.cos(a))}" x2="${f1(180+40*Math.sin(a))}" y2="${f1(320-40*Math.cos(a))}" stroke="#3D4A6B" stroke-width="${i%3?1.5:3}"/>`}).join("")}
 <g class="st-hh"><rect x="178" y="296" width="4" height="26" rx="2" fill="#3D4A6B"/></g>
 <g class="st-mh"><rect x="179" y="284" width="2.4" height="38" rx="1.2" fill="#3D4A6B"/></g>
 <circle cx="180" cy="320" r="4" fill="#C6A15B"/>
 ${[[150,420],[190,420],[150,500],[190,500]].map(([x,y])=>`<path d="M${x} ${y+34}v-22a10 10 0 0 1 20 0v22z" fill="#F3D58C" class="tw" style="--d:${(x+y)%3}s"/>`).join("")}</g>
 </svg>`,
 frame:`<svg class="cv-frame" viewBox="0 0 300 440" preserveAspectRatio="none" aria-hidden="true"><rect x="14" y="14" width="272" height="412" rx="6" fill="none" stroke="#E0C27A" stroke-width="2.5" vector-effect="non-scaling-stroke"/><rect x="24" y="24" width="252" height="392" rx="3" fill="none" stroke="#E0C27A" stroke-width="1" opacity=".7" vector-effect="non-scaling-stroke"/></svg>`,
 corners:`<svg class="cv-corners" viewBox="0 0 300 440" aria-hidden="true">${[[0,0,1,1],[300,0,-1,1],[0,440,1,-1],[300,440,-1,-1]].map(([x,y,sx,sy])=>`<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="#E0C27A" stroke-width="1.6"><path d="M30 78C30 50 46 32 78 30M30 60c0-14 10-22 22-18 10 4 6 18-4 16M48 30c-12-2-18 8-12 16 6 6 14 0 12-6"/><circle cx="40" cy="40" r="3" fill="#E0C27A"/></g>`).join("")}</svg>`,
 dove:`<svg viewBox="-80 -80 170 120" aria-hidden="true"><path d="M-70 18Q-40 8-12 10Q8-14 40-14Q30-6 34 2Q58 0 74 8Q50 16 30 20Q0 34-34 28Q-52 26-70 18Z" fill="#fff" stroke="#9DB0CC" stroke-width="1.2"/><g class="st-wing"><path d="M-6 10Q-14-30-58-58Q-44-22-48 2Q-30 8-6 10Z" fill="#fff" stroke="#9DB0CC" stroke-width="1.2"/></g><path d="M8 8Q14-36 52-70Q46-30 38-6Z" fill="#F4F7FB" stroke="#9DB0CC" stroke-width="1.2"/><circle cx="44" cy="-4" r="2.2" fill="#3D4A6B"/><path d="M72 6l8 2-8 3z" fill="#E1B66C"/></svg>`
};
function storyHTML(t,d){
 const cl=d.lang||LANG;const C=(en,sr)=>cl==="sr"?sr:en;const p=t.pal;
 const name=esc((d.childName||"").trim()||C("Our princess","Naša princeza"));const rs=pd(d.rsvpBy,cl);const uid="s"+rid(5);
 return `<div class="story" style="--c-accent:${p.accent};--c-x1:${p.x1}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <div class="st-scene st-cover on" data-s="0"><div class="book"><div class="pg-under"><p>${C("Once upon a time…","Bilo jednom…")}</p></div><div class="cover">${STORY.frame}${STORY.corners}<div class="cv-title"><small>${C("A royal tale","Kraljevska priča")}</small><span class="cv-name">${name}</span><span class="cv-rule"></span><small>${C("A fairytale adventure","Bajkovita avantura")}</small></div></div></div><p class="st-hint">${C("Tap the book to open it","Dodirnite knjigu da je otvorite")}</p></div>
 <div class="st-scene st-castle" data-s="1"><div class="kb">${STORY.castle(uid+"a")}</div><div class="st-text bottom"><h3>${C("Once upon a time","Bilo jednom")}</h3><p>${C("in a kingdom not so far away, a magical celebration was about to begin…","u kraljevstvu ne tako dalekom, spremala se jedna čarobna proslava…")}</p></div></div>
 <div class="st-scene st-dove" data-s="2"><div class="kb2">${STORY.castle(uid+"b")}</div><div class="dove-fly">${STORY.dove}</div><div class="ribbon-msg"><span>${C("Your presence is requested","Vaše prisustvo je poželjno")}</span></div></div>
 <div class="st-scene st-details" data-s="3"><div class="st-card">${renderCard(t,d,{anim:true})}</div></div>
 <div class="st-scene st-clock" data-s="4">${STORY.clock(uid+"c")}<div class="st-text top light"><small>${C("Please RSVP","Molimo potvrdite dolazak")}</small><h3>${C("before the clock strikes midnight","pre nego što sat otkuca ponoć")}</h3>${rs?`<p>${C("by","do")} ${esc(rs.short)}</p>`:""}</div></div>
 <div class="st-scene st-end" data-s="5"><div class="end-pg"><p>${C("…and the magic reminded everyone that dreams really do come true.","…i čarolija je svima pokazala da se snovi zaista ostvaruju.")}</p><h3>${C("The End","Kraj")}</h3><span class="cv-rule"></span></div></div>
 <div class="st-ui"><div class="st-prog">${[1,2,3,4,5].map(i=>`<i data-i="${i}"><b></b></i>`).join("")}</div><button type="button" class="st-skip">${C("Skip","Preskoči")}</button></div>
 </div>`;
}
function playStory(host,t,d,onDone){
 host.innerHTML=storyHTML(t,d);const root=$(".story",host);const scenes=$$(".st-scene",root);const dur=[0,6500,5200,11000,7000,5500];let i=0,timer=null,done=false;
 const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
 const finish=()=>{if(done)return;done=true;clearTimeout(timer);onDone&&onDone()};
 const show=n=>{clearTimeout(timer);if(n>5)return finish();i=n;scenes.forEach((s,k)=>s.classList.toggle("on",k===n));root.dataset.s=n;
  $$(".st-prog i",root).forEach(el=>{const k=+el.dataset.i;el.className=k<n?"done":k===n?"cur":"";el.style.setProperty("--dur",dur[k]+"ms")});
  if(n>0)timer=setTimeout(()=>show(n+1),reduce?Math.min(dur[n],4000):dur[n])};
 root.addEventListener("click",e=>{if(e.target.closest(".st-skip")){finish();return}
  if(i===0){if(root.classList.contains("opening"))return;root.classList.add("opening");setTimeout(()=>show(1),reduce?50:1500);return}
  show(i+1)});
 root.tabIndex=0;root.setAttribute("role","button");root.setAttribute("aria-label",LANG==="sr"?"Animirana pozivnica, dodirnite za nastavak":"Animated invitation, tap to continue");
 root.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();root.click()}});
 show(0);
 return{stop(){done=true;clearTimeout(timer)}};
}
function storyOverlay(t,d){
 const ov=document.createElement("div");ov.className="story-ov";ov.innerHTML=`<div class="story-host"></div><button class="arrow x" aria-label="${L("Close","Zatvori")}">✕</button>`;
 document.body.appendChild(ov);document.body.style.overflow="hidden";
 const close=()=>{p.stop();ov.remove();if(!LB)document.body.style.overflow=""};
 const p=playStory($(".story-host",ov),t,d,()=>setTimeout(close,400));settle(ov);
 $(".x",ov).onclick=close;ov.addEventListener("click",e=>{if(e.target===ov)close()});
 ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()});$(".story",ov).focus();
}

function shrink(file,max){return new Promise((res,rej)=>{if(!/^image\//.test(file.type))return rej(new Error(L("Please choose an image file.","Izaberite fajl sa slikom.")));const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const sc=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*sc));c.height=Math.max(1,Math.round(img.height*sc));const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL("image/jpeg",.82))};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error(L("That image couldn't be read. Try another one.","Ta slika ne može da se učita. Probajte drugu.")))};img.src=url})}
/* ---------- "Naša pesma" vinyl experience ---------- */
const MBox={ctx:null,master:null,timer:null,on:false,step:0,next:0,dur:.27,
 bars:[[60,64,67,76],[57,60,64,72],[53,57,60,77],[55,59,62,74],[60,64,67,79],[52,55,59,76],[53,57,60,72],[55,59,62,71]],
 use(b,dur){if(this._b!==b){this.bars=b;this._b=b;this._s=null;this.step=0}this.dur=dur||.27},
 seq(){const s=[];this.bars.forEach(([r,th,f,m])=>s.push(r,f,th+12,m,th+12,f));return s},
 start(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;this.ctx=this.ctx||new AC();this.ctx.resume&&this.ctx.resume();
  if(this.master){try{this.master.disconnect()}catch(e){}}this.master=this.ctx.createGain();this.master.gain.value=.55;this.master.connect(this.ctx.destination);
  this._s=this._s||this.seq();this.on=true;this.next=this.ctx.currentTime+.08;clearInterval(this.timer);this.timer=setInterval(()=>this.tick(),50);return true}catch(e){return false}},
 stop(){this.on=false;clearInterval(this.timer);this.timer=null;if(this.master&&this.ctx){const g=this.master;try{g.gain.setTargetAtTime(0,this.ctx.currentTime,.12);setTimeout(()=>{try{g.disconnect()}catch(e){}},700)}catch(e){}}this.master=null},
 tick(){if(!this.on||!this.ctx)return;while(this.next<this.ctx.currentTime+.3){this.note(this._s[this.step%this._s.length],this.next,this.step%6===3);this.next+=this.dur;this.step++}},
 note(n,t,acc){const f=440*Math.pow(2,(n-69)/12),c=this.ctx;[[1,1],[2,.22],[3.02,.07],[4.1,.03]].forEach(([m,a])=>{const o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.value=f*m;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a*(acc?.16:.1),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+1.5);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+1.6)})}
};
function ticketNo(d){const a=(d.partner1||d.partner2?(((d.partner1||"A").trim()[0]||"A")+((d.partner2||"S").trim()[0]||"S")):(((d.name||"P").trim()[0]||"P")+(parseInt(d.age)||""))).toUpperCase();const m=(d.date||"").match(/^\d{4}-(\d{2})-(\d{2})$/);return`${a}·${m?m[2]+m[1]:"0000"}`}
function eventWhen(d,dt){if(!dt)return null;const tm=(d.plan1Time||d.time||d.ceremonyTime||"12:00").split(":").map(Number);const x=new Date(dt.y,dt.m-1,dt.d,tm[0]||0,tm[1]||0);return isNaN(x)?null:x}
function calLink(title,w,place){if(!w)return"";const pad=n=>String(n).padStart(2,"0");const fmt=x=>`${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;return`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(w)}/${fmt(new Date(w.getTime()+6*36e5))}&location=${encodeURIComponent(place)}&details=${encodeURIComponent(location.href)}`}
const TONEARM=`<svg viewBox="0 0 120 200" aria-hidden="true"><circle cx="92" cy="26" r="20" fill="#2A2420"/><circle cx="92" cy="26" r="13" fill="#C9C1B4"/><circle cx="92" cy="26" r="5" fill="#2A2420"/><path d="M92 26 L86 120 Q84 150 62 168" fill="none" stroke="#D8D1C4" stroke-width="5" stroke-linecap="round"/><rect x="48" y="160" width="26" height="16" rx="3" transform="rotate(32 61 168)" fill="#2A2420"/></svg>`;
function vinylHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl);const n1=esc(v("partner1")),n2=esc(v("partner2"));
 const ini=esc(((v("partner1")[0]||"")+(v("partner2")[0]||"")).toUpperCase());
 const dots=dt?`${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}`:"";
 const stories=[1,2,3].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const link=/^https?:\/\/[^\s"'<>]+$/i.test(v("songLink"))?v("songLink"):"";
 const g=o.guest;const gname=g&&g.source==="personal"?esc(g.name):C("Our dear guests","Naši dragi gosti");
 const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const rsH=pd(v("rsvpBy"),cl);
 return`<div class="vx${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="vx-hero">
  <p class="vx-mono">${g?`${C("For","Za:")} ${esc(g.name)}`:C("You're invited","Pozvani ste")}</p>
  <button class="vx-deck" type="button" aria-label="${C("Play the record","Pusti ploču")}">
   <span class="vx-arm">${TONEARM}</span>
   <span class="vx-disc"><span class="rot"><span class="lab"><b>${ini}</b><i>${C("Side A","Strana A")}</i><small>${dots}</small></span></span><span class="sheen"></span></span>
   <span class="vx-sleeve"><span class="ring"></span><span class="top">${n1} &amp; ${n2}</span><b>${ini}</b><small>${C("Side A","Strana A")} · LP ${dt?dt.y:""}</small></span>
  </button>
  <p class="vx-hint">${C("Tap the record to play it","Dodirnite ploču da je pustite")}</p>
  <div class="vx-title">
   <p class="vx-mono">${C("Side A · Our wedding","Strana A · Naše venčanje")}</p>
   <h1>${n1}<span>&amp;</span>${n2}</h1>
   <p class="vx-date">${dots}</p>
   <p class="vx-sub">${C("Come and be part of our song","Dođite i budite deo naše pesme")}</p>
   ${v("songName")?`<p class="vx-now"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${C("Our song","Naša pesma")}: <b>${esc(v("songName"))}</b>${link?` · <a href="${esc(link)}" target="_blank" rel="noopener">${C("Listen","Poslušajte")} ↗</a>`:""}</span></p>`:""}
   <span class="vx-cue" aria-hidden="true"></span>
  </div>
 </section>
 <div class="vx-rest">
  ${v("message")?`<section class="vx-sec"><p class="vx-mono rv">${C("Liner notes","Beleške sa omota")}</p><p class="vx-lead rv">${br(v("message"))}</p><p class="vx-sign rv">${n1} &amp; ${n2}</p></section>`:""}
  ${stories.length?`<section class="vx-sec"><p class="vx-mono rv">${C("Side A","Strana A")}</p><h2 class="rv">${C(`Our story in <em>${stories.length===1?"one song":stories.length===2?"two songs":"three songs"}</em>`,`Naša priča u <em>${stories.length===1?"jednoj pesmi":stories.length===2?"dve pesme":"tri pesme"}</em>`)}</h2>
   <ol class="vx-tl">${stories.map((s,i)=>`<li class="rv"><button type="button" class="vx-tr" aria-expanded="${i===0}"><span class="no">A${i+1}</span><span class="nm">${esc(s.t||"—")}<small>${esc(s.y)}</small></span><span class="pl" aria-hidden="true"></span></button><div class="vx-tx"${i===0?"":" hidden"}><p>${esc(s.x)}</p></div></li>`).join("")}
   <li class="rv tt"><div class="vx-tr"><span class="no">A${stories.length+1}</span><span class="nm">${C("Title track: our wedding","Naslovna pesma: naše venčanje")}<small>${dt?esc(dt.short):""}</small></span><span class="new">${C("Premiere","Premijera")}</span></div></li></ol></section>`:""}
  ${plan.length?`<section class="vx-stage"><div class="vx-inner"><p class="vx-mono rv">${C("Tonight's programme","Program večeri")}</p><h2 class="rv">${C("The <em>setlist</em>","<em>Setlista</em>")}</h2>
   <div class="vx-setlist rv"><span class="tape l"></span><span class="tape r"></span><p class="hd">${n1} &amp; ${n2}${dt?` — ${esc(dt.short)}`:""}</p><ol>${plan.map(p=>`<li><span>${esc(p.tm)}</span>${esc(p.t)}</li>`).join("")}</ol><p class="ft">${C("Encore: dancing until late","Bis: ples do kasno")}</p></div></div></section>`:""}
  <section class="vx-sec"><p class="vx-mono rv">${C("Your ticket","Vaša ulaznica")}</p>
   <div class="vx-ticket rv"><div class="tk-main"><div class="tk-head"><span>${C("Admit","Ulaz")}</span><span>${ticketNo(d)}</span></div><p class="tk-ev">${n1} &amp; ${n2}<small>${C("Live · our wedding","Uživo · naše venčanje")}</small></p>
    <dl><div class="wide"><dt>${C("Guest","Gost")}</dt><dd>${gname}</dd></div><div><dt>${C("Date","Datum")}</dt><dd>${dt?esc(dt.short):"—"}</dd></div><div><dt>${C("Doors open","Početak")}</dt><dd>${esc(plan[0]?.tm||"—")}</dd></div><div class="wide"><dt>${C("Venue","Mesto")}</dt><dd>${esc(v("venue"))}<small>${esc(v("address"))}</small></dd></div>${v("dressCode")?`<div class="wide"><dt>Dress code</dt><dd>${esc(v("dressCode"))}</dd></div>`:""}</dl></div>
    <div class="tk-stub"><span class="bar" aria-hidden="true"></span><span class="no">${ticketNo(d)}</span></div></div>
   <div class="vx-links rv">${gcal?`<a class="vx-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="vx-btn" href="${maps}" target="_blank" rel="noopener">${C("Directions","Kako stići")}</a>`:""}</div></section>
  ${w&&w>Date.now()?`<section class="vx-sec" style="padding-top:20px"><p class="vx-mono rv">${C("Until the first note","Do prvog takta")}</p><div class="vx-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="vx-sec" style="padding-top:30px">${o.preview?`<div class="rsvp vx-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Save your seat","Rezervišite svoje mesto")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp" id="rsvp"></div>`}</section>
  <section class="vx-encore"><span class="vx-mini" aria-hidden="true"></span><p class="vx-mono">${C("Encore","Bis")}</p><h2>${C("Thank you for being part of <em>our song</em>","Hvala što ste deo <em>naše pesme</em>")}</h2><p class="sig">${n1} &amp; ${n2}</p><p class="vx-mono">${dots}</p>${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music box","Muzička kutija")}</span></button>
</div>`;
}
const VX_BARS=MBox.bars;
function bindVinyl(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;
 const mus=$(".vx-music",root);
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music box","Pauziraj muzičku kutiju"):C("Play the music box","Pusti muzičku kutiju"))};
 const open=withSound=>{if(root.classList.contains("on"))return;root.classList.add("on");if(withSound){MBox.use(VX_BARS,.27);MBox.start();setPlay(true)}else setPlay(false);o.onOpen&&o.onOpen();reveal();count()};
 $(".vx-deck",root).addEventListener("click",()=>{if(!root.classList.contains("on"))return open(true);if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else{MBox.use(VX_BARS,.27);MBox.start();setPlay(true)}});
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else{MBox.use(VX_BARS,.27);MBox.start();setPlay(true)}});
 $$(".vx-tr[aria-expanded]",root).forEach(b=>b.addEventListener("click",()=>{const x=b.getAttribute("aria-expanded")!=="true";b.setAttribute("aria-expanded",x);b.nextElementSibling.hidden=!x}));
 function reveal(){if(!("IntersectionObserver" in window))return;root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.12});$$(".rv",root).forEach(el=>io.observe(el))}
 function count(){const el=$(".vx-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Minutes","Minuta")],[Math.floor(ms/1e3)%60,C("Seconds","Sekundi")]];el.innerHTML=a.map(([n,l])=>`<div><span class="c"><b>${n}</b></span><span class="l">${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}
async function expOverlay(t,d){
 MBox.stop();const ov=document.createElement("div");ov.className="vx-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.setAttribute("aria-label",tName(t));
 ov.innerHTML=expOf(t)[0](t,d,{preview:true})+`<button class="vx-close" aria-label="${L("Close preview","Zatvori pregled")}">✕</button>`;
 document.body.appendChild(ov);document.body.style.overflow="hidden";
 const close=()=>{MBox.stop();ov.remove();if(!LB)document.body.style.overflow=""};
 $(".vx-close",ov).onclick=close;ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()});ov.tabIndex=-1;ov.focus();
 await settle(ov);if(!ov.isConnected)return;
 expOf(t)[1]($(".vx,.dx,.sb,.hy,.ps,.pq,.sk,.fw,.rp,.zv,.bn,.zp,.dn,.nz,.tl",ov),t,d,{});
}

/* ---------- animated layers for envelope designs ---------- */
function fxHTML(kind){
 seed=kind.length*97+13;let s="";
 if(kind==="petals"){for(let i=0;i<11;i++){const k=Math.floor(rnd()*6);s+=`<i style="left:${f1(rnd()*92)}%;width:${f1(5+rnd()*5)}cqw;--d:${f1(rnd()*7)}s;--t:${f1(7+rnd()*5)}s;--x:${f1(rnd()*30-15)}cqw;background-position:${(k%3)*50}% ${Math.floor(k/3)*100}%"></i>`}}
 else if(kind==="stars"){for(let i=0;i<22;i++)s+=`<i style="left:${f1(rnd()*96)}%;top:${f1(rnd()*96)}%;--d:${f1(rnd()*3)}s;--s:${f1(.6+rnd()*1.4)}cqw"></i>`}
 else if(kind==="clouds"){for(let i=0;i<3;i++)s+=`<i style="top:${f1(8+i*22+rnd()*8)}%;--d:${f1(-rnd()*30)}s;--t:${f1(34+rnd()*16)}s;width:${f1(26+rnd()*20)}cqw"></i>`}
 else if(kind==="balloons"){const c=["#E9B7B3","#F2D49B","#B9CDB0","#BFD3E6","#E8C5D8"];for(let i=0;i<6;i++)s+=`<i style="left:${f1(6+rnd()*84)}%;--d:${f1(.4+i*.9)}s;--t:${f1(9+rnd()*4)}s;--c:${c[i%5]};--w:${f1(5+rnd()*3)}cqw"></i>`}
 if(kind==="twinkle"){const P=[[21,4.6],[34,4],[66,4.4],[74,3.3],[7.5,24],[90,24],[2.6,58],[96,64],[3,85],[96.5,90],[64,95.5],[14,37],[86,38],[5,47]];for(let i=0;i<12;i++)s+=`<i style="left:${f1(8+rnd()*84)}%;--d:${f1(rnd()*9)}s;--t:${f1(9+rnd()*6)}s;--s:${f1(.6+rnd()*.9)}cqw;--x:${f1(rnd()*14-7)}cqw"></i>`}
 if(kind==="dust"){for(let i=0;i<18;i++)s+=`<i style="left:${f1(rnd()*96)}%;--d:${f1(rnd()*8)}s;--t:${f1(7+rnd()*6)}s;--s:${f1(.5+rnd()*1.1)}cqw;--x:${f1(rnd()*16-8)}cqw"></i>`}
 if(kind==="disco"){for(let i=0;i<16;i++){const side=i%2?rnd()*16:84+rnd()*14;s+=`<i style="left:${f1(side)}%;top:${f1(2+rnd()*90)}%;--d:${f1(rnd()*4)}s;--t:${f1(1.8+rnd()*2.2)}s;--s:${f1(2.2+rnd()*3.2)}cqw"></i>`}s+=`<b class="beam b1"></b><b class="beam b2"></b>`}
 return`<div class="fx fx-${kind}" aria-hidden="true">${s}</div>`;
}
/* ---------- envelope markup shared by guest page, previews and home ---------- */
function laceHTML(t,d,id){const ini=esc(((d.partner1||"").trim()[0]||"")+((d.partner2||"").trim()[0]||""));return`<button class="env lacebox" id="${id}" aria-label="${L("Break the seal","Slomite pečat")}"><span class="lw"><span class="letter">${renderCard(t,d,{fixed:true})}</span></span><span class="lace-l" aria-hidden="true"></span><span class="seal lace-seal" aria-hidden="true"><span class="sh l"><b>${ini}</b></span><span class="sh r"><b>${ini}</b></span></span><span class="lace-tap" aria-hidden="true"><i></i><i></i></span></button>`}
function envHTML(t,d,id){if(t.opener==="lace")return laceHTML(t,d,id);
 const p=t.pal,lux=!!t.liner;const ini=(t.layout==="wedding"||t.layout==="vinyl"||t.layout==="estate"?((d.partner1||"").trim()[0]||"")+((d.partner2||"").trim()[0]||""):((d.childName||d.name||d.occasion||"P").trim()[0]||"P")).toUpperCase();
 const st=`--c-bg:${p.bg};--c-bg2:${t.env||p.bg2};--c-ink:${p.ink};--c-accent:${p.accent};--f-s:${t.font.s};${lux?`--liner:var(--a-${t.liner});`:""}--sealimg:var(--a-${t.seal||"seal1"});`;
 return`<button class="env${lux?" luxe":""}${t.tier?" full":""} env-${t.kind}" id="${id}" style="${st}" aria-label="${L("Open the invitation","Otvori pozivnicu")}"><span class="back"></span>${t.tier?`<span class="lw"><span class="letter">${renderCard(t,d,{fixed:true})}</span></span>`:`<span class="letter">${esc(titleOf(t,d))}</span>`}<span class="front"></span><span class="flap"></span><span class="seal img"><span class="sh l">${esc(ini)}</span><span class="sh r">${esc(ini)}</span></span></button>`;
}
function envOverlay(t,d){
 const ov=document.createElement("div");ov.className="story-ov env-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");
 ov.innerHTML=`<div class="env-ov-in"><div class="env-stage">${envHTML(t,d,"ovenv")}<p class="env-hint" id="ovhint">${L("Tap the seal to open","Dodirnite pečat da otvorite")}<small>${L("This is what your guests will see","Ovako će videti vaši gosti")}</small></p></div></div><button class="arrow x" aria-label="${L("Close","Zatvori")}">✕</button>`;
 document.body.appendChild(ov);document.body.style.overflow="hidden";
 const close=()=>{ov.remove();if(!LB)document.body.style.overflow=""};
 $(".x",ov).onclick=close;ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
 $("#ovenv",ov).addEventListener("click",()=>{const e=$("#ovenv",ov);if(e.classList.contains("open"))return;e.classList.add("open");setTimeout(()=>{if(!ov.isConnected)return;envHandoff(e,()=>{$(".env-ov-in",ov).innerHTML=`<div class="ov-card" data-tilt-host>${cardFace(t,d,{fx:true})}</div>${(()=>{const dc=detailsHTML(t,d);return dc?`<div class="kd-host after-env ov-dc">${dc}</div>`:""})()}<p class="env-hint after-env" style="margin-top:18px">${L("Your guests will find the reply form below the card","Ispod pozivnice gosti nalaze formular za odgovor")}</p>`;bindTilt(ov,6);bindFlip(ov);$(".env-ov-in",ov).classList.add("scroll");return $(".ov-card",ov)})},e.classList.contains("lacebox")?2500:1600)});
 $("#ovenv",ov).focus();
 settle(ov,`<div class="env-ov-in"><div class="ov-card">${cardFace(t,d,{fx:true})}</div><div class="kd-host">${detailsHTML(t,d)}</div></div>`);
}

/* ---------- Disko · premium experience (35 & 5) ---------- */
const DiscoBeat=(()=>{let ctx,master,timer,step=0,next=0,on=false,noise;const bpm=116,spb=60/bpm/4;
 const prog=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]];const bassN=[45,41,36,43];
 const f=m=>440*Math.pow(2,(m-69)/12);
 function nz(){const b=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
 function env(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)}
 function kick(t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);env(g,t,.004,.9,.32);o.connect(g).connect(master);o.start(t);o.stop(t+.4)}
 function hat(t,open){const s=ctx.createBufferSource(),h=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;h.type="highpass";h.frequency.value=7200;env(g,t,.002,open?.16:.09,open?.16:.04);s.connect(h).connect(g).connect(master);s.start(t);s.stop(t+.25)}
 function clap(t){const s=ctx.createBufferSource(),b=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;b.type="bandpass";b.frequency.value=1600;b.Q.value=.8;env(g,t,.003,.32,.14);s.connect(b).connect(g).connect(master);s.start(t);s.stop(t+.3)}
 function bass(t,m){const o=ctx.createOscillator(),l=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o.frequency.value=f(m);l.type="lowpass";l.frequency.setValueAtTime(900,t);l.frequency.exponentialRampToValueAtTime(220,t+.18);env(g,t,.006,.32,.17);o.connect(l).connect(g).connect(master);o.start(t);o.stop(t+.3)}
 function stab(t,ch){const l=ctx.createBiquadFilter(),g=ctx.createGain();l.type="lowpass";l.frequency.value=2400;env(g,t,.01,.07,.22);l.connect(g).connect(master);ch.forEach(m=>{const o=ctx.createOscillator();o.type="square";o.frequency.value=f(m+12);o.connect(l);o.start(t);o.stop(t+.3)})}
 function sched(){while(next<ctx.currentTime+.12){const s=step%16,bar=Math.floor(step/16)%4;
   if(s%4===0)kick(next);if(s%4===2)hat(next,true);else if(s%2===1)hat(next,false);if(s===4||s===12)clap(next);
   if(s%2===0)bass(next,bassN[bar]+(s%4===2?12:0));if(s===6||s===14||s===3)stab(next,prog[bar]);
   next+=spb;step++}}
 return{start(){try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==="suspended")ctx.resume();noise=noise||nz();if(on)return;master=ctx.createGain();master.gain.value=.0001;master.gain.exponentialRampToValueAtTime(.32,ctx.currentTime+1.2);master.connect(ctx.destination);step=0;next=ctx.currentTime+.06;on=true;timer=setInterval(sched,25);sched()}catch(e){}},
  stop(){if(!on)return;on=false;clearInterval(timer);try{const m=master;m.gain.setTargetAtTime(.0001,ctx.currentTime,.12);setTimeout(()=>m.disconnect(),700)}catch(e){}},
  get on(){return on}}})();
window.addEventListener("hashchange",()=>DiscoBeat.stop());

const loadMirrorBall=()=>loadMirrorBall.p||(loadMirrorBall.p=import("./designs/mirrorball.js").catch(e=>{loadMirrorBall.p=null;throw e}));
function discoBall(cls=""){return`<span class="dx-ball ${cls}" aria-hidden="true"><i class="tx"></i><i class="sh"></i></span>`}
function discoHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const n1=parseInt(v("num1"))||0,n2=parseInt(v("num2"))||0;
 const who=esc(v("name1")),brand=esc(v("brand")||v("name2"));
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const defPh=["var(--a-dp1)","var(--a-dp2)","var(--a-dp3)"];
 const stories=[1,2,3].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`),p:img(`photo${i}`),d:defPh[i-1]})).filter(s=>s.y||s.t||s.x);
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const host=img("photo");const dress=v("dressCode");
 seed=97;const conf=Array.from({length:26},()=>`<i style="left:${f1(rnd()*100)}%;--d:${f1(rnd()*6)}s;--t:${f1(5+rnd()*5)}s;--x:${f1(rnd()*80-40)}px;--r:${f1(rnd()*720-360)}deg;--s:${f1(5+rnd()*7)}px"></i>`).join("");
 const specks=`<span class="dx-specks" aria-hidden="true"></span>`;
 return`<div class="dx${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <span class="dx-room" aria-hidden="true"></span><canvas class="dx-cv" aria-hidden="true"></canvas>
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="dx-open" role="button" tabindex="0" aria-label="${C("Start the party","Pokreni žurku")}">${specks}<span class="dx-cord" aria-hidden="true"></span><span class="dx-bw">${discoBall("big")}<span class="dx-hit" aria-hidden="true"><i></i><i></i><i></i><b class="dx-tap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-1.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-4.1-2.1L4.3 14.4a1.6 1.6 0 0 1 2.4-2.1L9 14.5"/></svg></b></span></span>
  <div class="dx-open-in"><p class="dx-k">${g?`${C("For","Za:")} ${esc(g.name)}`:C("A private invitation","Lična pozivnica")}</p><h2 class="dx-script">${brand||who}</h2><span class="dx-go">${C("Tap the disco ball to open","Dodirnite disko kuglu da otvorite")}<i aria-hidden="true">✦</i></span><p class="dx-cap">${C("the invitation opens with music","pozivnica se otvara uz muziku")}</p></div><span class="dx-flash" aria-hidden="true"></span></section>
 <section class="dx-hero">${specks}<div class="dx-card">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="vx-cue" aria-hidden="true"></span></section>
 <div class="dx-rest">
  <section class="dx-sec dx-two">${specks}<p class="dx-k rv">${C("Two reasons, one night","Dva razloga, jedno veče")}</p>
   <div class="dx-duo rv">${n1?`<div><b class="dx-chrome" data-to="${n1}">0</b><em class="dx-script" style="--l:${Math.max(6,v("name1").length,v("name2").length)}">${who}</em><span>${C("birthday party","slavi rođendan")}</span></div>`:""}${n1&&n2?`<span class="dx-amp">&amp;</span>`:""}${n2?`<div><b class="dx-chrome" data-to="${n2}">0</b><em class="dx-script" style="--l:${Math.max(6,v("name1").length,v("name2").length)}">${esc(v("name2"))}</em><span>${C("company celebration","proslava firme")}</span></div>`:""}</div>
   ${v("intro")?(()=>{const [h,...r]=v("intro").split(/\n+/);return`${r.length?`<p class="dx-hl rv">${esc(h)}</p>`:""}<p class="dx-lead rv">${br(r.length?r.join("\n"):h)}</p>`})():""}</section>
  ${dress?`<section class="dx-sec dx-dress"><p class="dx-k rv">Dress code</p><h2 class="dx-h rv">${esc(dress)}</h2><div class="dx-sw rv"><span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span></div></section>`:""}
  <section class="dx-sec dx-when">${specks}<p class="dx-k rv">${C("Save the date","Zapišite datum")}</p>
   <div class="dx-info rv">${dt?`<div><small>${esc(dt.wd)}</small><b>${dt.d}${cl==="sr"?".":""}</b><span>${esc(dt.mon)} ${dt.y}${cl==="sr"?".":""}</span></div>`:""}${v("time")?`<div><small>${C("Starts at","Početak u")}</small><b>${esc(v("time"))}</b></div>`:""}${place?`<div><small>${C("Where","Gde")}</small><b class="v">${esc(v("venue"))}</b><span>${esc(v("address"))}</span></div>`:""}</div>
   ${w&&w>Date.now()?`<div class="dx-count rv" data-w="${w.getTime()}"></div>`:""}
   <div class="vx-links rv">${gcal?`<a class="dx-btn2" href="${gcal}" target="_blank" rel="noopener"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5"/></svg></span><span class="tx"><b>${C("Add to calendar","Dodajte u kalendar")}</b><small>${C("so you don't miss it","da ne propustite žurku")}</small></span><i aria-hidden="true">→</i></a>`:""}${maps?`<a class="dx-btn2" href="${maps}" target="_blank" rel="noopener"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg></span><span class="tx"><b>${C("Directions","Kako stići")}</b><small>${esc(v("venue")||C("Open the map","Otvori mapu"))}</small></span><i aria-hidden="true">→</i></a>`:""}</div></section>
  <section class="dx-sec">${o.preview?`<div class="rsvp vx-rsvp dx-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you dance with us?","Da li dolazite na žurku?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp dx-rsvp" id="rsvp"></div>`}</section>
  <section class="dx-fin">${specks}<div class="dx-conf" aria-hidden="true">${conf}</div><span class="dx-cord" aria-hidden="true"></span>${discoBall()}
   <h2 class="dx-script huge rv">${esc(v("signoff")||C("See you there!","Vidimo se!"))}</h2><p class="dx-thanks rv">${C("Thank you for being part of our story","Hvala što ste deo naše priče")}</p><p class="dx-sig rv">${brand?`<span class="dx-script">${brand}</span>`:""}${v("brandSub")?`<small>${esc(v("brandSub"))}</small>`:""}</p>
   ${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music dx-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindDisco(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".dx-music",root);
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music","Pauziraj muziku"):C("Play the music","Pusti muziku"))};
 const play=()=>{try{MBox.stop()}catch(e){}DiscoBeat.start();setPlay(true)};
 const open=withSound=>{if(root.classList.contains("on"))return;root.classList.add("on");root.dispatchEvent(new Event("dx-open"));if(withSound)play();else setPlay(false);o.onOpen&&o.onOpen();setTimeout(reveal,withSound?900:0);count()};
 const op=$(".dx-open",root);op.addEventListener("click",()=>open(true));op.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open(true)}});
 mus.addEventListener("click",()=>{if(DiscoBeat.on){DiscoBeat.stop();setPlay(false)}else play()});
 // the 3D mirror ball and its light, behind the whole page
 let mb=null;
 const anchors=()=>root.classList.contains("on")?[$(".dx-fin .dx-ball",root)]:[$(".dx-open .dx-bw",root)];
 loadMirrorBall().then(m=>m.mountMirrorBall($(".dx-cv",root),{anchors,small:matchMedia("(max-width:700px)").matches})).then(b=>{
  if(!b){root.classList.add("no3d");return}
  if(!root.isConnected){b.destroy();return}
  mb=b;root.classList.add("has3d");if(root.classList.contains("on"))mb.setGain(.6);
 }).catch(()=>root.classList.add("no3d"));
 $(".dx-cv",root).addEventListener("ball-lost",()=>root.classList.replace("has3d","no3d"));
 root.addEventListener("dx-open",()=>{if(mb){mb.burst();setTimeout(()=>mb&&mb.setGain(.6),1800)}});
 const countUp=el=>{const to=+el.dataset.to;const t0=performance.now(),dur=1600+to*20;const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)};
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));$$(".dx-chrome",root).forEach(e=>e.textContent=e.dataset.to);return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");$$(".dx-chrome",e.target).forEach(countUp);io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".dx-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 const obs=new MutationObserver(()=>{if(!root.isConnected){DiscoBeat.stop();if(mb){mb.destroy();mb=null}obs.disconnect()}});obs.observe(document.body,{childList:true,subtree:true});
 if(o.opened)open(false);
}


/* ---------- keep card text inside the illustration's empty area ---------- */
function fitText(inv){const b=inv.querySelector(":scope > .inv-body");if(!b)return;const u=inv.clientWidth/100;if(!u)return;
 inv.querySelectorAll(".i-name,.i-names,.lc-names,.bd-t1,.bd-t2,.dz-name,.er-hl").forEach(el=>{el.style.removeProperty("--fz");el.classList.remove("fz");const box=el.closest(".pc-board")||b;const bc=getComputedStyle(box);const lim=box.clientWidth-parseFloat(bc.paddingLeft)-parseFloat(bc.paddingRight)-2;
  let fs=parseFloat(getComputedStyle(el).fontSize),i=0;const over=()=>el.scrollWidth>lim+1||[...el.querySelectorAll("span")].some(x=>x.scrollWidth>lim+1);
  while(over()&&i<40){fs*=.95;el.style.setProperty("--fz",(fs/u).toFixed(2)+"cqw");el.classList.add("fz");i++}})}
function fitCard(inv){const b=inv.querySelector(":scope > .inv-body");if(!b)return true;if(b.clientHeight<40||inv.clientWidth<40)return false;fitText(inv);
 b.classList.remove("fit");b.style.removeProperty("--z");b.style.removeProperty("row-gap");const cs=getComputedStyle(b);
 if(cs.display!=="flex"||cs.flexDirection!=="column"||cs.justifyContent!=="center")return true;
 const kids=[...b.children].filter(k=>{const s=getComputedStyle(k);return s.position!=="absolute"&&s.position!=="fixed"&&s.display!=="none"});if(!kids.length)return true;
 const gap=parseFloat(cs.rowGap)||0;let h=gap*(kids.length-1);kids.forEach(k=>{const s=getComputedStyle(k);h+=k.offsetHeight+(parseFloat(s.marginTop)||0)+(parseFloat(s.marginBottom)||0)});
 const avail=Math.min(b.clientHeight,inv.clientHeight-b.offsetTop)-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
 if(h>avail+1){const z=Math.max(.82,avail/h*.97),u=inv.clientWidth/100;b.style.setProperty("--z",z.toFixed(3));b.style.rowGap=`calc(${(gap/u*z).toFixed(3)}cqw)`;b.classList.add("fit")}
 return true}
const fitAll=(force)=>{document.querySelectorAll(".inv").forEach(inv=>{if(!force&&inv.dataset.fit)return;if(fitCard(inv))inv.dataset.fit="1"})};
let fitQ=0;new MutationObserver(()=>{if(fitQ)return;fitQ=requestAnimationFrame(()=>{fitQ=0;fitAll(false)})}).observe(document.documentElement,{childList:true,subtree:true});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>fitAll(true));
addEventListener("load",()=>fitAll(true));

/* ---------- envelope → card hand-off (one continuous motion) ---------- */
function envHandoff(env,render){
 const rm=matchMedia("(prefers-reduced-motion:reduce)").matches;
 const fromC=env.querySelector(".letter .inv-c");const first=fromC&&fromC.getBoundingClientRect();const er=env.getBoundingClientRect();
 if(rm||!first||!first.width){render();return}
 const ghost=(drop)=>{const g=env.cloneNode(true);g.removeAttribute("id");g.classList.add("ghost");g.querySelectorAll(drop).forEach(x=>x.remove());
  Object.assign(g.style,{position:"fixed",left:er.left+"px",top:er.top+"px",width:er.width+"px",height:er.height+"px",margin:"0",pointerEvents:"none"});document.body.appendChild(g);return g};
 const back=ghost(".lw,.front,.seal");back.style.zIndex=89;
 const front=ghost(".lw,.back,.flap");front.style.zIndex=90;
 const host=render();const toC=host&&host.querySelector(".inv-c");
 if(!toC){back.remove();front.remove();return}
 const last=toC.getBoundingClientRect();
 const clone=toC.cloneNode(true);clone.classList.add("flip-clone");
 const cut=env.classList.contains("lacebox")?0:Math.max(0,Math.min(1,(first.bottom-(er.top+er.height*.22))/first.height))*100;
 Object.assign(clone.style,{position:"fixed",left:last.left+"px",top:last.top+"px",width:last.width+"px",margin:"0",zIndex:95,clipPath:`inset(0 0 ${cut.toFixed(2)}% 0)`,transformOrigin:"0 0",transform:`translate(${first.left-last.left}px,${first.top-last.top}px) scale(${first.width/last.width})`,transition:"none",pointerEvents:"none"});
 document.body.appendChild(clone);toC.style.visibility="hidden";
 clone.getBoundingClientRect();
 requestAnimationFrame(()=>{clone.style.transition="transform 1.1s cubic-bezier(.22,.8,.24,1), clip-path .7s cubic-bezier(.3,.6,.3,1) .3s";clone.style.transform="none";clone.style.clipPath="inset(0 0 0% 0)";
  [back,front].forEach(g=>{g.style.transition="opacity .22s ease, transform .45s cubic-bezier(.5,0,.75,0)";g.style.opacity="0";g.style.transform="translateY(140px) scale(.92)"})});
 setTimeout(()=>{toC.style.visibility="";clone.remove();back.remove();front.remove()},1120);
}

/* ---------- Satenska mašna · premium wedding experience ---------- */
/* ---------- Satenska mašna · premium wedding: a gift box tied with a satin bow ---------- */
const SB_BOW='<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M20 12C14 4 4 1.5 4 9s10 7 16 3zM20 12c6-8 16-10.5 16-3s-10 7-16 3z" fill="currentColor"/><path d="M19 13l-5 10 3.2-.6 2 2.6.8-12zM21 13l5 10-3.2-.6-2 2.6-.8-12z" fill="currentColor" opacity=".75"/><circle cx="20" cy="12" r="2.8" fill="currentColor"/></svg>';
function bowHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const n1=esc(v("partner1")),n2=esc(v("partner2"));
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen({...d,time:v("ceremonyTime")},dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const dots=dt?`${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}`:"";
 const who=g&&g.source==="personal"?esc(g.name):"";
 const petals=Array.from({length:10},(_,i)=>`<i style="left:${(i*9.7+4)%100}%;--t:${(13+(i*1.9)%8).toFixed(1)}s;--d:${(-(i*2.3)%13).toFixed(1)}s;--s:${(10+(i*3)%9)}px;--w:${(i%2?1:-1)*(16+i%4*6)}px"></i>`).join("");
 return`<div class="sb${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="sb-open">
  <p class="sb-for">${who?`${C("For","Za")} ${who}`:C("A gift for you","Poklon za vas")}</p>
  <div class="sb-box">
   <span class="sb-in" aria-hidden="true"></span>
   <span class="sb-card" aria-hidden="true">${renderCard(t,d,{fixed:true,lang:cl})}</span>
   <span class="sb-lid" aria-hidden="true"><span class="sb-rb v t"><i></i></span><span class="sb-rb v b"><i></i></span><span class="sb-rb h l"><i></i></span><span class="sb-rb h r"><i></i></span></span>
   <button class="sb-bow" type="button" aria-label="${C("Untie the bow","Odvežite mašnu")}"><i></i></button>
  </div>
  <p class="sb-go">${C("Pull the bow","Povucite mašnu")}<small>${C("or just tap it","ili je samo dodirnite")}</small></p>
 </section>
 <section class="sb-hero"><div class="sb-silk"></div><div class="sb-petals" aria-hidden="true">${petals}</div><div class="sb-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="sb-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="sb-rest">
  <section class="sb-sec"><p class="sb-k rv">${C("The invitation","Pozivnica")}</p>${v("message")?`<p class="sb-lead rv">${br(v("message"))}</p>`:""}
   ${dt?`<div class="sb-day rv"><span>${esc(dt.wd)}</span><b>${dt.d}</b><span>${esc(dt.mon)} ${dt.y}${cl==="sr"?".":""}</span></div>`:""}${v("ceremonyTime")?`<p class="sb-at rv">${C("at","u")} ${esc(v("ceremonyTime"))}${cl==="sr"?" časova":""}</p>`:""}</section>
  ${place?`<section class="sb-sec"><p class="sb-k rv">${C("Where","Gde")}</p><div class="sb-venue rv"><div class="ph"></div><div class="tx"><h3>${esc(v("venue"))}</h3>${v("address")?`<p>${esc(v("address"))}</p>`:""}${v("venueNote")?`<p class="note">${esc(v("venueNote"))}</p>`:""}${v("dressCode")?`<p class="dc">Dress code · ${esc(v("dressCode"))}</p>`:""}
   <div class="sb-links">${gcal?`<a class="sb-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="sb-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Directions","Kako stići")}</a>`:""}</div></div></div></section>`:""}
  ${plan.length?`<section class="sb-sec"><p class="sb-k rv">${C("The day","Dan")}</p><h2 class="sb-h rv">${C("Our <em>programme</em>","Naš <em>program</em>")}</h2>
   <ol class="sb-tl">${plan.map((p,i)=>`<li class="rv" style="--i:${i}"><span class="mk">${SB_BOW}</span><div><time>${esc(p.tm)}</time><p>${esc(p.t)}</p></div></li>`).join("")}</ol></section>`:""}
  ${w&&w>Date.now()?`<section class="sb-sec"><p class="sb-k rv">${C("Until our “yes”","Do našeg „da“")}</p><div class="sb-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="sb-sec">${o.preview?`<div class="rsvp vx-rsvp sb-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you join us?","Da li dolazite?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp sb-rsvp" id="rsvp"></div>`}</section>
  <section class="sb-fin"><div class="ph rv"></div><p class="sb-k rv">${esc(v("signoff")||C("We can't wait to celebrate with you","Radujemo se što ćemo slaviti sa vama"))}</p><h2 class="sb-names rv">${n1}<em>&amp;</em>${n2}</h2>${dots?`<p class="sb-date rv">${dots}</p>`:""}
   ${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music sb-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindBow(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".sb-music",root);const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music","Pauziraj muziku"):C("Play the music","Pusti muziku"))};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.27);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 const show=()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,700);count()};
 // the bow unties and the ribbon slides off, the lid lifts away, and the card rises from the tissue to where it sits on the page
 const rise=()=>{const card=$(".sb-card",root),hc=$(".sb-cardwrap",root);const a=card.getBoundingClientRect(),b=hc.getBoundingClientRect();
  const k=hc.offsetWidth/card.offsetWidth,dx=(b.left+b.width/2)-(a.left+a.width/2),dy=(b.top+b.height/2)-(a.top+a.height/2);root.classList.add("rise");
  card.animate([{transform:"rotate(-4deg)"},{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${k.toFixed(3)}) rotate(-2deg)`}],{duration:1000,easing:"cubic-bezier(.45,.05,.25,1)",fill:"forwards"}).finished.then(()=>{if(root.isConnected)show()})};
 const open=withSound=>{if(root.classList.contains("on")||root.classList.contains("untie"))return;if(withSound)play();else setPlay(false);
  if(!withSound||RM)return show();root.classList.add("untie");setTimeout(()=>root.classList.add("lift"),950);setTimeout(rise,2050)};
 const bow=$(".sb-bow",root);let y0=null;
 bow.addEventListener("pointerdown",e=>{y0=[e.clientX,e.clientY];try{bow.setPointerCapture(e.pointerId)}catch(_){}});
 bow.addEventListener("pointermove",e=>{if(!y0)return;const dx=e.clientX-y0[0],dy=e.clientY-y0[1];bow.style.transform=`translate(${(dx*.25).toFixed(1)}px,${(dy*.25).toFixed(1)}px)`;if(Math.hypot(dx,dy)>60){y0=null;bow.style.transform="";open(true)}});
 bow.addEventListener("pointerup",()=>{if(y0){y0=null;bow.style.transform="";open(true)}});
 bow.addEventListener("pointercancel",()=>{y0=null;bow.style.transform=""});
 const tl=$(".sb-tl",root);let raf=0;const grow=()=>{raf=0;if(!tl||!tl.isConnected){removeEventListener("scroll",onS,true);return}const r=tl.getBoundingClientRect();tl.style.setProperty("--g",Math.max(0,Math.min(1,(innerHeight*.8-r.top)/r.height)).toFixed(3))};const onS=()=>{if(!raf)raf=requestAnimationFrame(grow)};if(tl){addEventListener("scroll",onS,{passive:true,capture:true});grow()}
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".sb-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}

/* ---------- Zvezdana noć · premium wedding under a live night sky (three.js, src/designs/sky.js) ---------- */
const ZV_BARS=[[53,57,60,76],[57,60,64,79],[50,53,57,77],[58,62,65,74],[53,57,60,72],[55,58,62,74],[57,60,64,76],[52,56,59,71]];
const loadSky=()=>loadSky.p||(loadSky.p=import("./designs/sky.js").catch(e=>{loadSky.p=null;throw e}));
const skyInitials=d=>`${((d.partner1||"").trim()[0]||"A").toUpperCase()} & ${((d.partner2||"").trim()[0]||"B").toUpperCase()}`;
function skyHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const n1=esc(v("partner1")),n2=esc(v("partner2"));
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen({...d,time:v("ceremonyTime")},dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const story=[1,2,3].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const dots=dt?`${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}`:"";
 const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-2.8z" fill="currentColor"/></svg>';
 return`<div class="zv${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <div class="zv-sky" aria-hidden="true"><canvas class="zv-cv"></canvas><p class="zv-ini">${esc(skyInitials(d))}</p></div>
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="zv-open" role="button" tabindex="0" aria-label="${C("Open the invitation","Otvorite pozivnicu")}">
  <div class="zv-open-in">${g?`<p class="zv-for">${C("For","Za:")} ${esc(g.name)}</p>`:`<p class="zv-for">${C("An invitation for you","Pozivnica za vas")}</p>`}
   <h2 class="zv-q">${C("Look up at the <em>sky</em>","Pogledajte u <em>nebo</em>")}</h2>
   <span class="zv-go">${star}<span>${C("Touch the stars","Dodirnite zvezde")}</span></span></div></section>
 <section class="zv-hero"><div class="zv-hero-txt"><p class="zv-k">${C("We're getting married","Venčavamo se")}</p><h1 class="zv-names">${n1}<em>&amp;</em>${n2}</h1>${dots?`<p class="zv-date">${dots}</p>`:""}</div><span class="zv-cue" aria-hidden="true"></span></section>
 <div class="zv-rest">
  <section class="zv-sec"><div class="zv-card rv"><p class="zv-k">${C("The invitation","Pozivnica")}</p>${v("message")?`<p class="zv-lead">${br(v("message"))}</p>`:""}
   ${dt?`<div class="zv-big"><span>${esc(dt.wd)}</span><b>${dt.d}</b><span>${esc(dt.mon)} ${dt.y}${cl==="sr"?".":""}</span></div>`:""}${v("ceremonyTime")?`<p class="zv-at">${C("at","u")} ${esc(v("ceremonyTime"))}</p>`:""}</div></section>
  ${story.length?`<section class="zv-sec"><h2 class="zv-h rv">${C("Our story, <em>star by star</em>","Naša priča, <em>zvezda po zvezda</em>")}</h2>
   <ol class="zv-story">${story.map((s,i)=>`<li class="rv" style="--i:${i}"><span class="zv-dot" aria-hidden="true">${star}</span>${s.y?`<time>${esc(s.y)}</time>`:""}${s.t?`<h3>${esc(s.t)}</h3>`:""}${s.x?`<p>${br(s.x)}</p>`:""}</li>`).join("")}</ol></section>`:""}
  ${place?`<section class="zv-sec"><div class="zv-card rv"><p class="zv-k">${C("Where","Gde")}</p><h3 class="zv-venue">${esc(v("venue"))}</h3>${v("address")?`<p class="zv-addr">${esc(v("address"))}</p>`:""}${v("dressCode")?`<p class="zv-dc">Dress code · ${esc(v("dressCode"))}</p>`:""}</div></section>`:""}
  ${plan.length?`<section class="zv-sec"><h2 class="zv-h rv">${C("The <em>programme</em>","Program <em>večeri</em>")}</h2>
   <ol class="zv-plan">${plan.map((p,i)=>`<li class="rv" style="--i:${i}"><time>${esc(p.tm)}</time><i aria-hidden="true"></i><p>${esc(p.t)}</p></li>`).join("")}</ol></section>`:""}
  ${w&&w>Date.now()?`<section class="zv-sec"><p class="zv-k rv">${C("Until our “yes”","Do našeg „da“")}</p><div class="zv-count rv" data-w="${w.getTime()}"></div></section>`:""}
  ${(gcal||maps)?`<section class="zv-sec"><div class="zv-links rv">${gcal?`<a class="zv-btn" href="${gcal}" target="_blank" rel="noopener"><b>${C("Add to calendar","Dodajte u kalendar")}</b><small>${dots}</small></a>`:""}${maps?`<a class="zv-btn" href="${maps}" target="_blank" rel="noopener"><b>${C("Directions","Kako stići")}</b><small>${esc(v("venue"))}</small></a>`:""}</div></section>`:""}
  <section class="zv-sec">${o.preview?`<div class="rsvp vx-rsvp zv-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you join us?","Da li dolazite?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp zv-rsvp" id="rsvp"></div>`}</section>
  <section class="zv-fin"><p class="zv-k rv">${esc(v("signoff")||C("Under the same stars, with you","Pod istim zvezdama, sa vama"))}</p><h2 class="zv-names rv">${n1}<em>&amp;</em>${n2}</h2>${dots?`<p class="zv-date rv">${dots}</p>`:""}
   ${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music zv-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindSky(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".zv-music",root);
 const reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
 let sky=null,dead=false,formedNow=false;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music","Pauziraj muziku"):C("Play the music","Pusti muziku"))};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(ZV_BARS,.34);MBox.start();setPlay(true)};
 // the 3D sky; without WebGL the page keeps its painted CSS sky and shows the initials as text
 const cv=$(".zv-cv",root);
 loadSky().then(m=>m.mountSky(cv,{initials:skyInitials(d),small:matchMedia("(max-width:700px)").matches})).then(s=>{
  if(!s){root.classList.add("no3d");return}
  if(!root.isConnected){s.destroy();return}
  sky=s;root.classList.add("has3d");if(formedNow)sky.formed();
  // stop drawing once this page is gone (guest navigated away or closed the preview)
  const mo=new MutationObserver(()=>{if(!root.isConnected){dead=true;sky.destroy();mo.disconnect();removeEventListener("scroll",onS,true)}});mo.observe(document.body,{childList:true,subtree:true});
 }).catch(()=>root.classList.add("no3d"));
 cv.addEventListener("sky-lost",()=>root.classList.replace("has3d","no3d"));
 // scrolling turns the sky into a calm backdrop (the guest page scrolls the window, the preview its overlay)
 let raf=0;const scroller=()=>root.closest(".vx-ov")||null;
 const onS=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const sc=scroller();const y=sc?sc.scrollTop:scrollY;const p=Math.min(1,y/(innerHeight*.9));root.style.setProperty("--zs",p.toFixed(3));if(sky&&!dead)sky.setScroll(p)})};
 addEventListener("scroll",onS,{passive:true,capture:true});
 const open=withSound=>{
  if(root.classList.contains("on")||root.classList.contains("forming"))return;
  if(withSound){play();try{if(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.isActive)navigator.vibrate(12)}catch(e){}}else setPlay(false);
  const go=()=>{root.classList.remove("forming");root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,withSound?400:0);count()};
  if(!withSound||reduced){formedNow=true;if(sky)sky.formed();go();return}
  root.classList.add("forming");
  if(sky)sky.form(false).then(go);else setTimeout(go,1200);
 };
 const op=$(".zv-open",root);op.addEventListener("click",()=>open(true));op.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open(true)}});
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".zv-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}

/* ---------- Zlatna ploča · premium anniversary on a gold record (three.js, src/designs/record.js) ---------- */
const ZP_BARS=[[55,59,62,74],[52,55,59,71],[57,60,64,76],[50,54,57,74],[55,59,62,79],[52,55,59,76],[48,52,55,72],[50,54,57,78]];
const loadRecord=()=>loadRecord.p||(loadRecord.p=import("./designs/record.js").catch(e=>{loadRecord.p=null;throw e}));
const zpYears=d=>parseInt((d.age||"").toString())||0;
function recordHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const n1=esc(v("partner1")),n2=esc(v("partner2"));const yrs=zpYears(d);
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const story=[1,2,3].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const dots=dt?`${String(dt.d).padStart(2,"0")} · ${String(dt.m).padStart(2,"0")} · ${dt.y}`:"";
 return`<div class="zp${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <div class="zp-room" aria-hidden="true"></div><canvas class="zp-cv" aria-hidden="true"></canvas>
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="zp-open" role="button" tabindex="0" aria-label="${C("Drop the needle to open the invitation","Spustite iglu da otvorite pozivnicu")}">
  <div class="zp-open-in"><div>${g?`<p class="zp-for">${C("For","Za:")} ${esc(g.name)}</p>`:`<p class="zp-for">${C("An invitation for you","Pozivnica za vas")}</p>`}
   <h2 class="zp-q">${C("Our <em>song</em> is playing","Svira <em>naša</em> pesma")}</h2></div>
   <span class="zp-go"><i aria-hidden="true"></i>${C("Drop the needle","Spustite iglu")}</span></div></section>
 <section class="zp-hero"><div class="zp-hero-in"><p class="zp-k">${yrs?C(`${yrs} years together`,`${yrs} godina zajedno`):C("Our anniversary","Naša godišnjica")}</p><h1 class="zp-names">${n1}<em>&amp;</em>${n2}</h1>${dots?`<p class="zp-date">${dots}</p>`:""}${v("songName")?`<p class="zp-song"><span>${C("Now playing","Svira")}</span>${esc(v("songName"))}</p>`:""}</div></section>
 <div class="zp-rest">
  <section class="zp-sec"><div class="zp-sleeve rv"><p class="zp-k">${C("You're invited","Pozivamo vas")}</p>${v("message")?`<p class="zp-lead">${br(v("message"))}</p>`:""}
   ${dt?`<div class="zp-big"><span>${esc(dt.wd)}</span><b>${dt.d}</b><span>${esc(dt.mon)} ${dt.y}${cl==="sr"?".":""}</span></div>`:""}${v("time")?`<p class="zp-at">${C("at","u")} ${esc(v("time"))}</p>`:""}</div></section>
  ${story.length?`<section class="zp-sec"><p class="zp-side rv">${C("Side A","Strana A")}</p><h2 class="zp-h rv">${C("Our <em>story</em>","Naša <em>priča</em>")}</h2>
   <ol class="zp-tracks">${story.map((s,i)=>`<li class="rv" style="--i:${i}"><span class="zp-no">A${i+1}</span><div>${s.t?`<h3>${esc(s.t)}</h3>`:""}${s.x?`<p>${br(s.x)}</p>`:""}</div>${s.y?`<time>${esc(s.y)}</time>`:""}</li>`).join("")}</ol></section>`:""}
  ${plan.length?`<section class="zp-sec"><p class="zp-side rv">${C("Side B","Strana B")}</p><h2 class="zp-h rv">${C("The <em>evening</em>","Program <em>večeri</em>")}</h2>
   <ol class="zp-tracks b">${plan.map((p,i)=>`<li class="rv" style="--i:${i}"><span class="zp-no">B${i+1}</span><div><h3>${esc(p.t)}</h3></div><time>${esc(p.tm)}</time></li>`).join("")}</ol></section>`:""}
  ${place?`<section class="zp-sec"><div class="zp-sleeve rv"><p class="zp-k">${C("Where","Gde")}</p><h3 class="zp-venue">${esc(v("venue"))}</h3>${v("address")?`<p class="zp-addr">${esc(v("address"))}</p>`:""}${v("dressCode")?`<p class="zp-dc">Dress code · ${esc(v("dressCode"))}</p>`:""}</div></section>`:""}
  ${w&&w>Date.now()?`<section class="zp-sec"><p class="zp-k rv">${C("Until the party","Do proslave")}</p><div class="zp-count rv" data-w="${w.getTime()}"></div></section>`:""}
  ${(gcal||maps)?`<section class="zp-sec"><div class="zp-links rv">${gcal?`<a class="zp-btn" href="${gcal}" target="_blank" rel="noopener"><b>${C("Add to calendar","Dodajte u kalendar")}</b><small>${dots}</small></a>`:""}${maps?`<a class="zp-btn" href="${maps}" target="_blank" rel="noopener"><b>${C("Directions","Kako stići")}</b><small>${esc(v("venue"))}</small></a>`:""}</div></section>`:""}
  <section class="zp-sec">${o.preview?`<div class="rsvp vx-rsvp zp-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you join us?","Da li dolazite?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp zp-rsvp" id="rsvp"></div>`}</section>
  <section class="zp-fin"><p class="zp-k rv">${esc(v("signoff")||C("Thank you for being part of our song","Hvala što ste deo naše pesme"))}</p><h2 class="zp-names rv">${n1}<em>&amp;</em>${n2}</h2>
   ${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music zp-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindRecord(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".zp-music",root);
 const reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
 let rec=null,dead=false,played=false;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music","Pauziraj muziku"):C("Play the music","Pusti muziku"))};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(ZP_BARS,.36);MBox.start();setPlay(true)};
 const cv=$(".zp-cv",root);const yrs=zpYears(d);
 loadRecord().then(m=>m.mountRecord(cv,{small:matchMedia("(max-width:700px)").matches,label:{n1:(d.partner1||"").trim(),n2:(d.partner2||"").trim(),years:yrs?String(yrs):"♥",sub:yrs?C("years together","godina zajedno"):C("our anniversary","naša godišnjica")}})).then(r=>{
  if(!r){root.classList.add("no3d");return}
  if(!root.isConnected){r.destroy();return}
  rec=r;root.classList.add("has3d");if(played)rec.played();
  const mo=new MutationObserver(()=>{if(!root.isConnected){dead=true;rec.destroy();mo.disconnect();removeEventListener("scroll",onS,true)}});mo.observe(document.body,{childList:true,subtree:true});
 }).catch(()=>root.classList.add("no3d"));
 cv.addEventListener("record-lost",()=>root.classList.replace("has3d","no3d"));
 let raf=0;const onS=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const ov=root.closest(".vx-ov");const y=ov?ov.scrollTop:scrollY;const p=Math.min(1,y/(innerHeight*.9));root.style.setProperty("--zps",p.toFixed(3));if(rec&&!dead)rec.setScroll(p)})};
 addEventListener("scroll",onS,{passive:true,capture:true});
 const open=withSound=>{
  if(root.classList.contains("on")||root.classList.contains("dropping"))return;
  if(withSound){play();try{if(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.isActive)navigator.vibrate(10)}catch(e){}}else setPlay(false);
  const go=()=>{root.classList.remove("dropping");root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,withSound?300:0);count()};
  if(!withSound||reduced){played=true;if(rec)rec.played();go();return}
  root.classList.add("dropping");played=true;
  if(rec)rec.drop(false).then(go);else setTimeout(go,900);
 };
 const op=$(".zp-open",root);op.addEventListener("click",()=>open(true));op.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open(true)}});
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".zp-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}

/* ---------- Baloni · premium children's birthday with balloons to pop (three.js, src/designs/balloons.js) ---------- */
const BL_BARS=[[60,64,67,76],[65,69,72,77],[67,71,74,79],[60,64,67,72],[57,60,64,76],[65,69,72,81],[67,71,74,79],[60,64,67,84]];
const BL_COLORS=["#F59AB0","#FFCB6B","#8FD3C1","#9EC2F7","#C8AEF5","#FFAE84"];
const loadBalloons=()=>loadBalloons.p||(loadBalloons.p=import("./designs/balloons.js").catch(e=>{loadBalloons.p=null;throw e}));
// a soft "pop": a short burst of filtered noise over a low thump
function popSound(){try{const C=popSound.ctx||(popSound.ctx=new (window.AudioContext||window.webkitAudioContext)());if(C.state==="suspended")C.resume();const t=C.currentTime;
 const len=Math.floor(C.sampleRate*.09),buf=C.createBuffer(1,len,C.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);
 const n=C.createBufferSource();n.buffer=buf;const bp=C.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1700;bp.Q.value=.8;const g=C.createGain();g.gain.value=.55;n.connect(bp).connect(g).connect(C.destination);n.start(t);
 const o=C.createOscillator(),og=C.createGain();o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(60,t+.12);og.gain.setValueAtTime(.35,t);og.gain.exponentialRampToValueAtTime(.001,t+.14);o.connect(og).connect(C.destination);o.start(t);o.stop(t+.15)}catch(e){}}
function balloonHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const nm=esc(v("childName"));const age=parseInt(v("age"))||"";
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const N=5;
 return`<div class="bn${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <div class="bn-sky" aria-hidden="true"><i class="c1"></i><i class="c2"></i><i class="c3"></i></div>
 <canvas class="bn-cv" aria-hidden="true"></canvas>
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="bn-open" aria-label="${C("Pop the balloons to open the invitation","Pukni balone da otvoriš pozivnicu")}">
  <div class="bn-open-top">${g?`<p class="bn-for">${C("For","Za:")} ${esc(g.name)}</p>`:`<p class="bn-for">${C("An invitation for you","Pozivnica za vas")}</p>`}
   <h2 class="bn-q">${C("Pop the balloons!","Pukni balone!")}</h2>
   <p class="bn-dots" aria-live="polite">${Array.from({length:N},(_,i)=>`<i style="--c:${BL_COLORS[i]}"></i>`).join("")}</p></div>
  <div class="bn-open-bot"><button type="button" class="bn-pop">${C("Tap the balloons","Dodirni balone")}</button><button type="button" class="bn-skip">${C("Open now","Otvori odmah")}</button></div></section>
 <section class="bn-hero"><div class="bn-hero-in"><p class="bn-k">${C("Birthday party","Rođendanska žurka")}</p><h1 class="bn-name">${nm}</h1>
  ${age?`<p class="bn-turns">${C("is turning","puni")}</p><p class="bn-age" aria-label="${age}"><span>${age}</span></p>`:""}
  ${dt?`<p class="bn-date">${esc(dt.wd)} · ${dt.d}. ${esc(dt.mon)}${v("time")?` · ${esc(v("time"))}`:""}</p>`:""}</div><span class="bn-cue" aria-hidden="true"></span></section>
 <div class="bn-rest">
  ${v("message")?`<section class="bn-sec"><div class="bn-card rv"><p class="bn-lead">${br(v("message"))}</p></div></section>`:""}
  <section class="bn-sec"><div class="bn-card bn-when rv">${dt?`<div class="bn-cal"><span>${esc(dt.mon)}</span><b>${dt.d}</b><span>${esc(dt.wd)}</span></div>`:""}
   <div class="bn-wtx">${v("time")?`<p class="bn-time">${C("at","u")} ${esc(v("time"))}</p>`:""}${v("venue")?`<h3>${esc(v("venue"))}</h3>`:""}${v("address")?`<p>${esc(v("address"))}</p>`:""}${v("dressCode")?`<p class="bn-dc">${esc(v("dressCode"))}</p>`:""}</div></div></section>
  ${plan.length?`<section class="bn-sec"><h2 class="bn-h rv">${C("Party plan","Plan žurke")}</h2>
   <ol class="bn-plan">${plan.map((p,i)=>`<li class="rv" style="--i:${i};--c:${BL_COLORS[i%BL_COLORS.length]}"><time>${esc(p.tm)}</time><p>${esc(p.t)}</p></li>`).join("")}</ol></section>`:""}
  ${w&&w>Date.now()?`<section class="bn-sec"><h2 class="bn-h rv">${C("Party starts in","Žurka počinje za")}</h2><div class="bn-count rv" data-w="${w.getTime()}"></div></section>`:""}
  ${(gcal||maps)?`<section class="bn-sec"><div class="bn-links rv">${gcal?`<a class="bn-btn" href="${gcal}" target="_blank" rel="noopener" style="--c:${BL_COLORS[3]}">${C("Add to calendar","Dodaj u kalendar")}</a>`:""}${maps?`<a class="bn-btn" href="${maps}" target="_blank" rel="noopener" style="--c:${BL_COLORS[2]}">${C("Directions","Kako stići")}</a>`:""}</div>${v("rsvpContact")?`<p class="bn-ph rv">${C("Questions? Call","Pitanja? Pozovite")} <a href="tel:${esc(v("rsvpContact").replace(/[^+\d]/g,""))}">${esc(v("rsvpContact"))}</a></p>`:""}</section>`:""}
  <section class="bn-sec">${o.preview?`<div class="rsvp vx-rsvp bn-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Are you coming?","Dolaziš li?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp bn-rsvp" id="rsvp"></div>`}</section>
  <section class="bn-fin"><p class="bn-sign rv">${br(v("signoff")||C("See you at the party!","Vidimo se na žurci!"))}</p>${v("hosts")?`<p class="bn-hosts rv">${esc(v("hosts"))}</p>`:""}
   ${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music bn-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindBalloon(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".bn-music",root);
 let sc=null,dead=false;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music","Pauziraj muziku"):C("Play the music","Pusti muziku"))};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(BL_BARS,.22);MBox.start();setPlay(true)};
 const buzz=()=>{try{if(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.isActive)navigator.vibrate(15)}catch(e){}};
 const dots=$$(".bn-dots i",root);let popped=0;
 const onPop=()=>{popSound();buzz();if(dots[popped])dots[popped].classList.add("on");popped++;if(popped===1&&!root.classList.contains("playing"))play()};
 const open=withSound=>{
  if(root.classList.contains("on"))return;
  if(withSound&&!root.classList.contains("playing"))play();else if(!withSound)setPlay(false);
  root.classList.add("on");o.onOpen&&o.onOpen();if(sc)sc.release();
  if(withSound)setTimeout(()=>confetti(BL_COLORS),250);
  setTimeout(reveal,withSound?500:0);count();
 };
 const cv=$(".bn-cv",root);
 loadBalloons().then(m=>m.mountBalloons(cv,{count:5,small:matchMedia("(max-width:700px)").matches,onPop,onDone:()=>open(true)})).then(s=>{
  if(!s){root.classList.add("no3d");return}
  if(!root.isConnected){s.destroy();return}
  sc=s;root.classList.add("has3d");if(root.classList.contains("on"))sc.release();
  const mo=new MutationObserver(()=>{if(!root.isConnected){dead=true;sc.destroy();mo.disconnect();removeEventListener("scroll",onS,true)}});mo.observe(document.body,{childList:true,subtree:true});
 }).catch(()=>root.classList.add("no3d"));
 cv.addEventListener("balloons-lost",()=>root.classList.replace("has3d","no3d"));
 let raf=0;const onS=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const ov=root.closest(".vx-ov");const y=ov?ov.scrollTop:scrollY;const p=Math.min(1,y/(innerHeight*1.2));root.style.setProperty("--bs",p.toFixed(3));if(sc&&!dead)sc.setScroll(p)})};
 addEventListener("scroll",onS,{passive:true,capture:true});
 // without 3D (or for keyboard users) the buttons pop the balloons one by one or open straight away
 $(".bn-pop",root).addEventListener("click",()=>{if(sc)sc.popNext();else open(true)});
 $(".bn-skip",root).addEventListener("click",()=>open(true));
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".bn-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l],i)=>`<div style="--c:${BL_COLORS[i]}"><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}

/* ---------- Mala pčelica · premium first birthday ---------- */
const RIP_DEC={10:["teens","tinejdžerske godine"],20:["twenties","dvadesete"],30:["thirties","tridesete"],40:["forties","četrdesete"],50:["fifties","pedesete"],60:["sixties","šezdesete"],70:["seventies","sedamdesete"]};
function ripInfo(d,cl){const v=k=>(d[k]??"").toString().trim();const age=parseInt(v("age"))||30;const dec=Math.max(10,Math.floor((age-1)/10)*10);const w=RIP_DEC[dec]||[`${dec}s`,`${dec}-e`];const dt=pd(v("date"),cl);const y=dt?dt.y:new Date().getFullYear();return{age,dec,word:cl==="sr"?w[1]:w[0],yrs:`${y-10} – ${y}`}}
function ripCard(d,cl,Q){
 const C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();Q=Q||((c)=>`class="${c}"`);
 const nm=esc(v("name"));const I=ripInfo(d,cl);const dt=pd(v("date"),cl);
 const fs=Math.min(15,64/Math.max(1,v("name").length*.5)).toFixed(1);
 return`<div class="rpc-st"><p class="rpc-rip">R.I.P.</p><p ${Q("rpc-my","age")}>${C("My","Moje")}<br>${esc(I.word)}</p><p class="rpc-y">${I.yrs}</p><p class="rpc-ep">${C("forever young","zauvek mlade")}</p></div>
 <div class="rpc-main"><p ${Q("rpc-k")}>${C("Join us as we say goodbye to","Pridružite nam se na ispraćaju")}</p><p class="rpc-k2">${C(`my ${esc(I.word)}`,`mojih ${esc(I.word.endsWith("godine")?"tinejdžerskih godina":I.word.replace(/e$/,"ih"))}`)}</p>
 <h2 ${Q("rpc-name","name")}><span style="font-size:${fs}cqw">${nm}</span></h2><p ${Q("rpc-age","age")}>${C("turns","puni")} <b style="font-size:${fs}cqw">${I.age}</b></p>
 ${dt?`<p ${Q("rpc-date","date")}><span>${esc(dt.wd).toUpperCase()}</span><i></i><b>${String(dt.d).padStart(2,"0")}.${String(dt.m).padStart(2,"0")}.</b><i></i><span>${v("time")?esc(v("time")):dt.y}</span></p>`:""}
 ${v("venue")?`<p ${Q("rpc-ven","venue")}>${esc(v("venue"))}${v("address")?`<small>${esc(v("address"))}</small>`:""}</p>`:""}
 ${v("dressCode")?`<p ${Q("rpc-dc","dressCode")}>Dress code: ${esc(v("dressCode"))}</p>`:""}</div>`}
function ripHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const nm=esc(v("name"));const I=ripInfo(d,cl);
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const stories=[1,2,3,4].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const photos=[1,2,3,4].map(i=>img(`photo${i}`)).filter(Boolean);const demo=!photos.length;
 const who=g&&g.source==="personal"?esc(g.name):"";
 const CONF=["#C9A45C","#E8CF8E","#F4E6BC","#8C6D2E","#FFFFFF"];
 const conf=Array.from({length:40},(_,i)=>`<i style="left:${(i*2.53)%100}%;--c:${CONF[i%5]};--t:${(5+(i*.37)%4).toFixed(2)}s;--d:${(-(i*.61)%6).toFixed(2)}s;--r:${(i*47)%360}deg;--w:${(i%3?6:4)}px"></i>`).join("");
 return`<div class="rp${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="rp-open">
  <p class="rp-hi">${who?`${C("For","Za")} ${who}`:C("A farewell party","Oproštajna žurka")}</p>
  <div class="rp-stone"><div class="rp-eng"><p class="a">R.I.P.</p><p class="b">${C("My","Moje")}<br>${esc(I.word)}</p><p class="c">${I.yrs}</p><p class="e">${C("Gone, but the party goes on","Otišle su, a žurka tek počinje")}</p></div></div>
  <button class="rp-candle" type="button" aria-label="${C("Light the candle and let the party begin","Upalite svećicu i neka žurka počne")}"><span class="rp-fl"></span><span class="rp-wick"></span><span class="rp-wax"></span><span class="rp-glow"></span></button>
  <p class="rp-go">${C("Light the candle and let the party begin","Upalite svećicu i neka žurka počne")}<small>${C("tap the candle","dodirnite svećicu")}</small></p>
 </section>
 <section class="rp-hero bd-hero"><div class="rp-bg"></div><div class="bd-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="hy-cue rp-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="rp-rest">
  <section class="rp-sec"><div class="rp-obit rv"><p class="rp-ok">${C("A cheerful obituary","Vesela čitulja")}</p>
   <div class="rp-ob">${demo?`<figure class="rp-op demo"><span>${C("photo","fotografija")}</span></figure>`:`<figure class="rp-op" style="background-image:url(${photos[0]})"></figure>`}
   <div><p class="rp-o1">${C(`With a smile and a little nostalgia we announce that after ten wonderful years we are saying goodbye to`,`Sa osmehom i malo nostalgije javljamo da su nas posle deset divnih godina napustile`)}</p><h2 class="rp-o2">${C(`${nm}'s ${esc(I.word)}`,esc(I.word))}</h2><p class="rp-o3">${C("",`${nm} · `)}${I.yrs}</p></div></div>
   ${v("message")?`<p class="rp-om">${br(v("message"))}</p>`:""}
   ${v("hosts")?`<p class="rp-os"><small>${C("Seeing them off","Ispraćaju ih")}:</small> ${esc(v("hosts"))}</p>`:""}</div></section>
  <section class="rp-sec"><p class="rp-kk rv">${C("The farewell party","Oproštajna žurka")}</p><h2 class="rp-h rv">${C("Come and <em>celebrate</em>","Dođite da <em>proslavimo</em>")}</h2>
   <div class="rp-when rv">${dt?`<div><small>${esc(dt.wd)}</small><b>${dt.d}.</b><span>${esc(dt.mon)} ${dt.y}.</span></div>`:""}${v("time")?`<div><small>${C("at","u")}</small><b>${esc(v("time"))}</b><span>${C("sharp","časova")}</span></div>`:""}${v("venue")?`<div><small>${C("where","gde")}</small><b class="v">${esc(v("venue"))}</b><span>${esc(v("address"))}</span></div>`:""}${v("dressCode")?`<div class="dc"><small>Dress code</small><b class="v">${esc(v("dressCode"))}</b><span>${C("a little sparkle is welcome","malo sjaja je dobrodošlo")}</span></div>`:""}</div>
   <div class="rp-acts rv">${gcal?`<a class="rp-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="rp-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Open the map","Otvorite mapu")}</a>`:""}</div></section>
  ${stories.length?`<section class="rp-sec"><p class="rp-kk rv">${C("Fond memories","Lepe uspomene")}</p><h2 class="rp-h rv">${C("The best <em>years</em>","Najlepše <em>godine</em>")}</h2><div class="rp-mem">${stories.map((s,i)=>`<div class="rp-m rv" style="--i:${i}"><b class="y">${esc(s.y)}</b><p class="t">${esc(s.t)}</p><p class="x">${esc(s.x)}</p></div>`).join("")}</div></section>`:""}
  <section class="rp-sec"><p class="rp-kk rv">${C("Memories in pictures","Uspomene na slikama")}</p><div class="rp-gal rv">${(demo?[0,1,2]:photos).map(u=>`<figure class="rp-ph${demo?" demo":""}"${demo?"":` style="background-image:url(${u})"`}>${demo?`<span>${C("Your photo","Vaša fotografija")}</span>`:""}</figure>`).join("")}</div>${demo?`<p class="rp-note rv">${C("Your photos will appear here","Ovde će biti vaše fotografije")}</p>`:photos.length>1?`<p class="rp-note rv">${C("Swipe","Prevucite")} →</p>`:""}</section>
  ${w&&w>Date.now()?`<section class="rp-sec"><p class="rp-kk rv">${C("Until the party","Do žurke")}</p><div class="rp-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="rp-sec">${o.preview?`<div class="rsvp vx-rsvp rp-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you join the party?","Da li dolazite na žurku?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp rp-rsvp" id="rsvp"></div>`}</section>
  <section class="rp-fin"><div class="rp-conf" aria-hidden="true">${conf}</div><p class="rp-f1 rv">${C(`The ${esc(I.word)} are gone…`,`${esc(I.word[0].toUpperCase()+I.word.slice(1))} su otišle…`)}</p><h2 class="rp-f2 rv">${C(`Long live the ${I.dec+10}s!`,`Živele ${({20:"tridesete",30:"četrdesete",40:"pedesete",50:"šezdesete",10:"dvadesete",60:"sedamdesete"})[I.dec]||"nove godine"}!`)}</h2>${v("hosts")?`<p class="rp-sign rv">${esc(v("hosts"))}</p>`:""}${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music rp-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindRip(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".rp-music",root);
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.3);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 const cdl=$(".rp-candle",root);let done=false;
 const open=withSound=>{if(done)return;done=true;root.classList.add("lit");if(withSound)play();setTimeout(()=>root.classList.add("fade"),withSound?1300:0);setTimeout(()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,600);count()},withSound?2200:0)};
 cdl.addEventListener("click",()=>open(true));
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".rp-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}
const FW_BLOOM=(c="")=>`<svg class="fw-bloom ${c}" viewBox="-50 -50 100 100" aria-hidden="true"><defs><radialGradient id="fwG1" cx="50%" cy="100%" r="105%"><stop offset="0" stop-color="#FDF0EF"/><stop offset=".55" stop-color="#F4C7CB"/><stop offset="1" stop-color="#E39FA8"/></radialGradient><radialGradient id="fwG2" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F6D6D8"/></radialGradient></defs>${[0,1,2,3,4,5,6,7].map(i=>`<g transform="rotate(${i*45})"><ellipse class="p o" cx="0" cy="-24" rx="12" ry="23" style="--k:${i}"/></g>`).join("")}${[0,1,2,3,4,5,6,7].map(i=>`<g transform="rotate(${i*45+22.5})"><ellipse class="p n" cx="0" cy="-15" rx="8" ry="15" style="--k:${i+4}"/></g>`).join("")}<circle class="c" r="7"/><circle class="c2" r="3.4"/></svg>`;
function bloomCard(d,cl,Q){
 const C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();Q=Q||((c)=>`class="${c}"`);
 const nm=esc(v("childName"));const age=parseInt(v("age"))||1;const dt=pd(v("date"),cl);const rs=pd(v("rsvpBy"),cl);
 const fs=Math.min(15,62/Math.max(1,v("childName").length*.5)).toFixed(1);
 const ORD=["","prvu","drugu","treću","četvrtu","petu"];
 const turns=cl==="sr"?(ORD[age]?`puni ${ORD[age]} godinu`:`puni ${age}. godinu`):(age===1?"is turning one":`is turning ${age}`);
 const mon=dt?(cl==="sr"?DATES.sr.mon[dt.m-1]:DATES.en.mon[dt.m-1]).toUpperCase():"";
 const PET=["#F2C4C8","#FFFFFF","#EBCFB8","#E7A9B1","#F8DCDD"];
 return`<div class="fwc-pet" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i style="left:${(i*11+4)%96}%;--c:${PET[i%5]};--t:${(11+(i*2.3)%7).toFixed(1)}s;--d:${(-(i*1.9)%11).toFixed(1)}s;--s:${(2+(i%3)*.6).toFixed(1)}cqw;--w:${(i%2?1:-1)*(4+i%4)}cqw"></i>`).join("")}</div><div class="fwc"><p ${Q("fwc-s")}>${C("Our little flower","Naš mali cvet")}</p>
 <h2 ${Q("fwc-name","childName")}><span style="font-size:${fs}cqw">${nm}</span></h2>
 <p ${Q("fwc-age","age")}>${turns}</p><span class="fwc-orn" aria-hidden="true">❀</span>
 <p ${Q("fwc-k")}>${C("Join us to celebrate","Pozivamo vas da proslavite sa nama")}</p>
 ${dt?`<p ${Q("fwc-date","date")}><span>${esc(dt.wd).toUpperCase()}</span><i></i><b>${dt.d}</b><i></i><span>${mon} ${dt.y}.</span></p>`:""}
 ${v("time")?`<p ${Q("fwc-time","time")}>${C("at","u")} ${esc(v("time"))}${cl==="sr"?" časova":""}</p>`:""}
 ${v("venue")?`<p ${Q("fwc-ven","venue")}>${esc(v("venue"))}</p>`:""}${v("address")?`<p ${Q("fwc-addr","address")}>${esc(v("address"))}</p>`:""}
 ${rs?`<p ${Q("fwc-rs","rsvpBy")}>${C(`Kindly reply by ${rs.short}`,`Molimo potvrdite dolazak do ${rs.short}`)}</p>`:""}</div>`}
function bloomHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl),bd=pd(v("birthDate"),cl);const nm=esc(v("childName"));const age=parseInt(v("age"))||1;
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const stories=[1,2,3,4].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const photos=[1,2,3,4].map(i=>img(`photo${i}`)).filter(Boolean);const demo=!photos.length;
 const dd=dt?`${dt.d}. ${cl==="sr"?DATES.sr.monG[dt.m-1]:DATES.en.mon[dt.m-1]} ${dt.y}.`:"";
 const who=g&&g.source==="personal"?esc(g.name):"";
 const stats=[[C("Bloomed","Procvetala"),bd?`${bd.d}.${bd.m}.${bd.y}.`:""],[C("Time","Vreme"),v("birthTime")],[C("Weight","Težina"),v("birthWeight")],[C("Length","Dužina"),v("birthLength")]].filter(x=>x[1]);
 const PET=["#F2C4C8","#F8DCDD","#FFFFFF","#EBCFB8","#E7A9B1"];
 const petals=Array.from({length:34},(_,i)=>`<i style="--c:${PET[i%5]};--x:${(Math.sin(i*2.4)*46).toFixed(0)}vw;--y:${(-48+((i*37)%80)).toFixed(0)}vh;--r:${(i*67)%360}deg;--d:${((i%7)*.05).toFixed(2)}s"></i>`).join("");
 const fall=Array.from({length:14},(_,i)=>`<i style="left:${(i*7.3+3)%100}%;--c:${PET[i%5]};--t:${(9+(i*1.7)%6).toFixed(1)}s;--d:${(-(i*1.3)%9).toFixed(1)}s;--s:${(10+(i*3)%9)}px"></i>`).join("");
 return`<div class="fw${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="fw-open">
  <p class="fw-hi">${who?`${C("For","Za")} ${who}`:C("A little something for you","Nešto lepo za vas")}</p>
  <div class="fw-pack">
   <button class="fw-top" type="button" aria-label="${C("Tear open the seed packet","Otvorite kesicu semena")}"><span>${C("Tear here","Otcepite ovde")} ✂</span></button>
   <div class="fw-body">
    <p class="fw-brand">${C("Seeds of joy","Seme radosti")}</p>
    <div class="fw-art"></div>
    <p class="fw-var">${C("Variety","Sorta")}: <b>${nm}</b></p>
    <div class="fw-info"><div><small>${C("Blooms","Cveta")}</small><b>${dd}</b></div><div><small>${C("Age","Starost")}</small><b>${C(`${age} year`,`${age}. godina`)}</b></div></div>
    <p class="fw-how">${C("Open gently and watch her bloom","Otvorite nežno i gledajte kako cveta")}</p>
   </div>
  </div>
  <p class="fw-go">${C("Swipe across the top to open","Prevucite preko vrha da otvorite")}<small>${C("or just tap it","ili ga samo dodirnite")}</small></p>
  <div class="fw-burst" aria-hidden="true">${petals}</div><div class="fw-big" aria-hidden="true">${FW_BLOOM("big")}</div>
 </section>
 <section class="fw-hero bd-hero"><div class="fw-bg"></div><div class="bd-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="hy-cue fw-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="fw-rest">
  <section class="fw-sec"><div class="fw-div rv">${FW_BLOOM()}</div><p class="fw-kk rv">${C("You're invited","Pozvani ste")}</p>${v("message")?`<p class="fw-lead rv">${(()=>{const m=br(v("message"));return nm&&m.includes(nm)?m.split(nm).join(`<b>${nm}</b>`):m})()}</p>`:""}
   <div class="fw-when rv">${dt?`<div><small>${esc(dt.wd)}</small><b>${dt.d}.</b><span>${esc(dt.mon)} ${dt.y}.</span></div>`:""}${v("time")?`<div><small>${C("at","u")}</small><b>${esc(v("time"))}</b><span>${C("o'clock","časova")}</span></div>`:""}${v("venue")?`<div><small>${C("where","gde")}</small><b class="v">${esc(v("venue"))}</b><span>${esc(v("address"))}</span></div>`:""}</div>
   <div class="fw-acts rv">${gcal?`<a class="fw-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="fw-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Open the map","Otvorite mapu")}</a>`:""}</div></section>
  ${stats.length?`<section class="fw-sec"><div class="fw-div rv">${FW_BLOOM()}</div><p class="fw-kk rv">${C("How she grew","Kako je rasla")}</p><h2 class="fw-h rv">${C("The day our <em>flower</em> bloomed","Dan kada je naš <em>cvet</em> procvetao")}</h2><div class="fw-tags">${stats.map(([a,b],i)=>`<div class="fw-tag rv" style="--i:${i}"><span class="hole"></span><small>${a}</small><b>${esc(b)}</b></div>`).join("")}</div></section>`:""}
  ${stories.length?`<section class="fw-sec"><div class="fw-div rv">${FW_BLOOM()}</div><p class="fw-kk rv">${C("My first year","Moja prva godina")}</p><h2 class="fw-h rv">${C("Petal <em>by petal</em>","Latica <em>po latica</em>")}</h2><ol class="fw-tl">${stories.map((s,i)=>`<li class="rv" style="--i:${i}"><span class="dot">✿</span><div><small>${esc(s.y)}</small><b>${esc(s.t)}</b><p>${esc(s.x)}</p></div></li>`).join("")}<li class="fw-full rv"><span class="dot">❀</span><div><small>${dd}</small><b>${C(`In full bloom: ${ordEn(age)} birthday`,`U punom cvatu: ${age}. rođendan`)}</b></div></li></ol></section>`:""}
  <section class="fw-sec"><div class="fw-div rv">${FW_BLOOM()}</div><p class="fw-kk rv">${C("My little garden of memories","Moja mala bašta uspomena")}</p><div class="fw-gal rv">${(demo?[0,1,2]:photos).map(u=>`<figure class="fw-ph${demo?" demo":""}"${demo?"":` style="background-image:url(${u})"`}>${demo?`<span>${C("Your photo","Vaša fotografija")}</span>`:""}</figure>`).join("")}</div>${demo?`<p class="fw-note rv">${C("Your photos will appear here","Ovde će biti vaše fotografije")}</p>`:photos.length>1?`<p class="fw-note rv">${C("Swipe","Prevucite")} →</p>`:""}</section>
  ${w&&w>Date.now()?`<section class="fw-sec"><div class="fw-div rv">${FW_BLOOM()}</div><p class="fw-kk rv">${C("Until we celebrate","Do slavlja")}</p><div class="fw-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="fw-sec">${o.preview?`<div class="rsvp vx-rsvp fw-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you celebrate with us?","Da li slavite sa nama?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp fw-rsvp" id="rsvp"></div>`}</section>
  <section class="fw-fin"><div class="fw-fall" aria-hidden="true">${fall}</div><div class="fw-bq rv"></div><h2 class="fw-see rv">${C("See you soon!","Vidimo se!")}</h2>${v("hosts")?`<p class="fw-sign rv">${esc(v("hosts"))}</p>`:""}${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <div class="fw-amb" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="left:${(i*8.7+2)%100}%;--c:${PET[i%5]};--t:${(14+(i*2.1)%9).toFixed(1)}s;--d:${(-(i*2.7)%14).toFixed(1)}s;--s:${(9+(i*3)%8)}px"></i>`).join("")}</div>
 <button class="vx-music fw-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindBloom(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".fw-music",root);
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.26);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 const top=$(".fw-top",root);let x0=null,done=false;
 const open=withSound=>{if(done)return;done=true;top.style.transform="";root.classList.add("torn");if(withSound)play();setTimeout(()=>root.classList.add("burst"),withSound?350:0);setTimeout(()=>root.classList.add("blooming"),withSound?650:0);setTimeout(()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,600);count()},withSound?2600:0)};
 top.addEventListener("pointerdown",e=>{if(done)return;x0=e.clientX;try{top.setPointerCapture(e.pointerId)}catch(_){}});
 top.addEventListener("pointermove",e=>{if(x0===null||done)return;const dx=Math.abs(e.clientX-x0);top.style.transform=`rotate(${(-Math.min(dx,120)*.06).toFixed(1)}deg) translateY(${(-Math.min(dx,120)*.08).toFixed(1)}px)`;if(dx>80)open(true)});
 top.addEventListener("pointerup",()=>{if(!done)open(true);x0=null});
 top.addEventListener("pointercancel",()=>{x0=null;if(!done)top.style.transform=""});
 top.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open(true)}});
 const tl=$(".fw-tl",root);let raf=0;const stem=()=>{raf=0;if(!tl||!tl.isConnected){removeEventListener("scroll",onS);return}const r=tl.getBoundingClientRect();const p=Math.max(0,Math.min(1,(innerHeight*.75-r.top)/r.height));tl.style.setProperty("--g",p.toFixed(3))};const onS=()=>{if(!raf)raf=requestAnimationFrame(stem)};if(tl){addEventListener("scroll",onS,{passive:true});stem()}
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".fw-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}
function planeCard(d,cl,Q){
 const C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();Q=Q||((c)=>`class="${c}"`);
 const nm=esc(v("childName"));const age=parseInt(v("age"))||1;const dt=pd(v("date"),cl);const rs=pd(v("rsvpBy"),cl);
 const fs=Math.min(13.5,70/Math.max(1,v("childName").length*.62)).toFixed(1);
 const ORD=["","prvu","drugu","treću","četvrtu","petu"];
 const turns=cl==="sr"?(ORD[age]?`puni ${ORD[age]} godinu!`:`puni ${age}. godinu!`):(age===1?"is turning one!":`is turning ${age}!`);
 const mon=dt?(cl==="sr"?DATES.sr.mon[dt.m-1]:DATES.en.mon[dt.m-1]).slice(0,3).toUpperCase():"";
 const wd=dt?esc(dt.wd).slice(0,3).toUpperCase():"";
 return`<p class="sc-s1">${C("My, oh my…","Kako brzo…")}</p><p class="sc-s2">${C("a year has flown by!","godina je proletela!")}</p>
 <div class="sc-main"><p ${Q("sc-k")}>${C("Time flies when you're having fun…","Vreme leti kad je lepo…")}</p>
 <h2 ${Q("sc-name","childName")}><span style="font-size:${fs}cqw">${nm}</span></h2>
 <p ${Q("sc-age","age")}>${turns}</p>
 <p ${Q("sc-fly")}>${C("Fly on over to celebrate!","Doletite da proslavimo!")}</p>
 ${dt?`<p ${Q("sc-date","date")}><span>${mon}</span><i></i><b>${dt.d}</b><i></i><span>${wd}</span></p>`:""}
 ${v("time")?`<p ${Q("sc-time","time")}>${C("at","u")} ${esc(v("time"))}${cl==="sr"?" časova":""}</p>`:""}
 ${v("venue")?`<p ${Q("sc-ven","venue")}>${esc(v("venue"))}</p>`:""}${v("address")?`<p ${Q("sc-addr","address")}>${esc(v("address"))}</p>`:""}
 ${rs?`<p ${Q("sc-rs","rsvpBy")}>${C(`RSVP by ${rs.short}`,`Potvrdite dolazak do ${rs.short}`)}</p>`:""}</div>`}
const PLANE_SVG='<svg viewBox="0 0 140 70" aria-hidden="true"><path d="M8 34c0-5 6-9 14-9h66c14 0 26 4 34 9-8 5-20 9-34 9H22c-8 0-14-4-14-9z" fill="#5E86AC"/><path d="M22 26c8-1 60-1 66 0" stroke="#F4EBDC" stroke-width="3" fill="none" opacity=".7"/><path d="M14 30 4 12h10l14 15z" fill="#4A6F94"/><path d="M50 36 38 64h14l26-28z" fill="#F4EBDC"/><path d="M52 32 44 10h12l20 22z" fill="#E9DCC4"/><path d="M84 25c3-6 12-7 16-1" fill="#CFE2F1" stroke="#3E5A78" stroke-width="2"/><circle cx="64" cy="34" r="3" fill="#F4EBDC"/><circle cx="74" cy="34" r="3" fill="#F4EBDC"/><circle cx="54" cy="34" r="3" fill="#F4EBDC"/><path d="M122 34h6" stroke="#3E5A78" stroke-width="4" stroke-linecap="round"/><ellipse class="prop" cx="129" cy="34" rx="3" ry="16" fill="#B5643C" opacity=".85"/></svg>';
function planeHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl),bd=pd(v("birthDate"),cl);const nm=esc(v("childName"));const age=parseInt(v("age"))||1;
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const stories=[1,2,3,4].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const photos=[1,2,3,4].map(i=>img(`photo${i}`)).filter(Boolean);const demo=!photos.length;
 const fno=((v("childName").slice(0,2)||"PL").toUpperCase()+" "+String(age).padStart(2,"0")).replace(/[^A-ZČĆŽŠĐ0-9 ]/g,"");
 const dd=dt?`${String(dt.d).padStart(2,"0")}.${String(dt.m).padStart(2,"0")}.${dt.y}.`:"";
 const who=g&&g.source==="personal"?esc(g.name):C("Our dear guest","Naš dragi gost");
 const stats=[[C("Take-off","Poletanje"),bd?`${String(bd.d).padStart(2,"0")}.${String(bd.m).padStart(2,"0")}.${bd.y}.`:""],[C("Time","Vreme"),v("birthTime")],[C("Weight","Težina"),v("birthWeight")],[C("Length","Dužina"),v("birthLength")]].filter(x=>x[1]);
 const bars=Array.from({length:34},(_,i)=>`<i style="width:${[1,2,1,3,1,1,2,1,3,2][i%10]}px"></i>`).join("");
 return`<div class="sk${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="sk-open">
  <p class="sk-hi">${C("Your flight is ready","Vaš let je spreman")}</p>
  <div class="sk-pass">
   <div class="sk-ph"><span>✈ POZIV AIR</span><span>${C("Boarding pass","Karta za ukrcavanje")}</span></div>
   <div class="sk-pb">
    <p class="sk-lbl">${C("Passenger","Putnik")}</p><p class="sk-who">${who}</p>
    <div class="sk-route"><div><b>0</b><small>${C("Birth","Rođenje")}</small></div><span class="sk-line"><i>✈</i></span><div><b>${age}</b><small>${C(`${ordEn(age)} birthday`,`${age}. rođendan`)}</small></div></div>
    <div class="sk-grid"><div><small>${C("Flight","Let")}</small><b>${esc(fno)}</b></div><div><small>${C("Date","Datum")}</small><b>${dd}</b></div><div><small>${C("Boarding","Ukrcavanje")}</small><b>${esc(v("time"))}</b></div><div><small>${C("Seat","Sedište")}</small><b>1A</b></div><div class="w"><small>${C("Gate","Izlaz")}</small><b>${esc(v("venue"))}</b></div></div>
   </div>
   <button class="sk-stub" type="button" aria-label="${C("Tear off the ticket to take off","Otkinite kartu i poletite")}"><span class="sk-bars">${bars}</span><span class="sk-tear">${C("Tear here","Otkinite ovde")} ↓</span></button>
  </div>
  <p class="sk-go">${C("Pull the stub down to take off","Povucite deo karte nadole i poletite")}<small>${C("or just tap it","ili ga samo dodirnite")}</small></p>
  <span class="sk-fly">${PLANE_SVG}</span>
 </section>
 <section class="sk-hero bd-hero"><div class="sk-sky"></div><div class="bd-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="hy-cue sk-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="sk-rest">
  <section class="sk-sec"><p class="sk-kk rv">${C("You're invited","Pozvani ste")}</p>${v("message")?`<p class="sk-lead rv">${(()=>{const m=br(v("message"));return nm&&m.includes(nm)?m.split(nm).join(`<b>${nm}</b>`):m})()}</p>`:""}
   <div class="sk-when rv">${dt?`<div><small>${esc(dt.wd)}</small><b>${dt.d}.</b><span>${esc(dt.mon)} ${dt.y}.</span></div>`:""}${v("time")?`<div><small>${C("boarding","ukrcavanje")}</small><b>${esc(v("time"))}</b><span>${C("o'clock","časova")}</span></div>`:""}${v("venue")?`<div><small>${C("gate","izlaz")}</small><b class="v">${esc(v("venue"))}</b><span>${esc(v("address"))}</span></div>`:""}</div>
   <div class="sk-acts rv">${gcal?`<a class="sk-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="sk-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Open the map","Otvorite mapu")}</a>`:""}</div></section>
  ${stats.length?`<section class="sk-sec"><p class="sk-kk rv">${C("Flight details","Podaci o letu")}</p><h2 class="sk-h rv">${C("Where it all <em>took off</em>","Gde je sve <em>poletelo</em>")}</h2><div class="sk-board rv"><div class="sk-bh"><span>${C("Departures","Polasci")}</span><span>${fno}</span></div>${stats.map(([a,b],i)=>`<div class="sk-row" style="--i:${i}"><small>${a}</small><b>${esc(b).split("").map((ch,j)=>`<i style="--j:${j}">${ch===" "?"&nbsp;":ch}</i>`).join("")}</b></div>`).join("")}</div></section>`:""}
  ${stories.length?`<section class="sk-sec"><p class="sk-kk rv">${C("My first year","Moja prva godina")}</p><h2 class="sk-h rv">${C("The route <em>so far</em>","Ruta mog <em>prvog leta</em>")}</h2><ol class="sk-tl">${stories.map((s,i)=>`<li class="rv" style="--i:${i}"><span class="dot">✈</span><div><small>${esc(s.y)}</small><b>${esc(s.t)}</b><p>${esc(s.x)}</p></div></li>`).join("")}<li class="sk-land rv"><span class="dot">★</span><div><small>${dt?dd:""}</small><b>${C(`Landing: ${ordEn(age)} birthday`,`Sletanje: ${age}. rođendan`)}</b></div></li></ol></section>`:""}
  <section class="sk-sec"><p class="sk-kk rv">${C("View from my window","Pogled kroz moj prozor")}</p><div class="sk-wins rv">${(demo?[0,1,2]:photos).map((u,i)=>`<figure class="sk-win${demo?" demo":""}"${demo?"":` style="background-image:url(${u})"`}>${demo?`<span>${C("Your photo","Vaša fotografija")}</span>`:""}</figure>`).join("")}</div>${demo?`<p class="sk-note rv">${C("Your photos will appear in the windows","Vaše fotografije biće u prozorima aviona")}</p>`:photos.length>1?`<p class="sk-note rv">${C("Swipe","Prevucite")} →</p>`:""}</section>
  ${w&&w>Date.now()?`<section class="sk-sec"><p class="sk-kk rv">${C("Until take-off","Do poletanja")}</p><div class="sk-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="sk-sec">${o.preview?`<div class="rsvp vx-rsvp sk-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Are you flying with us?","Da li letite sa nama?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp sk-rsvp" id="rsvp"></div>`}</section>
  <section class="sk-fin"><div class="sk-tow rv"><div class="sk-train"><span class="sk-flag">${C("See you on board!","Vidimo se u letu!")}</span><span class="sk-rope"></span><span class="sk-tp">${PLANE_SVG}</span></div></div>${v("hosts")?`<p class="sk-sign rv">${esc(v("hosts"))}</p>`:""}${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music sk-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindPlane(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".sk-music",root);
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.3);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 const stub=$(".sk-stub",root);let y0=null,dy=0,done=false;
 const open=withSound=>{if(done)return;done=true;stub.style.transform="";root.classList.add("torn");if(withSound)play();setTimeout(()=>root.classList.add("flying"),withSound?450:0);setTimeout(()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,600);count()},withSound?2100:0)};
 stub.addEventListener("pointerdown",e=>{if(done)return;y0=e.clientY;dy=0;try{stub.setPointerCapture(e.pointerId)}catch(_){}});
 stub.addEventListener("pointermove",e=>{if(y0===null||done)return;dy=Math.max(0,e.clientY-y0);stub.style.transform=`translateY(${Math.min(dy,90)*.5}px) rotate(${Math.min(dy,90)*.08}deg)`;if(dy>70)open(true)});
 stub.addEventListener("pointerup",()=>{if(!done)open(true);y0=null});
 stub.addEventListener("pointercancel",()=>{y0=null;if(!done)stub.style.transform=""});
 stub.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open(true)}});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".sk-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}
/* the opening scene of Mala pčelica: a daisy and the little bee asleep on it */
const HY_DAISY=(()=>{const ring=(n,o,cls,cy,rx,ry)=>Array.from({length:n},(_,i)=>`<ellipse class="${cls}" cx="100" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${i*360/n+o} 100 95)"/>`).join("");
 const dots=Array.from({length:16},(_,i)=>{const a=i*2.4,r=5+(i%4)*4.4;return`<circle cx="${(100+Math.cos(a)*r).toFixed(1)}" cy="${(95+Math.sin(a)*r).toFixed(1)}" r="${i%3?1.5:1.2}" fill="${i%3?"#E29A17":"#FFF0A8"}" opacity=".7"/>`}).join("");
 return`<svg class="hy-daisy" viewBox="0 0 200 260" aria-hidden="true"><defs><radialGradient id="hdP" cx="50%" cy="88%" r="95%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".68" stop-color="#F8FAFD"/><stop offset="1" stop-color="#DCE5F1"/></radialGradient><radialGradient id="hdC" cx="42%" cy="36%" r="72%"><stop offset="0" stop-color="#FFE27A"/><stop offset=".6" stop-color="#F6BE2C"/><stop offset="1" stop-color="#E09414"/></radialGradient></defs>
<path class="st" d="M100 118C97 165 104 205 100 262"/><path class="lf" d="M100 210C82 191 60 189 43 197C60 216 84 220 100 210Z"/><path class="lv" d="M99 209C82 203 64 200 48 198"/><path class="lf" d="M101 177C118 157 140 153 157 159C143 179 119 185 101 177Z"/><path class="lv" d="M102 176C119 168 138 162 152 160"/>
${ring(12,15,"pb",57,11.5,31)}${ring(12,0,"pf",58,12.5,33)}<circle cx="100" cy="95" r="25" fill="url(#hdC)"/>${dots}</svg>`})();
const HY_BEE=`<svg viewBox="0 0 120 100" aria-hidden="true"><defs><radialGradient id="hbY" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#FFE98C"/><stop offset=".55" stop-color="#F8C832"/><stop offset="1" stop-color="#E7A417"/></radialGradient><clipPath id="hbC"><ellipse cx="50" cy="62" rx="30" ry="24"/></clipPath></defs>
<g class="wg"><g transform="rotate(-24 44 30)"><ellipse cx="44" cy="30" rx="13" ry="20"/><path d="M44 46q-3-10 0-26"/></g><g transform="rotate(14 61 26)"><ellipse cx="61" cy="26" rx="15.5" ry="23"/><path d="M60 46q2-12-1-30"/></g></g>
<path d="M22 59l-10 4 10 4z" fill="#2B2420"/><path d="M39 82l-3 8M51 85v8M63 82l3 8" stroke="#2B2420" stroke-width="3.2" stroke-linecap="round"/>
<g clip-path="url(#hbC)"><ellipse cx="50" cy="62" rx="30" ry="24" fill="url(#hbY)"/><rect x="33" y="30" width="8.5" height="70" fill="#2B2420" transform="rotate(9 37 62)"/><rect x="50" y="30" width="9.5" height="70" fill="#2B2420" transform="rotate(9 55 62)"/><ellipse cx="45" cy="49" rx="11" ry="4.5" fill="#fff" opacity=".3"/></g>
<path d="M79 28C77 17 73 11 68 7M90 28C94 18 100 13 107 11" fill="none" stroke="#2B2420" stroke-width="2.6" stroke-linecap="round"/><circle cx="68" cy="7" r="3.8" fill="#2B2420"/><circle cx="107" cy="11" r="3.8" fill="#2B2420"/>
<circle cx="84" cy="48" r="23" fill="url(#hbY)"/><ellipse cx="77" cy="36" rx="7" ry="3.6" fill="#fff" opacity=".35"/>
<path d="M73 47q4.5-5.5 9 0M88 46q4.5-5.5 9 0M82 56q3.5 3.6 7 0" fill="none" stroke="#2B2420" stroke-width="2.4" stroke-linecap="round"/><circle cx="72.5" cy="55" r="4.6" fill="#F29C86" opacity=".7"/><circle cx="99" cy="54" r="4.6" fill="#F29C86" opacity=".7"/></svg>`;
function honeyHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl),bd=pd(v("birthDate"),cl);const nm=esc(v("childName"));const age=parseInt(v("age"))||1;
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const stories=[1,2,3,4].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 let photos=[1,2,3,4].map(i=>img(`photo${i}`)).filter(Boolean);const demo=!photos.length;
 const route=[1,2,3].map(i=>v(`route${i}`)).filter(Boolean);
 const stats=[[C("Born","Rođena/o"),bd?`${bd.d}.${bd.m}.${bd.y}.`:""],[C("Time","Vreme"),v("birthTime")],[C("Weight","Težina"),v("birthWeight")],[C("Length","Dužina"),v("birthLength")]].filter(x=>x[1]);
 const BEE='<svg viewBox="0 0 40 30" aria-hidden="true"><ellipse cx="13" cy="9" rx="8" ry="6" fill="#fff" opacity=".85"/><ellipse cx="24" cy="8" rx="8" ry="6" fill="#fff" opacity=".85"/><ellipse cx="20" cy="18" rx="12" ry="9" fill="#F4B41A"/><path d="M15 10v16M21 9.4v17.2M27 11v14" stroke="#4a2f12" stroke-width="3"/><circle cx="31" cy="16" r="1.6" fill="#4a2f12"/></svg>';
 return`<div class="hy${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="hy-open" aria-label="${C("Wake the little bee to open","Probudite pčelicu da otvorite")}">
  <p class="hy-k">${g?`${C("For","Za:")} ${esc(g.name)}`:"Bzzz… "+C("an invitation","pozivnica")}</p>
  <div class="hy-scene">${HY_DAISY}<button class="hy-bz" type="button" aria-label="${C("Wake the little bee","Probudite pčelicu")}"><span class="hy-bzi">${HY_BEE}</span></button><i class="hy-z" aria-hidden="true">z</i><i class="hy-z z2" aria-hidden="true">z</i></div>
  <svg class="hy-trail" aria-hidden="true"><defs><mask id="hyTm" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><path class="m"/></mask></defs><path class="t" mask="url(#hyTm)"/></svg>
  <p class="hy-go">${C("Wake the little bee","Probudite pčelicu")}<small>${C("tap her and follow her to the invitation","dodirnite je i ona će vas odvesti do pozivnice")}</small></p></section>
 <section class="hy-hero bd-hero"><div class="bd-scene"></div><div class="bd-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="hy-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="hy-rest">
  <section class="hy-sec"><p class="hy-kk rv">${C("You're invited","Pozvani ste")}</p>${v("message")?`<p class="hy-lead hy-inv rv">${(()=>{const m=br(v("message"));const n=esc(v("childName"));return n&&m.includes(n)?m.split(n).join(`<b class="hy-nm">${n}</b>`):m})()}</p>`:""}
   <div class="hy-when rv">${dt?`<div><small>${esc(dt.wd)}</small><b>${dt.d}.</b><span>${esc(dt.mon)} ${dt.y}.</span></div>`:""}${v("time")?`<div><small>${C("at","u")}</small><b>${esc(v("time"))}</b><span>${C("o'clock","časova")}</span></div>`:""}${v("venue")?`<div><small>${C("where","gde")}</small><b class="v">${esc(v("venue"))}</b><span>${esc(v("address"))}</span></div>`:""}</div></section>
  ${stats.length?`<section class="hy-sec"><p class="hy-kk rv">${C("A little about me","Malo o meni")}</p><div class="hy-stats">${stats.map(([a,b],i)=>`<div class="rv" style="--i:${i}"><span class="hex">${BEE}</span><small>${a}</small><b>${esc(b)}</b></div>`).join("")}</div></section>`:""}
  ${stories.length?`<section class="hy-sec"><p class="hy-kk rv">${C("My first year","Moja prva godina")}</p><h2 class="hy-h rv">${C("The flight <em>so far</em>","Moj <em>let</em>")}</h2><ol class="hy-tl">${stories.map((s,i)=>`<li class="rv" style="--i:${i}"><span class="dot">${BEE}</span><div><small>${esc(s.y)}</small><b>${esc(s.t)}</b><p>${esc(s.x)}</p></div></li>`).join("")}</ol></section>`:""}
  <section class="hy-sec"><p class="hy-kk rv">${C("Photos with my family","Fotografije sa mojima")}</p><div class="hy-gal rv">${(demo?["var(--a-hyph1)","var(--a-hyph2)"]:photos.map(u=>`url(${u})`)).map(b=>`<figure style="background-image:${b}"></figure>`).join("")}</div>${demo?`<p class="hy-note rv">${C("Your photos will appear here","Ovde će biti vaše fotografije")}</p>`:`<p class="hy-note rv">${C("Swipe","Prevucite")} →</p>`}</section>
  ${w&&w>Date.now()?`<section class="hy-sec"><p class="hy-kk rv">${C("Until the party","Do žurke")}</p><div class="hy-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="hy-sec">${o.preview?`<div class="rsvp vx-rsvp hy-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you buzz by?","Da li doletite?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp hy-rsvp" id="rsvp"></div>`}</section>
  <section class="hy-fin"><div class="wave rv"></div><h2 class="hy-h rv">Bzzz… ${C("see you!","vidimo se!")}</h2>${v("hosts")?`<p class="hy-sign rv">${esc(v("hosts"))}</p>`:""}${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music hy-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindHoney(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".hy-music",root);
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.3);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 const op=$(".hy-open",root),sc=$(".hy-scene",op),bee=$(".hy-bz",op),tr=$(".hy-trail",op);let done=false;
 const show=()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,600);count()};
 // she wakes, loops up from the daisy drawing a dotted trail, glides to the middle and the view zooms into her
 const fly=()=>{
  const ob=op.getBoundingClientRect(),b=bee.getBoundingClientRect(),hk=$(".hy-k",op).getBoundingClientRect();
  const R=[b.left-ob.left+b.width*.71,b.top-ob.top+b.height*.5],T=[ob.width/2,Math.min(ob.height*.4,(hk.bottom-ob.top+R[1])/2)];
  const u=Math.min(sc.getBoundingClientRect().width/100,(R[1]-(hk.bottom-ob.top)-12)/92); // the loop stays below the title
  const P=(x,y)=>`${(R[0]+x*u).toFixed(1)} ${(R[1]+y*u).toFixed(1)}`,TP=(x,y)=>`${(T[0]+x*u).toFixed(1)} ${(T[1]+y*u).toFixed(1)}`;
  const d=`M${P(0,0)}C${P(-4,-22)} ${P(-34,-34)} ${P(-34,-56)}C${P(-34,-78)} ${P(-4,-84)} ${P(2,-66)}C${P(8,-48)} ${P(-22,-44)} ${P(-22,-60)}C${P(-22,-82)} ${TP(-40,-6)} ${TP(0,0)}`;
  tr.setAttribute("viewBox",`0 0 ${ob.width.toFixed(0)} ${ob.height.toFixed(0)}`);const pa=$$("path",tr);pa.forEach(p=>p.setAttribute("d",d));
  const len=pa[0].getTotalLength(),N=64,kf=[];let f=1,px=R[0],py=R[1];
  for(let i=0;i<=N;i++){const q=pa[0].getPointAtLength(len*i/N),dx=q.x-px,dy=q.y-py;px=q.x;py=q.y;
   if(i){const want=dx<-.4?-1:dx>.4?1:Math.sign(f);f+=(want-f)*.6}if(i>N-7)f+=(1-f)*.5;
   let r=i?Math.max(-24,Math.min(24,Math.atan2(dy,Math.abs(dx)||.001)*28.6))*(f<0?-1:1):0;if(i>N-4)r*=.3;
   kf.push({transform:`translate(${(q.x-R[0]).toFixed(1)}px,${(q.y-R[1]).toFixed(1)}px) rotate(${r.toFixed(1)}deg) scaleX(${f.toFixed(2)})`})}
  const at=`translate(${(T[0]-R[0]).toFixed(1)}px,${(T[1]-R[1]).toFixed(1)}px)`;kf[N]={transform:`${at} rotate(0deg) scaleX(1)`};
  const FL=1700,ZM=1100,fe="cubic-bezier(.45,.05,.4,1)";
  pa[0].style.strokeDasharray=len;pa[0].animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:FL,easing:fe,fill:"both"});
  setTimeout(()=>root.classList.add("left"),180);
  bee.animate(kf,{duration:FL,easing:fe,fill:"forwards"}).finished.then(()=>{
   root.classList.add("zoom");tr.animate([{opacity:1},{opacity:0}],{duration:450,fill:"forwards"});
   bee.animate([{transform:`${at} scale(1)`},{transform:`${at} scale(3)`,offset:.4},{transform:`${at} scale(30)`}],{duration:ZM,easing:"cubic-bezier(.5,0,.9,.4)",fill:"forwards"});
   setTimeout(show,ZM*.62)})};
 const open=withSound=>{if(done)return;done=true;if(withSound)play();if(!withSound||matchMedia("(prefers-reduced-motion: reduce)").matches){show();return}root.classList.add("awake");setTimeout(fly,380)};
 sc.addEventListener("click",()=>open(true));
 const cake=$(".hy-cake",root);const blow=()=>{if(!cake)return;if(cake.classList.contains("out"))return;cake.classList.add("out");$(".hy-cake-t",root).textContent=C("Your wish is on its way!","Vaša želja je na putu!");const cf=$(".hy-conf",root);cf.innerHTML=Array.from({length:28},(_,i)=>`<i style="--x:${(Math.random()*240-120).toFixed(0)}px;--y:${(-Math.random()*220-60).toFixed(0)}px;--r:${(Math.random()*720).toFixed(0)}deg;--c:${["#F4B41A","#FFE08A","#C98A1B","#B9CDB0","#fff"][i%5]};--d:${(Math.random()*.3).toFixed(2)}s"></i>`).join("");cf.classList.add("go")};
 cake&&cake.addEventListener("click",blow);cake&&cake.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();blow()}});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".hy-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}


/* ---------- Mali dino · premium first birthday: the guest taps an egg until it hatches, then jungle leaves sweep the invitation in ---------- */
const DN_EGG=(()=>{const egg="M100 8C150 8 186 94 186 158C186 218 148 254 100 254C52 254 14 218 14 158C14 94 50 8 100 8Z";
 const zz="182 142 164 124 146 144 128 122 110 142 92 120 74 142 56 124 38 144 20 126 0 138";
 const spots=[[64,70,9],[132,58,7],[150,104,11],[52,128,12],[104,96,8],[120,176,13],[60,196,9],[154,206,8],[90,224,6],[84,150,7]].map(([x,y,r])=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r*.82).toFixed(1)}" fill="${r%2?"#a9c79a":"#8fb7b8"}" opacity=".78"/>`).join("");
 const body=`<path d="${egg}" fill="url(#dnE)"/>${spots}<path d="${egg}" fill="none" stroke="#c9bd94" stroke-width="2"/><ellipse cx="70" cy="64" rx="15" ry="27" fill="#fff" opacity=".5" transform="rotate(-24 70 64)"/>`;
 return`<svg viewBox="0 0 200 262" aria-hidden="true"><defs><radialGradient id="dnE" cx="40%" cy="34%" r="74%"><stop offset="0" stop-color="#fffdf4"/><stop offset=".6" stop-color="#f3ebd0"/><stop offset="1" stop-color="#d8caa0"/></radialGradient><clipPath id="dnT"><path d="M0 0H200V130L${zz}Z"/></clipPath><clipPath id="dnB"><path d="M0 138 20 126 38 144 56 124 74 142 92 120 110 142 128 122 146 144 164 124 182 142 200 130V262H0Z"/></clipPath></defs>
 <g class="dn-bot" clip-path="url(#dnB)">${body}</g><g class="dn-top" clip-path="url(#dnT)">${body}<path class="dn-crack" pathLength="100" d="M200 130 ${zz}"/><path class="dn-crack b" d="M164 124 169 108 161 96M92 120 87 104 95 92M38 144 32 128"/></g></svg>`})();
function dinoHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl),bd=pd(v("birthDate"),cl);const nm=esc(v("childName"));const age=parseInt(v("age"))||1;
 const g=o.guest;const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const stories=[1,2,3,4].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(s=>s.y||s.t||s.x);
 const photos=[1,2,3,4].map(i=>img(`photo${i}`)).filter(Boolean);const demo=!photos.length;
 const dd=dt?`${dt.d}. ${cl==="sr"?DATES.sr.monG[dt.m-1]:DATES.en.mon[dt.m-1]} ${dt.y}.`:"";
 const who=g&&g.source==="personal"?esc(g.name):"";
 const stats=[[C("Hatched","Izlegao se"),bd?`${bd.d}.${bd.m}.${bd.y}.`:""],[C("Time","Vreme"),v("birthTime")],[C("Weight","Težina"),v("birthWeight")],[C("Length","Dužina"),v("birthLength")]].filter(x=>x[1]);
 const bits=Array.from({length:10},(_,i)=>`<i style="--x:${(Math.cos(i*.63+.3)*(26+(i%3)*8)).toFixed(0)}cqw;--y:${(-22-(i%4)*7).toFixed(0)}cqw;--r:${(i*71)%300-150}deg;--s:${(5+(i%3)*2)}cqw"></i>`).join("");
 const leaf=(s,top,k,r,dl)=>`<span class="dn-lf ${s}" style="top:${top}%;--r:${r}deg;--d:${dl}ms;--lf:var(--a-pdleaf${k})"><i></i></span>`;
 const motes=Array.from({length:14},(_,i)=>`<i style="left:${(i*7.1+3)%100}%;--t:${(9+(i*1.7)%7).toFixed(1)}s;--d:${(-(i*1.3)%9).toFixed(1)}s;--s:${(4+(i*3)%6)}px"></i>`).join("");
 const lead=v("message")?(()=>{const m=br(v("message"));return nm&&m.includes(nm)?m.split(nm).join(`<b>${nm}</b>`):m})():"";
 return`<div class="dn${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="dn-open">
  <p class="dn-hi">${who?`${C("For","Za")} ${who}`:C("Something is about to hatch…","Nešto će se izleći…")}</p>
  <div class="dn-stage">
   <span class="dn-dino" aria-hidden="true"><i></i></span>
   <button class="dn-egg" type="button" aria-label="${C("Tap the egg to hatch it","Kucnite jaje da se izlegne")}">${DN_EGG}</button>
   <span class="dn-nest" aria-hidden="true"></span>
   <span class="dn-bits" aria-hidden="true">${bits}</span>
   <p class="dn-rawr" aria-hidden="true">Rawr!</p>
  </div>
  <p class="dn-go">${C("Tap the egg","Kucnite po jajetu")}<small>${C("three little taps and see who hatches","tri mala kucanja i vidite ko se izleže")}</small></p>
 </section>
 <div class="dn-wipe" aria-hidden="true">${leaf("l",-12,1,-8,0)}${leaf("l",22,2,7,70)}${leaf("l",56,1,-5,140)}${leaf("r",4,2,6,40)}${leaf("r",38,1,-7,110)}${leaf("r",72,2,5,180)}</div>
 <section class="dn-hero"><div class="dn-scene"></div><div class="dn-motes" aria-hidden="true">${motes}</div><div class="dn-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="dn-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="dn-rest">
  <section class="dn-sec"><p class="dn-kk rv">${C("You're invited","Pozvani ste")}</p>${lead?`<p class="dn-lead rv">${lead}</p>`:""}
   <div class="dn-when rv">${dt?`<div><small>${esc(dt.wd)}</small><b>${dt.d}.</b><span>${esc(dt.mon)} ${dt.y}.</span></div>`:""}${v("time")?`<div><small>${C("at","u")}</small><b>${esc(v("time"))}</b><span>${C("o'clock","časova")}</span></div>`:""}${v("venue")?`<div><small>${C("where","gde")}</small><b class="v">${esc(v("venue"))}</b><span>${esc(v("address"))}</span></div>`:""}</div>
   <div class="dn-acts rv">${gcal?`<a class="dn-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="dn-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Open the map","Otvorite mapu")}</a>`:""}</div></section>
  ${stats.length?`<section class="dn-sec"><p class="dn-kk rv">${C("The day I hatched","Dan kada sam se izlegao")}</p><h2 class="dn-h rv">${C("A little about <em>me</em>","Malo o <em>meni</em>")}</h2><div class="dn-eggs">${stats.map(([a,b],i)=>`<div class="dn-st rv" style="--i:${i}"><small>${a}</small><b>${esc(b)}</b></div>`).join("")}</div></section>`:""}
  ${stories.length?`<section class="dn-sec"><p class="dn-kk rv">${C("My first year","Moja prva godina")}</p><h2 class="dn-h rv">${C("Follow <em>my footprints</em>","Pratite <em>moje tragove</em>")}</h2><ol class="dn-tl">${stories.map((s,i)=>`<li class="rv" style="--i:${i}"><span class="dn-fp">${DN_FOOT}</span><div><small>${esc(s.y)}</small><b>${esc(s.t)}</b><p>${esc(s.x)}</p></div></li>`).join("")}<li class="dn-end rv"><span class="dn-fp">${DN_FOOT}</span><div><small>${dd}</small><b>${C(`My ${ordEn(age)} birthday!`,`Moj ${age}. rođendan!`)}</b></div></li></ol></section>`:""}
  <section class="dn-sec"><p class="dn-kk rv">${C("Snapshots from my nest","Slike iz mog gnezda")}</p><div class="dn-gal rv">${(demo?["var(--a-pdph1)","var(--a-pdph2)"]:photos.map(u=>`url(${u})`)).map(b=>`<figure style="background-image:${b}"></figure>`).join("")}</div>${demo?`<p class="dn-note rv">${C("Your photos will appear here","Ovde će biti vaše fotografije")}</p>`:photos.length>1?`<p class="dn-note rv">${C("Swipe","Prevucite")} →</p>`:""}</section>
  ${w&&w>Date.now()?`<section class="dn-sec"><p class="dn-kk rv">${C("Until the big roar","Do velikog slavlja")}</p><div class="dn-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="dn-sec">${o.preview?`<div class="rsvp vx-rsvp dn-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you stomp by?","Da li dolazite?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp dn-rsvp" id="rsvp"></div>`}</section>
  <section class="dn-fin"><div class="dn-wave rv"></div><h2 class="dn-see rv">Rawr! ${C("See you soon!","Vidimo se!")}</h2>${v("hosts")?`<p class="dn-sign rv">${esc(v("hosts"))}</p>`:""}<div class="dn-walk" aria-hidden="true">${Array.from({length:8},(_,i)=>`<span style="--i:${i}">${DN_FOOT}</span>`).join("")}</div>${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music dn-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindDino(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".dn-music",root);const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.28);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 const egg=$(".dn-egg",root);let st=0,tm=0,done=false;
 const show=()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,600);count()};
 // three cracks, then the shell bursts and the little dino pops out; leaves sweep across and part on the invitation
 const hatch=()=>{done=true;root.classList.add("hatched");setTimeout(()=>root.classList.add("rawr"),620);
  if(RM){setTimeout(show,900);return}
  setTimeout(()=>root.classList.add("wipe","wipe-in"),1900);
  setTimeout(()=>{root.classList.remove("wipe-in");root.classList.add("wipe-out");show()},2620);
  setTimeout(()=>root.classList.remove("wipe","wipe-out"),3800)};
 const crack=()=>{if(done)return;st++;root.dataset.crack=st;egg.classList.remove("wob");void egg.offsetWidth;egg.classList.add("wob");clearTimeout(tm);if(st>=3)return hatch();tm=setTimeout(crack,1250)};
 egg.addEventListener("click",()=>{if(done)return;if(!st)play();crack()});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".dn-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened){done=true;root.dataset.crack=3;root.classList.add("hatched");show()}
}

/* ---------- Bila jednom: a living fairy-tale scene; the words and things of the story rise out of the book ---------- */
const LV_OPEN=new URL("./art/lvopen.mp4",import.meta.url).href,LV_LOOP=new URL("./art/lvloop.mp4",import.meta.url).href;
function taleHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl),bd=pd(v("birthDate"),cl);const nm=esc(v("childName"));
 const g=o.guest;const who=g&&g.source==="personal"?esc(g.name):"";
 const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?u:""};
 const day=x=>cl==="sr"?`${x.d}. ${DATES.sr.monG[x.m-1]} ${x.y}.`:`${DATES.en.mon[x.m-1]} ${x.d}, ${x.y}`;
 // every piece of a scene is its own element (e), so each one can fly out of the book on its own path
 const e=(h,c="")=>`<div class="lv-e ${c}">${h}</div>`;
 const thing=k=>e(`<span class="lv-obj" style="--i:var(--a-lv${k})"></span>`,"ob");
 const lines=x=>br(x).split("<br>").map(l=>l.trim()).filter(Boolean);
 const ch=[1,2,3,4].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`),p:img(`photo${i}`),a:["teddy","berry","shoes","balloon"][i-1]})).filter(x=>x.t||x.x);
 const stats=[v("birthWeight"),v("birthLength")].filter(Boolean).join(" · ");
 const S=[];const scene=(id,h,c="")=>S.push(`<section class="lv-sc ${c}" data-id="${id}">${h}</section>`);
 scene("title",`${e(C("Once upon a time","Bila jednom"),"t1")}${e(C("there was a little princess","jedna mala princeza"),"t2")}${nm?e(nm,"t3"):""}`,"ttl");
 scene("born",`${thing("crib")}${e(C("Once upon a time","Bila jednom"),"lab")}${lines(C(`In a kingdom full of love\na little princess was born,\nand her name was ${v("childName")}.`,`U jednom kraljevstvu punom ljubavi\nrodila se mala princeza\npo imenu ${v("childName")}.`)).map(l=>e(l,"tx")).join("")}${bd?e(`${day(bd)}${v("birthTime")?` · ${esc(v("birthTime"))}`:""}`,"chip"):""}${stats?e(esc(stats),"chip"):""}`);
 ch.forEach((x,i)=>scene("ch"+i,`${x.p?e(`<span class="lv-ph"><img src="${esc(x.p)}" alt=""></span>`,"ob"):thing(x.a)}${x.y?e(esc(x.y),"lab"):""}${x.t?e(esc(x.t),"h"):""}${x.x?e(esc(x.x),"tx"):""}`));
 scene("ball",`${thing("crown")}${e(C("The birthday ball","Rođendanski bal"),"lab")}${v("message")?e(br(v("message")),"tx"):""}${dt?e(`<small>${esc(dt.wd)}</small>${day(dt)}`,"date"):""}${v("time")?e(`${C("at","u")} ${esc(v("time"))}${cl==="sr"?" h":""}`,"tx b"):""}${v("venue")||v("address")?e(`<b>${esc(v("venue"))}</b>${v("address")?`<span>${esc(v("address"))}</span>`:""}`,"where"):""}${gcal||maps?e(`${gcal?`<a class="lv-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="lv-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Map","Mapa")}</a>`:""}`,"acts"):""}`);
 if(w&&w>Date.now())scene("count",`${thing("cake")}${e(C("Until the ball","Do bala je ostalo"),"lab")}${e(`<div class="lv-count" data-w="${w.getTime()}"></div>`,"cnt")}${e(C("Every good fairy tale has a cake,<br>and this one has you too!","Svaka dobra bajka ima tortu,<br>a ova ima i vas!"),"tx")}`);
 scene("rsvp",e(o.preview?`<div class="rsvp lv-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you come to the ball?","Da li dolazite na bal?")}</h2>${rsH?`<p class="sub">${C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`)}</p>`:""}<p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp lv-rsvp" id="rsvp"></div>`,"form"),"rs");
 scene("end",`${thing("moon")}${lines(C("…and they lived happily ever after,\nand the most beautiful pages of this story\nare still to be written.","…i živeli su srećno i veselo,\na najlepše stranice ove bajke\ntek će biti napisane.")).map(l=>e(l,"tx")).join("")}${e(C("The End","Kraj"),"t1 end")}${v("hosts")?e(esc(v("hosts")),"h"):""}${o.preview?"":e(`${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a>`,"by")}`);
 const N=S.length,R=(n,f)=>Array.from({length:n},(_,i)=>f(i)).join("");
 const dust=R(34,i=>`<i style="--x:${((i*53)%41-20)*.9}%;--t:${(3.2+(i%7)*.55).toFixed(2)}s;--d:${(-(i*.47)%4).toFixed(2)}s;--s:${3+(i*7)%6}px"></i>`);
 return`<div class="tl lv${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}" style="--n:${N}">
 <div class="lv-blur" aria-hidden="true"></div>
 <div class="lv-stage">
  <img class="lv-still op" src="" alt="" aria-hidden="true"><img class="lv-still cl" alt="" aria-hidden="true">
  <video class="lv-vid op" muted playsinline preload="auto" aria-hidden="true"></video>
  <video class="lv-vid lp" muted playsinline loop preload="auto" aria-hidden="true"></video>
  <span class="lv-wash" aria-hidden="true"></span>
  <div class="lv-dust" aria-hidden="true">${dust}</div>
  <div class="lv-scenes">${S.join("")}</div>
  <button class="lv-book" type="button" aria-label="${C("Open the book","Otvorite knjigu")}"></button>
  <span class="lv-flash" aria-hidden="true"></span>
  <p class="lv-hi">${who?`${C("For","Za")} ${who}`:C("A fairy tale has arrived for you","Stigla vam je jedna bajka")}</p>
  <p class="lv-tip">${C("Tap the book to open it","Dodirnite knjigu da je otvorite")}</p>
  <span class="lv-more" aria-hidden="true">${C("Swipe up","Prevucite nagore")}<i></i></span>
  <div class="lv-dots" aria-hidden="true">${R(N,()=>"<i></i>")}</div>
 </div>
 <div class="lv-track" aria-hidden="true">${R(N,()=>"<i></i>")}</div>
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <button class="vx-music lv-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindTale(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const stage=$(".lv-stage",root),scs=$$(".lv-sc",root),N=scs.length,dots=$$(".lv-dots i",root),mus=$(".lv-music",root);
 const vOp=$(".lv-vid.op",root),vLp=$(".lv-vid.lp",root),cs=getComputedStyle(document.documentElement);
 const urlOf=k=>(/url\(["']?([^"')]+)/.exec(cs.getPropertyValue("--a-"+k))||[])[1]||"";
 $(".lv-still.op",root).src=urlOf("lvkey");$(".lv-still.cl",root).src=urlOf("lvclosed");
 if(!RM){vLp.src=LV_LOOP;if(!o.opened)vOp.src=LV_OPEN}
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{DiscoBeat.stop()}catch(e){}MBox.use(VX_BARS,.22);MBox.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 // where the magic comes out of the book, and where each piece of each scene ends up
 let H=1,BX=0,BY=0,els=[];
 function measure(){const r=stage.getBoundingClientRect();H=root.clientHeight||innerHeight;BX=r.width/2;BY=r.height*.74;
  els=scs.map(sc=>{const was=sc.style.cssText;sc.style.visibility="hidden";sc.style.opacity="1";const it=$$(".lv-e",sc).map((el,k)=>{el.style.transform="";const q=el.getBoundingClientRect();return{el,k,dx:BX-(q.left-r.left+q.width/2),dy:BY-(q.top-r.top+q.height/2),side:k%2?1:-1}});sc.style.cssText=was;return it})}
 // s is the story position: 0 = the title, 1 = the next scene… It follows the scroll softly, so everything flows
 let target=0,shown=-1.2,raf=0,live=false,last=0;
 const ease=x=>x<0?0:x>1?1:1-Math.pow(1-x,3),clamp=x=>x<0?0:x>1?1:x;
 function frame(now){raf=0;const dt=last?Math.min(80,now-last):16;last=now;shown+=(target-shown)*(RM?1:1-Math.exp(-dt/300));if(Math.abs(target-shown)<.0008)shown=target;
  const flow=Math.min(1,Math.abs(target-shown)*3);stage.style.setProperty("--flow",flow.toFixed(3));
  scs.forEach((sc,i)=>{const dd=shown-i,act=Math.abs(dd)<.5;sc.classList.toggle("on",act&&Math.abs(dd)<.12);
   if(dd<=-1||dd>=1){if(sc.style.visibility!=="hidden"){sc.style.visibility="hidden"}return}sc.style.visibility="visible";
   const it=els[i]||[],n=it.length;
   it.forEach(({el,k,dx,dy,side})=>{
    if(dd<0){// rising out of the book: each piece leaves a little after the one before, on its own curve
     const st=(n>1?k/(n-1):0)*.38,u=ease(clamp((dd+1-st)/(.88-st)));const arc=Math.sin(u*Math.PI)*side*H*.05;
     el.style.opacity=clamp(u*1.6).toFixed(3);el.style.transform=`translate3d(${(dx*(1-u)+arc).toFixed(1)}px,${(dy*(1-u)).toFixed(1)}px,0) scale(${(.18+.82*u).toFixed(3)}) rotate(${((1-u)*side*14).toFixed(1)}deg)`}
    else{// drifting up and away, dissolving into the light
     const st=(n>1?(n-1-k)/(n-1):0)*.25,u=clamp((dd-.12-st*.4)/(.7-st*.4));const uu=u*u;
     el.style.opacity=(1-clamp(u*1.5)).toFixed(3);el.style.transform=`translate3d(${(side*uu*H*.04).toFixed(1)}px,${(-uu*H*.2).toFixed(1)}px,0) scale(${(1+uu*.12).toFixed(3)})`}})});
  const ci=Math.round(clamp(shown/(N-1))*(N-1));dots.forEach((x,k)=>x.classList.toggle("on",k===ci));
  root.classList.toggle("atend",ci>=N-1);root.classList.toggle("moved",target>.4);
  if(shown!==target)raf=requestAnimationFrame(frame);else last=0}
 const kick=()=>{if(!raf&&live)raf=requestAnimationFrame(frame)};
 root.addEventListener("scroll",()=>{if(!live)return;target=root.scrollTop/H;kick()},{passive:true});
 // the opening: the closed book opens by itself, light bursts out and the castle grows; then the title rises from the pages
 function begin(){live=true;root.classList.add("live");measure();target=root.scrollTop/H;shown=Math.min(shown,target-1);kick();count()}
 function open(anim){if(root.classList.contains("open"))return;root.classList.add("open");o.onOpen&&o.onOpen();
  if(!anim||RM){root.classList.add("looping");vLp.play().catch(()=>{});begin();return}
  let done=false;const toLoop=()=>{if(done)return;done=true;vLp.currentTime=0;const go=()=>{root.classList.add("looping");setTimeout(()=>root.classList.add("gone"),400)};vLp.play().then(go,go);begin()};
  root.classList.add("opening");play();
  vOp.play().then(()=>{root.classList.add("playop");vOp.addEventListener("timeupdate",()=>{if(vOp.duration&&vOp.currentTime>vOp.duration-.35)toLoop()});vOp.addEventListener("ended",toLoop)},()=>{root.classList.add("flash");setTimeout(toLoop,500)});
  setTimeout(toLoop,9000)}
 $(".lv-book",root).addEventListener("click",()=>open(true));
 const key=e=>{if(!root.isConnected){document.removeEventListener("keydown",key);return}if(e.target.closest&&e.target.closest("input,textarea,select"))return;if(!live)return;if(["ArrowDown","PageDown","ArrowRight"].includes(e.key)){e.preventDefault();root.scrollBy({top:H,behavior:"smooth"})}if(["ArrowUp","PageUp","ArrowLeft"].includes(e.key)){e.preventDefault();root.scrollBy({top:-H,behavior:"smooth"})}};
 document.addEventListener("keydown",key);
 dots.forEach((x,k)=>x.addEventListener("click",()=>root.scrollTo({top:k*H,behavior:"smooth"})));
 let rt=0;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(root.isConnected&&live){measure();target=root.scrollTop/H;kick()}},200)});
 // after a reply the thank-you is measured again so it rises from the book like everything else
 const rv=$("#rsvp",root);if(rv)new MutationObserver(()=>{if(live)measure()}).observe(rv,{childList:true});
 const obs=new MutationObserver(()=>{if(!root.isConnected){vOp.pause();vLp.pause();obs.disconnect()}});obs.observe(document.body,{childList:true,subtree:true});
 let ticking=false;function count(){const el=$(".lv-count",root);if(!el||ticking)return;ticking=true;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(live)measure()});
 if(o.opened)requestAnimationFrame(()=>open(false));
}

/* ---------- Rođendanske novine: a newspaper that spins in like an old film headline ---------- */
function newsHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const nm=esc(v("name"));const g=o.guest;
 const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const img=k=>{const u=v(k);return PHOTO_RE.test(u)?`url('${u}')`:""};
 const arch=[img("photo3")||"var(--a-nzph3)",img("photo4")||"var(--a-nzph4)"];
 const plan=v("dayPlan").split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>{const m=x.match(/^(\d{1,2}[:.]\d{2}h?)\s*[–—-]?\s*(.*)$/);return m?[m[1],m[2]]:["",x]});
 const who=g&&g.source==="personal"?esc(g.name):"";
 const dd=dt?(cl==="sr"?`${dt.d}. ${DATES.sr.monG[dt.m-1]} ${dt.y}.`:`${DATES.en.mon[dt.m-1]} ${dt.d}, ${dt.y}`):"";
 const tick=[C("Breaking news","Udarna vest"),nm?C(`${nm} is celebrating`,`${nm} slavi rođendan`):"",dd,v("venue")?esc(v("venue")):"",C("Everyone is invited","Svi ste pozvani")].filter(Boolean).map(x=>`<span>${x}</span><i>✦</i>`).join("");
 return`<div class="nz${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="nz-open">
  <p class="nz-hi">${who?`${C("For","Za")} ${who}`:C("A special edition has arrived","Stiglo je specijalno izdanje")}</p>
  <button class="nz-paper" type="button" aria-label="${C("Read the news","Pročitajte vest")}"><span class="nz-spin" aria-hidden="true">${renderCard(t,d,{fixed:true,lang:cl})}</span><span class="nz-band" aria-hidden="true">${C("Special edition","Specijalno izdanje")}</span></button>
  <p class="nz-go">${C("Read the news","Pročitajte vest")}<small>${C("tap the newspaper","dodirnite novine")}</small></p>
  <span class="nz-flash" aria-hidden="true"></span>
 </section>
 <section class="nz-hero"><div class="nz-cardwrap">${renderCard(t,d,{anim:true,fixed:true})}</div><span class="nz-cue">${C("Scroll","Skrolujte")}</span></section>
 <div class="nz-rest">
  <div class="nz-tick" aria-hidden="true"><div>${tick}${tick}${tick}</div></div>
  <section class="nz-sec nz-story"><p class="nz-kk rv">${C("Top story · page 2","Glavna vest · strana 2")}</p><h2 class="nz-h rv">${nm?C(`${nm} is celebrating!`,`${nm} slavi rođendan!`):C("It's party time!","Vreme je za žurku!")}</h2><span class="nz-rule rv"></span>${v("message")?`<p class="nz-lead rv">${nzRich(v("message"))}</p>`:""}${v("hosts")?`<p class="nz-by rv">${C("Reported by","Piše")}: <b>${esc(v("hosts"))}</b></p>`:""}</section>
  <section class="nz-sec"><div class="nz-ad rv"><p class="nz-adk">${C("Notice","Oglas")}</p><h3>${C("Where and when","Gde i kada")}</h3>${dt?`<p class="nz-wd">${esc(dt.wd)}</p><p class="nz-date">${dd}</p>`:""}${v("time")?`<p class="nz-time">${C("at","u")} ${esc(v("time"))}${cl==="sr"?" h":""}</p>`:""}${v("venue")?`<p class="nz-venue">${esc(v("venue"))}</p>`:""}${v("address")?`<p class="nz-addr">${esc(v("address"))}</p>`:""}
   <div class="nz-acts">${gcal?`<a class="nz-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="nz-btn ghost" href="${maps}" target="_blank" rel="noopener">${C("Open the map","Otvorite mapu")}</a>`:""}</div></div></section>
  ${plan.length?`<section class="nz-sec"><p class="nz-kk rv">${C("Tonight's programme","Program večeri")}</p><h2 class="nz-h rv">${C("What's on","Šta nas čeka")}</h2><ol class="nz-plan">${plan.map(([tm,x],i)=>`<li class="rv" style="--i:${i}"><b>${esc(tm)}</b><i></i><span>${esc(x)}</span></li>`).join("")}</ol></section>`:""}
  ${v("dressCode")?`<section class="nz-sec"><div class="nz-fash rv"><p class="nz-adk">${C("Style section","Modni kutak")}</p><p class="nz-dc">${br(v("dressCode"))}</p></div></section>`:""}
  <section class="nz-sec"><p class="nz-kk rv">${C("From the archive","Iz arhive")}</p><div class="nz-gal">${arch.map((b,i)=>`<figure class="rv" style="--i:${i}"><span style="background-image:${b}"></span><figcaption>${C("Photo","Foto")}: ${C("newsroom archive","arhiva redakcije")}</figcaption></figure>`).join("")}</div></section>
  ${w&&w>Date.now()?`<section class="nz-sec"><p class="nz-kk rv">${C("Countdown to the party","Do žurke je ostalo")}</p><div class="nz-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="nz-sec">${o.preview?`<div class="rsvp vx-rsvp nz-rsvp"><p class="kicker">${C("Letters to the editor","Pisma čitalaca")}</p><h2>${C("Will you come?","Da li dolazite?")}</h2><p class="sub">${rsH?C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`):""}</p><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp vx-rsvp nz-rsvp" id="rsvp"></div>`}</section>
  <section class="nz-fin"><span class="nz-rule"></span><p class="nz-kk">${C("End of the special edition","Kraj specijalnog izdanja")}</p><h2 class="nz-see rv">${C("See you at the party!","Vidimo se na žurci!")}</h2>${v("hosts")?`<p class="nz-sign rv">${C("Editor in chief","Glavni urednik")}: ${esc(v("hosts"))}</p>`:""}${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music nz-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindNews(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".nz-music",root);const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on)};
 const play=()=>{try{MBox.stop()}catch(e){}DiscoBeat.start();setPlay(true)};
 mus.addEventListener("click",()=>{if(DiscoBeat.on){DiscoBeat.stop();setPlay(false)}else play()});
 const obs=new MutationObserver(()=>{if(!root.isConnected){DiscoBeat.stop();obs.disconnect()}});obs.observe(document.body,{childList:true,subtree:true});
 const paper=$(".nz-paper",root);let done=false;
 const show=()=>{root.classList.add("on");o.onOpen&&o.onOpen();setTimeout(reveal,500);count()};
 // the paper whirls away, spins back in and lands where the front page waits underneath
 paper.addEventListener("click",()=>{if(done)return;done=true;play();if(RM)return show();root.classList.add("spin");setTimeout(show,2250)});
 function reveal(){const els=$$(".rv",root);if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.14});els.forEach(el=>io.observe(el))}
 function count(){const el=$(".nz-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Min","Min")],[Math.floor(ms/1e3)%60,C("Sec","Sek")]];el.innerHTML=a.map(([n,l])=>`<div><b>${String(n).padStart(2,"0")}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened){done=true;show()}
}

/* ---------- Koverta extras: a card that turns over, and a second card with the details ---------- */
function backHTML(t,d){const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en,p=t.pal;const v=k=>(d[k]??"").toString().trim();
 const nm=t.layout==="estate"||t.layout==="wedding"?`${v("partner1")} ${C("&","i")} ${v("partner2")}`:(v("childName")||v("name")||v("occasion"));
 const ini=t.layout==="estate"||t.layout==="wedding"?(v("partner1")[0]||"")+(v("partner2")[0]||""):(nm[0]||"");const dt=pd(v("date"),cl);
 return`<div class="cback${v("photo5")?" has-ph":""}" style="--c-bg:${p.bg};--c-ink:${p.ink};--c-accent:${p.accent};--f-d:${t.font.d};--f-s:${t.font.s};--f-b:${t.font.b};${t.liner?`--cb-pat:var(--a-${t.liner})`:""}"><div class="cb-in">
  ${v("photo5")?`<div class="cb-ph"><img src="${esc(v("photo5"))}" alt=""></div>`:`<div class="cb-mono">${esc(ini.toUpperCase())}</div>`}
  ${v("backMsg")?`<p class="cb-msg">${br(v("backMsg"))}</p>`:""}<p class="cb-nm">${esc(nm)}</p>${dt?`<p class="cb-dt">${esc(dt.short||dt.full)}</p>`:""}</div></div>`}
function cardFace(t,d,o){const card=tiltWrap(renderCard(t,d,o));if(t.tier!=="envelope")return card;
 return`<div class="flip" role="button" tabindex="0" aria-pressed="false" aria-label="${L("Turn the invitation over","Okrenite pozivnicu")}"><div class="flip-in"><div class="flip-f">${card}</div><div class="flip-b">${backHTML(t,d)}</div></div></div><button type="button" class="flip-hint">↻ ${L("Tap the card to turn it over","Dodirnite pozivnicu da je okrenete")}</button>`}
function bindFlip(root){$$(".flip",root).forEach(f=>{const go=()=>{const on=!f.classList.contains("on");f.classList.toggle("on",on);f.setAttribute("aria-pressed",on)};f.addEventListener("click",go);f.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}});f.parentElement.querySelector(".flip-hint")?.addEventListener("click",go)})}
function detailsHTML(t,d){if(t.tier!=="envelope")return"";const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en,p=t.pal;const v=k=>(d[k]??"").toString().trim();
 const plan=v("dayPlan").split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>{const m=x.match(/^(\d{1,2}[:.]\d{2}h?)\s*[–—-]?\s*(.*)$/);return m?`<li><b>${esc(m[1])}</b><span>${esc(m[2])}</span></li>`:`<li class="nt"><span>${esc(x)}</span></li>`}).join("");
 const sec=[[plan,C("Schedule of the day","Program dana"),plan?`<ul class="dc-plan">${plan}</ul>`:""],[v("dressCode"),C("Dress code","Dress code"),`<p>${br(v("dressCode"))}</p>`],[v("stay"),C("Accommodation","Smeštaj"),`<p>${br(v("stay"))}</p>`],[v("gifts"),C("Gifts","Pokloni"),`<p>${br(v("gifts"))}</p>`]].filter(x=>x[0]);
 if(!sec.length)return"";
 return`<article class="kdcard" style="--c-bg:${p.bg};--c-ink:${p.ink};--c-accent:${p.accent};--f-d:${t.font.d};--f-s:${t.font.s};--f-b:${t.font.b}" aria-label="${C("Details","Detalji")}"><div class="dc-in"><p class="dc-k">${C("Good to know","Dobro je znati")}</p><h3 class="dc-h">${C("Details","Detalji")}</h3>
  ${sec.map(([,h,b],i)=>`${i?`<span class="dc-orn" aria-hidden="true"><i></i>◆<i></i></span>`:""}<section><h4>${h}</h4>${b}</section>`).join("")}</div></article>`}
/* ---------- one "preview as guest" for every design ---------- */
function guestPreview(t,d){if(t.exp==="sky")loadSky().catch(()=>{});if(t.exp==="balloon")loadBalloons().catch(()=>{});if(t.exp==="gold")loadRecord().catch(()=>{});if(t.exp==="disco")loadMirrorBall().catch(()=>{});d={...defaultsOf(t,d.lang||LANG),...d};if(t.exp)return expOverlay(t,d);if(t.liner||t.opener)return envOverlay(t,d);if(t.story)return storyOverlay(t,d);return basicOverlay(t,d)}
function basicOverlay(t,d){
 const ov=document.createElement("div");ov.className="story-ov env-ov gp-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const dt=pd(d.date,cl);
 ov.innerHTML=`<div class="env-ov-in gp-in"><p class="to-line">${C("For: Our dear guest","Za: Dragi gost")}</p><div class="ov-card" data-tilt-host>${tiltWrap(renderCard(t,d,{anim:true}))}</div>
  <div class="gp-extras">${dt?`<div class="gp-cd">${[[C("Days","Dana"),"128"],[C("Hours","Sati"),"06"],[C("Minutes","Minuta"),"42"]].map(([l,n])=>`<div><b>${n}</b><span>${l}</span></div>`).join("")}</div>`:""}
  <div class="gp-btns"><span class="btn btn-line btn-sm">${ic("cal")} ${C("Add to calendar","Dodajte u kalendar")}</span><span class="btn btn-line btn-sm">${ic("pin")} ${C("Directions","Kako stići")}</span></div>
  <p class="env-hint">${L("Your guests will find the reply form below the card","Ispod pozivnice gosti nalaze formular za odgovor")}</p></div></div><button class="arrow x" aria-label="${L("Close","Zatvori")}">✕</button>`;
 document.body.appendChild(ov);document.body.style.overflow="hidden";bindTilt(ov,6);settle(ov);
 const close=()=>{ov.remove();if(!LB)document.body.style.overflow=""};
 $(".x",ov).onclick=close;ov.tabIndex=-1;ov.focus();
}
/* ---------- download the invitation as a JPG ---------- */
async function cardToJpg(t,d,fname,o={}){
 const W=420,S=o.scale||3;
 const host=document.createElement("div");host.style.cssText=`position:fixed;left:-10000px;top:0;width:${W}px;pointer-events:none`;host.innerHTML=renderCard(t,d,{fixed:true});document.body.appendChild(host);
 try{
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;await new Promise(r=>setTimeout(r,120));
  try{fitAll(true)}catch(e){}
  const src=host.querySelector(".inv");const H=Math.round(src.getBoundingClientRect().height);
  const used=new Set();
  const SKIP=/^(--|transition|animation|will-change|cursor|pointer-events|caret|-webkit-tap|view-transition|container|inset-|anchor|scroll|overscroll|touch|user-select|-webkit-user)/;
  const copyStyle=(from,to,pseudo)=>{const cs=getComputedStyle(from,pseudo);let txt="";for(let i=0;i<cs.length;i++){const p=cs[i];if(SKIP.test(p))continue;txt+=`${p}:${cs.getPropertyValue(p)};`}to.setAttribute("style",txt+"animation:none;transition:none;opacity:"+(pseudo?cs.opacity:(cs.opacity==="0"?"1":cs.opacity))+";");const ff=cs.fontFamily;ff&&ff.split(",").forEach(f=>used.add(f.trim().replace(/^["']|["']$/g,"")))};
  const walk=(a)=>{
   if(a.nodeType===3)return document.createTextNode(a.nodeValue);
   if(a.nodeType!==1)return document.createTextNode("");
   const tag=a.tagName.toLowerCase();
   if(tag==="script")return document.createTextNode("");
   const b=tag==="svg"?a.cloneNode(true):document.createElementNS(a.namespaceURI,tag);
   if(tag==="img"){b.setAttribute("src",a.currentSrc||a.src)}
   copyStyle(a,b);
   if(tag!=="svg"){
    for(const ps of ["::before","::after"]){const pc=getComputedStyle(a,ps);if(pc.content&&pc.content!=="none"&&pc.content!=="normal"){const sp=document.createElementNS("http://www.w3.org/1999/xhtml","span");copyStyle(a,sp,ps);const txt=pc.content.replace(/^["']|["']$/g,"");if(txt&&!/^url\(/.test(pc.content)&&txt!=='""')sp.textContent=txt.replace(/\\"/g,'"');ps==="::before"?b.appendChild(sp):b._after=sp}}
    a.childNodes.forEach(c=>b.appendChild(walk(c)));
    if(b._after){b.appendChild(b._after);delete b._after}
   }
   return b};
  const clone=walk(src);clone.setAttribute("xmlns","http://www.w3.org/1999/xhtml");
  clone.style.transform="none";clone.style.margin="0";
  // the picture is drawn from a self-contained SVG, which can't load files: embed every picture it uses
  const toData=u=>{if(!toData.c.has(u))toData.c.set(u,fetch(u).then(r=>r.blob()).then(b=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r(u);fr.readAsDataURL(b)})).catch(()=>u));return toData.c.get(u)};toData.c=cardToJpg.c||(cardToJpg.c=new Map());
  const pics=[clone,...clone.querySelectorAll("*")];
  await Promise.all(pics.map(async el=>{
   if(el.tagName.toLowerCase()==="img"&&!/^data:/.test(el.getAttribute("src")||""))el.setAttribute("src",await toData(el.getAttribute("src")));
   const st=el.getAttribute("style");if(!st||!st.includes("url("))return;
   const found=[...st.matchAll(/url\("?([^")]+)"?\)/g)].map(m=>m[1]).filter(u=>!u.startsWith("data:"));if(!found.length)return;
   let out=st;for(const u of found)out=out.split(u).join(await toData(u));el.setAttribute("style",out)}));
  // fonts: embed the faces this card uses, only for the characters actually on it
  let fontCss="";
  try{
   const cps=[...new Set(src.textContent)].map(c=>c.codePointAt(0));
   const covers=ur=>!ur||ur.split(",").some(p=>{const [a,b]=p.trim().replace(/^U\+/i,"").split("-");const lo=parseInt(a.replace(/\?/g,"0"),16),hi=b?parseInt(b,16):parseInt(a.replace(/\?/g,"F"),16);return cps.some(c=>c>=lo&&c<=hi)});
   for(const sh of document.styleSheets){let rules;try{rules=sh.cssRules}catch(e){continue}
    for(const r of rules){if(!(r instanceof CSSFontFaceRule))continue;
     const fam=r.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g,"");if(!used.has(fam)||!covers(r.style.getPropertyValue("unicode-range")))continue;
     const m=r.cssText.match(/url\("?([^")]+)"?\)/);if(!m)continue;
     fontCss+=r.cssText.replace(m[0],`url("${await toData(new URL(m[1],sh.href||location.href).href)}")`)}}
  }catch(e){}
  const xml=new XMLSerializer().serializeToString(clone);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W*S}" height="${H*S}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px"><style>${fontCss}</style>${xml}</div></foreignObject></svg>`;
  const img=new Image();img.decoding="sync";
  await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error("render"));img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)});
  const c=document.createElement("canvas");c.width=W*S;c.height=H*S;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",o.quality||.93));
  if(o.blob)return blob;
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
  return true;
 }finally{host.remove()}
}
const slugFile=s=>(s||"pozivnica").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"dj").replace(/Đ/g,"Dj").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"pozivnica";

/* ---------- live text on picture designs (positions taken from the original Canva design) ---------- */
const PIC_TXT={
 b_sea:(v,dt,cl,R)=>{const Q=(c,k,top)=>R(k).replace('class="r"','class="r '+c+'"').replace('style="','style="top:'+top+';');
  const wd=dt?dt.wd:"",mon=dt?(cl==="sr"?DATES.sr.mon[dt.m-1]:DATES.en.mon[dt.m-1]):"";const tm=v("time")?v("time")+(cl==="sr"?"h":""):"";
  return`<div class="pt pt-sea">
  <p ${Q("ps-k","hKick","38.37%")}>${esc(v("hKick"))}</p>
  <p class="ps-h1" style="top:41.6%;font-size:${(11.75*Math.min(1,9.5/Math.max(1,(v("hName")+v("hAge")).length+1))).toFixed(2)}cqw"><span ${R("hName")}>${esc(v("hName"))}</span>${v("hAge")?`<b ${R("hAge")}>${esc(v("hAge"))}</b>`:""}</p>
  <p ${Q("ps-h2","hOcc","51.69%").replace('style="','style="font-size:'+(9.74*Math.min(1,9/Math.max(1,v("hOcc").length))).toFixed(2)+'cqw;')}>${esc(v("hOcc"))}</p>
  <p ${Q("ps-s ps-wd","date","62.66%")}>${esc(wd)}</p>
  <p ${Q("ps-day","date","59.63%")}>${dt?dt.d:""}</p>
  <p ${Q("ps-s ps-tm","time","62.66%")}>${esc(tm)}</p>
  <p ${Q("ps-s ps-mo","date","66.86%")}>${esc(mon)}</p>
  <p ${Q("ps-ad","venue","72.1%")}>${esc(v("venue"))}${v("venue")&&v("address")?",":""}${v("address")?`<br><span data-f="address">${esc(v("address"))}</span>`:""}</p>
 </div>`}
};
const PICL={b_esp:`<i class="es-spl es-spl-b0" style="left:77.686%;top:16.901%;width:5.908%"></i><i class="es-spl es-spl-b1" style="left:82.276%;top:17.239%;width:8.272%"></i><i class="es-spl es-spl-b2" style="left:90.088%;top:15.964%;width:10.849%"></i><i class="es-spl es-spl-b3" style="left:97.168%;top:16.836%;width:6.230%"></i><i class="pl es-bean es-b0" style="left:75.0%;top:14.193%;width:5.371%;height:3.385%;background-image:var(--a-esp-b0)"></i><i class="pl es-bean es-b1" style="left:78.516%;top:14.583%;width:7.52%;height:3.32%;background-image:var(--a-esp-b1)"></i><i class="pl es-bean es-b2" style="left:85.156%;top:12.63%;width:9.863%;height:4.167%;background-image:var(--a-esp-b2)"></i><i class="pl es-bean es-b3" style="left:94.336%;top:13.867%;width:5.664%;height:3.711%;background-image:var(--a-esp-b3)"></i><i class="pl es-bw es-bw0" style="left:26.367%;top:34.115%;width:7.812%;height:3.776%;background-image:var(--a-esp-bw0)"></i><i class="pl es-bw es-bw1" style="left:29.395%;top:61.849%;width:7.715%;height:3.711%;background-image:var(--a-esp-bw1)"></i>`,b_ilija:`<i class="pl pl-bal pl-balL" style="left:0.0%;top:40.683%;width:12.917%;height:18.517%;background-image:var(--a-il-balL)"></i><i class="pl pl-bal pl-balR" style="left:86.645%;top:41.77%;width:13.355%;height:19.759%;background-image:var(--a-il-balR)"></i><i class="pl pl-hor pl-horL" style="left:0.712%;top:69.41%;width:25.835%;height:25.854%;background-image:var(--a-il-horL)"></i><i class="pl pl-hor pl-horR" style="left:73.892%;top:68.595%;width:26.108%;height:27.873%;background-image:var(--a-il-horR)"></i><i class="pl pl-bow pl-bowL" style="left:4.16%;top:4.193%;width:12.753%;height:4.62%;background-image:var(--a-il-bowL)"></i><i class="pl pl-bow pl-bowR" style="left:82.759%;top:4.037%;width:13.355%;height:4.969%;background-image:var(--a-il-bowR)"></i><i class="pl pl-bow pl-bowB" style="left:44.061%;top:96.39%;width:10.619%;height:3.61%;background-image:var(--a-il-bowB)"></i><i class="pl pl-st pl-st0" style="left:19.759%;top:1.048%;width:5.364%;height:3.96%;background-image:var(--a-il-st0)"></i><i class="pl pl-st pl-st1" style="left:31.637%;top:3.339%;width:3.886%;height:2.756%;background-image:var(--a-il-st1)"></i><i class="pl pl-st pl-st2" style="left:62.945%;top:1.825%;width:4.215%;height:3.028%;background-image:var(--a-il-st2)"></i><i class="pl pl-st pl-st3" style="left:5.911%;top:22.787%;width:4.16%;height:3.067%;background-image:var(--a-il-st3)"></i><i class="pl pl-st pl-st4" style="left:88.615%;top:22.981%;width:4.324%;height:3.183%;background-image:var(--a-il-st4)"></i><i class="pl pl-st pl-st5" style="left:87.356%;top:18.362%;width:2.573%;height:1.863%;background-image:var(--a-il-st5)"></i><i class="pl pl-st pl-st6" style="left:0.657%;top:59.006%;width:3.339%;height:2.484%;background-image:var(--a-il-st6)"></i><i class="pl pl-st pl-st7" style="left:0.985%;top:72.05%;width:3.394%;height:2.523%;background-image:var(--a-il-st7)"></i><i class="pl pl-st pl-st8" style="left:95.293%;top:76.242%;width:3.503%;height:2.562%;background-image:var(--a-il-st8)"></i><i class="pl pl-st pl-st9" style="left:62.835%;top:95.07%;width:3.448%;height:2.484%;background-image:var(--a-il-st9)"></i>`,b_sea:`<i class="pl sl-fish sl-fish0" style="left:17.505%;top:0.0%;width:6.729%;height:3.261%;background-image:var(--a-sea-fish0)"></i><i class="pl sl-fish sl-fish1" style="left:10.284%;top:0.194%;width:5.525%;height:4.93%;background-image:var(--a-sea-fish1)"></i><i class="pl sl-fish sl-fish2" style="left:18.709%;top:2.096%;width:6.674%;height:6.328%;background-image:var(--a-sea-fish2)"></i><i class="pl sl-fish sl-fish3" style="left:12.473%;top:4.231%;width:5.361%;height:6.522%;background-image:var(--a-sea-fish3)"></i><i class="pl sl-fish sl-fish4" style="left:2.407%;top:4.464%;width:7.385%;height:3.377%;background-image:var(--a-sea-fish4)"></i><i class="pl sl-fish sl-fish5" style="left:3.829%;top:7.259%;width:6.783%;height:5.823%;background-image:var(--a-sea-fish5)"></i><i class="pl sl-fish sl-fish6" style="left:13.512%;top:9.783%;width:7.057%;height:6.211%;background-image:var(--a-sea-fish6)"></i><i class="pl sl-fish sl-fish7" style="left:6.893%;top:11.646%;width:5.361%;height:6.483%;background-image:var(--a-sea-fish7)"></i><i class="pl sl-fish sl-fish8" style="left:0.0%;top:14.752%;width:5.744%;height:4.697%;background-image:var(--a-sea-fish8)"></i><i class="pl sl-starf sl-starf" style="left:82.44%;top:1.825%;width:6.893%;height:5.435%;background-image:var(--a-sea-starf)"></i><i class="pl sl-spk sl-spk0" style="left:91.193%;top:5.318%;width:5.306%;height:4.736%;background-image:var(--a-sea-spk0)"></i><i class="pl sl-spk sl-spk1" style="left:88.457%;top:8.696%;width:5.525%;height:4.464%;background-image:var(--a-sea-spk1)"></i><i class="pl sl-spk sl-spk2" style="left:92.505%;top:11.646%;width:3.939%;height:3.067%;background-image:var(--a-sea-spk2)"></i><i class="pl sl-bub sl-bub0" style="left:89.825%;top:42.974%;width:6.018%;height:4.231%;background-image:var(--a-sea-bub0)"></i><i class="pl sl-bub sl-bub1" style="left:93.162%;top:47.904%;width:6.018%;height:4.193%;background-image:var(--a-sea-bub1)"></i><i class="pl sl-bub sl-bub2" style="left:87.09%;top:50.97%;width:6.018%;height:4.231%;background-image:var(--a-sea-bub2)"></i><i class="pl sl-bub sl-bub3" style="left:95.35%;top:53.61%;width:4.65%;height:6.172%;background-image:var(--a-sea-bub3)"></i><i class="pl sl-bub sl-bub4" style="left:75.821%;top:65.761%;width:9.081%;height:5.629%;background-image:var(--a-sea-bub4)"></i><i class="pl sl-jel sl-jel" style="left:88.184%;top:58.269%;width:9.081%;height:9.821%;background-image:var(--a-sea-jel)"></i><i class="pl sl-dol sl-dol0" style="left:5.197%;top:56.444%;width:10.941%;height:5.978%;background-image:var(--a-sea-dol0)"></i><i class="pl sl-dol sl-dol1" style="left:3.009%;top:64.169%;width:15.7%;height:6.328%;background-image:var(--a-sea-dol1)"></i><i class="pl sl-spo sl-spout" style="left:22.538%;top:75.66%;width:11.05%;height:5.707%;background-image:var(--a-sea-spout);transform-origin:50% 100%"></i><i class="pl sl-wha sl-whale" style="left:0.0%;top:78.998%;width:48.906%;height:21.002%;background-image:var(--a-sea-whale);transform-origin:45% 100%"></i><i class="pl sl-prl sl-pearl" style="left:74.179%;top:84.084%;width:12.691%;height:7.842%;background-image:var(--a-sea-pearl)"></i><i class="pl sl-fin sl-fin" style="left:45.842%;top:7.22%;width:44.803%;height:26.825%;background-image:var(--a-sea-fin);transform-origin:25.5% 4.9%"></i>`};
const EXP_BG={p_tale:"#F7EDE8",p_news:"#1b1512",e_cherry:"#0B0607",e_kiss:"#F2EBDF",e_estate:"#F3EEE1",e_lemon:"#F7F8FA",e_rouge:"#3A0C16",e_peony:"#F8F1EC",e_night:"#0B1024",e_lamb:"#EAF2FA",e_picnic:"#FBF5E6",e_lace:"#4E1420",e_disco:"#0D0D0F",gold:"#1C0D10",balloon:"#FFF3F0",sky:"#060914",rip:"#0B0A0A",bloom:"#FBF3EE",plane:"#E3EEF6",letter:"#1B120C",disco:"#09090A",vinyl:"#F1E8D8",bow:"#F3EFE7",honey:"#FBF4E3",dino:"#F3F0E2"};

/* ---------- "Ljubavno pismo" · premium wedding told as old-century letters ---------- */
const LT_BARS=[[53,57,60,72],[50,53,57,69],[46,50,53,70],[48,52,55,67],[53,57,60,77],[45,48,52,76],[46,50,53,74],[48,52,55,72]];
const ROMAN=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
// every word becomes its own span, so the pen can write them one after another
const inkw=s=>esc(s).split(/(\s+)/).map(w=>!w?"":/^\s+$/.test(w)?" ":`<span class="w">${w}</span>`).join("");
const psBow=`<svg viewBox="0 0 80 50" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M40 25c-9-15-32-19-31-6 1 11 23 10 31 6zM40 25c9-15 32-19 31-6-1 11-23 10-31 6z" stroke="#8f7046" stroke-width="3.6"/><path d="M40 25c-9-15-32-19-31-6 1 11 23 10 31 6zM40 25c9-15 32-19 31-6-1 11-23 10-31 6z" stroke="#c7a874" stroke-width="1.6" stroke-dasharray="2 2.4"/><path d="M38 27c-5 8-10 14-17 21M42 27c5 8 9 14 15 20" stroke="#8f7046" stroke-width="3.4"/><path d="M38 27c-5 8-10 14-17 21M42 27c5 8 9 14 15 20" stroke="#c7a874" stroke-width="1.4" stroke-dasharray="2 2.4"/></g><ellipse cx="40" cy="25.5" rx="5" ry="4.2" fill="#8a6a3e"/><ellipse cx="39" cy="24.5" rx="2.2" ry="1.6" fill="#c7a874" opacity=".6"/></svg>`;
// a round postmark with the date in old style (day, month in Roman numerals, year)
const psPostmark=(cls,top,mid,bot)=>`<svg class="${cls}" viewBox="0 0 150 110" aria-hidden="true"><circle cx="48" cy="55" r="44" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="48" cy="55" r="32" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="48" y="30" font-size="8.5" text-anchor="middle" letter-spacing="1.5">${esc(top)}</text><text x="48" y="61" font-size="15" text-anchor="middle">${esc(mid)}</text><text x="48" y="85" font-size="10" text-anchor="middle" letter-spacing="1">${esc(bot)}</text><path d="M96 34q9-7 18 0t18 0 18 0M96 48q9-7 18 0t18 0 18 0M96 62q9-7 18 0t18 0 18 0M96 76q9-7 18 0t18 0 18 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const psPost=cl=>cl==="sr"?"LJUBAVNA POŠTA":"LOVE POST";
function letterCard(d,cl,Q){
 const C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const n1=esc(v("partner1")),n2=esc(v("partner2")),ini=esc(((v("partner1")[0]||"")+(v("partner2")[0]||"")).toUpperCase());const dt=pd(v("date"),cl);
 const fs=Math.min(8.4,105/Math.max(1,v("partner1").length+v("partner2").length+3)).toFixed(2);
 return`<p ${Q("pc-k")}>${C("Wedding invitation","Pozivnica za venčanje")}</p>
  <div class="pc-env"><span class="pc-stamp" aria-hidden="true">${ini}</span>${dt?psPostmark("pc-pm",psPost(cl),`${dt.d} ${ROMAN[dt.m-1]}`,dt.y):""}
   <h2 ${Q("pc-names","partner1")} style="--fs:${fs}cqw">${n1}<em>&amp;</em>${n2}</h2>${v("venue")?`<p ${Q("pc-place","venue")}>${esc(v("venue"))}</p>`:""}
   <span class="pc-tw h" aria-hidden="true"></span><span class="pc-tw v" aria-hidden="true"></span><span class="pc-bow" aria-hidden="true">${psBow}</span></div>
  ${dt?`<p ${Q("pc-date","date")}>${dt.d} · ${ROMAN[dt.m-1]} · ${dt.y}</p>`:""}`}
// splits a telegram line into paper tapes of up to `max` characters
const tapes=(s,max=24)=>{const out=[];let cur="";for(const w of s.split(/\s+/).filter(Boolean)){if(cur&&(cur+" "+w).length>max){out.push(cur);cur=w}else cur=cur?cur+" "+w:w}if(cur)out.push(cur);return out};
function letterHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();
 const dt=pd(v("date"),cl);const n1=esc(v("partner1")),n2=esc(v("partner2"));
 const ini=esc(((v("partner1")[0]||"")+(v("partner2")[0]||"")).toUpperCase());
 const stories=[1,2,3].map(i=>({y:v(`story${i}Year`),t:v(`story${i}Title`),x:v(`story${i}Text`)})).filter(x=>x.y||x.t||x.x);
 const plan=[1,2,3,4].map(i=>({tm:v(`plan${i}Time`),t:v(`plan${i}Title`)})).filter(p=>p.tm||p.t);
 const g=o.guest,personal=g&&g.source==="personal";const to=personal?g.name:C("Our dear guests","Naši dragi gosti");
 const place=[v("venue"),v("address")].filter(Boolean).join(", ");const w=eventWhen(d,dt);
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const town=(v("address").split(",").pop()||v("venue")).trim();
 const dd=dt?(cl==="sr"?`${dt.d}. ${DATES.sr.monG[dt.m-1]} ${dt.y}.`:`${dt.d} ${DATES.en.mon[dt.m-1]} ${dt.y}`):"";
 const paras=v("message").split(/\n+/).filter(Boolean);
 const fs=Math.min(8.6,125/Math.max(1,to.length)).toFixed(2);
 const first=paras[0]||"";const capL=first.match(/^[\p{L}\p{N}]/u)?first[0]:"";
 // the telegram: short typed lines that end in STOP
 const tl=[dt?(cl==="sr"?`${dt.wd} ${dt.d}. ${DATES.sr.monG[dt.m-1]} ${dt.y}.`:`${dt.wd} ${dt.d} ${DATES.en.mon[dt.m-1]} ${dt.y}`):"",plan[0]&&plan[0].tm?C(`starts at ${plan[0].tm}`,`početak u ${plan[0].tm}`):"",v("venue"),v("address"),v("dressCode")?`dress code ${v("dressCode")}`:"",C("we can't wait to see you","radujemo se vama")].filter(Boolean);
 const tp=[...tl.flatMap(l=>{const o=tapes(l);if((o[o.length-1]+" stop").length<=29)o[o.length-1]+=" stop";else o.push("stop");return o}),...tapes(`${v("partner1")} ${C("&","i")} ${v("partner2")}`)];
 const words=tl.join(" ").split(/\s+/).length+tl.length;
 return`<div class="ps${o.preview?" pv":""}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <span class="ps-desk" aria-hidden="true"></span><span class="ps-candle" aria-hidden="true"></span>
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="ps-hero">
  <div class="ps-stage">
   <p class="ps-kick">${C("A letter for you","Pismo za vas")}</p>
   <button class="ps-bundle" type="button" aria-label="${C("Untie the letters and open the envelope","Odvežite pisma i otvorite koverat")}">
    <span class="ps-under u1" aria-hidden="true"></span><span class="ps-under u2" aria-hidden="true"></span>
    <span class="ps-env" aria-hidden="true">
     <span class="ps-front">
      <span class="ps-stamp"><small>${psPost(cl)}</small><i>${ini}</i><b>${dt?dt.y:""}</b></span>
      ${dt?psPostmark("ps-pm",town.toUpperCase().slice(0,18)||psPost(cl),`${dt.d} ${ROMAN[dt.m-1]}`,dt.y):""}
      <span class="ps-addr"><small>${C("To","Za")}</small><b style="--fs:${fs}cqw">${esc(to)}</b><em>${esc(town)}</em></span>
     </span>
     <span class="ps-back"><span class="ps-bk"></span><span class="ps-sheet"></span><span class="ps-pocket"></span><span class="ps-flap"></span>
      <span class="ps-seal"><span class="h l"><b>${ini}</b></span><span class="h r"><b>${ini}</b></span></span></span>
    </span>
    <span class="ps-twine h" aria-hidden="true"></span><span class="ps-twine v" aria-hidden="true"></span><span class="ps-bow" aria-hidden="true">${psBow}</span>
   </button>
   <p class="ps-hint">${C("Touch to untie the letters","Dodirnite da odvežete pisma")}</p>
  </div>
  <article class="ps-letter ps-pp ps-fold" aria-label="${C("Letter","Pismo")}">
   <div class="ps-crest ps-fade" aria-hidden="true"><b>${ini.split("").join("·")}</b><svg viewBox="0 0 120 14"><path d="M4 7h40M76 7h40" stroke="currentColor" stroke-width=".7"/><path d="M60 2c-5 0-8 5-13 5 5 0 8 5 13 5s8-5 13-5c-5 0-8-5-13-5z" fill="none" stroke="currentColor" stroke-width=".8"/><circle cx="60" cy="7" r="1.4" fill="currentColor"/></svg></div>
   ${dd||town?`<p class="ps-dateline">${inkw([town,dd].filter(Boolean).join(", "))}</p>`:""}
   <p class="ps-dear">${inkw(personal?`${C("Dear","Dragi")} ${g.name},`:C("Dear friends,","Dragi naši,"))}</p>
   ${paras.map((p,i)=>i===0&&capL?`<p class="ps-p first"><span class="ps-cap w">${esc(capL)}</span>${inkw(p.slice(capL.length))}</p>`:`<p class="ps-p">${inkw(p)}</p>`).join("")}
   <div class="ps-sigw"><p class="ps-close">${inkw(C("With love,","S ljubavlju,"))}</p><p class="ps-sign">${inkw(`${v("partner1")} ${C("&","i")} ${v("partner2")}`)}</p><span class="ps-wax" aria-hidden="true"><b>${ini}</b></span></div>
  </article>
 </section>
 <div class="ps-rest">
  <section class="ps-sec"><div class="ps-card ps-pp rv"><div class="ps-card-in"><p class="ps-k">${C("We are getting married","Venčavamo se")}</p><h1>${n1}<em>${C("and","i")}</em>${n2}</h1>${dt?`<p class="ps-big">${esc(dt.full)}</p>`:""}${v("venue")?`<p class="ps-mut">${esc(v("venue"))}${v("address")?`, ${esc(v("address"))}`:""}</p>`:""}</div></div></section>
  ${stories.length?`<section class="ps-sec"><p class="ps-k rv">${C("Our correspondence","Naša prepiska")}</p><h2 class="ps-h rv">${C(`Our story in <em>${stories.length===1?"one letter":stories.length===2?"two letters":"three letters"}</em>`,`Naša priča u <em>${stories.length===1?"jednom pismu":stories.length===2?"dva pisma":"tri pisma"}</em>`)}</h2><svg class="ps-orn rv" viewBox="0 0 150 14" aria-hidden="true"><path d="M4 7h52M94 7h52" stroke="currentColor" stroke-width=".8"/><path d="M75 2c-6 0-9 5-15 5 6 0 9 5 15 5s9-5 15-5c-6 0-9-5-15-5z" fill="none" stroke="currentColor"/><circle cx="75" cy="7" r="1.6" fill="currentColor"/></svg>
   <div class="ps-ltrs">${stories.map((x,i)=>{const yr=(x.y.match(/\d{4}/)||[""])[0];return`<article class="ps-ltr ps-pp ps-fold rv" style="--r:${[-1.6,1.3,-.9][i]}deg;--fx:${i%2?"40px":"-40px"};--pc:${["#e3cc9d","#e9d5ac","#eedfbe"][i]}"><div class="ps-ltr-h"><b>${ROMAN[i]}.</b>${x.y?`<span>${inkw(x.y)}</span>`:""}</div>${x.t?`<h3>${inkw(x.t)}</h3>`:""}${x.x?`<p>${inkw(x.x)}</p>`:""}${yr?psPostmark("ps-pmk",psPost(cl),"✦",yr):""}</article>`}).join("")}</div></section>`:""}
  ${plan.length?`<section class="ps-sec"><p class="ps-k rv">${C("The day","Dan venčanja")}</p><h2 class="ps-h rv">${C("Order of <em>the day</em>","Red <em>venčanja</em>")}</h2><svg class="ps-orn rv" viewBox="0 0 150 14" aria-hidden="true"><path d="M4 7h52M94 7h52" stroke="currentColor" stroke-width=".8"/><path d="M75 2c-6 0-9 5-15 5 6 0 9 5 15 5s9-5 15-5c-6 0-9-5-15-5z" fill="none" stroke="currentColor"/><circle cx="75" cy="7" r="1.6" fill="currentColor"/></svg>
   <div class="ps-prog ps-pp rv"><div class="ps-prog-in"><h3>${C("Programme","Program")}</h3><ol>${plan.map(p=>`<li><span>${esc(p.t)}</span><i aria-hidden="true"></i><b>${esc(p.tm)}</b></li>`).join("")}</ol></div></div></section>`:""}
  <section class="ps-sec"><p class="ps-k rv">${C("Where and when","Gde i kada")}</p><h2 class="ps-h rv">${C("A <em>telegram</em> has arrived","Stigao je <em>telegram</em>")}</h2>
   <div class="ps-tele ps-pp rv" aria-label="${esc(tl.join(". "))}"><div class="ps-tele-h"><b>${C("Telegram","Telegram")}</b><small>${psPost(cl)}<br>${esc(town)}</small></div>
    <div class="ps-tele-m"><div>${C("No.","Br.")}<b>${dt?String(dt.m).padStart(2,"0")+String(dt.d).padStart(2,"0"):"0001"}</b></div><div>${C("Words","Reči")}<b>${words}</b></div><div>${C("To","Za")}<b>${esc(personal?g.name:C("Guests","Goste"))}</b></div></div>
    <div class="ps-tapes" aria-hidden="true">${tp.map((s,i)=>`<span class="ps-tape" style="--r:${[-.6,.4,-.3,.7,-.5,.2,-.7,.5][i%8]}deg"><span style="--c:${s.length}">${esc(s)}</span></span>`).join("")}</div>
    <span class="ps-urgent" aria-hidden="true">${C("Urgent","Hitno")}</span></div>
   <div class="ps-links rv">${gcal?`<a class="ps-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="ps-btn" href="${maps}" target="_blank" rel="noopener">${C("Directions","Kako stići")}</a>`:""}</div></section>
  ${w&&w>Date.now()?`<section class="ps-sec"><p class="ps-k rv">${C("Until our yes","Do našeg „da“")}</p><div class="ps-count rv" data-w="${w.getTime()}" style="margin-top:22px"></div></section>`:""}
  <section class="ps-sec">${o.preview?`<div class="rsvp ps-reply ps-pp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Write back to us","Odgovorite nam")}</h2><p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp ps-reply ps-pp" id="rsvp"></div>`}</section>
  <section class="ps-end"><p class="ps-ps"><b>P.S.</b>${C("We can't wait to see you.","Jedva čekamo da vas vidimo.")}</p><p class="ps-sig2">${n1} ${C("&","i")} ${n2}</p>${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </div>
 <button class="vx-music ps-music" type="button" aria-pressed="false"><span class="d" aria-hidden="true"></span><span>${C("Music","Muzika")}</span></button>
</div>`;
}
function bindLetter(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const mus=$(".ps-music",root),art=$(".ps-letter",root);
 const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
 const setPlay=on=>{root.classList.toggle("playing",on);mus.setAttribute("aria-pressed",on);mus.setAttribute("aria-label",on?C("Pause the music","Pauziraj muziku"):C("Play the music","Pusti muziku"))};
 const play=()=>{MBox.use(LT_BARS,.34);MBox.start();setPlay(true)};
 // the pen writes word after word at a hand's pace, faster when there is a lot to write
 function ink(el,start,cap){
  const ws=$$(".w,.ps-fade,.ps-wax",el);const du=ws.map(w=>w.classList.contains("w")?Math.max(140,w.textContent.length*62):520);
  const total=du.reduce((a,b)=>a+b,0),k=Math.min(1,cap/total);let at=start,prev=null;
  ws.forEach((w,i)=>{if(prev&&w.parentElement!==prev)at+=260*k;prev=w.parentElement;w.style.setProperty("--d",at+"ms");w.style.setProperty("--du",du[i]*k+"ms");at+=du[i]*k});
  el.classList.add("ink");setTimeout(()=>{if(el.isConnected){el.classList.remove("ink");el.classList.add("inked")}},at+2800);
 }
 function type(el){
  let at=200;$$(".ps-tape",el).forEach(tp=>{const s=tp.firstElementChild,n=s.textContent.length,du=n*24;tp.style.setProperty("--d",at+"ms");s.style.setProperty("--du",du+"ms");at+=du+160});
  el.classList.add("ink");
 }
 function read(anim){
  const s=$(".ps-sheet",root).getBoundingClientRect();
  root.classList.add("read");
  if(anim){
   const a=art.getBoundingClientRect();
   art.animate([{transformOrigin:"0 0",transform:`translate(${s.left-a.left}px,${s.top-a.top}px) scale(${s.width/a.width},${s.height/a.height})`},{transformOrigin:"0 0",transform:"none"}],{duration:1000,easing:"cubic-bezier(.3,.7,.2,1)"});
   ink(art,900,6000);
  }
  reveal();count();
 }
 const open=withSound=>{if(root.classList.contains("on"))return;root.classList.add("on");if(withSound)play();else setPlay(false);o.onOpen&&o.onOpen();
  if(RM||!withSound)read(false);else setTimeout(()=>{if(root.isConnected)read(true)},2850)};
 $(".ps-bundle",root).addEventListener("click",()=>open(true));
 mus.addEventListener("click",()=>{if(root.classList.contains("playing")){MBox.stop();setPlay(false)}else play()});
 function reveal(){if(!("IntersectionObserver" in window))return;root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target;el.classList.add("in");io.unobserve(el);if(RM)return;if(el.classList.contains("ps-ltr"))ink(el,550,3600);if(el.classList.contains("ps-tele"))type(el)}),{threshold:.18});$$(".rv",root).forEach(el=>io.observe(el))}
 function count(){const el=$(".ps-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Minutes","Minuta")],[Math.floor(ms/1e3)%60,C("Seconds","Sekundi")]];el.innerHTML=a.map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}
/* ---------- Plus · a themed opening scene per design, then the card on a full invitation page ---------- */
// how long each opening scene plays before the card takes over (ms)
const PQ_T={gates:1900,shutters:1700,box:2100,bloom:1900,clock:2600,clouds:1800,napkin:2500,lace:2500,tinsel:1800,kiss:2800};
const pqWho=(t,d)=>{const v=k=>(d[k]??"").toString().trim();
 if(["estate","wedding","lace"].includes(t.layout))return[v("partner1"),v("partner2")].filter(Boolean);
 if(t.layout==="disco"){const n=[v("name1"),v("name2")].filter(Boolean);return n.length?n:[v("brand")||v("title")].filter(Boolean)}
 return[v("childName")||v("name")].filter(Boolean)};
// one leaf of the wrought-iron garden gate: bars under an arch, rails, a scroll and gilded spear tips
function pqGateLeaf(){let s="";const top=x=>64-46*Math.pow(x/100,1.15);
 for(let x=7;x<100;x+=12.4){const y=top(x);s+=`<path d="M${x} ${(y+6).toFixed(1)}V292" stroke="#1d2620" stroke-width="3.4"/><path d="M${x} ${(y-3).toFixed(1)}l3 6.5-3 3.5-3-3.5z" fill="#c8a85a"/>`}
 s+=`<path d="M0 ${top(0)+10}Q55 ${top(55)+4} 100 ${top(100)+10}" fill="none" stroke="#1d2620" stroke-width="4"/><path d="M0 128H100M0 252H100M0 292H100" stroke="#1d2620" stroke-width="4.5"/>`;
 s+=`<g fill="none" stroke="#c8a85a" stroke-width="2.2"><ellipse cx="50" cy="190" rx="30" ry="40"/><path d="M50 150c-14 14-14 66 0 80M50 150c14 14 14 66 0 80"/><path d="M20 190c-12 0-16-12-8-18M80 190c12 0 16-12 8-18"/></g>`;
 return`<svg viewBox="0 0 100 300" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`}
const pqCloud=`<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M26 64a22 22 0 0 1 4-43 28 28 0 0 1 51-7 20 20 0 0 1 24 18 17 17 0 0 1-3 32z" fill="url(#pqcg)"/><defs><linearGradient id="pqcg" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#dbe7f4"/></linearGradient></defs></svg>`;
const pqLemons=`<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="pqlm" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff8b8"/><stop offset=".45" stop-color="#f6d01c"/><stop offset="1" stop-color="#cf9407"/></radialGradient><linearGradient id="pqlf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8dbb52"/><stop offset="1" stop-color="#2d6a2b"/></linearGradient></defs><g fill="url(#pqlf)"><path d="M4 30c14-20 40-20 50-4-16 10-36 12-50 4z"/><path d="M30 6c20 2 32 20 26 38-16-6-28-20-26-38z"/><path d="M60 14c18-6 34 6 34 20-16 2-30-6-34-20z"/><path d="M8 58c6-18 26-26 40-16-10 14-26 20-40 16z"/></g><g stroke="#2d6a2b" stroke-width="1.2" fill="none"><path d="M22 26q18 6 28 16M42 22q6 12 8 22M76 26q-12 4-22 18"/></g><g transform="rotate(-28 44 52)"><ellipse cx="44" cy="52" rx="19" ry="14" fill="url(#pqlm)"/><path d="M62 51l5-1.4-1.4 3.2z" fill="#cf9407"/></g><g transform="rotate(18 70 62)"><ellipse cx="70" cy="62" rx="16" ry="12" fill="url(#pqlm)"/><path d="M85 62l4.4-1-1.2 2.8z" fill="#cf9407"/></g><g fill="#fff"><circle cx="24" cy="70" r="3.4"/><circle cx="29" cy="67" r="3.4"/><circle cx="29" cy="73" r="3.4"/><circle cx="19" cy="67" r="3.4"/><circle cx="20" cy="74" r="3.4"/></g><circle cx="24" cy="70" r="1.8" fill="#f2c94c"/></svg>`;
// a watercolour-coloured butterfly for the picnic napkin (wings beat with CSS)
const PK_FLY=`<svg viewBox="0 0 40 30" aria-hidden="true"><g class="w l"><path class="a" d="M20 15C14 3 3 2 4 10c1 5 8 7 16 5z"/><path class="b" d="M20 16c-7 1-12 6-9 10 3 3 8-2 9-10z"/></g><g class="w r"><path class="a" d="M20 15c6-12 17-13 16-5-1 5-8 7-16 5z"/><path class="b" d="M20 16c7 1 12 6 9 10-3 3-8-2-9-10z"/></g><path d="M20 8.5v15" stroke="#5a4632" stroke-width="1.7" stroke-linecap="round"/><path d="M20 9c-1-3-3-5-5-6M20 9c1-3 3-5 5-6" fill="none" stroke="#5a4632" stroke-width=".8" stroke-linecap="round"/></svg>`;
const pqBow=`<svg viewBox="0 0 120 70" aria-hidden="true"><defs><linearGradient id="pqgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a6"/><stop offset=".5" stop-color="#c79a45"/><stop offset="1" stop-color="#f0d488"/></linearGradient></defs><g fill="url(#pqgb)" stroke="#9b7230" stroke-width=".8"><path d="M60 34C46 14 10 6 12 26c2 18 34 14 48 8zM60 34c14-20 50-28 48-8-2 18-34 14-48 8z"/><path d="M56 38 40 68l10-3 6 5 4-30zM64 38l16 30-10-3-6 5-4-30z"/><ellipse cx="60" cy="35" rx="8" ry="7"/></g></svg>`;
function pqOpener(t,d,cl){const C=(en,sr)=>cl==="sr"?sr:en;const op=t.op;
 const ini=esc(pqWho(t,d).map(n=>n[0]||"").join("").toUpperCase().slice(0,2));const seal=t.seal?`var(--a-${t.seal})`:"";
 if(op==="lace")return laceHTML(t,d,"pqlace");
 const lbl=C("Open the invitation","Otvorite pozivnicu");let in_="";
 if(op==="gates")in_=`<span class="g-sky"></span><span class="g-view"></span><span class="g-leaf l">${pqGateLeaf()}<i class="g-half" style="--s:${seal}"></i></span><span class="g-leaf r">${pqGateLeaf()}<i class="g-half" style="--s:${seal}"></i></span><span class="g-pil l"><i></i></span><span class="g-pil r"><i></i></span><span class="g-mono">${ini}</span>`;
 if(op==="shutters")in_=`<span class="s-view"><i class="sun"></i><i class="sea"></i></span><span class="s-sh l"><i></i></span><span class="s-sh r"><i></i></span><span class="s-frame"></span><span class="s-sill"></span><span class="s-lem a">${pqLemons}</span><span class="s-lem b">${pqLemons}</span><span class="s-latch" style="--s:${seal}"></span>`;
 if(op==="box")in_=`<span class="b-glow"></span><span class="b-body"></span><span class="b-lid"><i class="b-rose"></i></span><span class="b-rib v"></span><span class="b-rib h"></span><span class="b-bow">${pqBow}</span>${Array.from({length:18},(_,i)=>`<i class="pt" style="--a:${(i*20+((i*37)%17))}deg;--r:${(8+(i*13)%12)}cqw;--d:${(i%6)*.05}s;--s:${(.7+(i%4)*.18).toFixed(2)}"></i>`).join("")}`;
 if(op==="bloom")in_=`<span class="f-glow"></span>${[[9,0,.92,"o"],[7,20,.74,"m"],[5,8,.54,"i"]].map(([n,o,sc,c])=>`<span class="f-ring ${c}" style="--sc:${sc}">${Array.from({length:n},(_,i)=>`<i style="--a:${(o+i*360/n).toFixed(1)}deg"></i>`).join("")}</span>`).join("")}<span class="f-heart" style="--s:${seal}"></span>`;
 if(op==="clock")in_=`<span class="c-rays"></span><span class="c-face"><span class="c-ticks"></span>${["XII","I","II","III","IIII","V","VI","VII","VIII","IX","X","XI"].map((r,i)=>`<b style="--a:${i*30}deg"><i>${r}</i></b>`).join("")}<span class="c-h"></span><span class="c-m"></span><span class="c-pin"></span></span>`;
 if(op==="clouds")in_=`<span class="k-rays"></span><span class="k-moon"></span><span class="k-cl l1">${pqCloud}</span><span class="k-cl l2">${pqCloud}</span><span class="k-cl r1">${pqCloud}</span><span class="k-cl r2">${pqCloud}</span><span class="k-cl c">${pqCloud}</span><span class="k-seal" style="--s:${seal}"></span>`;
 if(op==="napkin")in_=`<span class="n-card" aria-hidden="true">${renderCard(t,d,{fixed:true,lang:cl})}</span>${[["t","M5 3 50 47 95 3"],["l","M3 5 47 50 3 95"],["r","M97 5 53 50 97 95"],["b","M5 97 50 53 95 97"]].map(([s,p])=>`<span class="n-flap ${s}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${p}"/></svg></span>`).join("")}<span class="n-seal" style="--s:${seal}"></span>${[0,1,2].map(i=>`<span class="n-fly f${i}"><span class="n-flee">${PK_FLY}</span></span>`).join("")}`;
 if(op==="kiss")in_=`<span class="k-back"></span><span class="k-card" aria-hidden="true">${renderCard(t,d,{fixed:true,lang:cl})}</span><span class="k-pocket"></span><span class="k-fsh"><i></i></span><span class="k-flap"><i class="k-out"></i><i class="k-lin"></i></span><span class="k-seal"></span>${t.id==="e_cherry"?"":`<span class="k-st r"></span><span class="k-st s"></span><span class="k-ball"></span>${(()=>{const a=String(parseInt(d.age)||"");return a?`<span class="k-age" style="--k:${a.length}">${[...a].map((x,i)=>`<i style="--d:var(--a-ksd${x});--i:${i}"></i>`).join("")}</span>`:""})()}`}${Array.from({length:10},(_,i)=>`<i class="k-sp" style="--a:${i*36}deg;--d:${(i%4)*60}ms"></i>`).join("")}`;
 if(op==="tinsel")in_=`<span class="t-beam a"></span><span class="t-beam b"></span><span class="t-cur l">${Array.from({length:22},(_,i)=>`<i style="--i:${i};--h:${(88+(i*7)%12)}%;--d:${((i*.37)%1.6).toFixed(2)}s"></i>`).join("")}</span><span class="t-cur r">${Array.from({length:22},(_,i)=>`<i style="--i:${i};--h:${(88+(i*5)%12)}%;--d:${((i*.53)%1.6).toFixed(2)}s"></i>`).join("")}</span><span class="t-ball">${discoBall()}</span><span class="t-seal" style="--s:${seal}"></span>`;
 return`<button class="pq-door pq-${op} v-${t.id}" type="button" aria-label="${lbl}">${in_}</button>`}
const PQ_HINT={gates:["Touch the gate to open it","Dodirnite kapiju da je otvorite"],shutters:["Touch the shutters to open them","Dodirnite škure da ih otvorite"],box:["Touch the ribbon to open the box","Dodirnite mašnu da otvorite kutiju"],bloom:["Touch the flower to let it bloom","Dodirnite cvet da procveta"],clock:["Touch the clock to strike midnight","Dodirnite sat da otkuca ponoć"],clouds:["Touch the clouds to part them","Dodirnite oblake da se razmaknu"],napkin:["Touch the seal to unwrap the napkin","Dodirnite pečat da odmotate salvetu"],lace:["Touch the seal to break it","Dodirnite pečat da ga slomite"],tinsel:["Touch the curtain to open it","Dodirnite zavesu da je razmaknete"],kiss:["Touch the kiss to open the envelope","Dodirnite poljubac da otvorite kovertu"]};
function plusHTML(t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const v=k=>(d[k]??"").toString().trim();const p=t.pal,f=t.font;
 const dt=pd(v("date"),cl),rsH=pd(v("rsvpBy"),cl);const who=pqWho(t,d),names=who.map(esc).join(` ${C("&","i")} `);
 const g=o.guest,w=eventWhen(d,dt);
 const stops=(t.layout==="estate"?[[C("Ceremony","Venčanje"),v("ceremonyTime"),v("ceremonyVenue")]]:["wedding","lace"].includes(t.layout)?[[C("Ceremony","Venčanje"),v("ceremonyTime"),v("ceremonyVenue")],[C("Reception","Proslava"),v("receptionTime"),v("receptionVenue")]]:t.layout==="christening"?[[C("Christening","Krštenje"),v("time"),v("church")],[C("Celebration","Proslava"),"",v("receptionVenue")]]:[["",v("time"),v("venue")]]).filter(s=>s[1]||s[2]);
 const place=[stops.find(s=>s[2])?.[2]||"",v("address")].filter(Boolean).join(", ");
 const gcal=calLink(titleOf(t,d),w,place),maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
 const plan=v("dayPlan").split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>{const m=x.match(/^(\d{1,2}[:.]\d{2}h?)\s*[–—-]?\s*(.*)$/);return m?[m[1],m[2]]:["",x]});
 const info=[[v("dressCode"),C("Dress code","Dress code")],[v("stay"),C("Accommodation","Smeštaj")],[v("gifts"),C("Gifts","Pokloni")]].filter(x=>x[0]);
 const photo=PHOTO_RE.test(v("photo5"))?v("photo5"):"";const seal=t.seal?`var(--a-${t.seal})`:"var(--a-laceseal)";
 const orn=`<span class="pq-orn" aria-hidden="true"><i></i>◆<i></i></span>`;
 const st=`--pbg:${p.bg};--pink:${p.ink};--acc:${p.accent};--soft:${p.soft};--fd:${f.d};--fs:${f.s};--fb:${f.b};--pat:var(--a-${t.liner||"l8"});--seal:${seal}`;
 return`<div class="pq pq-t-${t.op} pq-d-${t.id}${o.preview?" pv":""}" style="${st}" lang="${cl==="sr"?"sr-Latn":"en"}">
 <span class="pq-bg" aria-hidden="true"></span>${t.fx?`<div class="pq-fx">${fxHTML(t.fx)}</div>`:""}
 ${o.preview?"":`<div class="vx-top">${langSwitch()}</div>`}
 <section class="pq-open">
  <p class="pq-to">${g&&g.source==="personal"?`${C("For","Za:")} <b>${esc(g.name)}</b>`:C("You've received an invitation","Stigla vam je pozivnica")}</p>
  ${pqOpener(t,d,cl)}
  <p class="pq-hint">${C(...(t.hint||PQ_HINT[t.op]))}</p>
 </section>
 <main class="pq-main">
  <section class="pq-hero"><p class="pq-k">${g&&g.source==="personal"?`${C("For","Za:")} ${esc(g.name)}`:C("You are invited","Pozvani ste")}</p><div class="pq-card" data-tilt-host>${tiltWrap(renderCard(t,d,{fx:true}))}</div><span class="pq-cue" aria-hidden="true"></span></section>
  ${v("backMsg")||photo?`<section class="pq-sec"><div class="pq-panel pq-word rv">${photo?`<div class="pq-ph"><img src="${esc(photo)}" alt=""></div>`:`<span class="pq-wax" aria-hidden="true"></span>`}${v("backMsg")?`<p class="pq-msg">${br(v("backMsg"))}</p>`:""}<p class="pq-sig">${names}</p></div></section>`:""}
  ${plan.length?`<section class="pq-sec"><p class="pq-kk rv">${C("The day","Dan za pamćenje")}</p><h2 class="pq-h rv">${C("Programme","Program dana")}</h2>${orn}
   <ol class="pq-plan">${plan.map(([tm,x],i)=>`<li class="rv" style="--i:${i}"><b>${esc(tm)}</b><span>${esc(x)}</span></li>`).join("")}</ol></section>`:""}
  <section class="pq-sec"><p class="pq-kk rv">${C("Where and when","Gde i kada")}</p><h2 class="pq-h rv">${C("We'll be waiting for you","Čekamo vas")}</h2>${orn}
   <div class="pq-panel pq-when rv">${dt?`<p class="pq-wd">${esc(dt.wd)}</p><p class="pq-date">${dt.d}<span>${esc(cl==="sr"?DATES.sr.monG[dt.m-1]:dt.mon)} ${dt.y}.</span></p>`:""}
    ${stops.map(([k,tm,pl])=>`<div class="pq-stop">${k?`<small>${esc(k)}</small>`:""}${tm?`<b>${esc(tm)}${cl==="sr"?" h":""}</b>`:""}${pl?`<span>${esc(pl)}</span>`:""}</div>`).join("")}
    ${v("address")?`<p class="pq-addr">${esc(v("address"))}</p>`:""}${v("estLine")?`<p class="pq-note">${esc(v("estLine"))}</p>`:""}
    <div class="pq-links">${gcal?`<a class="pq-btn" href="${gcal}" target="_blank" rel="noopener">${C("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="pq-btn ln" href="${maps}" target="_blank" rel="noopener">${C("Directions","Kako stići")}</a>`:""}</div></div></section>
  ${info.length?`<section class="pq-sec"><p class="pq-kk rv">${C("Good to know","Dobro je znati")}</p><div class="pq-info">${info.map(([x,h])=>`<div class="pq-panel rv"><h3>${h}</h3><p>${br(x)}</p></div>`).join("")}</div></section>`:""}
  ${w&&w>Date.now()?`<section class="pq-sec"><p class="pq-kk rv">${C("Counting down","Još samo")}</p><div class="pq-count rv" data-w="${w.getTime()}"></div></section>`:""}
  <section class="pq-sec">${o.preview?`<div class="rsvp pq-panel pq-rsvp"><p class="kicker">${C("RSVP","Potvrda dolaska")}</p><h2>${C("Will you join us?","Da li dolazite?")}</h2>${rsH?`<p class="sub">${C(`Please reply by ${rsH.short}`,`Molimo odgovorite do ${rsH.short}`)}</p>`:""}<p class="note-box" style="text-align:center">${L("This is a preview. Your guests will see the reply form here.","Ovo je pregled. Ovde će vaši gosti videti formular za odgovor.")}</p></div>`:`<div class="rsvp pq-panel pq-rsvp" id="rsvp"></div>`}</section>
  <section class="pq-end"><span class="pq-wax sm" aria-hidden="true"></span><p class="pq-sig2">${names}</p>${o.preview?"":`<p class="vx-by">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a></p>`}</section>
 </main>
</div>`}
function bindPlus(root,t,d,o={}){
 const cl=d.lang||LANG,C=(en,sr)=>cl==="sr"?sr:en;const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
 const door=$(".pq-door,.lacebox",root);
 function read(){root.classList.add("read");bindTilt(root,6);reveal();count()}
 const open=anim=>{if(root.classList.contains("on"))return;root.classList.add("on");door.classList.add("open");o.onOpen&&o.onOpen();
  if(!anim||RM)return read();setTimeout(()=>{if(root.isConnected)read()},PQ_T[t.op]||1800)};
 door.addEventListener("click",()=>open(true));
 function reveal(){if(!("IntersectionObserver" in window))return;root.classList.add("io");const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.15});$$(".rv",root).forEach(el=>io.observe(el))}
 function count(){const el=$(".pq-count",root);if(!el)return;const w=+el.dataset.w;const tick=()=>{if(!el.isConnected)return;const ms=w-Date.now();if(ms<=0){el.innerHTML="";return}const a=[[Math.floor(ms/864e5),C("Days","Dana")],[Math.floor(ms/36e5)%24,C("Hours","Sati")],[Math.floor(ms/6e4)%60,C("Minutes","Minuta")],[Math.floor(ms/1e3)%60,C("Seconds","Sekundi")]];el.innerHTML=a.map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
 if(o.opened)open(false);
}
const EXPS={plus:()=>[plusHTML,bindPlus],gold:()=>[recordHTML,bindRecord],balloon:()=>[balloonHTML,bindBalloon],sky:()=>[skyHTML,bindSky],rip:()=>[ripHTML,bindRip],bloom:()=>[bloomHTML,bindBloom],plane:()=>[planeHTML,bindPlane],letter:()=>[letterHTML,bindLetter],honey:()=>[honeyHTML,bindHoney],dino:()=>[dinoHTML,bindDino],news:()=>[newsHTML,bindNews],tale:()=>[taleHTML,bindTale],bow:()=>[bowHTML,bindBow],vinyl:()=>[vinylHTML,bindVinyl],disco:()=>[discoHTML,bindDisco]};const expOf=t=>(EXPS[t.exp]||EXPS.vinyl)();
/* ---------- interaction helpers ---------- */
const fine=matchMedia("(pointer:fine)").matches&&!matchMedia("(prefers-reduced-motion:reduce)").matches;
const tiltWrap=(html,cls="")=>`<div class="tilt ${cls}" style="position:relative">${html}<span class="shine"></span></div>`;
function bindTilt(root=document,max=7){if(!fine)return;$$(".tilt",root).forEach(el=>{if(el._t)return;el._t=1;const host=el.closest("[data-tilt-host]")||el;
 // one update per frame, however many pointer events arrive
 let raf=0,px=0,py=0;
 const paint=()=>{raf=0;const r=el.getBoundingClientRect(),x=(px-r.left)/r.width,y=(py-r.top)/r.height;el.style.transform=`rotateY(${(x-.5)*max}deg) rotateX(${(.5-y)*max}deg) translateZ(0)`;el.style.setProperty("--mx",x*100+"%");el.style.setProperty("--my",y*100+"%")};
 host.addEventListener("pointermove",e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(paint)});
 host.addEventListener("pointerleave",()=>{cancelAnimationFrame(raf);raf=0;el.style.transform=""})})}
const LOGO=`<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="17" fill="#16291F" stroke="#C9A66B" stroke-width="1"/><circle cx="18" cy="18" r="13.2" fill="none" stroke="#C9A66B" stroke-width=".8" opacity=".7"/><text x="18" y="24.4" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-style="italic" font-weight="600" font-size="19" fill="#E8D3A2">P</text></svg>`;
function demoName(t,name){const k={era:"name",vinyl:"partner1",wedding:"partner1",eighteen:"name",first:"childName",christening:"childName",celebration:"hostNames"}[t.layout];return name?{...defaultsOf(t),[k]:name}:null}
const langSwitch=()=>`<div class="lang" role="group" aria-label="${L("Language","Jezik")}"><button data-l="sr" class="${LANG==="sr"?"on":""}" aria-pressed="${LANG==="sr"}">SR</button><button data-l="en" class="${LANG==="en"?"on":""}" aria-pressed="${LANG==="en"}">EN</button></div>`;
function bindLang(root=document){$$(".lang button",root).forEach(b=>b.onclick=()=>{if(b.dataset.l===LANG)return;setLang(b.dataset.l);render()})}

/* ---------- router ---------- */
const app=$("#app");
function route(){
 if(location.pathname.startsWith("/i/")){const slug=location.pathname.split("/")[2]||"";const g=new URLSearchParams(location.search).get("g");return{name:"invite",a:slug,b:g}}
 const h=decodeURIComponent(location.hash.replace(/^#/,""));if(!h)return{name:"home"};const[name,a,b]=h.split("-");return{name,a,b};
}
const go=h=>{if(location.pathname.startsWith("/i/")){location.href="/#"+h;return}if(location.hash==="#"+h)render();else location.hash=h};
let afterAuth=null,timers=[];
const later=(fn,ms)=>{const id=setInterval(fn,ms);timers.push(id);return id};
function nav(){const r=route();const on=n=>r.name===n?" on":"";
 $("#nav").innerHTML=`<a class="lnk${on("templates")}" href="#templates">${L("Choose an invitation","Izaberi pozivnicu")}</a><a class="lnk${on("custom")}" href="#custom">${L("Made for you","Po vašoj želji")}</a>`+(ME?`${ME.admin?`<a class="lnk${on("admin")}" href="#admin">${L("Orders","Porudžbine")}</a>`:""}<a class="lnk${on("dashboard")}" href="#dashboard">${L("My invitations","Moje pozivnice")}</a><a class="lnk js-logout" href="#">${L("Sign out","Odjava")}</a>`:`<a class="lnk${on("login")}" href="#login">${L("Sign in","Prijava")}</a>`)+langSwitch()+`<button class="burger" id="burger" aria-label="${L("Open menu","Otvori meni")}" aria-expanded="false"><span></span></button>`;
 bindLang($("#nav"));$("#burger").onclick=openMenu;
 $(".hdr").hidden=r.name==="invite";$("#ft").hidden=r.name==="invite";
 
 $("#ft").innerHTML=`<div class="wrap ft3">
  <div class="ft3-top">
   <div class="ft3-brand"><a class="ft3-logo" href="#" aria-label="Poziv na klik"><span class="bl full" role="img" aria-label="Poziv na klik"></span></a>
    <p class="ft3-big">${L("Every celebration<br>deserves a <em>beautiful</em> beginning.","Svaka proslava<br>zaslužuje <em>lep</em> početak.")}</p></div>
   <div class="ft3-side"><p class="ft3-k">${L("Follow us","Pratite nas")}</p>
    <a class="ft3-ig" href="${IG_URL}" target="_blank" rel="noopener" aria-label="${L("Poziv na klik on Instagram","Poziv na klik na Instagramu")}">${IG_ICON}<span>@pozivnaklik</span><i aria-hidden="true">↗</i></a>
    <p class="ft3-sub">${L("Online invitations with RSVP for weddings, birthdays and every celebration.","Online pozivnice sa potvrdom dolaska za venčanja, rođendane i svaku proslavu.")}</p></div>
  </div>
  <div class="ft3-bottom"><span>© 2026 Poziv na klik · ${L("Website made by","Izrada sajta:")} <b class="ft3-by">DigitalByBT</b></span><span class="ft3-sig">${L("Your invitation. Your style. One click.","Tvoja pozivnica. Tvoj stil. Jedan klik.")}</span></div></div>`;
 $$(".js-logout").forEach(a=>a.onclick=async e=>{e.preventDefault();closeMenu();await API.logout();ME=null;toast(L("Signed out","Odjavljeni ste"));go("")});
}
let MENU=null;
function closeMenu(){if(MENU){MENU.remove();MENU=null;document.body.style.overflow="";$("#burger")?.setAttribute("aria-expanded","false")}}
function openMenu(){
 closeMenu();const items=[["",L("Home","Početna")],["templates",L("Choose an invitation","Izaberi pozivnicu")],["custom",L("Made for you","Po vašoj želji")],...(ME?[["dashboard",L("My invitations","Moje pozivnice")],["logout",L("Sign out","Odjava")]]:[["login",L("Sign in","Prijava")],["signup",L("Create an account","Napravi nalog")]])];
 MENU=document.createElement("div");MENU.className="mnav";MENU.setAttribute("role","dialog");MENU.setAttribute("aria-modal","true");MENU.setAttribute("aria-label",L("Menu","Meni"));
 MENU.innerHTML=`<div class="mnav-top"><a class="logo" href="#" aria-label="Poziv na klik"><span class="bl" role="img" aria-label="Poziv na klik"></span></a><button class="x" aria-label="${L("Close menu","Zatvori meni")}">✕</button></div>
 <ol>${items.map(([h,l],i)=>`<li style="--i:${i}"><a href="#${h==="logout"?"":h}"${h==="logout"?' class="js-logout"':""}><span>${String(i+1).padStart(2,"0")}</span>${esc(l)}</a></li>`).join("")}</ol>
 <div class="mnav-foot">${langSwitch().replace('class="lang"','class="lang" style="background:rgba(243,236,221,.1)"')}</div>`;
 document.body.appendChild(MENU);document.body.style.overflow="hidden";$("#burger")?.setAttribute("aria-expanded","true");
 $(".x",MENU).onclick=closeMenu;$$("a",MENU).forEach(a=>a.addEventListener("click",()=>{if(!a.classList.contains("js-logout"))closeMenu()}));
 bindLang(MENU);$$(".js-logout",MENU).forEach(a=>a.onclick=async e=>{e.preventDefault();closeMenu();await API.logout();ME=null;toast(L("Signed out","Odjavljeni ste"));go("")});
 MENU.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});$(".x",MENU).focus();
}
const waxPath=(()=>{let d="";for(let i=0;i<=120;i++){const a=i/120*Math.PI*2,r=44+3.4*Math.sin(a*13)+1.6*Math.sin(a*4+1);d+=(i?"L":"M")+f1(50+r*Math.cos(a))+" "+f1(50+r*Math.sin(a))}return d+"Z"})();
let waxN=0;
const WAX=()=>`<span class="wax-img" aria-hidden="true"></span>`;
const tNo=t=>String((t.tier?SHOW():T).indexOf(t)+1).padStart(2,"0");
function bindRail(rail){
 let down=false,sx=0,sl=0,moved=false;
 rail.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse"||e.button!==0)return;down=true;moved=false;sx=e.clientX;sl=rail.scrollLeft});
 rail.addEventListener("pointermove",e=>{if(!down)return;const dx=e.clientX-sx;if(!moved&&Math.abs(dx)>6){moved=true;rail.classList.add("drag");try{rail.setPointerCapture(e.pointerId)}catch(_){}}if(moved)rail.scrollLeft=sl-dx});
 const up=()=>{if(!down)return;down=false;rail.classList.remove("drag")};rail.addEventListener("pointerup",up);rail.addEventListener("pointercancel",up);
 rail.addEventListener("click",e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false}},true);
}

let RT=0;
async function render(){
 RT++;timers.forEach(clearInterval);timers=[];closeLB();closeMenu();MBox.stop();$$(".vx-ov").forEach(x=>x.remove());
 const r=route();nav();window.scrollTo(0,0);
 const views={custom:vCustom,admin:vAdmin,home:vHome,templates:vTemplates,login:vAuth,signup:vAuth,dashboard:vDash,pay:vPay,create:vCreate,edit:vCreate,manage:vManage,invite:vInvite};
 const fn=views[r.name]||vHome;
 if(["dashboard","create","edit","manage","admin","pay"].includes(r.name)&&!ME){afterAuth=location.hash.slice(1);toast(L("Create an account or sign in first","Prvo napravite nalog ili se prijavite"));return go("signup")}
 try{await fn(r)}catch(e){app.innerHTML=`<div class="wrap view"><div class="empty" style="margin-block:64px"><h2>${L("Something went wrong","Nešto nije u redu")}</h2><p>${esc(e.message)}</p><a class="btn btn-ink" href="#">${L("Back to home","Nazad na početnu")}</a></div></div>`}
 const v=$(".view",app);if(v){v.style.animation="none";void v.offsetWidth;v.style.animation=""}
 bindTilt(app);
}
addEventListener("hashchange",render);
addEventListener("hashchange",()=>{document.querySelectorAll(".story-ov,.vx-ov").forEach(o=>o.remove());try{MBox.stop()}catch(e){}try{DiscoBeat.stop()}catch(e){}if(typeof LB!=="undefined"&&LB&&typeof closeLB==="function")closeLB();document.body.style.overflow=""});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;const o=[...document.querySelectorAll(".story-ov,.vx-ov")].pop();if(o){e.stopPropagation();const x=o.querySelector(".x,.vx-close");x&&x.click()}},true);

/* ---------- lightbox ---------- */
let LB=null;
function closeLB(){if(LB){LB.remove();LB=null;document.body.style.overflow=""}}
function openLB(list,i){
 closeLB();const t=list[i];const flds=fieldsOf(t).map(k=>labelOf(t,k));
 LB=document.createElement("div");LB.className="lb";LB.setAttribute("role","dialog");LB.setAttribute("aria-modal","true");LB.setAttribute("aria-label",tName(t));
 LB.innerHTML=`<button class="arrow prev" aria-label="${L("Previous design","Prethodni dizajn")}">${ic("back")}</button>
 <div class="card-slot" data-tilt-host>${tiltWrap(renderCard(t,null,{anim:true}))}</div>
 <div class="info"><p class="kicker">${t.tier?`${tierName(t.tier)} · ${priceTxt(t.tier)}`:catName(t.cat)}</p><h2>${esc(tName(t))}</h2><p>${esc(tTag(t))}</p><ul>${[L("Your own wording in every field","Vaš tekst u svakom polju"),(t.exp==="plus"?L("Its own opening scene and a full invitation page","Posebno otvaranje i cela stranica pozivnice"):t.exp?L("A full-page experience with music","Doživljaj na celoj stranici, uz muziku"):t.tier==="basic"?L("Opens straight away with a gentle animation","Otvara se odmah, uz nežnu animaciju"):L("An envelope that guests open","Koverta koju gosti otvaraju")),L("Personal links and RSVP tracking","Lični linkovi i praćenje potvrda")].map(x=>`<li>${x}</li>`).join("")}<li>${L("Fields","Polja")}: ${esc(flds.slice(0,5).join(", "))}${flds.length>5?L(" and more"," i još"):""}</li></ul><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ink" data-gp>👁 ${L("Preview as a guest","Pogledaj kao gost")}</button><a class="btn btn-gold" href="#create-${t.id}">${L("Use this design","Izaberi ovaj dizajn")}</a><button class="btn btn-line" data-close>${L("Keep browsing","Nastavi razgledanje")}</button></div></div>
 <button class="arrow next" aria-label="${L("Next design","Sledeći dizajn")}" style="transform:scaleX(-1)">${ic("back")}</button>
 <button class="arrow x" data-close aria-label="${L("Close preview","Zatvori pregled")}">✕</button>`;
 document.body.appendChild(LB);document.body.style.overflow="hidden";bindTilt(LB,10);
 const step=d=>openLB(list,(i+d+list.length)%list.length);
 $(".prev",LB).onclick=()=>step(-1);$(".next",LB).onclick=()=>step(1);
 $$("[data-close]",LB).forEach(b=>b.onclick=closeLB);
 $("[data-gp]",LB)?.addEventListener("click",()=>guestPreview(t,{...defaultsOf(t),lang:LANG}));
 
 $("[data-play-x]",LB)?.addEventListener("click",()=>storyOverlay(t,{...defaultsOf(t),lang:LANG}));
 LB.addEventListener("click",e=>{if(e.target===LB)closeLB()});
 LB.tabIndex=-1;LB.focus();
 LB.onkeydown=e=>{if(e.key==="Escape")closeLB();if(e.key==="ArrowRight")step(1);if(e.key==="ArrowLeft")step(-1)};
}

/* ---------- views ---------- */
function vHome(){
 const picks=["p_letter","p_honey","e_estate","e_rouge","e_lemon","b_ilija","b_esp","b_sea","vinyl","p_bow","p_disco"].map(id=>TM[id]).filter(Boolean);let cur=0,typed="";
 const evts=L("Weddings|First birthdays|18th birthdays|Christenings|Anniversaries|Graduations|Birthdays|Celebrations","Venčanja|Prvi rođendani|Punoletstva|Krštenja|Godišnjice|Diplome|Rođendani|Proslave").split("|");
 const xp=[[L("A sealed envelope","Koverta sa voštanim pečatom"),L("The first thing guests see is a closed envelope. One tap and the invitation slides out.","Prvo što gost vidi je zatvorena koverta. Jedan dodir i pozivnica izlazi.")],[L("Your words, your design","Vaš tekst, vaš dizajn"),L("Names, date, venue and message, exactly as you wrote them.","Imena, datum, mesto i poruka, tačno onako kako ste ih napisali.")],[L("A countdown","Odbrojavanje"),L("Days, hours and minutes until the celebration, always in sight.","Dani, sati i minuti do proslave, uvek na vidiku.")],[L("Map and calendar","Mapa i kalendar"),L("Guests add the date to their calendar or get directions in one tap.","Gosti jednim dodirom dodaju proslavu u kalendar ili otvaraju put do mesta.")],[L("RSVP in seconds","Potvrda dolaska za par sekundi"),L("Yes or no, how many people, and a kind note for you.","Dolazim ili ne mogu, broj osoba i lepa poruka za vas.")]];
 const proc=[[L("Choose your design","Izaberite svoj dizajn"),L("Explore our collection of digital invitations and find the style that suits your celebration perfectly.","Istražite našu kolekciju digitalnih pozivnica i pronađite stil koji savršeno odgovara vašoj proslavi.")],[L("Personalise every detail","Personalizujte svaki detalj"),L("Add names, date, location, message and photos. Every change shows straight away in the invitation preview.","Unesite imena, datum, lokaciju, poruku i fotografije. Sve izmene pratite odmah kroz pregled pozivnice.")],[L("Share the special moment","Podelite poseban trenutak"),L("Send the invitation to your guests with a simple link, on WhatsApp, Viber or any other app.","Pošaljite pozivnicu svojim gostima jednostavno putem linka, preko WhatsApp-a, Vibera ili drugih aplikacija.")],[L("Follow the replies","Pratite potvrde dolaska"),L("Everything in one place. See who has confirmed and how many guests to expect.","Sve informacije na jednom mestu. Pratite ko je potvrdio dolazak i koliko gostiju možete da očekujete.")]];
 const PROC_IC=['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/></svg>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/></svg>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l2.5 2.5L16 9"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/></svg>'];
 const C=2*Math.PI*60;const sg=(v,o,c)=>`<circle class="seg ${c}" r="60" cx="75" cy="75" stroke-dasharray="${v/38*C} ${C}" stroke-dashoffset="${-o/38*C}"/>`;

 app.innerHTML=`<div class="view">
 <section class="hero3"><div class="wrap h3-grid">
  <div class="h3-text">
   <p class="kicker">${L("Your invitation. Your style. One click.","Tvoja pozivnica. Tvoj stil. Jedan klik.")}</p>
   <h1 class="h3-h1">${L(`Special moments<br class="bm"> deserve<br class="bd"> <em>special</em><br class="bm"> invitations.`,`Posebni trenuci<br class="bm"> zaslužuju<br class="bd"> <em>posebne</em><br class="bm"> pozivnice.`)}</h1>
   <p class="lead">${L("Discover a new generation of digital invitations for birthdays, weddings and every important celebration. Choose a design, personalise every detail and surprise your guests with a unique interactive experience.","Otkrijte novu generaciju digitalnih pozivnica za rođendane, venčanja i sve važne proslave. Izaberite dizajn, personalizujte svaki detalj i iznenadite svoje goste jedinstvenim interaktivnim iskustvom.")}</p>
   <p class="h2-sub">${L("From the first opening to the RSVP, everything in one place, simple and elegant.","Od prvog otvaranja do potvrde dolaska — sve na jednom mestu, jednostavno i elegantno.")}</p>
   <div class="cta"><a class="btn btn-ink" href="#templates">${L("Explore the designs","Istražite dizajne")}</a></div>
  </div>
  <div class="h3-stage" aria-hidden="true"><div class="h3-in">
   <div class="h3-env-back"></div>
   <div class="h3-flap"></div>
   <div class="h3-clip"><div class="h3-card" id="h3card">${renderCard(TM.e_estate||T[0],null,{fixed:true})}</div></div>
   <div class="h3-pocket"></div>
   <div class="h3-seal">${WAX("P")}</div><span class="h3-ring"></span>
   <svg class="h3-cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.6L16 20l-2.7 1.2-3.2-7.3L5 18z" fill="#2b1a15" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
   <div class="h3-chip h3-c1"><b>✓</b><span>${L("Marija is coming","Marija dolazi")}</span><small>${L("2 guests","2 osobe")}</small></div>
   <div class="h3-chip h3-c2"><b>✓</b><span>${L("Stefan is coming","Stefan dolazi")}</span><small>${L("just now","upravo")}</small></div>
  </div></div>
 </div><div class="h3-row" aria-label="${L("Our designs","Naši dizajni")}">${["e_estate","p_disco","b_sea","e_rouge","p_honey","b_esp","e_lemon"].filter(id=>TM[id]).map(id=>`<a class="h3-thumb" href="#templates">${renderCard(TM[id],null,{fixed:true})}<span>${esc(tName(TM[id]))}</span></a>`).join("")}</div></section>
 <div class="scrollcue" aria-hidden="true"><span>${L("Scroll","Dalje")}</span><i></i></div>

 <section class="section reveal"><div class="rail-wrap"><div class="rail-head"><div><p class="kicker">${L("The collection","Kolekcija")}</p><h2>${L(`Find <em>your</em> design`,`Pronađite <em>svoj</em> dizajn`)}</h2></div>
  <div class="rail-ctl"><button class="rbtn" data-d="-1" aria-label="${L("Scroll back","Nazad")}">${ic("back")}</button><button class="rbtn" data-d="1" aria-label="${L("Scroll forward","Napred")}" style="transform:scaleX(-1)">${ic("back")}</button><a class="tlink" href="#templates" style="margin-left:12px">${L(`All ${SHOW().length} designs`,`Svih ${SHOW().length} dizajna`)} <span aria-hidden="true">→</span></a></div></div>
  <div class="rail" id="rail">${RAIL().map((t,i)=>designCard(t,Math.min(i,8))).join("")}</div></div></section>



 

 <section class="wrap section reveal" style="padding-top:30px"><div class="sec-head"><div><p class="kicker">${L("How it works","Kako funkcioniše")}</p><h2>${L(`From idea to the <em>perfect</em> invitation, in just four steps.`,`Od ideje do <em>savršene</em> pozivnice, u samo četiri koraka.`)}</h2></div></div>
  <ol class="proc2">${proc.map(([h,p],i)=>`<li><div class="p2-ic">${PROC_IC[i]}</div><span class="p2-n">${L("Step","Korak")} 0${i+1}</span><h3>${h}</h3><p>${p}</p></li>`).join("")}</ol></section>
 <section class="wrap section reveal" id="paketi" style="padding-top:20px"><div class="sec-head"><div><p class="kicker">${L("Packages and prices","Paketi i cene")}</p><h2>${L(`Every celebration begins with a <em>special</em> invitation.`,`Svaka proslava počinje <em>posebnim</em> pozivom.`)}</h2><p>${L("Choose the invitation that best suits your style and the occasion you are celebrating. Personalise every detail, see how it looks and pay only when you are happy with the result.","Odaberite pozivnicu koja najbolje odgovara vašem stilu i prilici koju slavite. Personalizujte svaki detalj, pogledajte kako izgleda i platite tek kada budete zadovoljni rezultatom.")}</p><p class="pk-note">${L("One invitation. Unlimited guests.","Jedna pozivnica. Neograničen broj gostiju.")}</p></div></div>${plansHTML()}
 <div class="pk-end"><h3>${L("Your special moment, <em>your</em> choice.","Vaš poseban trenutak, <em>vaš</em> izbor.")}</h3><p>${L("Whichever package you choose, the invitation is tailored to your celebration and ready to share with all the people you love.","Bez obzira na paket koji odaberete, pozivnica je prilagođena vašoj proslavi i spremna da je podelite sa svim dragim ljudima.")}</p><p class="pk-sig">${L("Your invitation. Your style. One click.","Tvoja pozivnica. Tvoj stil. Jedan klik.")}</p></div></section>

 <section class="section" style="background:var(--wash)"><div class="wrap panelx reveal">
  <div><p class="kicker">${L("Guest list","Spisak gostiju")}</p><h2>${L(`A guest list that <em>fills itself in</em>`,`Spisak gostiju koji se <em>sam popunjava</em>`)}</h2><p style="color:var(--ink-2);font-size:17px;max-width:30em">${L("No more chasing replies on the phone. Every answer lands in your account the moment a guest sends it.","Nema više zvanja i dopisivanja. Svaki odgovor stiže u vaš nalog čim ga gost pošalje.")}</p>
   <ul class="checks"><li>${L("Who opened the invitation, and when","Ko je otvorio pozivnicu i kada")}</li><li>${L("Who is coming, and with how many people","Ko dolazi i sa koliko osoba")}</li><li>${L("Every guest's note in one place","Poruke gostiju na jednom mestu")}</li><li>${L("A personal link for each guest","Lični link za svakog gosta")}</li></ul>
   <a class="btn btn-ink" href="#${ME?"dashboard":"signup"}">${ME?L("Open my invitations","Otvori moje pozivnice"):L("Create a free account","Napravi besplatan nalog")}</a></div>
  <div class="mock" aria-label="${L("Example of the reply overview","Primer pregleda odgovora")}"><div class="mock-top"><div class="donut"><svg viewBox="0 0 150 150"><circle class="bg" r="60" cx="75" cy="75"/>${sg(24,0,"y")+sg(5,24,"n")+sg(9,29,"w")}</svg><div class="ctr"><b>76%</b><span>${L("Replied","Odgovorilo")}</span></div></div><div class="tiles" style="grid-template-columns:repeat(3,1fr);flex:1"><div class="tile t-yes" style="border-left:0"><b>24</b><span>${L("Coming","Dolazi")}</span><small>58 ${L("people","osoba")}</small></div><div class="tile t-no"><b>5</b><span>${L("Declined","Ne dolazi")}</span></div><div class="tile t-wait"><b>9</b><span>${L("Waiting","Čeka se")}</span></div></div></div>
   ${[["M","Marija J.",`<span class="pill p-yes">${L("Coming","Dolazi")} · 2</span>`,L("“We can't wait!”","„Jedva čekamo!”")],["P",L("The Petrović family","Porodica Petrović"),`<span class="pill p-yes">${L("Coming","Dolazi")} · 4</span>`,""],["I","Ivan P.",`<span class="pill p-no">${L("Declined","Ne dolazi")}</span>`,""],["S","Sofija M.",`<span class="pill p-wait">${L("Opened","Otvoreno")}</span>`,""]].map(([a,n,p,q])=>`<div class="mock-row"><span class="av" style="width:38px;height:38px;font-size:18px">${a}</span><span style="min-width:0"><b style="font-weight:700">${n}</b>${q?`<span class="gnote" style="display:block;font-size:16px;margin-top:0">${q}</span>`:""}</span>${p}</div>`).join("")}
   <p style="font-size:12px;color:var(--muted);margin-top:10px;text-align:right">${L("Example","Primer")}</p></div>
 </div></section>

 ${customBand()}</div>`;
 {const ids=["e_estate","e_rouge","b_sea","p_honey","e_lemon","b_ilija"].filter(id=>TM[id]);let k=0;const c=$("#h3card");
  c&&c.addEventListener("animationiteration",()=>{k=(k+1)%ids.length;c.innerHTML=renderCard(TM[ids[k]],null,{fixed:true})})}
 $("#xenv")?.addEventListener("click",()=>{const env=$("#xenv"),o=env.classList.toggle("open");$("#xhint").innerHTML=o?`${L("Tap again to close","Dodirnite ponovo da zatvorite")}<small>${L("That's what your guests will see","Tako će izgledati vašim gostima")}</small>`:`${L("Tap the seal","Dodirnite pečat")}<small>${L("Try it as a guest","Probajte kao gost")}</small>`});
 const rail=$("#rail");bindRail(rail);
 $$(".rbtn").forEach(b=>b.onclick=()=>{const w=rail.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(rail).columnGap||24),cs=getComputedStyle(rail),vis=rail.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);rail.scrollBy({left:+b.dataset.d*w*Math.max(1,Math.round(vis/w)),behavior:"smooth"})});
 $$("#rail [data-open]").forEach(b=>b.onclick=()=>openLB(RAIL(),RAIL().findIndex(t=>t.id===b.dataset.open)));
}
// a design can have its own cover scene in the gallery instead of the bare card
const COVERS={p_rip:t=>`<span class="cvr" aria-hidden="true"><span class="cvr-env"><i class="flapg"></i><i class="flap"></i><i class="back"></i><span class="cvr-card">${renderCard(t,null,{fixed:true})}</span><i class="frontg"></i><i class="front"></i><i class="seal"><b>R.I.P.</b></i></span></span>`};
function designCard(t,i){const list=SHOW();const no=String(list.indexOf(t)+1).padStart(2,"0");return`<button class="dcard" style="--i:${i}" data-open="${t.id}" data-tilt-host aria-label="${L("Preview","Pregled")}: ${esc(tName(t))}"><span class="dc-media${COVERS[t.id]?` cv cv-${t.id}`:""}" style="--s:${t.pal.bg2}">${COVERS[t.id]?COVERS[t.id](t):tiltWrap(renderCard(t,null,{fixed:true}))}</span><span class="dc-top"><span class="no">${L("No.","Br.")} ${no} · ${catName(t.cat)}</span>${t.tier?`<span class="tier-chip ${t.tier}">${tierName(t.tier)}</span>`:""}</span><span class="dc-name">${esc(tName(t))}<i aria-hidden="true">→</i></span><span class="dc-tag">${esc(tTag(t))}</span>${t.tier?`<span class="dc-price${TIERS[t.tier].was?" sale":""}">${TIERS[t.tier].was?`<s>${TIERS[t.tier].was.rsd}</s> `:""}${TIERS[t.tier].rsd} din<span>${TIERS[t.tier].was?`<s>${TIERS[t.tier].was.eur} €</s> `:""}${TIERS[t.tier].eur} €</span></span>`:""}</button>`}
function plansHTML(){return`<div class="plans">${TIER_KEYS.map(k=>{const T_=TIERS[k],hl=k==="envelope";return`<div class="plan${k==="premium"?" hl":""}">${hl?`<span class="badge-top">${L("Often chosen","Često birano")}</span>`:""}${T_.was?`<span class="badge-top sale">${L("On sale","Akcija")}</span>`:""}<div><h3>${tierName(k)}</h3></div><p class="tg">${pick(T_.tag)}</p><div class="pr">${T_.was?`<s class="was">${T_.was.rsd}</s>`:""}<b>${T_.rsd}</b><span>RSD · ${T_.was?`<s>${T_.was.eur} €</s> `:""}${T_.eur} €</span></div>${T_.desc?`<p class="ds">${pick(T_.desc)}</p>`:""}<button type="button" class="pl-more" aria-expanded="false" onclick="const o=this.parentElement.classList.toggle('open');this.setAttribute('aria-expanded',o);this.firstChild.textContent=o?this.dataset.l:this.dataset.m" data-m="${L("What's included","Šta je uključeno")}" data-l="${L("Show less","Prikaži manje")}">${L("What's included","Šta je uključeno")}<i aria-hidden="true">⌄</i></button><ul>${T_.feat.map(f=>`<li>${pick(f)}</li>`).join("")}</ul><a class="btn ${k==="premium"?"btn-gold":"btn-line"}" href="#templates-${k}">${L("See designs","Pogledaj dizajne")}</a></div>`}).join("")}</div>`}
function vTemplates(r){
 const tier=TIER_KEYS.includes(r.a)?r.a:"all";const all=SHOW();
 const chips=[["all",L("All","Svi"),all.length],...TIER_KEYS.map(k=>[k,`${tierName(k)} · ${rsdTxt(k)}`,all.filter(t=>t.tier===k).length])];
 const groups=tier==="all"?TIER_KEYS:[tier];const list=all.filter(t=>groups.includes(t.tier));let i=0;
 app.innerHTML=`<div class="view wrap section" style="padding-top:64px"><div class="sec-head"><div><p class="kicker">${L("The collection","Kolekcija")}</p><h2>${L(`Choose <em>your</em> design`,`Izaberite <em>svoj</em> dizajn`)}</h2><p>${L("Three packages, one simple process. Open any design to see it up close, then fill in your details.","Tri paketa, jedan jednostavan postupak. Otvorite bilo koji dizajn da ga vidite izbliza, pa upišite svoje podatke.")}</p></div></div>
 ${TIER_KEYS.length>1?"":"<!--"}<div class="chips" role="tablist">${chips.map(([k,l,n])=>`<a class="chip${tier===k?" on":""}" href="#templates${k==="all"?"":"-"+k}" role="tab" aria-selected="${tier===k}">${l}<span class="n">${n}</span></a>`).join("")}</div>${TIER_KEYS.length>1?"":"-->"}
 <div class="tgrid${tier==="all"?" grouped":" single"}">${groups.map(g=>{const ts=all.filter(t=>t.tier===g);const lim=tier==="all"&&TIER_KEYS.length>1?3:ts.length;
  return`<div class="tier-head"><div><h3>${tierName(g)}</h3><p>${pick(TIERS[g].tag)}</p></div><span class="pz">${priceTxt(g)}</span></div><div class="tier-row">${ts.slice(0,lim).map(t=>designCard(t,Math.min(i++,10))).join("")}</div>${ts.length>lim?`<div class="tier-more"><a class="btn btn-line" href="#templates-${g}">${L(`View all ${ts.length}`,`Pogledaj sve (${ts.length})`)} <span aria-hidden="true">→</span></a></div>`:""}`}).join("")}</div>
 ${tier!=="all"?`<div class="tier-more" style="margin-top:44px"><a class="btn btn-line" href="#templates">← ${L("All packages","Svi paketi")}</a></div>`:""}</div>${customBand()}`;
 $$("[data-open]").forEach(b=>b.onclick=()=>openLB(list,list.findIndex(t=>t.id===b.dataset.open)));
}
const PAYMENTS=false; // payments are switched off for now
function payHTML(inv,t){if(!PAYMENTS)return"";
 const k=t.tier||inv.tier;if(!k||inv.status!=="pending")return"";const c=PAYCFG;
 return`<div class="pay"><span class="st-pill pending">${L("Awaiting payment","Čeka uplatu")}</span><h3>${L("One step left: payment","Još jedan korak: uplata")}</h3><p>${L("Your invitation is saved. The guest link starts working as soon as we confirm your payment, usually the same day.","Pozivnica je sačuvana. Link za goste počinje da radi čim potvrdimo uplatu, obično istog dana.")}</p>
 <dl><dt>${L("Package","Paket")}</dt><dd>${tierName(k)}</dd><dt>${L("Amount","Iznos")}</dt><dd>${priceTxt(k)}</dd>${c.recipient?`<dt>${L("Recipient","Primalac")}</dt><dd>${esc(c.recipient)}</dd>`:""}${c.account?`<dt>${L("Account","Račun")}</dt><dd>${esc(c.account)}</dd>`:""}${c.bank?`<dt>${L("Bank","Banka")}</dt><dd>${esc(c.bank)}</dd>`:""}<dt>${L("Reference","Poziv na broj")}</dt><dd>${esc(inv.slug)}</dd>${c.phone?`<dt>${L("Questions","Pitanja")}</dt><dd>${esc(c.phone)}</dd>`:""}</dl>
 ${c.note?`<p style="margin-top:12px;font-size:14px">${esc(c.note)}</p>`:""}
 ${!c.account?`<p class="note-box">${API.kind==="local"?L("Preview mode: in the live site your bank details appear here.","Probni režim: na pravom sajtu ovde stoje vaši podaci za uplatu."):L("We'll send you the payment details by email.","Podatke za uplatu poslaćemo vam imejlom.")}</p>`:""}
 ${API.kind==="local"?`<div class="row"><button class="btn btn-ink btn-sm" id="sim-pay">${L("Preview mode: mark as paid","Probni režim: označi kao plaćeno")}</button></div>`:""}</div>`;
}

/* ---------- custom design request ---------- */
function customBand(){return`<section class="wrap section reveal cust-band"><div class="cb-in"><div class="cb-art" aria-hidden="true"><span class="p p1"></span><span class="p p2"></span><span class="p p3"></span><i>✦</i></div><div class="cb-tx"><p class="kicker">${L("Made for you","Po vašoj želji")}</p><h2>${L("Didn't find <em>the one</em>?","Niste pronašli <em>pravu</em>?")}</h2><p>${L("Saw an invitation you love on Pinterest or Instagram, or have an idea of your own? Send it to us and we'll design a new invitation just for you, in any package.","Videli ste pozivnicu koja vam se dopada na Pinterestu ili Instagramu, ili imate svoju ideju? Pošaljite nam je i napravićemo novu pozivnicu baš za vas, u bilo kom paketu.")}</p><a class="btn btn-ink" href="#custom">${L("Request your design","Zatražite svoj dizajn")} <span aria-hidden="true">→</span></a></div></div></section>`}
const IG_URL="https://www.instagram.com/pozivnaklik/",IG_ICON='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>';
const igLink=(cls="")=>`<a class="ig-link ${cls}" href="${IG_URL}" target="_blank" rel="noopener" aria-label="${L("Poziv na klik on Instagram","Poziv na klik na Instagramu")}">${IG_ICON}<span>@pozivnaklik</span></a>`;
function vCustom(){
 const occ=[["wedding",L("Wedding","Venčanje")],["birthday",L("Birthday","Rođendan")],["first",L("First birthday","Prvi rođendan")],["eighteen",L("18th birthday","18. rođendan")],["christening",L("Christening","Krštenje")],["company",L("Company event","Proslava firme")],["other",L("Something else","Nešto drugo")]];
 const pk=[["",L("Not sure yet","Još nisam siguran/na")],...TIER_KEYS.map(k=>[k,`${tierName(k)} · ${rsdTxt(k)}`])];
 app.innerHTML=`<div class="view wrap section cust" style="padding-top:56px">
  <div class="cust-grid"><div class="cust-intro"><p class="kicker">${L("Made for you","Po vašoj želji")}</p><h1>${L("Your idea, <em>our</em> design","Vaša ideja, <em>naš</em> dizajn")}</h1>
   <p class="lead">${L("If none of our designs is quite right, tell us what you'd like. Attach a picture of an invitation you liked (from Pinterest, Instagram or anywhere else) and we'll create a new one based on your wishes.","Ako nijedan naš dizajn nije baš ono što tražite, recite nam šta želite. Priložite sliku pozivnice koja vam se dopala (sa Pinteresta, Instagrama ili bilo odakle) i napravićemo novu, po vašim željama.")}</p>
   <ol class="cust-steps"><li><b>1</b><span>${L("Send your wishes and, if you like, a picture","Pošaljite želje i, ako želite, sliku")}</span></li><li><b>2</b><span>${L("We reply within 24 hours with a proposal and price","Javljamo se u roku od 24 sata sa predlogom i cenom")}</span></li><li><b>3</b><span>${L("You approve the design and get your link","Odobrite dizajn i dobijate svoj link")}</span></li></ol><p class="cust-ig">${L("Prefer to send a message? Write to us on Instagram:","Radije šaljete poruku? Pišite nam na Instagramu:")} ${igLink()}</p></div>
  <form class="panel cust-form" id="cf" novalidate>
   <div class="row2"><div class="fld"><label for="cf-name">${L("Your name","Vaše ime")} *</label><input id="cf-name" required maxlength="80" autocomplete="name"></div>
   <div class="fld"><label for="cf-email">${L("Email","Imejl")} *</label><input id="cf-email" type="email" required maxlength="160" autocomplete="email"></div></div>
   <div class="row2"><div class="fld"><label for="cf-phone">${L("Phone (optional)","Telefon (nije obavezno)")}</label><input id="cf-phone" type="tel" maxlength="40" autocomplete="tel"></div>
   <div class="fld"><label for="cf-date">${L("Date of the celebration","Datum proslave")}</label><input id="cf-date" type="date"></div></div>
   <div class="row2"><div class="fld"><label for="cf-occ">${L("Occasion","Povod")}</label><select id="cf-occ">${occ.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></div>
   <div class="fld"><label for="cf-pkg">${L("Package","Paket")}</label><select id="cf-pkg">${pk.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></div></div>
   <div class="fld"><label for="cf-msg">${L("Describe your idea","Opis vaše ideje")} *</label><p class="cust-help">${L("Describe how you imagine your invitation. Mention the colours, style, theme of the celebration, animations or any other details that matter to you.","Opišite kako zamišljate svoju pozivnicu. Navedite željene boje, stil, temu proslave, animacije ili druge detalje koji su vam važni.")}</p><textarea id="cf-msg" rows="5" maxlength="3000" required></textarea></div>
   <div class="fld"><label>${L("Add inspiration (optional)","Dodajte inspiraciju (opciono)")}</label><p class="cust-help">${L("Attach up to 3 photos or examples of designs you like.","Priložite do 3 fotografije ili primera dizajna koji vam se dopadaju.")}</p>
    <label class="cust-drop" for="cf-files"><input id="cf-files" type="file" accept="image/*" multiple hidden><span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span><b>${L("Add pictures","Dodajte slike")}</b><small>${L("Up to 3 pictures","Do 3 slike")}</small></label>
    <div class="cust-thumbs" id="cf-th"></div>
    <div class="fld" style="margin-top:18px"><label for="cf-link">${L("Link to your inspiration (optional)","Link ka inspiraciji (opciono)")}</label><p class="cust-help">${L("Paste a link to Pinterest, Instagram or another page that inspires you.","Unesite link ka Pinterestu, Instagramu ili drugoj stranici koja vas inspiriše.")}</p><input id="cf-link" type="url" maxlength="500" placeholder="https://pinterest.com/…"></div></div>
   <button class="btn btn-ink" type="submit" id="cf-send" style="width:100%;justify-content:center">${L("Send your request","Pošaljite upit")}</button>
   <p class="cust-fine">${L("Sending a request is free and doesn't commit you to anything. Once we've looked at your wishes, we'll get back to you with a proposal and the price.","Slanje upita je besplatno i ne obavezuje vas na kupovinu. Nakon što razmotrimo vaše želje, kontaktiraćemo vas sa predlogom i cenom izrade.")}</p>
  </form></div></div>`;
 const files=[];const th=$("#cf-th");
 const draw=()=>{th.innerHTML=files.map((u,i)=>`<span class="t"><img src="${u}" alt=""><button type="button" data-rm="${i}" aria-label="${L("Remove","Ukloni")}">✕</button></span>`).join("");$$("[data-rm]",th).forEach(b=>b.onclick=()=>{files.splice(+b.dataset.rm,1);draw()})};
 $("#cf-files").onchange=async e=>{for(const f of [...e.target.files]){if(files.length>=3){toast(L("Up to 3 pictures","Najviše 3 slike"));break}try{files.push(await shrink(f,1200))}catch(err){toast(err.message)}}e.target.value="";draw()};
 $("#cf").onsubmit=async e=>{e.preventDefault();const v=id=>$("#"+id).value.trim();
  if(!v("cf-name")||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("cf-email"))||!v("cf-msg"))return toast(L("Please fill in your name, email and a short description.","Upišite ime, imejl i kratak opis."));
  const b=$("#cf-send");b.disabled=true;b.textContent=L("Sending…","Šaljem…");
  try{await API.sendRequest({name:v("cf-name"),email:v("cf-email"),phone:v("cf-phone"),date:v("cf-date"),occasion:$("#cf-occ").value,tier:$("#cf-pkg").value,message:v("cf-msg"),link:v("cf-link"),images:files,lang:LANG});
   $(".cust-form").innerHTML=`<div class="cust-ok"><span class="ok-ic" aria-hidden="true">✓</span><h2>${L("Thank you!","Hvala vam!")}</h2><p>${L("We've received your wishes and will get back to you within 24 hours.","Primili smo vaše želje i javićemo vam se u roku od 24 sata.")}</p><a class="btn btn-line" href="#templates">${L("Browse designs meanwhile","U međuvremenu pogledajte dizajne")}</a></div>`;$(".cust-form").scrollIntoView({behavior:"smooth",block:"center"})}
  catch(err){toast(err.message);b.disabled=false;b.textContent=L("Send request","Pošalji zahtev")}};
}
async function vAdmin(){
 if(!ME||!ME.admin){app.innerHTML=`<div class="wrap view"><div class="empty" style="margin-block:64px"><h2>${L("Not available","Nije dostupno")}</h2><p>${L("This page is only for the site owner.","Ova stranica je samo za vlasnika sajta.")}</p></div></div>`;return}
 const list=await API.adminList();let f=PAYMENTS?"pending":"all";let reqs=[];try{reqs=await API.adminRequests()}catch(e){}let users=[];try{users=API.adminUsers?await API.adminUsers():[]}catch(e){}const newPw={};
 const draw=()=>{const rows=list.filter(x=>f==="all"||x.status===f);
  app.innerHTML=`<div class="view wrap"><div class="dash-head"><div><p class="kicker">${L("Owner","Vlasnik")}</p><h1>${L("Orders and payments","Porudžbine i uplate")}</h1><p>${L("Confirm a payment to activate the guest link.","Potvrdite uplatu da biste aktivirali link za goste.")}</p></div></div>
  <div class="chips" style="margin-bottom:20px">${[["pending",L("Awaiting payment","Čeka uplatu")],["active",L("Active","Aktivne")],["all",L("All","Sve")]].map(([k,l])=>`<button class="chip${f===k?" on":""}" data-f="${k}">${l}<span class="n">${list.filter(x=>k==="all"||x.status===k).length}</span></button>`).join("")}</div>
  <div class="adm-wrap"><table class="adm-table"><thead><tr><th>${L("Invitation","Pozivnica")}</th><th>${L("Client","Klijent")}</th><th>${L("Package","Paket")}</th><th>${L("Reference","Poziv na broj")}</th><th>${L("Status","Status")}</th><th></th></tr></thead><tbody>${rows.map(x=>{const t=TM[x.templateId]||T[0];return`<tr><td><b>${esc(titleOf(t,x.data))}</b><br><small style="color:var(--muted)">${esc(tName(t))} · ${new Date(x.createdAt).toLocaleDateString(LANG==="sr"?"sr-Latn":"en-GB")}</small></td><td>${esc(x.ownerName||"")}<br><small style="color:var(--muted)">${esc(x.ownerEmail||"")}</small></td><td>${x.tier?`${tierName(x.tier)}<br><small style="color:var(--muted)">${priceTxt(x.tier)}</small>`:"—"}</td><td><code>${esc(x.slug)}</code></td><td><span class="st-pill ${x.status}">${x.status==="pending"?L("Awaiting payment","Čeka uplatu"):L("Active","Aktivna")}</span></td><td>${x.status==="pending"?`<button class="btn btn-ink btn-sm" data-act="${x.id}">${L("Confirm payment","Potvrdi uplatu")}</button>`:`<button class="btn btn-line btn-sm" data-pend="${x.id}">${L("Set to pending","Vrati na čekanje")}</button>`}</td></tr>`}).join("")||`<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:30px">${L("Nothing here yet.","Ovde još nema ničega.")}</td></tr>`}</tbody></table></div></div>`;
  const OCC={wedding:L("Wedding","Venčanje"),birthday:L("Birthday","Rođendan"),first:L("First birthday","Prvi rođendan"),eighteen:L("18th birthday","18. rođendan"),christening:L("Christening","Krštenje"),company:L("Company event","Proslava firme"),other:L("Other","Drugo")};
  app.querySelector(".view").insertAdjacentHTML("beforeend",`<div class="req-head"><h2>${L("Custom design requests","Zahtevi za dizajn po želji")}</h2><span class="n">${reqs.filter(r=>r.status!=="done").length} ${L("open","otvorenih")}</span></div><div class="req-list">${reqs.map(r=>`<article class="req${r.status==="done"?" done":""}"><div class="rq-top"><b>${esc(r.name)}</b><span>${new Date(r.createdAt).toLocaleDateString(LANG==="sr"?"sr-Latn":"en-GB")}</span></div><p class="rq-meta"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone?` · <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>`:""}<br>${esc(OCC[r.occasion]||r.occasion||"")}${r.date?` · ${esc(r.date)}`:""}${r.tier&&TIERS[r.tier]?` · ${tierName(r.tier)}`:""}</p><p class="rq-msg">${br(esc(r.message||""))}</p>${r.link?`<p class="rq-link"><a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.link)}</a></p>`:""}${(r.images||[]).length?`<div class="rq-imgs">${r.images.map(u=>`<a href="${u}" target="_blank"><img src="${u}" alt=""></a>`).join("")}</div>`:""}<button class="btn btn-sm ${r.status==="done"?"btn-line":"btn-ink"}" data-rq="${r.id}" data-to="${r.status==="done"?"new":"done"}">${r.status==="done"?L("Reopen","Vrati kao otvoren"):L("Mark as handled","Označi kao rešen")}</button></article>`).join("")||`<p class="empty-req">${L("No requests yet.","Još nema zahteva.")}</p>`}</div>`);
  $$("[data-rq]").forEach(b=>b.onclick=async()=>{try{await API.adminRequestSet(b.dataset.rq,b.dataset.to);reqs.find(x=>x.id===b.dataset.rq).status=b.dataset.to;draw()}catch(e){toast(e.message)}});
  $$("[data-f]").forEach(b=>b.onclick=()=>{f=b.dataset.f;draw()});
  const set=async(id,st)=>{try{await API.adminSet(id,st);list.find(x=>x.id===id).status=st;toast(st==="active"?L("Payment confirmed. The link is live.","Uplata potvrđena. Link je aktivan."):L("Set back to pending","Vraćeno na čekanje"));draw()}catch(e){toast(e.message)}};
  $$("[data-act]").forEach(b=>b.onclick=()=>set(b.dataset.act,"active"));
  $$("[data-pend]").forEach(b=>b.onclick=()=>set(b.dataset.pend,"pending"));
  const host=$(".view.wrap",app);if(host&&API.adminUsers){const dt=x=>x?new Date(x).toLocaleDateString(LANG==="sr"?"sr-Latn":"en-GB"):"—";
   host.insertAdjacentHTML("beforeend",`<section class="adm-users" id="nalozi"><h2 style="margin:56px 0 6px">${L("Accounts","Nalozi")} <span class="n" style="font-size:16px;color:var(--muted)">${users.length}</span></h2>
   <p style="color:var(--muted);margin:0 0 18px;max-width:60ch">${L("Passwords are stored encrypted and can't be viewed. If a client forgets theirs, set a new one here and send it to them.","Lozinke se čuvaju šifrovano i ne mogu da se vide. Ako klijent zaboravi lozinku, ovde mu postavite novu i pošaljite mu je.")}</p>
   <div class="adm-wrap"><table class="adm-table"><thead><tr><th>${L("Name","Ime")}</th><th>${L("Email","Imejl")}</th><th>${L("Joined","Napravljen")}</th><th>${L("Last sign-in","Poslednja prijava")}</th><th>${L("Invitations","Pozivnice")}</th><th></th></tr></thead><tbody>
   ${users.length?users.map(u=>`<tr><td><b>${esc(u.name)}</b>${u.admin?` <small style="color:var(--muted)">· ${L("owner","vlasnik")}</small>`:""}</td><td><a href="mailto:${esc(u.email)}">${esc(u.email)}</a></td><td>${dt(u.createdAt)}</td><td>${dt(u.lastLogin)}</td><td>${u.invitations}</td><td>${newPw[u.id]?`<code class="newpw">${esc(newPw[u.id])}</code>`:`<button class="btn btn-line btn-sm" data-pw="${u.id}">${L("Set new password","Nova lozinka")}</button>`}</td></tr>`).join(""):`<tr><td colspan="6" style="color:var(--muted)">${L("No accounts yet.","Još nema naloga.")}</td></tr>`}</tbody></table></div></section>`);
   $$("[data-pw]",host).forEach(b=>b.onclick=async()=>{const u=users.find(x=>x.id===b.dataset.pw);if(!b.dataset.sure){b.dataset.sure=1;b.textContent=L("Click again to confirm","Kliknite ponovo za potvrdu");return}
    try{newPw[u.id]=await API.adminUserPw(u.id);toast(L("New password set. Send it to the client.","Nova lozinka je postavljena. Pošaljite je klijentu."));draw()}catch(e){toast(e.message)}});}
 };draw();
}
function inactiveHTML(){return`<div class="inactive view"><div><p class="kicker">Poziv na klik</p><h1>${L("This invitation isn't active yet","Ova pozivnica još nije aktivna")}</h1><p>${L("The host is finishing it. Please open the link again a little later.","Domaćin je još priprema. Molimo otvorite link ponovo malo kasnije.")}</p></div></div>`}
function vAuth(r){
 const up=r.name==="signup";const t=up?TM.blossom:TM.champagne;
 app.innerHTML=`<div class="view auth-wrap"><div class="auth-art">${renderCard(t,null,{fixed:true})}<blockquote>${up?L("Every celebration begins with an invitation.","Svaka proslava počinje pozivnicom."):L("Welcome back. Your guests are waiting.","Dobro došli nazad. Gosti čekaju.")}</blockquote></div>
 <div class="auth"><p class="kicker">${up?L("Create an account","Novi nalog"):L("Sign in","Prijava")}</p><h1 style="margin-top:12px">${up?L("Start your invitation","Napravite pozivnicu"):L("Welcome back","Dobro došli nazad")}</h1><p class="sub">${up?L("Save your designs, send them to guests and follow every reply in one place.","Sačuvajte pozivnice, pošaljite ih gostima i pratite sve odgovore na jednom mestu."):L("Sign in to manage your invitations and replies.","Prijavite se da biste upravljali pozivnicama i odgovorima.")}</p>
 <form class="form" id="af" novalidate>${up?`<div class="fld"><label for="a-name">${L("Your name","Vaše ime")}</label><input id="a-name" autocomplete="name" required></div>`:""}
 <div class="fld"><label for="a-email">${L("Email","Imejl")}</label><input id="a-email" type="email" autocomplete="email" required></div>
 <div class="fld"><label for="a-pw">${L("Password","Lozinka")}</label><input id="a-pw" type="password" autocomplete="${up?"new-password":"current-password"}" minlength="8" required></div>${up?"":`<div class="forgot"><button type="button" class="forgot-btn" id="fg">${L("Forgot your password?","Zaboravili ste lozinku?")}</button><div class="forgot-box" id="fgb" hidden><p>${L("No problem. Send us a message with the email you signed up with and we'll send you a new password, usually within a few hours.","Nema problema. Pošaljite nam poruku sa imejlom kojim ste se registrovali i poslaćemo vam novu lozinku, obično u roku od nekoliko sati.")}</p><p class="forgot-ig">${igLink()}</p></div></div>`}${up?`<small style="color:var(--muted);font-size:13.5px;margin-top:-10px">${L("At least 8 characters","Najmanje 8 karaktera")}</small>`:""}
 <p class="err" id="a-err"></p><button class="btn btn-ink" type="submit">${up?L("Create account","Napravi nalog"):L("Sign in","Prijavi se")}</button></form>
 <p class="alt">${up?`${L("Already have an account?","Već imate nalog?")} <a href="#login">${L("Sign in","Prijavite se")}</a>`:`${L("New to Poziv na klik?","Prvi put ste ovde?")} <a href="#signup">${L("Create an account","Napravite nalog")}</a>`}</p></div></div>`;
 $("#fg")?.addEventListener("click",()=>{const b=$("#fgb");b.hidden=!b.hidden});
 $("#af").addEventListener("submit",async e=>{e.preventDefault();const b=$("button[type=submit]",e.target);b.disabled=true;$("#a-err").textContent="";
  try{ME=up?await API.signup($("#a-name").value,$("#a-email").value,$("#a-pw").value):await API.login($("#a-email").value,$("#a-pw").value);toast(up?L(`Welcome, ${ME.name.split(" ")[0]}`,`Dobro došli, ${ME.name.split(" ")[0]}`):L("Signed in","Prijavljeni ste"));const n=afterAuth;afterAuth=null;go(n||"dashboard")}catch(err){$("#a-err").textContent=err.message;b.disabled=false}});
}
function greet(){const h=new Date().getHours();return h<12?L("Good morning","Dobro jutro"):h<18?L("Good afternoon","Dobar dan"):L("Good evening","Dobro veče")}
const nInv=n=>LANG==="sr"?`${n} ${n%10===1&&n%100!==11?"pozivnicu":(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?"pozivnice":"pozivnica"}`:`${n} invitation${n>1?"s":""}`;
async function vDash(){
 const list=await API.list();const first=esc(ME.name.split(" ")[0]);
 app.innerHTML=`<div class="view wrap"><div class="dash-head"><div><p class="kicker">${L("My invitations","Moje pozivnice")}</p><h1>${greet()}, ${first}</h1><p>${list.length?L(`You have ${nInv(list.length)}. Open one to share it and follow the replies.`,`Imate ${nInv(list.length)}. Otvorite pozivnicu da je podelite i pratite odgovore.`):L("Your invitations and their replies will appear here.","Ovde će se pojaviti vaše pozivnice i odgovori gostiju.")}</p></div><a class="btn btn-gold" href="#templates">${ic("plus")} ${L("New invitation","Nova pozivnica")}</a></div>
 ${list.length?`<div class="igrid">${list.map((x,i)=>{const t=TM[x.templateId]||T[0],lg=x.data.lang||LANG,d={...defaultsOf(t,lg),...x.data},dt=pd(d.date),s=x.stats;return`<a class="icard" style="--i:${i}" href="#manage-${x.id}"><div>${renderCard(t,x.data,{fixed:true})}</div><div style="min-width:0"><p class="tpl">${esc(tName(t))}${x.status==="pending"?` · <span class="st-pill pending" style="letter-spacing:0;text-transform:none">${L("Awaiting payment","Čeka uplatu")}</span>`:""}</p><h3>${esc(titleOf(t,x.data))}</h3><p class="when">${dt?esc(dt.full):L("No date set","Datum nije unet")}</p><div class="mini-stats"><span class="pill p-plain">${s.invited} ${L("invited","pozvano")}</span><span class="pill p-yes">${s.yes} ${L("coming","dolazi")}</span><span class="pill p-no">${s.no} ${L("declined","ne dolazi")}</span><span class="pill p-wait">${s.pending} ${L("waiting","čeka")}</span></div></div></a>`}).join("")}</div>`
 :`<div class="empty"><div style="width:160px">${tiltWrap(renderCard(TM.blossom,null,{fixed:true}))}</div><h2>${L("Your first invitation awaits","Vaša prva pozivnica vas čeka")}</h2><p>${L("Choose a design, add your details and you'll get a link to send to your guests.","Izaberite dizajn, unesite detalje i dobićete link koji šaljete gostima.")}</p><a class="btn btn-gold" href="#templates">${L("Browse designs","Pogledaj dizajne")}</a></div>`}</div>`;
}
function vCreate(r){
 return (async()=>{
 let inv=null,t,data;
 if(r.name==="edit"){const res=await API.get(r.a);inv=res.invitation;t=TM[inv.templateId]||T[0];data={...defaultsOf(t,inv.data.lang||LANG),...inv.data}}
 else{t=TM[r.a];if(!t)return go("templates");data={...defaultsOf(t),lang:LANG}}
 if(!data.lang)data.lang=LANG;
 const draw=()=>{
  const sibs=t.tier?SHOW().filter(x=>x.tier===t.tier):T.filter(x=>x.cat===t.cat);const flds=fieldsOf(t);
  const byG={};flds.forEach(k=>(byG[FD[k].g]=byG[FD[k].g]||[]).push(k));
  const fld=k=>{const f=FD[k],id="f-"+k,val=esc(data[k]??"");
   if(f.t==="photo"){const has=PHOTO_RE.test(data[k]||"");return`<div class="ph-fld${has?" has":""}" id="w-${k}"><span class="thumb" style="${has?`background-image:url('${data[k]}')`:""}">${has?"":ic("plus")}</span><span style="min-width:0;flex:1"><b style="display:block;font-size:14px">${esc(labelOf(t,k))}</b><span class="acts"><label class="btn btn-line btn-sm" for="${id}">${has?L("Change","Promeni"):L("Add photo","Dodaj fotografiju")}</label>${has?`<button type="button" class="btn btn-ghost btn-sm" data-rmph="${k}">${L("Remove","Ukloni")}</button>`:""}</span></span><input type="file" accept="image/*" id="${id}" data-ph="${k}"></div>`}
   return`<div class="fld" id="w-${k}"><label for="${id}">${esc(labelOf(t,k))}</label>${f.t==="area"?`<textarea id="${id}" data-k="${k}" maxlength="600">${val}</textarea>`:`<input id="${id}" data-k="${k}" type="${f.t==="date"?"date":f.t==="time"?"time":"text"}" value="${val}" maxlength="120"${f.ph?` placeholder="${esc(pick(f.ph))}"`:""}>`}</div>`};
  app.innerHTML=`<div class="view wrap"><div class="builder" id="bld" data-tab="form"><div class="left">
   <div class="b-head"><a class="btn btn-ghost btn-sm" href="${inv?"#manage-"+inv.id:"#templates"}" style="margin-left:-16px">${ic("back")} ${inv?L("Back to invitation","Nazad na pozivnicu"):L("All designs","Svi dizajni")}</a><p class="kicker" style="margin-top:12px">${catName(t.cat)} · ${esc(tName(t))}</p><h1>${inv?L("Edit your invitation","Izmenite pozivnicu"):L("Make it yours","Prilagodite pozivnicu")}</h1><p>${L("Type in the fields, or click any text on the card to jump straight to it.","Upišite podatke u polja ili kliknite na tekst na pozivnici da odmah pređete na njega.")}</p></div>
   <div class="card-lang"><span>${L("Invitation language","Jezik pozivnice")}</span><div class="lang" role="group"><button type="button" data-cl="sr" class="${data.lang==="sr"?"on":""}">Srpski</button><button type="button" data-cl="en" class="${data.lang==="en"?"on":""}">English</button></div></div>
   ${t.tier?`<div class="pkg-box"><div><small>${L("Package","Paket")}</small><b>${tierName(t.tier)}</b></div><div class="amt">${priceTxt(t.tier)}${PAYMENTS?`<small>${L("You pay once the invitation is ready","Plaćate kada je pozivnica gotova")}</small>`:""}</div></div>`:""}
   <div class="progress"><span id="pg-t"></span><span class="track"><i id="pg"></i></span></div>
   <div class="tabs-sm" role="tablist"><button class="on" data-tab="form">${L("Details","Detalji")}</button><button data-tab="preview">${L("Preview","Pregled")}</button></div>
   ${Object.keys(GROUPS).filter(g=>byG[g]).map(g=>{const ks=byG[g];const pair=ks.length>1&&g!=="words";return`<div class="group"><h3>${pick(GROUPS[g])}</h3>${g==="photos"?`<p style="color:var(--muted);font-size:14px;margin-top:-6px">${L("Photos are resized automatically. Use clear, bright pictures.","Fotografije se automatski smanjuju. Izaberite jasne i svetle slike.")}</p>`:""}<div class="${g==="photos"?"ph-grid":pair?"grid2":"form"}">${ks.map(fld).join("")}</div></div>`}).join("")}
   <p class="err" id="c-err"></p>
   <div class="save-bar"><button class="btn btn-gold" id="save">${inv?L("Save changes","Sačuvaj izmene"):(PAYMENTS?L("Save & continue to payment","Sačuvaj i nastavi na plaćanje"):L("Save & get my link","Sačuvaj i preuzmi link"))}</button><a class="btn btn-ghost" href="${inv?"#manage-"+inv.id:"#templates"}">${L("Cancel","Otkaži")}</a></div>
  </div><div class="preview" data-tilt-host><div id="pv" style="width:100%">${tiltWrap(renderCard(t,data,{anim:true}))}</div><p class="tip">${L("Click any text on the card to edit it","Kliknite na tekst na pozivnici da ga izmenite")}</p><button class="btn btn-ink btn-sm" id="gp">👁 ${L("Preview as a guest","Pogledaj kao gost")}</button></div></div></div>`;
  $("#play")?.addEventListener("click",()=>storyOverlay(t,{...data}));
  $("#exp")?.addEventListener("click",()=>expOverlay(t,{...data}));
  $("#gp")?.addEventListener("click",()=>guestPreview(t,{...data}));
  const prog=()=>{const k=flds.filter(k=>(data[k]??"").toString().trim()).length;$("#pg").style.width=k/flds.length*100+"%";$("#pg-t").textContent=L(`${k} of ${flds.length} details filled`,`Popunjeno ${k} od ${flds.length}`)};prog();
  const repaint=()=>{$("#pv").innerHTML=tiltWrap(renderCard(t,data));bindTilt($(".preview"))};
  $$("[data-ph]").forEach(el=>el.addEventListener("change",async()=>{const f=el.files&&el.files[0];if(!f)return;try{data[el.dataset.ph]=await shrink(f,FD[el.dataset.ph].max||600);const y=scrollY;draw();scrollTo(0,y)}catch(err){toast(err.message)}}));
  $$("[data-rmph]").forEach(b=>b.onclick=()=>{data[b.dataset.rmph]="";const y=scrollY;draw();scrollTo(0,y)});
  let tm;$$("[data-k]").forEach(el=>el.addEventListener("input",()=>{data[el.dataset.k]=el.value;prog();clearTimeout(tm);tm=setTimeout(repaint,120)}));
  $$("[data-cl]").forEach(b=>b.onclick=()=>{const nl=b.dataset.cl;if(nl===data.lang)return;const oldD=defaultsOf(t,data.lang),newD=defaultsOf(t,nl);fieldsOf(t).forEach(k=>{if((data[k]??"")===(oldD[k]??""))data[k]=newD[k]??""});data.lang=nl;const y=scrollY;draw();scrollTo(0,y)});
  $("#pv").addEventListener("click",e=>{const f=e.target.closest("[data-f]");if(!f)return;const k=f.dataset.f,inp=$("#f-"+k);if(!inp)return;if(inp.type==="file"){inp.click();return}if($("#bld").dataset.tab==="preview")$$(".tabs-sm button")[0].click();inp.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>inp.focus({preventScroll:true}),250);const w=$("#w-"+k);w.classList.remove("flash");void w.offsetWidth;w.classList.add("flash")});
  $$(".sw").forEach(b=>b.addEventListener("click",()=>{t=TM[b.dataset.t];const y=scrollY;draw();scrollTo(0,y)}));
  $$(".tabs-sm button").forEach(b=>b.addEventListener("click",()=>{$("#bld").dataset.tab=b.dataset.tab;$$(".tabs-sm button").forEach(x=>x.classList.toggle("on",x===b));if(b.dataset.tab==="preview"){$("#pv").innerHTML=tiltWrap(renderCard(t,data,{anim:true}))}}));
  $("#save").addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;$("#c-err").textContent="";const clean={lang:data.lang};fieldsOf(t).forEach(k=>clean[k]=(data[k]??"").toString());
   try{if(inv){await API.update(inv.id,t.id,clean);toast(L("Changes saved","Izmene su sačuvane"));go("manage-"+inv.id)}else{const n=await API.create(t.id,clean);toast(L("Invitation saved","Pozivnica je sačuvana"));go((PAYMENTS?"pay-":"manage-")+n.id)}}catch(err){$("#c-err").textContent=err.message;b.disabled=false}});
  bindTilt(app);
 };draw();})();
}

async function vPay(r){
 const res=await API.get(r.a);const inv=res.invitation,t=TM[inv.templateId]||T[0];const k=t.tier||inv.tier;
 if(!PAYMENTS||!k||inv.status!=="pending"){go("manage-"+inv.id);return}
 const title=titleOf(t,inv.data);
 app.innerHTML=`<div class="view wrap paypage"><ol class="pp-steps" aria-label="${L("Steps","Koraci")}"><li class="done"><b>✓</b>${L("Design","Dizajn")}</li><li class="done"><b>✓</b>${L("Your details","Vaši podaci")}</li><li class="on"><b>3</b>${L("Payment","Plaćanje")}</li></ol>
 <div class="pp-grid"><div class="pp-card" data-tilt-host>${tiltWrap(renderCard(t,inv.data,{fixed:true}))}<p class="pp-t">${esc(title)}</p></div>
 <div class="pp-main"><div id="pay">${payHTML(inv,t)}</div>
  <div class="pp-next"><a class="btn btn-gold" href="#manage-${inv.id}">${L("Go to my invitation","Idi na moju pozivnicu")} <span aria-hidden="true">→</span></a><a class="btn btn-ghost" href="#edit-${inv.id}">${ic("edit")} ${L("Edit details","Izmeni podatke")}</a></div>
  <p class="pp-hint">${L("You can add guests and copy your link right away. Guests can open it as soon as the payment is confirmed.","Goste i link možete pripremiti odmah. Gosti mogu da otvore pozivnicu čim potvrdimo uplatu.")}</p></div></div></div>`;
 bindTilt(app);
 $("#sim-pay")?.addEventListener("click",async()=>{await API.setStatus(inv.id,"active");toast(L("Marked as paid","Označeno kao plaćeno"));go("manage-"+inv.id)});
}

/* ---------- picture + title for shared links ---------- */
const PREV_BUSY=new Set();
async function sharePreview(inv,t){
 if(API.kind!=="server"||!API.preview||PREV_BUSY.has(inv.id))return;
 if(inv.og&&inv.og.v>=(inv.updatedAt||0))return;
 PREV_BUSY.add(inv.id);
 try{
  const lg=inv.data.lang||LANG,d={...defaultsOf(t,lg),...inv.data,lang:lg},dt=pd(d.date,lg),tm=d.time||d.ceremonyTime||"";
  const place=[d.venue||d.ceremonyVenue||d.church,d.address].filter(Boolean).join(", ");
  const desc=[dt?dt.full+(tm?(lg==="sr"?` u ${tm}`:` at ${tm}`):""):"",place].filter(Boolean).join(" · ")||(lg==="sr"?"Otvorite pozivnicu i potvrdite dolazak.":"Open the invitation and let the host know if you can come.");
  const blob=await cardToJpg(t,d,"",{blob:true,scale:1.5,quality:.86});
  const image=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});
  const r=await API.preview(inv.id,{image,title:titleOf(t,d),desc});inv.og=r.og;
 }catch(e){console.warn("preview",e)}finally{PREV_BUSY.delete(inv.id)}
}
async function vManage(r){
 const res=await API.get(r.a);const inv=res.invitation,t=TM[inv.templateId]||T[0];let gs=res.guests;let filter="all";
 setTimeout(()=>sharePreview(inv,t),900);
 const lg=inv.data.lang||LANG;const link=API.link(inv.slug);const d={...defaultsOf(t,lg),...inv.data};const dt=pd(d.date);const dtL=pd(d.date,lg);const title=titleOf(t,inv.data);
 const msg=lg==="sr"?`Pozvani ste: ${title}${dtL?" · "+dtL.full:""}`:`You're invited: ${title}${dtL?" · "+dtL.full:""}`;const tgt=API.kind==="local"?"_self":"_blank";
 app.innerHTML=`<div class="view wrap">
 <div class="m-top"><div class="thumbcol" data-tilt-host>${tiltWrap(renderCard(t,inv.data,{fixed:true}))}</div><div style="min-width:0">
  <a class="btn btn-ghost btn-sm" href="#dashboard" style="margin-left:-16px">${ic("back")} ${L("My invitations","Moje pozivnice")}</a>
  <p class="kicker" style="margin-top:10px">${esc(tName(t))} · ${catName(t.cat)}</p><h1>${esc(title)}</h1><p style="color:var(--muted);margin-top:8px">${dt?esc(dt.full):L("No date set","Datum nije unet")}</p>
  <div class="m-actions"><a class="btn btn-line btn-sm" href="#edit-${inv.id}">${ic("edit")} ${L("Edit","Izmeni")}</a><a class="btn btn-line btn-sm" href="${esc(link)}" target="${tgt}" rel="noopener">${ic("eye")} ${L("View as guest","Pogledaj kao gost")}</a><span id="jpgw">${(inv.status||"active")==="active"?`<button class="btn btn-gold btn-sm" id="jpg">⬇ ${L("Download JPG","Preuzmi JPG")}</button>`:""}</span><button class="btn btn-danger btn-sm" id="del">${ic("trash")} ${L("Delete","Obriši")}</button></div>
  <div id="pay">${payHTML(inv,t)}</div><div id="ov"></div></div></div>
 <div class="m-grid"><section class="panel glist"><h3>${L("Guest list","Spisak gostiju")}</h3><p class="hint">${L("Add each guest to give them a personal link. You'll see when they open it and how they reply. Guests who answer through the shared link appear here too.","Dodajte goste da biste svakom poslali lični link. Videćete kada ga otvore i šta odgovore. Gosti koji odgovore preko zajedničkog linka takođe se pojavljuju ovde.")}</p>
  <form class="addg" id="ag"><div class="fld"><label for="g-name">${L("Guest name","Ime gosta")}</label><input id="g-name" placeholder="${L("The Petrović family","Porodica Petrović")}" maxlength="80" required></div><div class="fld"><label for="g-contact">${L("Phone or email (optional)","Telefon ili imejl (nije obavezno)")}</label><input id="g-contact" placeholder="+381 64 123 4567" maxlength="80"></div><button class="btn btn-ink" type="submit">${ic("plus")} ${L("Add guest","Dodaj gosta")}</button></form>
  <div class="chips" id="gf"></div><div id="gt" style="margin-top:14px"></div></section>
 <aside class="panel share"><h3>${L("Share","Podeli")}</h3><p class="hint">${L("One link for everyone. Guests type their name when they reply.","Jedan link za sve. Gosti upisuju svoje ime kada odgovaraju.")}</p>
  <div class="linkbox"><input id="ln" value="${esc(link)}" readonly aria-label="${L("Invitation link","Link pozivnice")}"><button class="btn btn-ink btn-sm" id="cp">${ic("copy")} ${L("Copy","Kopiraj")}</button></div>
  <div class="share-row"><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg+"\n"+link)}">${ic("chat")} WhatsApp</a><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="viber://forward?text=${encodeURIComponent(msg+"\n"+link)}">${ic("chat")} Viber</a><button class="btn btn-line btn-sm" id="sh" hidden>${ic("share")} ${L("Share…","Podeli…")}</button></div>
  ${API.kind==="local"?`<p class="note-box">${L("You're in preview mode, so links open only in this browser. Once the site runs on its server, anyone you send the link to can open it and reply.","Ovo je probni režim, pa se linkovi otvaraju samo u ovom pregledaču. Kada sajt bude postavljen na server, svako kome pošaljete link moći će da ga otvori i odgovori.")}</p>`:""}
 </aside></div></div>`;
 const C=2*Math.PI*60;
 const drawOv=()=>{const s=statsOf(gs),tot=s.invited||1;const seg=(v,off,cls)=>!v?"":`<circle class="seg ${cls}" r="60" cx="75" cy="75" stroke-dasharray="${v/tot*C} ${C}" stroke-dashoffset="${-off/tot*C}"/>`;
  $("#ov").innerHTML=`<div class="overview"><div class="donut"><svg viewBox="0 0 150 150"><circle class="bg" r="60" cx="75" cy="75"/>${s.invited?seg(s.yes,0,"y")+seg(s.no,s.yes,"n")+seg(s.pending,s.yes+s.no,"w"):""}</svg><div class="ctr"><b>${s.invited?Math.round((s.yes+s.no)/tot*100):0}%</b><span>${L("Replied","Odgovorilo")}</span></div></div>
  <div class="tiles"><div class="tile"><b>${s.invited}</b><span>${L("Invited","Pozvano")}</span><small>${s.opened} ${L("opened","otvorilo")}</small></div><div class="tile t-yes"><b>${s.yes}</b><span>${L("Coming","Dolazi")}</span><small>${s.people} ${L(s.people===1?"person":"people",s.people===1?"osoba":"osoba")}</small></div><div class="tile t-no"><b>${s.no}</b><span>${L("Declined","Ne dolazi")}</span></div><div class="tile t-wait"><b>${s.pending}</b><span>${L("Waiting","Čeka se")}</span></div></div></div>`};
 const fmtAgo=ts=>{if(!ts)return"";const m=Math.round((Date.now()-ts)/6e4);return m<1?L("just now","upravo sada"):m<60?L(`${m} min ago`,`pre ${m} min`):m<1440?L(`${Math.round(m/60)} h ago`,`pre ${Math.round(m/60)} h`):new Date(ts).toLocaleDateString(LANG==="sr"?"sr-Latn":"en-GB",{day:"numeric",month:"short"})};
 const drawGuests=()=>{const s=statsOf(gs);$("#gf").innerHTML=[["all",L("All","Svi"),s.invited],["yes",L("Coming","Dolaze"),s.yes],["no",L("Declined","Ne dolaze"),s.no],["pending",L("Waiting","Čeka se"),s.pending]].map(([k,l,n])=>`<button class="chip${filter===k?" on":""}" data-f="${k}">${l}<span class="n">${n}</span></button>`).join("");
  $$("#gf .chip").forEach(b=>b.onclick=()=>{filter=b.dataset.f;drawGuests()});
  const rows=gs.filter(g=>filter==="all"||g.status===filter);
  $("#gt").innerHTML=rows.length?rows.map(g=>{const st=g.status==="yes"?`<span class="pill p-yes">${L("Coming","Dolazi")}${g.count>1?" · "+g.count:""}</span>`:g.status==="no"?`<span class="pill p-no">${L("Declined","Ne dolazi")}</span>`:`<span class="pill p-wait">${g.openedAt?L("Opened","Otvoreno"):L("Not opened","Nije otvoreno")}</span>`;const gl=API.link(inv.slug,g.token);const ph=(g.contact||"").replace(/[^\d]/g,"");
   return`<div class="grow"><div class="av">${esc((g.name||"?").charAt(0).toUpperCase())}</div><div style="min-width:0"><div class="gname">${esc(g.name)}</div><div class="gsub">${st}${g.source==="link"?`<span>${L("via shared link","preko zajedničkog linka")}</span>`:""}${g.contact?`<span>${esc(g.contact)}</span>`:""}${g.respondedAt?`<span>${L("replied","odgovor")} ${fmtAgo(g.respondedAt)}</span>`:g.openedAt?`<span>${L("opened","otvoreno")} ${fmtAgo(g.openedAt)}</span>`:""}</div>${g.note?`<p class="gnote">“${esc(g.note)}”</p>`:""}</div>
   <div class="gact">${g.source==="personal"?`<button class="icon-btn" data-copy="${esc(gl)}" title="${L("Copy personal link","Kopiraj lični link")}" aria-label="${L("Copy personal link","Kopiraj lični link")}: ${esc(g.name)}">${ic("link")}</button><a class="icon-btn" target="_blank" rel="noopener" href="https://wa.me/${ph.length>6?ph:""}?text=${encodeURIComponent((lg==="sr"?`Dragi/a ${g.name}, `:`Dear ${g.name}, `)+msg+"\n"+gl)}" title="${L("Send on WhatsApp","Pošalji preko WhatsApp-a")}" aria-label="WhatsApp: ${esc(g.name)}">${ic("chat")}</a>`:""}<button class="icon-btn" data-ed="${g.id}" title="${L("Edit guest","Izmeni gosta")}" aria-label="${L("Edit","Izmeni")} ${esc(g.name)}">${ic("edit")}</button><button class="icon-btn" data-rm="${g.id}" title="${L("Remove guest","Ukloni gosta")}" aria-label="${L("Remove","Ukloni")} ${esc(g.name)}">${ic("trash")}</button></div></div>`}).join("")
   :`<p style="color:var(--muted);padding:22px 0;border-top:2px dashed var(--line)">${filter==="all"?L("No guests yet. Add someone above, or send the shared link and replies will appear here.","Još nema gostiju. Dodajte nekoga iznad ili pošaljite zajednički link i odgovori će se pojaviti ovde."):L("Nobody in this group yet.","Još nema nikoga u ovoj grupi.")}</p>`;
  $$("[data-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.copy));
  // fix a guest's reply by hand: name, coming or not, and how many people
  $$("[data-ed]").forEach(b=>b.onclick=()=>{const g=gs.find(x=>x.id===b.dataset.ed),row=b.closest(".grow");
   row.outerHTML=`<form class="grow gedit" data-gid="${g.id}"><div class="av">${esc((g.name||"?").charAt(0).toUpperCase())}</div><div class="ge-f">
    <div class="fld"><label for="ge-n">${L("Name","Ime")}</label><input id="ge-n" value="${esc(g.name)}" maxlength="80" required></div>
    <div class="ge-row"><div class="fld"><label for="ge-s">${L("Reply","Odgovor")}</label><select id="ge-s"><option value="yes"${g.status==="yes"?" selected":""}>${L("Coming","Dolazi")}</option><option value="no"${g.status==="no"?" selected":""}>${L("Declined","Ne dolazi")}</option><option value="pending"${g.status==="pending"?" selected":""}>${L("No reply yet","Još nije odgovorio/la")}</option></select></div>
    <div class="fld ge-c"><label for="ge-c">${L("Number of people","Broj osoba")}</label><div class="ge-step"><button type="button" class="icon-btn" data-step="-1" aria-label="${L("One fewer","Jedna osoba manje")}">−</button><input id="ge-c" type="number" inputmode="numeric" min="1" max="50" value="${Math.max(1,g.count||1)}"><button type="button" class="icon-btn" data-step="1" aria-label="${L("One more","Jedna osoba više")}">+</button></div></div></div>
    <div class="ge-act"><button class="btn btn-ink btn-sm" type="submit">${L("Save","Sačuvaj")}</button><button class="btn btn-ghost btn-sm" type="button" data-cancel>${L("Cancel","Otkaži")}</button></div></div></form>`;
   const f=$(`form.gedit[data-gid="${g.id}"]`),cnt=$("#ge-c",f),sel=$("#ge-s",f);const sync=()=>{$(".ge-c",f).hidden=sel.value!=="yes"};sync();sel.onchange=sync;
   $$("[data-step]",f).forEach(s=>s.onclick=()=>{cnt.value=Math.max(1,Math.min(50,(parseInt(cnt.value)||1)+ +s.dataset.step))});
   $("[data-cancel]",f).onclick=()=>drawGuests();$("#ge-n",f).focus();
   f.onsubmit=async e=>{e.preventDefault();const sb=$("[type=submit]",f);sb.disabled=true;try{const ng=await API.updateGuest(inv.id,g.id,{name:$("#ge-n",f).value,status:sel.value,count:cnt.value});Object.assign(g,ng);drawGuests();toast(L("Guest updated","Izmene su sačuvane"))}catch(err){sb.disabled=false;toast(err.message)}}});
  $$("[data-rm]").forEach(b=>b.onclick=async()=>{const g=gs.find(x=>x.id===b.dataset.rm);if(!await confirmBox(L("Remove this guest?","Ukloniti gosta?"),L(`${g.name} and their reply will be removed from the list. Their personal link will stop working.`,`${g.name} i njegov/njen odgovor biće uklonjeni sa spiska. Lični link više neće raditi.`),L("Remove","Ukloni")))return;try{await API.removeGuest(inv.id,g.id);gs=gs.filter(x=>x.id!==g.id);drawGuests();toast(L("Guest removed","Gost je uklonjen"))}catch(e){toast(e.message)}});
  drawOv();};
 drawGuests();
 const bindJpg=()=>$("#jpg")?.addEventListener("click",async e=>{const b=e.currentTarget,tx=b.innerHTML;b.disabled=true;b.textContent=L("Preparing…","Pripremam…");try{await cardToJpg(t,{...d},slugFile(title)+".jpg");toast(L("JPG downloaded","JPG je preuzet"))}catch(err){toast(L("Couldn't create the image, please try again.","Slika nije napravljena, pokušajte ponovo."))}b.disabled=false;b.innerHTML=tx});bindJpg();
 $("#sim-pay")?.addEventListener("click",async()=>{await API.setStatus(inv.id,"active");inv.status="active";$("#pay").innerHTML="";$("#jpgw").innerHTML=`<button class="btn btn-gold btn-sm" id="jpg">⬇ ${L("Download JPG","Preuzmi JPG")}</button>`;bindJpg();toast(L("Marked as paid. The guest link is live.","Označeno kao plaćeno. Link za goste je aktivan."))});
 $("#ag").addEventListener("submit",async e=>{e.preventDefault();const n=$("#g-name").value.trim();if(!n){$("#g-name").focus();return}try{const g=await API.addGuest(inv.id,n,$("#g-contact").value);gs.push(g);filter="all";$("#g-name").value="";$("#g-contact").value="";drawGuests();$("#g-name").focus();toast(L(`${g.name} added. Copy or send their personal link.`,`Gost ${g.name} je dodat. Kopirajte ili pošaljite lični link.`))}catch(err){toast(err.message)}});
 $("#cp").addEventListener("click",()=>copy(link,$("#ln")));
 if(navigator.share){$("#sh").hidden=false;$("#sh").onclick=()=>navigator.share({title,text:msg,url:link}).catch(()=>{})}
 $("#del").addEventListener("click",async()=>{if(!await confirmBox(L("Delete this invitation?","Obrisati pozivnicu?"),L("The link will stop working and all replies will be deleted. This can't be undone.","Link će prestati da radi i svi odgovori će biti obrisani. Ovo se ne može poništiti."),L("Delete invitation","Obriši pozivnicu")))return;try{await API.remove(inv.id);toast(L("Invitation deleted","Pozivnica je obrisana"));go("dashboard")}catch(e){toast(e.message)}});
}
async function vInvite(r){
 const slug=r.a;let token=r.b||LS.get("paperlace.rsvp."+slug,null);
 let res;try{res=await API.pub(slug,token)}catch(e){if(r.b)throw e;token=null;res=await API.pub(slug,null)}
 if(res.inactive){app.innerHTML=inactiveHTML();return}
 if(token&&!res.guest&&!r.b){token=null;LS.del("paperlace.rsvp."+slug)}
 const t=TM[res.invitation.templateId]||T[0];if(t.exp==="sky")loadSky().catch(()=>{});if(t.exp==="balloon")loadBalloons().catch(()=>{});if(t.exp==="gold")loadRecord().catch(()=>{});if(t.exp==="disco")loadMirrorBall().catch(()=>{});const cardLang=res.invitation.data.lang||"sr";
 {const bg=EXP_BG[t.id]||EXP_BG[t.exp]||"#FBF5F0";document.documentElement.style.setProperty("--boot-bg",bg);document.querySelector('meta[name="theme-color"]')?.setAttribute("content",bg)}
 if(!LANG_PICKED&&!vInvite.done&&cardLang!==LANG){setLang(cardLang);LS.del("paperlace.lang")}vInvite.done=1;
 const data={...defaultsOf(t,cardLang),...res.invitation.data,lang:cardLang};let guest=res.guest;
 const p=t.pal;document.documentElement.style.setProperty("--g-tint",p.bg2);
 const title=titleOf(t,data),dt=pd(data.date,cardLang);
 const initial=(t.layout==="wedding"?(data.partner1||"").charAt(0)+(data.partner2||"").charAt(0):(data.childName||data.name||data.occasion||"P").charAt(0))||"P";
 const style=`--c-bg:${p.bg};--c-bg2:${p.bg2};--c-ink:${p.ink};--c-accent:${p.accent};--f-s:${t.font.s}`;
 const top=`<div class="guest-top">${langSwitch()}</div>`;
 if(t.exp){app.innerHTML=`<div class="view exp-view">${expOf(t)[0](t,data,{guest})}</div>`;const rt=RT;await settle(app);if(rt!==RT)return;bindLang($(".vx-top"));expOf(t)[1]($(".vx,.dx,.sb,.hy,.ps,.pq,.sk,.fw,.rp,.zv,.bn,.zp,.dn,.nz,.tl"),t,data,{opened:vInvite.opened===slug,onOpen:()=>{vInvite.opened=slug}});drawRsvp();return}
 app.innerHTML=`<div class="guest view">${top}<div class="env-stage">${guest?`<p class="to-line">${L("For","Za:")} ${esc(guest.name)}</p>`:`<p class="to-line">${L("You've received an invitation","Stigla vam je pozivnica")}</p>`}
  ${t.story?`<div class="story-host" id="sth"></div>`:`${envHTML(t,data,"env")}
  <p class="env-hint">${L("Tap the seal to open","Dodirnite pečat da otvorite")}<small>${esc(title)}</small></p>`}</div></div>`;
 bindLang($(".guest-top"));
 if(t.story&&vInvite.opened!==slug)playStory($("#sth"),t,data,()=>{vInvite.opened=slug;showCard()});
 if(!t.story)$("#env").addEventListener("click",()=>{const env=$("#env");if(env.classList.contains("open"))return;env.classList.add("open");vInvite.opened=slug;const rm=matchMedia("(prefers-reduced-motion:reduce)").matches;setTimeout(()=>envHandoff(env,()=>{showCard(true);return $(".guest .card-host")}),rm?50:(env.classList.contains("lacebox")?2500:1600))});
 function when(){if(!dt)return null;const tm=(data.time||data.ceremonyTime||"12:00").split(":").map(Number);const d=new Date(dt.y,dt.m-1,dt.d,tm[0]||0,tm[1]||0);return isNaN(d)?null:d}
 function showCard(fromEnv){
  const w=when(),place=[data.venue||data.ceremonyVenue||data.church,data.address].filter(Boolean).join(", ");
  const pad=n=>String(n).padStart(2,"0");const fmt=x=>`${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const gcal=w?`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(w)}/${fmt(new Date(w.getTime()+4*36e5))}&location=${encodeURIComponent(place)}&details=${encodeURIComponent(location.href)}`:"";
  const maps=place?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`:"";
  $(".guest").innerHTML=`${top}${guest?`<p class="to-line">${L("For","Za:")} ${esc(guest.name)}</p>`:""}<div class="card-host" data-tilt-host style="width:100%;display:flex;flex-direction:column;align-items:center">${cardFace(t,data,fromEnv?{fx:true}:{anim:true})}</div>${(()=>{const dc=detailsHTML(t,data);return dc?`<div class="kd-host${fromEnv?" after-env":""}">${dc}</div>`:""})()}
  <div class="extras${fromEnv?" after-env":""}">${w&&w>Date.now()?`<div class="count" id="cd"></div>`:""}<div class="ext-links">${gcal?`<a class="btn btn-line btn-sm" href="${gcal}" target="_blank" rel="noopener">${ic("cal")} ${L("Add to calendar","Dodajte u kalendar")}</a>`:""}${maps?`<a class="btn btn-line btn-sm" href="${maps}" target="_blank" rel="noopener">${ic("pin")} ${L("Directions","Kako stići")}</a>`:""}${t.story?`<button class="btn btn-line btn-sm" id="replay">▶ ${L("Watch again","Pogledaj ponovo")}</button>`:""}</div>
  <section class="panel rsvp${fromEnv?" after-env":""}" id="rsvp"></section><p class="powered">${L("Sent with","Poslato preko")} <a href="${API.kind==="local"?"#":"/"}">Poziv na klik</a> · ${igLink("pw-ig")}</p></div>`;
  bindLang($(".guest-top"));bindTilt($(".guest"),6);bindFlip($(".guest"));
  $("#replay")?.addEventListener("click",()=>storyOverlay(t,data));
  if($("#cd")){const tick=()=>{const ms=w-Date.now();if(ms<=0||!$("#cd"))return;const dd=Math.floor(ms/864e5),hh=Math.floor(ms/36e5)%24,mm=Math.floor(ms/6e4)%60,ss=Math.floor(ms/1e3)%60;$("#cd").innerHTML=[[dd,L("Days","Dana")],[hh,L("Hours","Sati")],[mm,L("Minutes","Minuta")],[ss,L("Seconds","Sekundi")]].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join("");setTimeout(tick,1000)};tick()}
  drawRsvp();
 }
 const shown=vInvite.opened===slug||t.tier==="basic";if(shown)showCard();
 await settle(app,shown?"":`<div class="guest"><div class="card-host">${cardFace(t,data,{fx:true})}</div><div class="kd-host">${detailsHTML(t,data)}</div></div>`);
 function drawRsvp(edit){
  const box=$("#rsvp");const rs=pd(data.rsvpBy);
  if(guest&&guest.status!=="pending"&&guest.status&&!edit){const y=guest.status==="yes";box.innerHTML=`<div class="thanks">${t.exp?`<div class="vx-stamp">${y?L("Seat reserved","Mesto rezervisano"):L("Reply received","Odgovor primljen")}<small>${ticketNo(data)}</small></div>`:`<p class="kicker">${L("Reply received","Odgovor je primljen")}</p>`}<p class="big">${y?L("See you there!","Vidimo se!"):L("Thank you for letting us know","Hvala što ste nam javili")}</p><p style="color:var(--muted)">${y?(guest.count>1?L(`You replied that ${guest.count} of you are coming. The host has your answer.`,`Odgovorili ste da dolazite (${guest.count} osobe). Domaćin je dobio vaš odgovor.`):L("You replied that you're coming. The host has your answer.","Odgovorili ste da dolazite. Domaćin je dobio vaš odgovor.")):L("You replied that you can't make it. The host has your answer.","Odgovorili ste da ne možete da dođete. Domaćin je dobio vaš odgovor.")}</p>${guest.note?`<p class="gnote">“${esc(guest.note)}”</p>`:""}<button class="btn btn-line btn-sm" id="chg">${L("Change my reply","Promeni odgovor")}</button></div>`;$("#chg").onclick=()=>drawRsvp(true);return}
  let st=guest&&guest.status!=="pending"?guest.status:"",cnt=guest&&guest.count>0?guest.count:1;
  box.innerHTML=`<p class="kicker">${L("RSVP","Potvrda dolaska")}</p><h2 style="margin-top:10px">${t.exp?L("Save your seat","Rezervišite svoje mesto"):L("Will you join us?","Da li dolazite?")}</h2><p class="sub">${rs?L(`Please reply by ${rs.short}`,`Molimo odgovorite do ${rs.short}`):L("Please let the host know","Javite domaćinu")}</p>
  <form class="form" id="rf" novalidate>${guest&&guest.source==="personal"?`<p style="text-align:center">${L("Replying as","Odgovarate kao")} <b>${esc(guest.name)}</b></p>`:`<div class="fld"><label for="r-name">${L("Your name","Vaše ime")}</label><input id="r-name" autocomplete="name" maxlength="80" value="${esc(guest?.name||"")}" placeholder="${L("First and last name","Ime i prezime")}"></div>`}
  <div class="choice" role="radiogroup" aria-label="${L("Your reply","Vaš odgovor")}"><button type="button" class="y${st==="yes"?" on":""}" data-s="yes" role="radio" aria-checked="${st==="yes"}"><b>${L("Joyfully accept","Rado dolazim")}</b></button><button type="button" class="n${st==="no"?" on":""}" data-s="no" role="radio" aria-checked="${st==="no"}"><b>${L("Regretfully decline","Nažalost, ne mogu")}</b></button></div>
  <div class="fld" id="cntw"${st==="yes"?"":" hidden"}><label>${L("Number of guests, including you","Broj osoba, uključujući vas")}</label><div class="stepper"><button type="button" id="mn" aria-label="${L("Fewer guests","Manje osoba")}">−</button><output id="cn">${cnt}</output><button type="button" id="pl" aria-label="${L("More guests","Više osoba")}">+</button></div></div>
  <div class="fld"><label for="r-note">${L("A note for the host (optional)","Poruka za domaćina (nije obavezno)")}</label><textarea id="r-note" maxlength="500" placeholder="${L("Dietary needs, a kind word…","Posebna ishrana, lepa reč…")}">${esc(guest?.note||"")}</textarea></div>
  <p class="err" id="r-err"></p><button class="btn btn-ink" type="submit">${L("Send my reply","Pošalji odgovor")}</button></form>`;
  $$(".choice button",box).forEach(b=>b.onclick=()=>{st=b.dataset.s;$$(".choice button",box).forEach(x=>{x.classList.toggle("on",x===b);x.setAttribute("aria-checked",x===b)});$("#cntw").hidden=st!=="yes"});
  $("#mn").onclick=()=>{cnt=Math.max(1,cnt-1);$("#cn").textContent=cnt};$("#pl").onclick=()=>{cnt=Math.min(20,cnt+1);$("#cn").textContent=cnt};
  $("#rf").addEventListener("submit",async e=>{e.preventDefault();const b=$("button[type=submit]",e.target);$("#r-err").textContent="";if(!st){$("#r-err").textContent=L("Please choose whether you can come.","Izaberite da li dolazite.");return}
   const name=$("#r-name")?.value.trim();if($("#r-name")&&!name){$("#r-err").textContent=L("Please enter your name so the host knows who replied.","Upišite ime da bi domaćin znao ko je odgovorio.");$("#r-name").focus();return}
   b.disabled=true;try{const out=await API.rsvp(slug,{token:guest?.token||token,name,status:st,count:cnt,note:$("#r-note").value});guest=out.guest;token=out.token;if(guest.source==="link")LS.set("paperlace.rsvp."+slug,out.token);if(st==="yes")confetti([p.accent,p.soft,p.x1,p.bg2]);drawRsvp();$("#rsvp").scrollIntoView({behavior:"smooth",block:"center"})}catch(err){$("#r-err").textContent=err.message;b.disabled=false}});
 }
}
function confetti(colors){if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;const c=document.createElement("canvas");c.className="confetti";document.body.appendChild(c);const x=c.getContext("2d");const W=c.width=innerWidth*devicePixelRatio,H=c.height=innerHeight*devicePixelRatio;const P=Array.from({length:140},()=>({x:W/2,y:H*.55,vx:(Math.random()-.5)*W*.02,vy:-Math.random()*H*.026-H*.006,r:Math.random()*6+4,a:Math.random()*6,va:(Math.random()-.5)*.3,c:colors[Math.floor(Math.random()*colors.length)]}));let f=0;(function loop(){x.clearRect(0,0,W,H);P.forEach(p=>{p.vy+=H*.0006;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.va;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-f/170);x.fillRect(-p.r,-p.r/2,p.r*2,p.r*devicePixelRatio);x.restore()});if(++f<170)requestAnimationFrame(loop);else c.remove()})()}


/* ---------- justify running text everywhere (not the invitation designs themselves) ---------- */
(function(){
 const SKIP=".ps,.rp,.sk,.fw,.dn,.nz,.tl,.ft3-big,.ft3-sub,.h3-row,.h3-stage,.ft2-big,.ft2-copy,.inv,.inv-c,.bd-hero,.btn,button,nav,.hdr,.kicker,.chips,.choice,label,.pk-sig,.p2-n,.dx-k,.dx-open,.lang,.toast,.mock,.h2-fan,.ticker,.cb-in,.newpw,.st-pill";
 const SEL="#app p,#app li,#ft p,.story-ov p";
 const fix=el=>{if(el.classList.contains("jt")||el.closest(SKIP))return;const ta=getComputedStyle(el).textAlign;if(ta==="center")el.style.textAlignLast="center";else if(ta==="right"||ta==="end")el.style.textAlignLast="right";el.classList.add("jt")};
 // Runs in the same frame the text is added (observer callbacks run before the browser paints),
 // and only on the new nodes, so paragraphs never visibly re-flow after they appear.
 const run=nodes=>{for(const n of nodes){if(n.nodeType!==1)continue;if(n.matches(SEL))fix(n);n.querySelectorAll("p,li").forEach(el=>{if(el.matches(SEL))fix(el)})}};
 new MutationObserver(list=>{for(const m of list)run(m.addedNodes)}).observe(document.body,{childList:true,subtree:true});run([document.body]);
})();

/* ---------- opening envelope when the site is first opened ---------- */
(function(){
 const box=document.getElementById("intro");if(!box||!document.documentElement.classList.contains("intro-on"))return;
 let done=false;
 const finish=()=>{if(done)return;done=true;try{sessionStorage.setItem("pk.intro","1")}catch(e){}box.classList.add("bye");setTimeout(()=>{document.documentElement.classList.remove("intro-on");box.remove()},1000)};
 const open=()=>{if(box.classList.contains("open"))return;box.classList.add("open");setTimeout(finish,3000)};
 box.querySelector(".in-seal").addEventListener("click",open);
 box.querySelector(".in-stage").addEventListener("click",open);
 box.querySelector(".in-skip").addEventListener("click",e=>{e.stopPropagation();finish()});
 // start (and count down to the automatic opening) only once the logo, seal and font are ready
 const html=document.documentElement;let started=false;
 const start=()=>{if(started)return;started=true;html.classList.add("intro-ready");setTimeout(open,2600)};
 const{urls,fonts}=assetsOf(box);
 Promise.race([Promise.all([...[...urls].map(loadImg),...[...fonts].map(([f,t])=>document.fonts?document.fonts.load(f,t||"Aa").catch(()=>{}):0)]),new Promise(r=>setTimeout(r,2500))]).then(start);
 if(document.documentElement.lang==="en"||(localStorage.getItem("paperlace.lang")||"")==="en"){box.querySelector(".in-hint").textContent="Tap the seal to open";box.querySelector(".in-skip").textContent="Skip";box.querySelector(".in-card p").textContent="Your invitation. Your style. One click."}
})();
/* ---------- boot ---------- */

(async()=>{
 // both requests were already started in <head>; wait for them together, not one after the other
 const[me,cfg]=await Promise.allSettled([API.me(),API.kind==="server"?API.config():Promise.resolve({})]);
 ME=me.status==="fulfilled"?me.value:null;
 if(cfg.status==="fulfilled")PAYCFG=Object.assign(PAYCFG,cfg.value.payment||{});
 render();
})();
