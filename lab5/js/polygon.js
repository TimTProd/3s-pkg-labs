import {EPS} from './geometry.js';
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function signedArea(r) {let a=0;for(let i=0;i<r.length;i++)a+=cross(r[i],r[(i+1)%r.length]);return a/2;}
export function inside(p,rings) {
  let yes=false;
  for(const ring of rings) for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>p[1]+EPS)!==(b[1]>p[1]+EPS) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]-EPS) yes=!yes;
  }
  return yes;
}
function intersections(a,b) {
  const u=sub(a.b,a.a),v=sub(b.b,b.a),w=sub(b.a,a.a),den=cross(u,v);
  if(Math.abs(den)>EPS) {
    const t=cross(w,v)/den,q=cross(w,u)/den;
    if(t>=-EPS&&t<=1+EPS&&q>=-EPS&&q<=1+EPS) {a.ts.push(Math.max(0,Math.min(1,t)));b.ts.push(Math.max(0,Math.min(1,q)));}
  } else if(Math.abs(cross(w,u))<=EPS) {
    for(const [e,f] of [[a,b],[b,a]]) {
      const d=sub(e.b,e.a),axis=Math.abs(d[0])>Math.abs(d[1])?0:1;
      if(Math.abs(d[axis])<=EPS) continue;
      for(const p of [f.a,f.b]) {const t=(p[axis]-e.a[axis])/d[axis];if(t>=-EPS&&t<=1+EPS)e.ts.push(Math.max(0,Math.min(1,t)));}
    }
  }
}
function boundaryGraph(subject,clip) {
  const edges=[];
  for(const rings of [subject,clip]) for(const r of rings) for(let i=0;i<r.length;i++) {
    const a=r[i],b=r[(i+1)%r.length];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])>EPS) edges.push({a,b,ts:[0,1]});
  }
  if(edges.length>1200) throw Error('Не более 1200 рёбер для многоугольного режима');
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)intersections(edges[i],edges[j]);
  const verts=[],buckets=new Map(),arcs=[],used=new Set();
  function vertex(p) {
    const x=Math.floor(p[0]/EPS),y=Math.floor(p[1]/EPS);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const id of buckets.get(`${x+dx},${y+dy}`)||[]) if(Math.hypot(verts[id].p[0]-p[0],verts[id].p[1]-p[1])<=EPS)return id;
    const id=verts.length,k=`${x},${y}`;verts.push({p,out:[]});if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(id);return id;
  }
  const covered=p=>inside(p,subject)&&inside(p,clip);
  for(const e of edges) {
    e.ts.sort((a,b)=>a-b);
    for(let i=1;i<e.ts.length;i++) {
      const a=mix(e.a,e.b,e.ts[i-1]),b=mix(e.a,e.b,e.ts[i]),d=sub(b,a),len=Math.hypot(...d);
      if(len<=EPS)continue;
      const mid=mix(a,b,.5),off=Math.min(EPS*4,len*.001),nx=-d[1]/len*off,ny=d[0]/len*off;
      const l=covered([mid[0]+nx,mid[1]+ny]),r=covered([mid[0]-nx,mid[1]-ny]);
      if(l===r)continue;
      const from=vertex(l?a:b),to=vertex(l?b:a),key=`${from}:${to}`;
      if(from===to||used.has(key))continue;
      used.add(key);const id=arcs.length;arcs.push({from,to,visited:false});verts[from].out.push(id);
    }
  }
  const result=[];
  for(const start of arcs) {
    if(start.visited)continue;
    let edge=start;const ring=[];
    for(let k=0;k<=arcs.length;k++) {
      if(edge.visited)break;
      edge.visited=true;ring.push(verts[edge.from].p);
      if(edge.to===start.from)break;
      const p=verts[edge.from].p,q=verts[edge.to].p,back=Math.atan2(p[1]-q[1],p[0]-q[0]);
      let best=null,angle=Infinity;
      for(const id of verts[edge.to].out) {
        const next=arcs[id];if(next.visited)continue;
        const r=verts[next.to].p;let turn=(back-Math.atan2(r[1]-q[1],r[0]-q[0])+Math.PI*2)%(Math.PI*2);
        if(turn<angle){best=next;angle=turn;}
      }
      if(!best)throw Error('Незамкнутый контур: геометрия слишком близка к ε');
      edge=best;
    }
    if(ring.length>=3&&Math.abs(signedArea(ring))>EPS)result.push(ring);
  }
  return result;
}
export function greinerHormann(subject,clip) {
  if([...subject,...clip].reduce((n,r)=>n+r.length,0)>1200)throw Error('Не более 1200 рёбер для многоугольного режима');
  if(subject.length!==1||clip.length!==1)return boundaryGraph(subject,clip);
  const rings=[subject[0],clip[0]];
  for(const r of rings)for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++) {
    if(j===i+1||(i===0&&j===r.length-1))continue;
    const a={a:r[i],b:r[(i+1)%r.length],ts:[]},b={a:r[j],b:r[(j+1)%r.length],ts:[]};
    intersections(a,b);if(a.ts.length)return boundaryGraph(subject,clip);
  }
  const lists=rings.map(r=>r.map(p=>({p,intersection:false,visited:false,cuts:[]})));
  let count=0;
  for(let i=0;i<lists[0].length;i++)for(let j=0;j<lists[1].length;j++) {
    const a=lists[0][i],b=lists[0][(i+1)%lists[0].length],c=lists[1][j],d=lists[1][(j+1)%lists[1].length];
    const u=sub(b.p,a.p),v=sub(d.p,c.p),w=sub(c.p,a.p),den=cross(u,v);
    if(Math.abs(den)<=EPS) {
      if(Math.abs(cross(w,u))<=EPS)return boundaryGraph(subject,clip);
      continue;
    }
    const t=cross(w,v)/den,q=cross(w,u)/den;
    if(t<-EPS||t>1+EPS||q<-EPS||q>1+EPS)continue;
    if(t<=EPS||t>=1-EPS||q<=EPS||q>=1-EPS)return boundaryGraph(subject,clip);
    const p=mix(a.p,b.p,t),x={p,t,intersection:true,visited:false},y={p,t:q,intersection:true,visited:false};
    x.neighbor=y;y.neighbor=x;a.cuts.push(x);c.cuts.push(y);count++;
  }
  if(!count)return boundaryGraph(subject,clip);
  for(let k=0;k<2;k++) {
    const expanded=lists[k].flatMap(a=>[a,...a.cuts.sort((a,b)=>a.t-b.t)]);
    let entry=!inside(lists[k][0].p,[rings[1-k]]);
    for(let i=0;i<expanded.length;i++) {
      const a=expanded[i];a.next=expanded[(i+1)%expanded.length];a.prev=expanded[(i+expanded.length-1)%expanded.length];
      if(a.intersection){a.entry=entry;entry=!entry;}
    }
  }
  const result=[];
  for(const a of lists[0])for(const start of a.cuts) {
    if(start.visited)continue;
    let current=start;const r=[];
    do {
      current.visited=true;current.neighbor.visited=true;r.push(current.p);
      const direction=current.entry?'next':'prev';
      current=current[direction];
      while(!current.intersection){r.push(current.p);current=current[direction];}
      current.visited=true;r.push(current.p);current=current.neighbor;
    } while(current!==start&&!current.visited);
    if(r.length>1&&Math.hypot(...sub(r[0],r[r.length-1]))<=EPS)r.pop();
    if(signedArea(r)<0)r.reverse();
    if(r.length>=3)result.push(r);
  }
  return result;
}
export function parseRings(text) {
  const rings=JSON.parse(text);
  if(!Array.isArray(rings)||!rings.length||rings.some(r=>!Array.isArray(r)||r.length<3||r.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))))throw Error('Нужен JSON: [[[x,y],…], …], минимум три вершины в контуре');
  return rings;
}
