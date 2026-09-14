import * as E from '../dist/engine.js';
function value(s,d){const r=E.slide(s.board,d);if(!r.changed)return -Infinity;const pts=E.scoreSlide(s,r,d).points,empty=r.board.filter(v=>!v).length;let smooth=0,links=0;for(let i=0;i<16;i++){if(!r.board[i])continue;for(const j of [i%4<3?i+1:-1,i+4<16?i+4:-1])if(j>=0&&r.board[j]){smooth-=Math.abs(Math.log2(r.board[i])-Math.log2(r.board[j]));if(r.board[i]===r.board[j])links++;}}const max=Math.max(...r.board),corner=[0,3,12,15].some(i=>r.board[i]===max);return pts+empty*(s.spawnBase*1.5)+links*s.spawnBase+smooth*s.spawnBase*.15+(corner?s.spawnBase*2:0);}
const priorities=['prism','growth','giant','orbit','twins','room','echo','spark','fuse','last','corner','clock','bank','feather','compass','crowd','crumbs','gold','mystery','solo','crown','chaos','jackpot','loaded','encore','pair','lucky'];
export function simulate(seed,policy='greedy',mode='standard'){
 const s=E.newRun({seed,mode});let safety=0;
 while(!['won','lost'].includes(s.phase)&&safety++<3000){
  if(s.phase==='playing'){let d;if(policy==='random')d=E.DIRS.filter(d=>E.slide(s.board,d).changed)[Math.floor(E.random(s,'shopRng')*E.DIRS.filter(d=>E.slide(s.board,d).changed).length)];else d=E.DIRS.map(d=>[d,value(s,d)]).sort((a,b)=>b[1]-a[1])[0][0];E.move(s,d);}
  if(s.phase==='danger'){let i=s.powers.indexOf('moves');if(s.moves<=0&&i>=0){E.usePower(s,i);continue;}i=s.powers.indexOf('hammer');if(s.moves>0&&i>=0){E.usePower(s,i,s.board.indexOf(Math.min(...s.board.filter(Boolean))));continue;}E.finish(s);}
  if(s.phase==='cleared')E.enterShop(s);
  if(s.phase==='shop'){
   if(policy!=='no-upgrades'){
    const offers=s.shop.map((o,i)=>({o,i})).filter(x=>x.o.kind==='relic').sort((a,b)=>priorities.indexOf(a.o.id)-priorities.indexOf(b.o.id));
    for(const {o,i}of offers)if(s.relics.length<5&&s.money>=E.relic(o.id).price)E.buy(s,i);
    if(s.relics.length>=4)E.forge(s);
    if(s.powers.length<3&&!s.powers.includes('moves')){const i=s.shop.findIndex(o=>o.id==='moves');if(i>=0)E.buy(s,i);}
   }
   E.nextRound(s);
  }
 }
 return s;
}
if(import.meta.url===new URL(process.argv[1],'file:').href){const n=Number(process.argv[2]||300);for(const policy of ['random','greedy','no-upgrades']){const reached=Array(13).fill(0),samples=[];for(let i=0;i<n;i++){const s=simulate('BALANCE-'+i,policy);reached[s.roundsCleared]++;if(s.phase==='won'&&samples.length<3)samples.push(s.seed);}let cumulative=n;const clearRates=Array.from({length:12},(_,r)=>{cumulative-=reached[r];return Math.round(cumulative/n*100);});console.log(JSON.stringify({policy,n,clearRates,winSeeds:samples}));}}
