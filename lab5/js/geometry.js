export const EPS = 1e-7;
export function mask(x,y,r) {
  return (x < r[0]-EPS ? 1:0) | (x > r[2]+EPS ? 2:0) | (y < r[1]-EPS ? 4:0) | (y > r[3]+EPS ? 8:0);
}
export function aabbReject(s,r) {
  return (mask(Math.min(s[0],s[2]),Math.min(s[1],s[3]),r) & mask(Math.max(s[0],s[2]),Math.max(s[1],s[3]),r)) !== 0;
}
export function liangBarsky(s,r,ops={mul:0,div:0},trace=[]) {
  const [x,y,x2,y2]=s, dx=x2-x,dy=y2-y;
  let lo=0,hi=1;
  const p=[-dx,dx,-dy,dy],q=[x-r[0],r[2]-x,y-r[1],r[3]-y];
  for(let i=0;i<4;i++) {
    if(Math.abs(p[i])<=EPS) {
      trace.push({edge:i,p:p[i],q:q[i],lo,hi});
      if(q[i]<-EPS) return null;
    } else {
      const t=q[i]/p[i]; ops.div++;
      if(p[i]<0) lo=Math.max(lo,t); else hi=Math.min(hi,t);
      trace.push({edge:i,p:p[i],q:q[i],t,lo,hi});
      if(lo>hi+EPS) return null;
    }
  }
  if(lo>hi) lo=hi=(lo+hi)/2;
  ops.mul+=4;
  return [x+lo*dx,y+lo*dy,x+hi*dx,y+hi*dy];
}
export function cohenSutherland(s,r,ops={mul:0,div:0}) {
  let [x,y,u,v]=s;
  for(let k=0;k<12;k++) {
    const a=mask(x,y,r),b=mask(u,v,r);
    if(!(a|b)) return [x,y,u,v];
    if(a&b) return null;
    const c=a||b;
    let xx,yy;
    if(c&12) {
      yy=c&8?r[3]:r[1];
      if(Math.abs(v-y)<=EPS) return null;
      xx=x+(u-x)*(yy-y)/(v-y);
    } else {
      xx=c&2?r[2]:r[0];
      if(Math.abs(u-x)<=EPS) return null;
      yy=y+(v-y)*(xx-x)/(u-x);
    }
    ops.mul++; ops.div++;
    if(c===a) {x=xx;y=yy;} else {u=xx;v=yy;}
  }
  throw Error('Не удалось завершить отсечение');
}
export function convexValid(poly) {
  if(poly.length<3) return false;
  let sign=0;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],c=poly[(i+2)%poly.length];
    const z=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(z)<=EPS) continue;
    if(sign && sign*z<0) return false;
    sign=Math.sign(z);
  }
  return sign!==0;
}
export function cyrusBeck(s,poly,ops={mul:0,div:0}) {
  let area=0;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length]; area+=a[0]*b[1]-a[1]*b[0]; ops.mul+=2;
  }
  if(Math.abs(area)<=EPS)return null;
  const sign=area>EPS?1:-1,dx=s[2]-s[0],dy=s[3]-s[1];
  let lo=0,hi=1;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length];
    const nx=-(b[1]-a[1])*sign,ny=(b[0]-a[0])*sign;
    const q=nx*(s[0]-a[0])+ny*(s[1]-a[1]),p=nx*dx+ny*dy; ops.mul+=6;
    if(Math.abs(p)<=EPS) {if(q<-EPS) return null;}
    else {
      const t=-q/p; ops.div++;
      if(p>0) lo=Math.max(lo,t); else hi=Math.min(hi,t);
      if(lo>hi+EPS) return null;
    }
  }
  if(lo>hi) lo=hi=(lo+hi)/2;
  ops.mul+=4;
  return [s[0]+lo*dx,s[1]+lo*dy,s[0]+hi*dx,s[1]+hi*dy];
}
export function parseInput(text) {
  const v=text.trim().split(/\s+/).map(Number),n=v[0];
  if(!Number.isInteger(n)||n<0||n>2000000||v.length!==1+4*n+4||!v.every(Number.isFinite)) throw Error('Ожидаются n, затем n строк x1 y1 x2 y2 и xmin ymin xmax ymax');
  const r=v.slice(-4);
  if(r[2]-r[0]<=EPS||r[3]-r[1]<=EPS) throw Error('Окно должно иметь положительные ширину и высоту');
  return {segments:Array.from({length:n},(_,i)=>v.slice(1+4*i,5+4*i)),rect:r};
}
