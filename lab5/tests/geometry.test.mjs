import test from 'node:test';
import assert from 'node:assert/strict';
import {liangBarsky,cohenSutherland,cyrusBeck,parseInput,aabbReject,EPS} from '../js/geometry.js';
import {Quadtree,generate,boundsOf,random} from '../js/spatial.js';
import {greinerHormann,signedArea} from '../js/polygon.js';
const r=[-10,-10,10,10],p=[[-10,-10],[10,-10],[10,10],[-10,10]];
const fns=[s=>liangBarsky(s,r),s=>cohenSutherland(s,r),s=>cyrusBeck(s,p)];
test('Границы и нулевые отрезки во всех вершинах',()=>{
  for(let i=0;i<4;i++)for(const s of [[...p[i],...p[(i+1)%4]],[...p[i],...p[i]]])for(const fn of fns)assert.deepEqual(fn(s),s);
  for(const fn of fns){assert.equal(fn([11,0,11,0]),null);assert.deepEqual(fn([-20,0,20,0]),[-10,0,10,0]);}
});
test('Допуск ε и счётчики арифметики',()=>{
  assert.ok(cohenSutherland([10+EPS/2,0,10+EPS/2,0],r));
  assert.equal(cohenSutherland([10+EPS*2,0,10+EPS*2,0],r),null);
  const a={mul:0,div:0},b={mul:0,div:0};liangBarsky([-20,0,20,0],r,a);cohenSutherland([-20,0,20,0],r,b);
  assert.deepEqual(a,{mul:4,div:2});assert.deepEqual(b,{mul:2,div:2});
});
test('10000 случайных отрезков: три алгоритма совпадают',()=>{
  const rng=random(81);for(let i=0;i<10000;i++){
    const s=Array.from({length:4},()=>rng()*80-40),results=fns.map(fn=>fn(s));
    assert.equal(Boolean(results[0]),Boolean(results[1]));assert.equal(Boolean(results[0]),Boolean(results[2]));
    if(results[0])for(const t of results.slice(1))for(let k=0;k<4;k++)assert.ok(Math.abs(results[0][k]-t[k])<1e-6);
  }
});
test('Quadtree совпадает с AABB после обновлений, в том числе вне исходного корня',()=>{
  const s=generate(10000),t=new Quadtree(s,boundsOf(s));
  for(let k=0;k<50;k++){
    s[k]=[3000+k,3000,3002+k,3002];t.update(k);
    for(const q of [[-30,-30,30,30],[2999,2999,3100,3100]])assert.deepEqual(t.query(q).sort((a,b)=>a-b),s.flatMap((v,i)=>aabbReject(v,q)?[]:[i]));
  }
});
test('Многоугольники: распад, дыра, самопересечение, касание, совпадение',()=>{
  const clip=[[[-1,4],[9,4],[9,7],[-1,7]]],u=[[[0,0],[8,0],[8,8],[6,8],[6,2],[2,2],[2,8],[0,8]]];
  assert.equal(greinerHormann(u,clip).length,2);
  const outer=[[0,0],[10,0],[10,10],[0,10]],hole=[[3,3],[7,3],[7,7],[3,7]],big=[[[-1,-1],[11,-1],[11,11],[-1,11]]];
  const area=rs=>rs.reduce((a,r)=>a+signedArea(r),0);
  assert.ok(Math.abs(area(greinerHormann([outer,hole],big))-84)<EPS);
  assert.ok(Math.abs(area(greinerHormann([[[0,0],[10,10],[0,10],[10,0]]],big))-50)<EPS);
  assert.ok(Math.abs(area(greinerHormann([outer],[outer]))-100)<EPS);
  assert.deepEqual(greinerHormann([outer],[[[10,0],[20,0],[20,10],[10,10]]]),[]);
});
test('Формат входного файла',()=>{
  assert.equal(parseInput('1\n0 0 1 1\n-2 -2 2 2').segments.length,1);
  for(const s of ['', '1\n0 0 0 0','0\n0 0 0 0','0\n0 0 NaN 1'])assert.throws(()=>parseInput(s));
});
