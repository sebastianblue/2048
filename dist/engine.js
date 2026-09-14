// Pure deterministic game rules. Browser rendering and storage live in app.js.
export const VERSION = 1;
export const DIRS = ['left','up','right','down'];
export const RELICS = [
  {id:'spark',name:'Pocket Spark',icon:'✦',type:'chips',price:5,desc:'+6 chips for every merge.',tag:'EVERY MERGE'},
  {id:'crumbs',name:'Small Change',icon:'⁙',type:'chips',price:5,desc:'+18 chips when a merge makes a 4 or 8.',tag:'SMALL TILES'},
  {id:'echo',name:'Echo Chamber',icon:'◎',type:'mult',price:7,desc:'Merging on consecutive slides gives an extra +0.20× per streak step, up to +1×.',tag:'STREAKS'},
  {id:'corner',name:'Corner Office',icon:'⌜',type:'chips',price:6,desc:'+24 chips for each merge that lands in a corner.',tag:'POSITION'},
  {id:'twins',name:'Two of a Kind',icon:'Ⅱ',type:'mult',price:7,desc:'×1.6 score on slides with at least two merges.',tag:'MULTI-MERGE'},
  {id:'giant',name:'Big Plans',icon:'↟',type:'mult',price:8,desc:'×1.8 score on slides that make a 64 or larger.',tag:'BIG TILES'},
  {id:'room',name:'Breathing Room',icon:'□',type:'mult',price:7,desc:'×1.5 score with at least 8 empty cells after merging, before spawns.',tag:'SPACE'},
  {id:'crowd',name:'Full House',icon:'▦',type:'mult',price:6,desc:'×1.8 score with 4 or fewer empty cells after merging, before spawns.',tag:'CROWDED BOARD'},
  {id:'growth',name:'Compound Interest',icon:'↗',type:'mult',price:8,desc:'Starts at ×1. Each merge making a 32+ permanently adds +0.04× this run.',tag:'SCALING'},
  {id:'gold',name:'Gold Standard',icon:'¤',type:'economy',price:6,desc:'Earn $1 on slides that make a 32+, at most $3 per round.',tag:'ECONOMY'},
  {id:'bank',name:'Rainy Day',icon:'◈',type:'economy',price:5,desc:'Gain $2 extra after every round.',tag:'ECONOMY'},
  {id:'clock',name:'Borrowed Time',icon:'◷',type:'utility',price:7,desc:'Begin each round with 4 extra moves.',tag:'SURVIVAL'},
  {id:'feather',name:'Light Touch',icon:'≈',type:'utility',price:6,desc:'Every fourth successful slide skips its normal tile spawn.',tag:'BOARD CONTROL'},
  {id:'last',name:'Last Call',icon:'!',type:'mult',price:6,desc:'×2 score when you have 6 or fewer moves after sliding.',tag:'CLUTCH'},
  {id:'compass',name:'Crossroads',icon:'↔',type:'chips',price:5,desc:'+30 chips when a scoring slide changes axis from the previous slide.',tag:'DIRECTION'},
  {id:'prism',name:'Prism',icon:'◇',type:'chips',price:7,desc:'+12 chips per different tile value on the board after merging.',tag:'VARIETY'},
  {id:'fuse',name:'Long Fuse',icon:'⌁',type:'mult',price:8,desc:'The first scoring slide each round is ×3. Subsequent scoring slides are ×1.2.',tag:'BURST'},
  {id:'orbit',name:'Satellite',icon:'⊙',type:'chips',price:6,desc:'+8 chips for every tile worth 32+ after merging.',tag:'BIG BOARD'}
  ,{id:'jackpot',name:'Jackpot',icon:'✹',type:'mult',price:9,desc:'Roll 1–6 on scoring slides: ×0.65 / ×0.85 / ×1 / ×1.25 / ×1.8 / ×3.5.',tag:'HIGH ROLLER'}
  ,{id:'encore',name:'Encore',icon:'↻',type:'mult',price:7,desc:'A non-scoring slide primes your next scoring slide for ×2.4.',tag:'SETUP'}
  ,{id:'solo',name:'One-Trick Pony',icon:'①',type:'mult',price:8,desc:'Exactly one merge is ×3.0. Extra merges add +24 chips each.',tag:'SINGLE FOCUS'}
  ,{id:'pair',name:'Pair-a-Dice',icon:'♢',type:'mult',price:8,desc:'Two tile values after merging gives ×2.2. Prism adds +40 chips too.',tag:'TWO TONES'}
  ,{id:'chaos',name:'Chaos Theory',icon:'⚛',type:'mult',price:8,desc:'Each round rolls a blessing from ×0.70 to ×2.00. The current roll is shown.',tag:'ROUND ROLL'}
  ,{id:'mystery',name:'Mystery Meat',icon:'?',type:'chips',price:7,desc:'Every scoring slide finds +0–96 mystery chips. Prism doubles the find.',tag:'WILD CHIPS'}
  ,{id:'loaded',name:'Loaded Coin',icon:'↯',type:'mult',price:8,desc:'Flip a coin: heads ×2.1, tails ×0.75. Overdrive makes tails ×1.2.',tag:'COIN FLIP'}
  ,{id:'crown',name:'Crown Jewels',icon:'♛',type:'mult',price:9,desc:'Highest tile in a corner: ×2.5. Else +48 chips. Loves Corner Office.',tag:'ROYALTY'}
  ,{id:'lucky',name:'Lucky Break',icon:'✺',type:'economy',price:7,desc:'Round-end die: 1–2 +$0, 3–5 +$2, 6 +$8.',tag:'WILD PAYOUT'}
];
export const POWERS = [
  {id:'hammer',name:'Hammer',icon:'×',price:3,desc:'Remove one tile. No move spent.',target:true},
  {id:'promote',name:'Double Up',icon:'↑',price:4,desc:'Double a tile worth 256 or less. No points or move spent.',target:true},
  {id:'shuffle',name:'Remix',icon:'⤨',price:3,desc:'Shuffle all tiles into new positions. No move spent.'},
  {id:'rewind',name:'Rewind',icon:'↶',price:3,desc:'Undo the last slide, including its spawn, score and earnings.'},
  {id:'moves',name:'Extra Time',icon:'+5',price:4,desc:'Gain 5 moves this round.'},
  {id:'focus',name:'Overdrive',icon:'×2',price:4,desc:'Double the score of your next 3 scoring slides.'},
  {id:'engrave',name:'Foil Stamp',icon:'✧',price:4,desc:'Mark one tile. Its mark moves with it and adds +50 chips when it merges.',target:true}
];
export const KITS = [
  {id:'spark',name:'The Spark',icon:'✦',desc:'Pocket Spark + a Hammer. A little value from every merge.',relic:'spark',power:'hammer',money:5,unlock:0},
  {id:'banker',name:'The Banker',icon:'¤',desc:'Rainy Day + $9. Invest early; build your own scoring engine.',relic:'bank',power:'moves',money:9,unlock:3},
  {id:'architect',name:'The Architect',icon:'⌜',desc:'Corner Office + Double Up. Make every placement count.',relic:'corner',power:'promote',money:5,unlock:6},
  {id:'highroller',name:'The High Roller',icon:'✹',desc:'Jackpot + Foil Stamp. Chase the spike; mark the runner.',relic:'jackpot',power:'engrave',money:6,unlock:9}
];
export const BOSSES = [
  {name:'The Toll',icon:'⅟₂',desc:'Merges that make a 4 or 8 give half their base chips. Relic chips are unaffected.',short:'Small merges: ½ base chips.'},
  {name:'High Tide',icon:'≈',desc:'Every third successful slide spawns an extra tile.',short:'Extra spawn every 3 slides.'},
  {name:'The Pendulum',icon:'↔',desc:'Using the same direction twice in a row halves that slide’s score.',short:'Repeat direction: ½ score.'},
  {name:'The House',icon:'♜',desc:'All scoring slides are multiplied by 0.7. Bring a working combo.',short:'All scoring slides: ×0.7.'}
];
export const TARGETS = [160,280,400,1000,1550,2300,3600,5200,7400,10500,14500,17000];
export const clone = x => structuredClone(x);
export const relic = id => RELICS.find(r=>r.id===id);
export const power = id => POWERS.find(p=>p.id===id);
export function hashSeed(str) {let h=2166136261;for(const c of str) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function random(s, stream='rng') {
  if(!Number.isFinite(s[stream]))s[stream]=hashSeed(`${s.seed??'LUCKY'}-${stream}`);
  s[stream]=(s[stream]+0x6D2B79F5)>>>0;let t=s[stream];
  t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}
export function randomAt(s,key='') {return hashSeed(`${s.seed??'LUCKY'}|${s.round??0}|${s.turn??0}|${s.totalMerges??0}|${key}`)/4294967296;}
export function rollFor(s,key,max=6) {return 1+Math.floor(randomAt(s,key)*max);}
export function shuffled(s,list,stream='rng') {const a=[...list];for(let i=a.length-1;i>0;i--) {const j=Math.floor(random(s,stream)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function roundInfo(index, mode='standard') {
  const act=Math.floor(index/3),boss=index%3===2,stage=index%3;
  return {act:act+1,index,stage,boss,rule:boss?BOSSES[act]:null,name:boss?BOSSES[act].name:stage?'Raise the Stakes':'Opening Hand',target:Math.round(TARGETS[index]*(mode==='relaxed'?0.75:mode==='expert'?1.3:1)),moves:24+(act>0?2:0)+(mode==='relaxed'?4:0),reward:boss?8:stage?6:5};
}
export const has = (s,id)=>s.relics.includes(id);
export function spawn(s) {
  const empties=s.board.flatMap((v,i)=>v?[]:[i]);if(!empties.length)return null;
  const index=empties[Math.floor(random(s)*empties.length)];
  s.board[index]=s.next;s.next=random(s)<0.85?s.spawnBase:s.spawnBase*2;
  return index;
}
export function startRound(s) {
  const info=roundInfo(s.round,s.mode);s.phase='playing';s.score=0;s.combo=0;s.turn=0;s.previous=null;s.focus=0;s.scoringSlides=0;s.goldThisRound=0;s.undo=null;s.last=null;s.receipt=null;
  s.encoreReady=false;s.chaosRoll=0;s.chaosFactor=1;
  if(has(s,'chaos')) {s.chaosRoll=rollFor(s,'chaos-round');s.chaosFactor=[.7,.85,1,1.2,1.5,2][s.chaosRoll-1];}
  s.moves=info.moves+(has(s,'clock')?4:0);s.startMoves=s.moves;s.board=Array(16).fill(0);s.marks=Array(16).fill(null);
  s.spawnBase=2**info.act;s.next=s.spawnBase;
  const indices=shuffled(s,Array.from({length:16},(_,i)=>i));
  const values=[s.spawnBase,s.spawnBase,s.spawnBase*2,s.spawnBase*2,s.spawnBase*4,s.spawnBase*4];
  values.forEach((v,i)=>s.board[indices[i]]=v);
  s.highest=Math.max(s.highest,...s.board);return s;
}
export function newRun({seed='LUCKY',kit='spark',mode='standard'}={}) {
  const k=KITS.find(x=>x.id===kit)||KITS[0];
  return startRound({version:VERSION,seed:String(seed).slice(0,40),rng:hashSeed(seed),jokerRng:hashSeed(seed+'-joker'),shopRng:hashSeed(seed+'-shop'),kit:k.id,mode,round:0,relics:[k.relic],powers:[k.power],money:k.money,forge:0,growth:0,totalScore:0,totalMerges:0,highest:0,roundsCleared:0,spent:0,startedAt:Date.now(),phase:'playing',shop:[],rerolls:0,recorded:false,encoreReady:false,chaosRoll:0,chaosFactor:1});
}
export function slide(board,dir,marks=null) {
  if(!DIRS.includes(dir))return {board:[...board],merges:[],motions:[],changed:false};
  const out=[...board],markOut=Array.isArray(marks)?[...marks]:null,merges=[],motions=[];
  for(let line=0;line<4;line++) {
    const indices=Array.from({length:4},(_,n)=>dir==='left'?line*4+n:dir==='right'?line*4+3-n:dir==='up'?n*4+line:(3-n)*4+line);
    const values=indices.filter(i=>board[i]).map(i=>({value:board[i],from:i}));indices.forEach(i=>out[i]=0);
    if(markOut)indices.forEach(i=>markOut[i]=null);
    let pos=0;
    for(let j=0;j<values.length;j++) {
      const tile=values[j],to=indices[pos++];let value=tile.value,mark=marks?.[tile.from]??null;
      if(values[j+1]?.value===value) {
        const other=values[j+1];value*=2;mark=mark||marks?.[other.from]||null;motions.push({...other,to});j++;merges.push({value,index:to,marked:!!mark});
      }
      out[to]=value;if(markOut)markOut[to]=mark;motions.push({...tile,to});
    }
  }
  return {board:out,marks:markOut,merges,motions,changed:out.some((v,i)=>v!==board[i])||!!markOut&&markOut.some((v,i)=>v!==(marks?.[i]??null))};
}
export const canMove = board=>DIRS.some(d=>slide(board,d).changed);
const axis=d=>['left','right'].includes(d)?'h':'v';
export function scoreSlide(s,result,dir) {
  if(!result.merges.length)return {chips:0,mult:1,points:0,lines:[],triggers:[],growth:s.growth};
  const info=roundInfo(s.round,s.mode),merges=result.merges,empty=result.board.filter(v=>!v).length;
  let chips=0,mult=1+Math.min(s.combo,5)*0.15,growth=s.growth;
  const lines=[],triggers=[];
  for(const m of merges) chips+=m.value*(info.boss&&info.act===1&&m.value<=8?0.5:1);
  lines.push({label:'Merged tiles',value:chips});
  const add=(id,n)=>{chips+=n;if(n){lines.push({label:relic(id).name,value:n});triggers.push(id);}};
  const multiply=(id,n)=>{mult*=n;if(n!==1){lines.push({label:relic(id).name,value:'×'+n.toFixed(2)});triggers.push(id);}};
  if(has(s,'spark'))add('spark',6*merges.length);
  if(has(s,'crumbs'))add('crumbs',18*merges.filter(m=>m.value<=8).length);
  if(has(s,'corner'))add('corner',24*merges.filter(m=>[0,3,12,15].includes(m.index)).length);
  if(has(s,'compass')&&s.previous&&axis(s.previous)!==axis(dir))add('compass',30);
  if(has(s,'prism'))add('prism',12*new Set(result.board.filter(Boolean)).size);
  if(has(s,'orbit'))add('orbit',8*result.board.filter(v=>v>=32).length);
  if(merges.some(m=>m.marked)) {const bonus=50*merges.filter(m=>m.marked).length;chips+=bonus;lines.push({label:'Foil Stamp',value:bonus});triggers.push('engrave');}
  if(has(s,'mystery')) {const roll=rollFor(s,'mystery');const bonus=(roll-1)*16*(has(s,'prism')?2:1);add('mystery',bonus);lines.push({label:'Mystery roll',value:`${roll} → +${bonus}`});}
  if(has(s,'echo')) {const bonus=Math.min(s.combo,5)*0.2;mult+=bonus;if(bonus){triggers.push('echo');lines.push({label:'Echo Chamber',value:'+'+bonus.toFixed(2)+'×'});}}
  if(has(s,'twins')&&merges.length>=2)multiply('twins',1.6);
  if(has(s,'giant')&&merges.some(m=>m.value>=64))multiply('giant',1.8);
  if(has(s,'room')&&empty>=8)multiply('room',1.5);
  if(has(s,'crowd')&&empty<=4)multiply('crowd',1.8);
  if(has(s,'growth')) {growth+=merges.filter(m=>m.value>=32).length*0.04;multiply('growth',1+growth);}
  if(has(s,'last')&&s.moves-1<=6)multiply('last',2);
  if(has(s,'fuse'))multiply('fuse',s.scoringSlides===0?3:1.2);
  if(has(s,'solo')) {if(merges.length===1)multiply('solo',3);else add('solo',24*(merges.length-1));}
  if(has(s,'pair')) {const values=new Set(result.board.filter(Boolean)).size;if(values===2)multiply('pair',2.2);if(values===2&&has(s,'prism'))add('pair',40);}
  if(has(s,'encore')&&s.encoreReady)multiply('encore',2.4);
  if(has(s,'jackpot')) {const roll=rollFor(s,'jackpot'),factor=[.65,.85,1,1.25,1.8,3.5][roll-1];mult*=factor;triggers.push('jackpot');lines.push({label:'Jackpot roll',value:`${roll} → ×${factor.toFixed(2)}`});}
  if(has(s,'loaded')) {const roll=rollFor(s,'loaded'),factor=roll%2===0?2.1:(has(s,'focus')?1.2:.75);mult*=factor;triggers.push('loaded');lines.push({label:'Loaded Coin',value:`${roll%2===0?'HEADS':'TAILS'} → ×${factor.toFixed(2)}`});}
  if(has(s,'chaos')) {const factor=Number.isFinite(s.chaosFactor)?s.chaosFactor:1;mult*=factor;triggers.push('chaos');lines.push({label:'Chaos Theory',value:`roll ${s.chaosRoll||'—'} → ×${factor.toFixed(2)}`});}
  if(has(s,'crown')) {const max=Math.max(...result.board),atCorner=result.board.some((v,i)=>v===max&&[0,3,12,15].includes(i));if(atCorner)multiply('crown',2.5);else add('crown',48);}
  if(s.forge) {mult*=1+s.forge*0.2;lines.push({label:'Workshop',value:'×'+(1+s.forge*0.2).toFixed(1)});}
  if(s.focus) {mult*=2;lines.push({label:'Overdrive',value:'×2'});}
  if(info.boss&&info.act===3&&s.previous===dir){mult*=0.5;lines.push({label:'The Pendulum',value:'×0.5'});}
  if(info.boss&&info.act===4){mult*=0.7;lines.push({label:'The House',value:'×0.7'});}
  return {chips,mult,points:Math.round(chips*mult),lines,triggers,growth};
}
export function move(s,dir) {
  if(s.phase!=='playing'||s.moves<=0)return false;
  s.marks??=Array(16).fill(null);
  const result=slide(s.board,dir,s.marks);if(!result.changed)return false;
  const before=clone(s);before.undo=null;s.undo=before;
  const scored=scoreSlide(s,result,dir);s.board=result.board;s.marks=result.marks??s.marks;s.moves--;s.turn++;
  s.score+=scored.points;s.totalScore+=scored.points;s.totalMerges+=result.merges.length;s.growth=scored.growth;
  s.combo=result.merges.length?s.combo+1:0;
  if(result.merges.length){s.scoringSlides++;if(s.focus)s.focus--;}
  if(has(s,'gold')&&result.merges.some(m=>m.value>=32)&&s.goldThisRound<3){s.money++;s.goldThisRound++;scored.triggers.push('gold');}
  if(has(s,'encore'))s.encoreReady=!result.merges.length;
  const spawns=[];
  if(!(has(s,'feather')&&s.turn%4===0))spawns.push(spawn(s));
  else scored.triggers.push('feather');
  if(s.round===5&&s.turn%3===0)spawns.push(spawn(s));
  s.highest=Math.max(s.highest,...s.board);s.previous=dir;
  s.last={...scored,merges:result.merges,spawns:spawns.filter(i=>i!==null),motions:result.motions,direction:dir};
  const info=roundInfo(s.round,s.mode);
  if(s.score>=info.target)clearRound(s);
  else if(s.moves<=0||!canMove(s.board))s.phase='danger';
  return true;
}
export function clearRound(s) {
  const info=roundInfo(s.round,s.mode),speed=Math.min(3,Math.floor(s.moves/5)),interest=Math.min(3,Math.floor(s.money/5)),bank=has(s,'bank')?2:0;
  const luckyRoll=has(s,'lucky')?rollFor(s,'lucky'):0,lucky=has(s,'lucky')?[0,0,2,2,2,8][luckyRoll-1]:0;
  s.receipt={base:info.reward,speed,interest,bank,total:info.reward+speed+interest+bank+lucky};
  if(has(s,'lucky')){s.receipt.lucky=lucky;s.receipt.luckyRoll=luckyRoll;}
  s.money+=s.receipt.total;s.roundsCleared=s.round+1;s.phase=s.round===11?'won':'cleared';s.undo=null;
}
export function rollShop(s) {
  const pool=RELICS.filter(r=>!has(s,r.id)&&(r.id!=='crumbs'||s.round<5));
  const picks=shuffled(s,pool,'shopRng').slice(0,3).map(r=>({kind:'relic',id:r.id,sold:false}));
  picks.push(...shuffled(s,POWERS,'shopRng').slice(0,2).map(p=>({kind:'power',id:p.id,sold:false})));
  s.shop=picks;return picks;
}
export function enterShop(s) {if(s.phase!=='cleared')return false;s.phase='shop';s.rerolls=0;rollShop(s);return true;}
export const forgePrice = s=>6+s.forge*4;
export const rerollPrice = s=>2+s.rerolls;
export function buy(s,index) {
  if(s.phase!=='shop')return false;const item=s.shop[index];if(!item||item.sold)return false;
  const data=item.kind==='relic'?relic(item.id):power(item.id);
  if(s.money<data.price||(item.kind==='relic'&&s.relics.length>=5)||(item.kind==='power'&&s.powers.length>=3))return false;
  if(item.kind==='relic'&&has(s,item.id))return false;
  s.money-=data.price;s.spent+=data.price;item.sold=true;
  (item.kind==='relic'?s.relics:s.powers).push(item.id);return true;
}
export function sell(s,id) {
  if(s.phase!=='shop'||!has(s,id))return false;s.relics.splice(s.relics.indexOf(id),1);s.money+=Math.max(1,Math.floor(relic(id).price/2));return true;
}
export function discardPower(s,index){if(s.phase!=='shop'||!s.powers[index])return false;s.powers.splice(index,1);return true;}
export function forge(s) {const cost=forgePrice(s);if(s.phase!=='shop'||s.money<cost||s.forge>=6)return false;s.money-=cost;s.spent+=cost;s.forge++;return true;}
export function reroll(s) {const cost=rerollPrice(s);if(s.phase!=='shop'||s.money<cost)return false;s.money-=cost;s.spent+=cost;s.rerolls++;rollShop(s);return true;}
export function nextRound(s) {if(s.phase!=='shop'||s.round>=11)return false;s.round++;startRound(s);return true;}
export function usePower(s,index,target=null) {
  if(!['playing','danger'].includes(s.phase))return false;
  const id=s.powers[index];if(!id)return false;
  if(['hammer','promote','engrave'].includes(id)&&(!Number.isInteger(target)||target<0||target>15||!s.board[target]))return false;
  if(id==='promote'&&s.board[target]>256)return false;
  if(id==='engrave'&&(s.marks?.[target]||false))return false;
  if(id==='rewind') {
    if(!s.undo)return false;
    const currentPowers=[...s.powers];currentPowers.splice(index,1);
    const previous=clone(s.undo);Object.assign(s,previous);s.powers=currentPowers;s.undo=null;s.last=null;return true;
  }
  s.marks??=Array(16).fill(null);
  if(id==='hammer'){s.board[target]=0;s.marks[target]=null;}
  if(id==='promote'){s.board[target]*=2;s.highest=Math.max(s.highest,...s.board);}
  if(id==='engrave')s.marks[target]='foil';
  if(id==='shuffle'){
    const pairs=shuffled(s,s.board.map((value,index)=>({value,mark:s.marks[index]??null})));
    s.board=pairs.map(x=>x.value);s.marks=pairs.map(x=>x.mark);
  }
  if(id==='moves')s.moves+=5;
  if(id==='focus')s.focus+=3;
  s.powers.splice(index,1);s.undo=null;s.last=null;
  s.phase=s.moves>0&&canMove(s.board)?'playing':'danger';return true;
}
export function finish(s){if(!['won','lost'].includes(s.phase))s.phase='lost';s.undo=null;return s;}
export function validSave(s) {
  return !!s&&s.version===VERSION&&Array.isArray(s.board)&&s.board.length===16&&s.board.every(v=>Number.isSafeInteger(v)&&v>=0&&(v===0||Number.isInteger(Math.log2(v))))&&(!s.marks||Array.isArray(s.marks)&&s.marks.length===16&&s.marks.every(v=>v===null||v==='foil'))&&Number.isInteger(s.round)&&s.round>=0&&s.round<12&&['playing','danger','cleared','shop','won','lost'].includes(s.phase)&&Array.isArray(s.relics)&&s.relics.every(id=>!!relic(id))&&Array.isArray(s.powers)&&s.powers.every(id=>!!power(id))&&Number.isFinite(s.money)&&Number.isFinite(s.rng)&&Number.isFinite(s.shopRng);
}
