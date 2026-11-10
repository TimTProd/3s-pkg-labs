import {aabbReject,EPS} from './geometry.js';
function node(r,d) {return {r,d,ids:[],children:null};}
export class Quadtree {
  constructor(segments,bounds,depth=7,capacity=32) {
    this.segments=segments;this.depth=depth;this.capacity=capacity;
    this.root=node(bounds,0);this.locations=[];
    for(let i=0;i<segments.length;i++) this.insert(i,this.root);
  }
  quadrant(s,n) {
    const x=(n.r[0]+n.r[2])/2,y=(n.r[1]+n.r[3])/2;
    const left=Math.max(s[0],s[2])<x-EPS,right=Math.min(s[0],s[2])>x+EPS;
    const low=Math.max(s[1],s[3])<y-EPS,high=Math.min(s[1],s[3])>y+EPS;
    return (left||right)&&(low||high)?(right?1:0)+(high?2:0):-1;
  }
  insert(id,n) {
    if(!n.children&&n.ids.length>=this.capacity&&n.d<this.depth) {
      const [a,b,c,d]=n.r,x=(a+c)/2,y=(b+d)/2;
      n.children=[[a,b,x,y],[x,b,c,y],[a,y,x,d],[x,y,c,d]].map(r=>node(r,n.d+1));
      const old=n.ids;n.ids=[];
      for(const i of old) this.insert(i,n);
    }
    const s=this.segments[id],contained=Math.min(s[0],s[2])>=n.r[0]-EPS&&Math.min(s[1],s[3])>=n.r[1]-EPS&&Math.max(s[0],s[2])<=n.r[2]+EPS&&Math.max(s[1],s[3])<=n.r[3]+EPS;
    if(n.children&&contained) {
      const q=this.quadrant(s,n);
      if(q>=0) {this.insert(id,n.children[q]);return;}
    }
    this.locations[id]=[n,n.ids.length];n.ids.push(id);
  }
  update(id) {
    const [n,pos]=this.locations[id],last=n.ids.pop();
    if(last!==id) {n.ids[pos]=last;this.locations[last]=[n,pos];}
    this.insert(id,this.root);
  }
  query(r) {
    const out=[],stack=[this.root];
    while(stack.length) {
      const n=stack.pop();
      if(n!==this.root&&aabbReject(n.r,r)) continue;
      for(const id of n.ids) if(!aabbReject(this.segments[id],r)) out.push(id);
      if(n.children) stack.push(...n.children);
    }
    return out;
  }
}
export function random(seed=8128) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
export function generate(n,density=1,seed=8128) {
  const rng=random(seed),spread=900/density;
  return Array.from({length:n},()=>{
    const x=(rng()-.5)*2*spread,y=(rng()-.5)*2*spread;
    return [x,y,x+(rng()-.5)*16,y+(rng()-.5)*16];
  });
}
export function boundsOf(s) {
  const r=[-1,-1,1,1];
  for(const a of s) {r[0]=Math.min(r[0],a[0]-1,a[2]-1);r[1]=Math.min(r[1],a[1]-1,a[3]-1);r[2]=Math.max(r[2],a[0]+1,a[2]+1);r[3]=Math.max(r[3],a[1]+1,a[3]+1);}
  return r;
}
