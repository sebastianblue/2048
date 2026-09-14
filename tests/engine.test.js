import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {simulate} from './balance.js';
const board=(...v)=>[...v,...Array(16-v.length).fill(0)];
const setup=(values,changes={})=>Object.assign(E.newRun({seed:'TEST'}),{board:values,relics:[],...changes});
test('2048 merges once, in travel order, without chain-merging',()=>{
 assert.deepEqual(E.slide(board(2,2,2,2),'left').board,board(4,4));
 assert.deepEqual(E.slide(board(2,2,4,4),'left').board,board(4,8));
 assert.deepEqual(E.slide(board(2,2,4,4),'right').board,board(0,0,4,8));
 assert.deepEqual(E.slide(board(2,0,2,4),'left').board,board(4,4));
 const vertical=Array(16).fill(0);[0,4,8,12].forEach(i=>vertical[i]=2);
 assert.deepEqual(E.slide(vertical,'up').board,board(4,0,0,0,4));
 assert.deepEqual(E.slide(vertical,'down').board,board(0,0,0,0,0,0,0,0,4,0,0,0,4));
});
test('all directions conserve tile mass across varied boards',()=>{
 const s=E.newRun();for(let n=0;n<400;n++){const b=Array.from({length:16},()=>E.random(s)<.25?0:2**(1+Math.floor(E.random(s)*7)));for(const dir of E.DIRS){const result=E.slide(b,dir);assert.equal(result.board.reduce((a,b)=>a+b,0),b.reduce((a,b)=>a+b,0));assert.ok(result.merges.every(m=>m.value>=4));}}
});
test('invalid or unchanged directions cost no moves, spawn or random state',()=>{
 const s=setup(board(2));const initial=E.clone(s);assert.equal(E.move(s,'left'),false);assert.deepEqual(s,initial);assert.equal(E.move(s,'oops'),false);assert.deepEqual(s,initial);
});
test('one successful move spawns one tile and costs exactly one move',()=>{
 const s=setup(board(2,2));const mass=s.board.reduce((a,b)=>a+b,0),next=s.next;assert.ok(E.move(s,'left'));assert.equal(s.moves,23);assert.equal(s.board.reduce((a,b)=>a+b,0),mass+next);assert.equal(s.score,4);
});
test('chips add before multipliers, streak applies from second scoring slide',()=>{
 const s=setup(board(2,2,2,2),{relics:['spark','twins'],combo:2,forge:1});
 const r=E.scoreSlide(s,E.slide(s.board,'left'),'left');assert.equal(r.chips,20);assert.equal(r.points,Math.round(20*1.3*1.6*1.2));
 const t=setup(board(2,2));E.move(t,'left');assert.equal(t.combo,1);t.board=board(4);E.move(t,'right');assert.equal(t.combo,0);
});
test('all relics score safely in corner, crowded, sparse and large-tile configurations',()=>{
 for(const r of E.RELICS)for(const b of [board(2,2,8,8),board(32,32,64,64),Array(16).fill(16)]){
  const s=setup(b,{relics:[r.id],previous:'up',combo:4,moves:5});const score=E.scoreSlide(s,E.slide(b,'left'),'left');assert.ok(Number.isFinite(score.points)&&score.points>0, r.id);
 }
});
test('all four bosses apply their announced rules',()=>{
 const toll=setup(board(2,2),{round:2,relics:['spark']});assert.equal(E.scoreSlide(toll,E.slide(toll.board,'left'),'left').chips,8);
 const tide=setup(board(2,2),{round:5,turn:2});E.move(tide,'left');assert.equal(tide.last.spawns.length,2);
 const pendulum=setup(board(8,8),{round:8,previous:'left'});assert.equal(E.scoreSlide(pendulum,E.slide(pendulum.board,'left'),'left').points,8);
 const house=setup(board(8,8),{round:11});assert.equal(E.scoreSlide(house,E.slide(house.board,'left'),'left').points,11);
});
test('money earned by Gold Standard is capped and Light Touch skips correct spawns',()=>{
 const s=setup(board(16,16),{relics:['gold','feather'],money:0});for(let i=0;i<4;i++){s.board=board(16,16);s.score=0;E.move(s,'left');}assert.equal(s.money,3);assert.equal(s.last.spawns.length,0);
});
test('clear reward happens once, interest and speed bonus are capped',()=>{
 const s=setup(board(128,128),{money:30,relics:['bank']});E.move(s,'left');assert.equal(s.phase,'cleared');assert.deepEqual(s.receipt,{base:5,speed:3,interest:3,bank:2,total:13});assert.equal(s.money,43);assert.equal(E.move(s,'up'),false);assert.equal(s.money,43);assert.equal(s.roundsCleared,1);
});
test('shop enforces phase, affordability, sold offers and inventory caps',()=>{
 const s=E.newRun();s.phase='cleared';E.enterShop(s);s.money=100;assert.equal(s.shop.length,5);assert.equal(new Set(s.shop.map(x=>x.id)).size,5);assert.ok(!s.shop.some(x=>x.id==='spark'));
 assert.ok(E.buy(s,0));const cash=s.money;assert.equal(E.buy(s,0),false);assert.equal(s.money,cash);
 s.relics=E.RELICS.slice(0,5).map(x=>x.id);assert.equal(E.buy(s,1),false);s.powers=['moves','moves','moves'];assert.equal(E.buy(s,3),false);
 s.money=0;assert.equal(E.forge(s),false);assert.equal(E.reroll(s),false);assert.equal(E.buy(s,4),false);
 s.phase='shop';s.round=5;for(let n=0;n<30;n++){E.rollShop(s);assert.ok(!s.shop.some(o=>o.id==='crumbs'));}
 s.phase='playing';assert.equal(E.buy(s,2),false);assert.equal(E.sell(s,s.relics[0]),false);
});
test('shop RNG cannot change future board spawns and reroll prices escalate',()=>{
 const s=E.newRun();s.phase='cleared';E.enterShop(s);s.money=100;const rng=s.rng;assert.ok(E.reroll(s));assert.equal(E.rerollPrice(s),3);assert.ok(E.reroll(s));assert.equal(E.rerollPrice(s),4);assert.equal(s.rng,rng);
});
test('workshop cost and multiplier stay bounded',()=>{
 const s=E.newRun();s.phase='shop';s.money=1000;for(let i=0;i<6;i++){assert.equal(E.forgePrice(s),6+i*4);assert.ok(E.forge(s));}assert.equal(E.forge(s),false);assert.equal(s.forge,6);
});
test('next round resets the board and streak while preserving the build',()=>{
 const s=E.newRun();s.phase='shop';s.round=2;s.relics=['clock','growth'];s.powers=['promote'];s.growth=.4;s.money=14;s.forge=2;s.combo=5;
 assert.ok(E.nextRound(s));assert.equal(s.round,3);assert.equal(s.moves,30);assert.equal(s.score,0);assert.equal(s.combo,0);assert.equal(s.spawnBase,4);assert.equal(s.board.filter(Boolean).length,6);assert.equal(s.growth,.4);assert.equal(s.money,14);assert.equal(s.forge,2);assert.deepEqual(s.powers,['promote']);
});
test('hammer and double up are targeted, free, one-use and never award points',()=>{
 const s=setup(board(2,512),{powers:['promote','hammer']});assert.equal(E.usePower(s,0,2),false);assert.equal(E.usePower(s,0,1),false);assert.equal(E.usePower(s,0,-1),false);assert.ok(E.usePower(s,0,0));assert.equal(s.board[0],4);assert.equal(s.score,0);assert.equal(s.moves,24);assert.ok(E.usePower(s,0,1));assert.equal(s.board[1],0);assert.equal(s.powers.length,0);
});
test('rewind restores score, rng, cash, moves and growth while consuming itself',()=>{
 const s=setup(board(16,16),{powers:['rewind','hammer'],relics:['growth','gold']});const before=E.clone(s);E.move(s,'left');const after=E.clone(s);assert.ok(E.usePower(s,0));for(const key of ['board','score','rng','money','moves','growth','totalMerges'])assert.deepEqual(s[key],before[key]);assert.deepEqual(s.powers,['hammer']);assert.equal(s.undo,null);E.move(s,'left');assert.deepEqual(s.board,after.board);assert.equal(s.score,after.score);
});
test('other powerups invalidate rewind and Overdrive lasts three scoring slides',()=>{
 const s=setup(board(2,2),{powers:['focus','rewind']});E.move(s,'left');assert.ok(s.undo);E.usePower(s,0);assert.equal(s.undo,null);assert.equal(E.usePower(s,0),false);assert.equal(s.focus,3);s.board=board(2);E.move(s,'right');assert.equal(s.focus,3);s.board=board(2,2);E.move(s,'left');assert.equal(s.focus,2);assert.equal(s.last.points,8);
});
test('extra moves rescue exhaustion; full boards and merges are detected correctly',()=>{
 const s=setup(board(2,2),{moves:1,powers:['moves']});E.move(s,'left');assert.equal(s.phase,'danger');assert.ok(E.usePower(s,0));assert.equal(s.moves,5);assert.equal(s.phase,'playing');
 const full=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];assert.equal(E.canMove(full),false);full[0]=4;assert.equal(E.canMove(full),true);
});
test('identical seeds and choices reproduce boards, shops and outcome',()=>{
 const a=simulate('DETERMINISM'),b=simulate('DETERMINISM');for(const key of ['board','shop','score','money','totalScore','rng','phase','relics'])assert.deepEqual(a[key],b[key]);
});
test('JSON round trips preserve saves, including the one-move rewind snapshot',()=>{
 const s=E.newRun();E.move(s,'left');const restored=JSON.parse(JSON.stringify(s));assert.equal(E.validSave(restored),true);assert.deepEqual(restored,s);assert.equal(E.validSave({}),false);assert.equal(E.validSave({...s,board:[2]}),false);assert.equal(E.validSave({...s,relics:['fake']}),false);
});
test('a complete run can win all twelve rounds with ordinary legal play and purchases',()=>{
 const s=simulate('BALANCE-1');assert.equal(s.phase,'won');assert.equal(s.roundsCleared,12);assert.equal(s.round,11);assert.ok(s.money>=0);assert.equal(E.nextRound(s),false);
});
