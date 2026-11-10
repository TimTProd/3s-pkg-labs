import {liangBarsky,cohenSutherland,cyrusBeck,aabbReject} from './geometry.js';
import {Quadtree,generate,boundsOf} from './spatial.js';
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
export function benchmark(progress=()=>{}) {
  const rows=[],count=500000,windows=Array.from({length:24},(_,i)=>[-30+i*2,-30+i,30+i*2,30+i]);
  for(const density of [.5,1,2,4]) {
    const segments=generate(count,density),bounds=boundsOf(segments);
    const start=performance.now();let scanHits=0;
    for(const r of windows)for(const s of segments)if(!aabbReject(s,r)&&liangBarsky(s,r))scanHits++;
    const scanMs=(performance.now()-start)/windows.length;
    for(const depth of [3,5,7,9]) {
      const begin=performance.now(),tree=new Quadtree(segments,bounds,depth),buildMs=performance.now()-begin;
      const query=[],clip=[],total=[],update=[];let hits=0,candidates=0;
      for(const r of windows) {
        const a=performance.now(),ids=tree.query(r),b=performance.now();
        for(const id of ids)if(liangBarsky(segments[id],r))hits++;
        const c=performance.now();query.push(b-a);clip.push(c-b);total.push(c-a);candidates+=ids.length;
      }
      if(hits!==scanHits)throw Error('Результат дерева не совпал с полным перебором');
      for(let k=0;k<24;k++) {
        const a=performance.now();
        for(let j=0;j<1000;j++){const id=k*1000+j;for(let q=0;q<4;q++)segments[id][q]+=.001;tree.update(id);}
        update.push(performance.now()-a);
      }
      let fullUpdateMs=null;
      if(density===1&&depth===7) {
        const begin=performance.now();
        for(let id=0;id<segments.length;id++){for(let q=0;q<4;q++)segments[id][q]+=.0001;tree.update(id);}
        fullUpdateMs=performance.now()-begin;
      }
      rows.push({density,depth,count,buildMs,scanMs,queryMs:median(query),clipMs:median(clip),totalMs:median(total),update1000Ms:median(update),fullUpdateMs,candidates:candidates/windows.length,hits:hits/windows.length});
      if(fullUpdateMs!==null)for(const s of segments)for(let q=0;q<4;q++)s[q]-=.0001;
      progress({done:rows.length,total:16});
      for(let k=0;k<24000;k++){for(let q=0;q<4;q++)segments[k][q]-=.001;}
    }
  }
  const source=generate(count,4),rect=[-30,-30,30,30],poly=[[-30,-30],[30,-30],[30,30],[-30,30]],operations=[];
  for(const [name,fn] of [['Сазерленд—Коэн',s=>cohenSutherland(s,rect,ops)],['Лианг—Барски',s=>liangBarsky(s,rect,ops)],['Сайрус—Бек',s=>cyrusBeck(s,poly,ops)]]) {
    var ops={mul:0,div:0};let accepted=0;const begin=performance.now();
    for(const s of source)if(fn(s))accepted++;
    operations.push({name,...ops,count,accepted,ms:performance.now()-begin,prefilter:false});
  }
  return {count,windows:windows.length,rows,operations,userAgent:globalThis.navigator?.userAgent||'Node.js',timestamp:new Date().toISOString()};
}
