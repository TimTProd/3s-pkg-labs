import {EPS,liangBarsky,cohenSutherland,cyrusBeck,convexValid,parseInput,aabbReject} from './geometry.js';
import {Quadtree,generate,boundsOf} from './spatial.js';
import {greinerHormann,parseRings,signedArea} from './polygon.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
export const state={segments:[],rect:[-8,-6,8,6],convex:JSON.parse($('convex').value),subject:[],clip:[],result:[],tree:null,scale:25,ox:0,oy:0,dirty:true,mode:'liang',cursor:0,frames:[],last:0,metrics:{},benchmark:null};
let drag=null,worker=null,animationStart=0;
const error=e=>{$('error').textContent=e?.message||String(e||'');};
function rebuild() {state.tree=new Quadtree(state.segments,boundsOf(state.segments),Number($('depth').value));state.dirty=true;}
function fromScreen(x,y) {return [(x-state.ox)/state.scale,(state.oy-y)/state.scale];}
function toScreen(p) {return [state.ox+p[0]*state.scale,state.oy-p[1]*state.scale];}
function fit() {
  state.ox=canvas.width/2;state.oy=canvas.height/2;
  let points=state.mode==='polygon'?[...state.subject.flat(),...state.clip.flat()]:state.segments.length>10000?[[-80,-60],[80,60]]:state.segments.flatMap(s=>[[s[0],s[1]],[s[2],s[3]]]);
  points.push(...rectRing());
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys);
  state.scale=Math.min(canvas.width/Math.max(2,b-a+6),canvas.height/Math.max(2,d-c+6));
  state.ox=canvas.width/2-(a+b)/2*state.scale;state.oy=canvas.height/2+(c+d)/2*state.scale;state.dirty=true;
}
function rectRing() {const [a,b,c,d]=state.rect;return [[a,b],[c,b],[c,d],[a,d]];}
function line(s,color,width=1) {
  const a=toScreen(s.slice(0,2)),b=toScreen(s.slice(2));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  if(Math.hypot(s[2]-s[0],s[3]-s[1])<=EPS){ctx.beginPath();ctx.arc(...a,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
}
function path(rings,color,fill=false) {
  ctx.beginPath();for(const r of rings){r.forEach((p,i)=>{const q=toScreen(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.closePath();}
  if(fill){ctx.fillStyle=color;ctx.fill('evenodd');}else{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}
}
function grid() {
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font='11px system-ui';
  const raw=75/state.scale,mag=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].map(x=>x*mag).find(x=>x>=raw);
  const [xmin,ymax]=fromScreen(0,0),[xmax,ymin]=fromScreen(canvas.width,canvas.height);
  ctx.textAlign='left';ctx.fillStyle='#637b89';
  for(let x=Math.ceil(xmin/step)*step;x<=xmax;x+=step){const px=toScreen([x,0])[0];ctx.beginPath();ctx.strokeStyle=Math.abs(x)<=EPS?'#8da5b3':'#e6edf2';ctx.moveTo(px,0);ctx.lineTo(px,canvas.height);ctx.stroke();ctx.fillText(Number(x.toPrecision(6)),px+3,Math.max(15,Math.min(canvas.height-6,state.oy+14)));}
  for(let y=Math.ceil(ymin/step)*step;y<=ymax;y+=step){const py=toScreen([0,y])[1];ctx.beginPath();ctx.strokeStyle=Math.abs(y)<=EPS?'#8da5b3':'#e6edf2';ctx.moveTo(0,py);ctx.lineTo(canvas.width,py);ctx.stroke();ctx.fillText(Number(y.toPrecision(6)),Math.max(4,Math.min(canvas.width-50,state.ox+4)),py-4);}
  ctx.fillText('x',canvas.width-12,Math.max(15,Math.min(canvas.height-8,state.oy-6)));ctx.fillText('y',Math.max(4,Math.min(canvas.width-14,state.ox+6)),14);
  ctx.fillText(`${state.scale.toFixed(2)} px / ед.`,canvas.width-125,canvas.height-12);
}
function clipBox() {
  if(state.mode!=='cyrus')return state.rect;
  const xs=state.convex.map(p=>p[0]),ys=state.convex.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
}
function draw() {
  const begin=performance.now();grid();
  const ops={mul:0,div:0};let candidates=0,accepted=0,queryMs=0,clipMs=0;
  if(state.mode==='polygon') {
    path(state.subject,'#73849b');path(state.result,'#06a57944',true);path(state.result,'#07916c');path(state.clip,'#cb6025');
    accepted=state.result.length;$('stats').textContent=`Контуров: ${accepted}; ориентированная площадь: ${state.result.reduce((a,r)=>a+signedArea(r),0).toFixed(5)}; правило even-odd`;
  } else {
    const [xmin,ymax]=fromScreen(0,0),[xmax,ymin]=fromScreen(canvas.width,canvas.height),view=[xmin,ymin,xmax,ymax];
    const q0=performance.now(),indexed=$('index').checked,ids=indexed?state.tree.query(view):state.segments.flatMap((s,i)=>aabbReject(s,view)?[]:[i]);
    const windowIds=indexed?state.tree.query(clipBox()):state.segments.flatMap((s,i)=>aabbReject(s,clipBox())?[]:[i]);queryMs=performance.now()-q0;candidates=windowIds.length;
    ctx.strokeStyle='#73849b88';ctx.lineWidth=1;ctx.beginPath();
    for(const id of ids){const s=state.segments[id],a=toScreen(s.slice(0,2)),b=toScreen(s.slice(2));ctx.moveTo(...a);ctx.lineTo(...b);}ctx.stroke();
    const c0=performance.now(),visible=[];
    for(const id of windowIds) {
      const s=state.segments[id],r=state.mode==='cyrus'?cyrusBeck(s,state.convex,ops):state.mode==='cohen'?cohenSutherland(s,state.rect,ops):liangBarsky(s,state.rect,ops);
      if(r)visible.push(r);
    }
    clipMs=performance.now()-c0;accepted=visible.length;
    for(const r of visible)line(r,'#07916c',2.5);
    const ring=state.mode==='cyrus'?state.convex:rectRing();path([ring],'#cb6025');
    ctx.fillStyle='#cb6025';for(const p of ring){ctx.beginPath();ctx.arc(...toScreen(p),4,0,Math.PI*2);ctx.fill();}
    if(state.segments.length<1000){ctx.fillStyle='#73849b';for(const s of state.segments)for(const p of [s.slice(0,2),s.slice(2)]){ctx.beginPath();ctx.arc(...toScreen(p),3,0,Math.PI*2);ctx.fill();}}
    const trace=[];if(state.segments.length)liangBarsky(state.segments[0],state.rect,{mul:0,div:0},trace);
    $('trace').textContent=JSON.stringify(trace,null,2);
    $('stats').textContent=`Умножений: ${ops.mul}; делений: ${ops.div}; алгоритм: ${$('mode').selectedOptions[0].textContent}`;
  }
  const renderMs=performance.now()-begin;
  state.metrics={count:state.segments.length,candidates,accepted,queryMs,clipMs,renderMs,ops};
  const fps=state.frames.length?1000/(state.frames.reduce((a,b)=>a+b,0)/state.frames.length):0;
  $('status').textContent=`Отрезков: ${state.segments.length.toLocaleString('ru')} | кандидатов: ${candidates} | видимых: ${accepted}\nИндекс: ${queryMs.toFixed(2)} мс | отсечение: ${clipMs.toFixed(2)} мс | весь draw: ${renderMs.toFixed(2)} мс\n${$('animate').checked?`FPS (последние ${state.frames.length} кадров): ${fps.toFixed(1)} | обновляется 1000 отрезков/кадр`:'Перетащите окно или отрезок. FPS измеряется в динамическом режиме.'}`;
}
function polyExample() {
  const key=$('polyExample').value;
  const outer=[[0,0],[12,0],[12,12],[0,12]];
  if(key==='hole'){state.subject=[outer,[[4,4],[8,4],[8,8],[4,8]]];state.clip=[[[-1,-1],[11,-1],[11,13],[-1,13]]];}
  else if(key==='self'){state.subject=[[[0,0],[12,12],[0,12],[12,0]]];state.clip=[[[2,-1],[10,-1],[10,13],[2,13]]];}
  else if(key==='vertex'){state.subject=[outer];state.clip=[[[6,0],[12,6],[6,12],[0,6]]];}
  else {state.subject=[[[0,0],[12,0],[12,12],[9,12],[9,3],[3,3],[3,12],[0,12]]];state.clip=[[[-1,6],[13,6],[13,10],[-1,10]]];}
  $('subject').value=JSON.stringify(state.subject);$('clip').value=JSON.stringify(state.clip);applyPoly();
}
function applyPoly() {state.subject=parseRings($('subject').value);state.clip=parseRings($('clip').value);state.result=greinerHormann(state.subject,state.clip);state.dirty=true;error('');}
function guarded(fn){return (...args)=>{try{fn(...args);}catch(e){error(e);}};}
$('load').onclick=guarded(()=>{const data=parseInput($('input').value);state.segments=data.segments;state.rect=data.rect;$('animate').checked=false;rebuild();fit();error('');});
$('file').onchange=async()=>{try{const f=$('file').files[0];if(f){$('input').value=await f.text();$('load').click();}}catch(e){error(e);}};
$('fit').onclick=fit;
$('example').onclick=()=>{if(state.mode==='polygon'){polyExample();fit();}else{$('input').value='7\n-16 0 16 0\n0 -12 0 12\n-8 -6 8 -6\n-8 -6 -8 -6\n-16 -12 16 12\n12 8 14 10\n-12 9 11 -8\n-8 -6 8 6';$('load').click();}};
$('mode').onchange=guarded(()=>{state.mode=$('mode').value;$('animate').checked=false;if(state.mode==='polygon'){polyExample();$('polygons').open=true;}fit();});
$('applyPoly').onclick=guarded(applyPoly);$('polyExample').onchange=guarded(()=>{polyExample();fit();});
$('setConvex').onclick=guarded(()=>{const p=JSON.parse($('convex').value);parseRings(JSON.stringify([p]));if(!convexValid(p))throw Error('Окно должно быть невырожденным выпуклым многоугольником');state.convex=p;state.dirty=true;error('');});
$('generate').onclick=guarded(()=>{const n=Number($('count').value),depth=Number($('depth').value);if(!Number.isInteger(n)||n<1||n>2000000||!Number.isInteger(depth)||depth<1||depth>12)throw Error('Число 1…2000000; глубина 1…12');state.segments=generate(n,Number($('density').value));state.rect=[-30,-30,30,30];state.cursor=0;state.frames=[];rebuild();fit();error('');});
$('add').onclick=()=>{state.segments.push([-5,-3,5,3]);rebuild();};
$('index').onchange=()=>state.dirty=true;
$('animate').onchange=()=>{animationStart=performance.now();state.frames=[];state.last=0;state.dirty=true;};
function distToSegment(p,a,b) {const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den<=EPS?0:Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
canvas.onpointerdown=e=>{
  const box=canvas.getBoundingClientRect(),pixel=[e.clientX-box.left,e.clientY-box.top],p=fromScreen(...pixel),tol=9/state.scale;
  canvas.setPointerCapture(e.pointerId);$('animate').checked=false;
  const ring=state.mode==='polygon'?state.clip[0]:state.mode==='cyrus'?state.convex:rectRing();
  drag={type:'pan',pixel,last:p};
  for(let i=0;i<ring.length;i++)if(Math.hypot(p[0]-ring[i][0],p[1]-ring[i][1])<tol){drag={type:'vertex',i,last:p};return;}
  const near=ring.some((a,i)=>distToSegment(p,a,ring[(i+1)%ring.length])<tol);
  if(near){drag={type:'window',last:p};return;}
  if(state.mode==='polygon') {
    for(let r=0;r<state.subject.length;r++)for(let i=0;i<state.subject[r].length;i++)if(Math.hypot(p[0]-state.subject[r][i][0],p[1]-state.subject[r][i][1])<tol){drag={type:'polyvertex',r,i,last:p};return;}
  } else {
    const ids=state.tree.query([p[0]-tol,p[1]-tol,p[0]+tol,p[1]+tol]);
    for(const id of ids){const s=state.segments[id];for(let k=0;k<2;k++)if(Math.hypot(p[0]-s[k*2],p[1]-s[k*2+1])<tol){drag={type:'endpoint',id,k,last:p};return;}}
    for(const id of ids){const s=state.segments[id];if(distToSegment(p,s.slice(0,2),s.slice(2))<tol){drag={type:'segment',id,last:p};return;}}
  }
};
canvas.onpointermove=guarded(e=>{
  if(!drag)return;
  const box=canvas.getBoundingClientRect(),pixel=[e.clientX-box.left,e.clientY-box.top],p=fromScreen(...pixel),dx=p[0]-drag.last[0],dy=p[1]-drag.last[1];
  if(drag.type==='pan'){state.ox+=pixel[0]-drag.pixel[0];state.oy+=pixel[1]-drag.pixel[1];drag.pixel=pixel;}
  else if(drag.type==='segment'||drag.type==='endpoint') {
    const s=state.segments[drag.id];for(let k=0;k<2;k++)if(drag.type==='segment'||k===drag.k){s[k*2]+=dx;s[k*2+1]+=dy;}state.tree.update(drag.id);
  } else if(state.mode==='polygon') {
    if(drag.type==='polyvertex'){state.subject[drag.r][drag.i]=p;}else if(drag.type==='vertex'){state.clip[0][drag.i]=p;}else{state.clip=state.clip.map(r=>r.map(q=>[q[0]+dx,q[1]+dy]));}
    state.result=greinerHormann(state.subject,state.clip);$('subject').value=JSON.stringify(state.subject);$('clip').value=JSON.stringify(state.clip);
  } else if(state.mode==='cyrus') {
    const next=state.convex.map((q,i)=>drag.type==='window'?[q[0]+dx,q[1]+dy]:i===drag.i?p:q);
    if(convexValid(next))state.convex=next;$('convex').value=JSON.stringify(state.convex);
  } else if(drag.type==='window'){state.rect=state.rect.map((v,i)=>v+(i%2?dy:dx));}
  else {const next=state.rect.slice(),i=drag.i;next[i===0||i===3?0:2]=p[0];next[i<2?1:3]=p[1];if(next[2]-next[0]>EPS&&next[3]-next[1]>EPS)state.rect=next;}
  drag.last=p;state.dirty=true;
});
canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
canvas.addEventListener('wheel',e=>{e.preventDefault();const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,p=fromScreen(x,y);state.scale=Math.max(.03,Math.min(1000,state.scale*Math.exp(-e.deltaY*.001)));state.ox=x-p[0]*state.scale;state.oy=y+p[1]*state.scale;state.dirty=true;},{passive:false});
function chart(rows,key,title) {
  const c=document.createElement('canvas');c.width=700;c.height=280;$('charts').append(c);const g=c.getContext('2d'),colors=['#1878ac','#d77728','#0b9976','#9456ae'];
  const max=Math.max(...rows.map(r=>r[key]))*1.15;g.fillStyle='#fff';g.fillRect(0,0,700,280);g.font='14px system-ui';g.fillStyle='#233c4c';g.fillText(title,45,22);
  for(let i=0;i<=4;i++){const y=230-i*45;g.strokeStyle='#dbe5eb';g.beginPath();g.moveTo(55,y);g.lineTo(670,y);g.stroke();g.fillText((max*i/4).toFixed(2),4,y+4);}
  [.5,1,2,4].forEach((density,i)=>{g.strokeStyle=colors[i];g.fillStyle=colors[i];g.fillText(`ρ=${density}`,80+i*145,265);g.beginPath();rows.filter(r=>r.density===density).forEach((r,j)=>{const x=90+j*175,y=230-r[key]/max*180;if(j)g.lineTo(x,y);else g.moveTo(x,y);g.fillText(String(r.depth),x,249);});g.stroke();});
  g.fillStyle='#233c4c';g.fillText('Глубина дерева; время, мс',400,22);
}
$('bench').onclick=()=>{
  if(worker)return;error('');$('bench').disabled=true;worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onerror=e=>{error(e.message);worker.terminate();worker=null;$('bench').disabled=false;};
  worker.onmessage=({data})=>{
    if(data.progress){$('bench').textContent=`Измерение ${data.progress.done}/${data.progress.total}`;return;}
    if(data.error)error(data.error);
    else {state.benchmark=data.result;$('charts').replaceChildren();chart(data.result.rows,'totalMs','Запрос + отсечение');chart(data.result.rows,'update1000Ms','Обновление 1000 отрезков');
      const table=document.createElement('table');table.innerHTML='<tr><th>Алгоритм / 500000</th><th>×</th><th>÷</th><th>мс</th></tr>'+data.result.operations.map(r=>`<tr><td>${r.name}</td><td>${r.mul}</td><td>${r.div}</td><td>${r.ms.toFixed(2)}</td></tr>`).join('');$('charts').append(table);const note=document.createElement('p'),full=data.result.rows.find(r=>r.fullUpdateMs!==null);note.textContent=`Полное обновление всех 500000 отрезков: ${full.fullUpdateMs.toFixed(2)} мс (ρ=1, глубина 7). Режим анимации обновляет только 1000 отрезков за кадр; 60 FPS при обновлении всей базы не заявляется.`;$('charts').append(note);$('download').disabled=false;}
    worker.terminate();worker=null;$('bench').disabled=false;$('bench').textContent='Измерить глубину и плотность';
  };worker.postMessage({});
};
$('download').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(state.benchmark,null,2)],{type:'application/json'}));a.href=url;a.download='lab5-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(()=>{const b=canvas.getBoundingClientRect();canvas.width=Math.round(b.width);canvas.height=Math.round(b.height);state.dirty=true;}).observe(canvas);
function frame(now) {
  if($('animate').checked&&state.mode!=='polygon') {
    if(state.last) {state.frames.push(now-state.last);if(state.frames.length>120)state.frames.shift();}state.last=now;
    const n=Math.min(1000,state.segments.length);
    for(let j=0;j<n;j++){const id=state.cursor++%state.segments.length,s=state.segments[id];const dx=Math.sin(id)*.04,dy=Math.cos(id)*.04;for(let k=0;k<2;k++){s[k*2]+=dx;s[k*2+1]+=dy;}state.tree.update(id);}
    const t=(now-animationStart)/1000,cx=Math.sin(t*.4)*25,cy=Math.cos(t*.3)*20;
    if(state.mode==='cyrus'){const b=clipBox(),dx=cx-(b[0]+b[2])/2,dy=cy-(b[1]+b[3])/2;state.convex=state.convex.map(p=>[p[0]+dx,p[1]+dy]);}
    else state.rect=[cx-30,cy-30,cx+30,cy+30];state.dirty=true;
  } else state.last=0;
  if(state.dirty){try{draw();error('');}catch(e){error(e);}$('error').textContent&&($('animate').checked=false);state.dirty=false;}
  requestAnimationFrame(frame);
}
$('load').click();polyExample();requestAnimationFrame(frame);
