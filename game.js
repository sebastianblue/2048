(function(){
"use strict";
const VERSION="1.6";
const STORAGE = new URLSearchParams(location.search).has("qa") ? "ante2048.qa." : "ante2048.";
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const $ = id => document.getElementById(id);
const fmt = n => n >= 1e9 ? (n/1e9).toFixed(2)+"b" : n >= 1e6 ? (n/1e6).toFixed(2)+"m" : Math.round(n).toLocaleString("en-US");
const r1 = n => Math.round(n*10)/10;
function hashStr(s){ let h=1779033703^s.length; for(let i=0;i<s.length;i++){ h=Math.imul(h^s.charCodeAt(i),3432918353); h=h<<13|h>>>19; } return (h>>>0); }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function randSeed(){ const w=["velvet","jackpot","plum","ember","tango","cobalt","mint","otter","quartz","sable","dune","lark"]; return w[Math.floor(Math.random()*w.length)]+"-"+Math.floor(Math.random()*9000+1000); }
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- audio ----------
const audio = window.AnteAudio;
const juice = window.AnteJuice;
function ping(freq, dur=.09, type="sine", vol=.18){ audio.tone(Math.min(1500,freq),dur,vol*.45); }
function chord(n){ audio.effect("score",n); }
function fanfare(){ audio.effect("win"); }

// ---------- content ----------
const BLINDS=[{name:"Opening",mult:1,cash:3},{name:"Raise",mult:1.5,cash:4},{name:"Boss",mult:2,cash:6}];
const TARGETS=[550,1200,2600,5600,12000,26000,56000,120000]; // deck escalation compounds, so the curve does too
const ENDLESS_GROWTH=2.6;
const BASE_MOVES=24, MAX_CHARMS=5, MAX_CONS=3;
const oddExp = v => (Math.log2(v)%2)===1;

const ENH={
 bonus:{ico:"+",name:"Kick",desc:"+30 chips when merged."},
 mult:{ico:"×",name:"Plus",desc:"+4 mult when merged."},
 glass:{ico:"◇",name:"Prism",desc:"×2 mult when merged, twice per move at most. 1 in 4 chance to shatter."},
 steel:{ico:"▦",name:"Iron",desc:"×1.2 mult per iron tile on the board, counting at most 6."},
 gold:{ico:"$",name:"Brass",desc:"+$2 when merged."},
 lucky:{ico:"★",name:"Odds",desc:"1 in 4: +8 mult. 1 in 12: +$4."},
};

// Different finishes can react once per pairing per move. The tile still
// keeps one finish, so the board remains readable and bonuses cannot stack forever.
const REACTIONS=[
 {id:'overprint',pair:['bonus','mult'],name:'Overprint',desc:'Kick + Plus: +40 chips and +2 mult.'},
 {id:'tempered',pair:['glass','steel'],name:'Tempered',desc:'Prism + Iron: this merge cannot shatter. The result keeps Iron.'},
 {id:'shockwave',pair:['bonus','steel'],name:'Shockwave',desc:'Kick + Iron: break one extra loose rubble for 25 chips.'},
 {id:'scratchcard',pair:['gold','lucky'],name:'Scratchcard',desc:'Brass + Odds: 1 in 4 chance for an extra $3.'},
 {id:'refraction',pair:['glass','mult'],name:'Refraction',desc:'Prism + Plus: +2 mult per other enhanced tile in its row or column, up to +6.'},
 {id:'wildfire',pair:['glass','lucky'],name:'Wildfire',desc:'Prism + Odds: 1 in 3 chance to give an adjacent plain tile Odds.'},
];
function reactionFor(enhs){return REACTIONS.find(d=>d.pair.every(e=>enhs.includes(e)));}

// Charm hooks. `me` is the owned instance ({...def, st:{}, sell}). ctx.add(me, {chips|mult|xmult}) records a scoring step.
const CHARMS=[
 {id:"carbon_press",ico:"Ⅱ",name:"Carbon Press",rar:"u",price:7,desc:"First scoring move each round: if it makes exactly one tile of 64 or less, pay <em>$2</em> to copy it into your deck. Needs a free slot.",st:{ready:true},roundStart:me=>{me.st.ready=true;},score:(ctx,me)=>{
   if(!me.st.ready||ctx.as)return;me.st.ready=false;
   const m=ctx.merges[0];if(ctx.merges.length!==1||m.v>64||S.deck.length>=DECK_CAP||S.money<2)return;
   const before=deckSummary(),card={v:m.tile.v,enh:m.tile.enh||null};S.money-=2;S.deck.push(card);S.pile.push({...card});
   recordDeckEdit("carbon_press",before,deckSummary());ctx.note(me,"copied "+card.v+" · −$2");
 }},
 {id:"matched_set",ico:"=",name:"Matched Set",rar:"u",price:6,desc:"<em>+4 mult</em> per pair of identical enhanced tiles in your deck. Caps at +20.",score:(ctx,me)=>{
   const types={};S.deck.filter(c=>c.enh).forEach(c=>{const k=c.v+"|"+c.enh;types[k]=(types[k]||0)+1;});
   const pairs=Object.values(types).reduce((n,c)=>n+Math.floor(c/2),0);if(pairs)ctx.add(me,{mult:Math.min(20,pairs*4)});
 }},
 {id:"offcuts",ico:"−$",name:"Offcuts",rar:"c",price:4,desc:"Whenever a deck edit removes tiles overall, gain <em>$1</em> per tile removed (up to $2 per edit).",onDeckEdit:(me,entry)=>{
   const count=summary=>summary.split(' ').reduce((n,part)=>n+(Number(part.split('x').at(-1))||0),0);
   const removed=Math.max(0,count(entry.before)-count(entry.after));if(removed){const cash=Math.min(2,removed);S.money+=cash;log("Offcuts paid $"+cash+".");}
 }},
 {id:"joker",ico:"+4",name:"House Chip",rar:"c",price:3,desc:"<em>+4 mult</em>.",
  score:(c,me)=>c.add(me,{mult:4})},
 {id:"twins",ico:"Ⅱ",name:"Small Change",rar:"c",price:4,desc:"+12 chips for every merge that makes a <em>4</em> or an <em>8</em>.",
  score:(c,me)=>{ const k=c.merges.filter(m=>m.v<=8).length; if(k) c.add(me,{chips:12*k}); }},
 {id:"corner",ico:"⌜",name:"Corner Pocket",rar:"c",price:4,desc:"+3 mult for each merge that lands in a <em>corner</em>.",
  score:(c,me)=>{ const N=S.N; const k=c.merges.filter(m=>(m.r===0||m.r===N-1)&&(m.c===0||m.c===N-1)).length; if(k) c.add(me,{mult:3*k}); }},
 {id:"breathe",ico:"○",name:"Open Floor",rar:"c",price:4,desc:"+4 chips per <em>empty cell</em> after the move.",
  score:(c,me)=>{ if(c.empty) c.add(me,{chips:4*c.empty}); }},
 {id:"bull",ico:"$²",name:"Cashflow",rar:"c",price:4,desc:"+2 chips per <em>$1</em> you hold (max +40).",
  score:(c,me)=>{ const b=Math.min(40,Math.max(0,S.money)*2); if(b>0) c.add(me,{chips:b}); }},
 {id:"lucky",ico:"⅖",name:"Loaded Hopper",rar:"c",price:4,desc:"2s drawn from your deck become <em>4s</em> 40% of the time.",
  spawnValue:v=>(v===2&&S.rng()<0.4)?4:v},
 {id:"half",ico:"½",name:"Solo Act",rar:"c",price:4,desc:"<em>+10 mult</em> if the move made exactly one merge.",
  score:(c,me)=>{ if(c.merges.length===1) c.add(me,{mult:10}); }},
 {id:"oddx",ico:"2ⁿ",name:"Odd Powers",rar:"c",price:4,desc:"+4 mult per merge that makes <em>2, 8, 32, 128, 512…</em>",
  score:(c,me)=>{ const k=c.merges.filter(m=>oddExp(m.v)).length; if(k) c.add(me,{mult:4*k}); }},
 {id:"evenx",ico:"4ⁿ",name:"Even Powers",rar:"c",price:4,desc:"+25 chips per merge that makes <em>4, 16, 64, 256, 1024…</em>",
  score:(c,me)=>{ const k=c.merges.filter(m=>!oddExp(m.v)).length; if(k) c.add(me,{chips:25*k}); }},
 {id:"misprint",ico:"?",name:"Loose Wire",rar:"c",price:4,desc:"<em>+0 to +20 mult</em>, rolled fresh every scoring move.",
  score:(c,me)=>{ const k=Math.floor(S.rng()*21); c.add(me,{mult:k}); }},
 {id:"bus",ico:"↗",name:"Escalator",rar:"c",price:4,desc:"Gains <em>+1 mult</em> per scoring move, up to +30. Resets to 0 when a move makes a <em>4</em>. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ if(me.st.m>0) c.add(me,{mult:me.st.m}); if(c.merges.some(m=>m.v===4)){ me.st.m=0; c.note(me,"reset"); } else me.st.m=Math.min(30,me.st.m+1); }},
 {id:"green",ico:"+1",name:"Green Light",rar:"c",price:4,desc:"<em>+1 mult</em> per scoring move, <em>−1</em> per move that scores nothing. Caps at +25. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ me.st.m=Math.min(25,me.st.m+1); c.add(me,{mult:me.st.m}); }, noscore:me=>{ me.st.m=Math.max(0,me.st.m-1); }},
 {id:"icecream",ico:"100",name:"Dry Ice",rar:"c",price:4,desc:"<em>+{chips} chips</em>. Melts by 5 chips every scoring move.",
  st:{chips:100}, score:(c,me)=>{ c.add(me,{chips:me.st.chips}); me.st.chips-=5; if(me.st.chips<=0) destroyCharm(me,"melted"); }},
 {id:"popcorn",ico:"20",name:"Firecracker",rar:"c",price:4,desc:"<em>+{mult} mult</em>. Loses 4 mult at the end of every round.",
  st:{mult:20}, score:(c,me)=>c.add(me,{mult:me.st.mult}), roundEnd:(lines,me)=>{ me.st.mult-=4; if(me.st.mult<=0){ destroyCharm(me,"eaten"); lines.push(["Firecracker","all gone"]); } }},
 {id:"egg",ico:"$+",name:"Savings Bond",rar:"c",price:3,desc:"Gains <em>+$3 sell value</em> at the end of every round. <span class='st'>Sells for ${sell}</span>",
  roundEnd:(lines,me)=>{ me.sell+=3; }},
 {id:"golden",ico:"$4",name:"Payday",rar:"c",price:5,desc:"<em>+$4</em> at the end of every round.",
  roundEnd:(lines,me)=>{ S.money+=4; lines.push(["Payday","+$4"]); }},
 {id:"bootstraps",ico:"$5",name:"Compound Interest",rar:"c",price:5,desc:"<em>+2 mult</em> for every <em>$5</em> you have (max +20).",
  score:(c,me)=>{ const k=Math.min(20,Math.floor(Math.max(0,S.money)/5)*2); if(k) c.add(me,{mult:k}); }},
 {id:"overtime",ico:"+8",name:"Night Shift",rar:"c",price:5,desc:"<em>+8 moves</em> every round.", moves:n=>n+8},
 {id:"credit",ico:"−20",name:"Overdraft",rar:"c",price:3,desc:"You can spend down to <em>−$20</em>."},
 {id:"chaos",ico:"↻",name:"Free Spin",rar:"c",price:5,desc:"The <em>first reroll</em> in every shop is free."},
 {id:"duet",ico:"Ⅱ",name:"Duet",rar:"c",price:4,desc:"Exactly <em>2 merges</em> in one move: ×2 mult.",
  score:(c,me)=>{ if(c.merges.length===2) c.add(me,{xmult:2}); }},
 {id:"patience",ico:"…",name:"Rain Check",rar:"c",price:4,desc:"Each move with no merge banks <em>+10 chips</em>, paid out on your next scoring move. <span class='st'>Banked {bank}</span>",
  st:{bank:0}, score:(c,me)=>{ if(me.st.bank){ c.add(me,{chips:me.st.bank}); me.st.bank=0; } }, noscore:me=>{ me.st.bank+=10; }},
 {id:"stamper",ico:"+8",name:"Ink Roller",rar:"c",price:5,desc:"<em>+8 chips</em> for every enhanced tile on the board.",
  score:(c,me)=>{ const k=allTiles().filter(t=>t.enh).length; if(k) c.add(me,{chips:8*k}); }},
 // ----- uncommons -----
 {id:"chain",ico:"++",name:"Linkage",rar:"u",price:6,desc:"+2 extra mult for every merge <em>after the first</em> in a move.",
  score:(c,me)=>{ const k=c.merges.length-1; if(k>0) c.add(me,{mult:2*k}); }},
 {id:"hoarder",ico:"64",name:"High Shelf",rar:"u",price:6,desc:"+1 mult per tile of <em>64 or more</em> on the board, max +12.",
  score:(c,me)=>{ const k=Math.min(12,allTiles().filter(t=>t.v>=64).length); if(k) c.add(me,{mult:k}); }},
 {id:"crowded",ico:"▦",name:"Rush Hour",rar:"u",price:6,desc:"×1.5 mult when <em>4 or fewer</em> cells are empty after the move.",
  score:(c,me)=>{ if(c.empty<=4) c.add(me,{xmult:1.5}); }},
 {id:"erosion",ico:"−2",name:"Vacancy",rar:"u",price:6,desc:"<em>+2 mult</em> for every tile fewer than 8 on the board.",
  score:(c,me)=>{ const k=Math.max(0,8-allTiles().length)*2; if(k) c.add(me,{mult:k}); }},
 {id:"momentum",ico:"→",name:"Flywheel",rar:"u",price:6,desc:"+1 mult for each consecutive move in the <em>same direction</em> (max +5).",
  score:(c,me)=>{ const k=Math.min(5,S.mom.count-1); if(k>0) c.add(me,{mult:k}); }},
 {id:"summit",ico:"▲",name:"High Water",rar:"u",price:6,desc:"×2 mult when a merge creates a <em>new highest tile</em>.",
  score:(c,me)=>{ if(c.newMax) c.add(me,{xmult:2}); }},
 {id:"loyalty",ico:"Ⅴ",name:"Punch Card",rar:"u",price:6,desc:"<em>×4 mult</em> every 5th scoring move. <span class='st'>{n}/5</span>",
  st:{n:0}, score:(c,me)=>{ me.st.n++; if(me.st.n>=5){ me.st.n=0; c.add(me,{xmult:4}); } }},
 {id:"gros",ico:"×2",name:"Cheap Battery",rar:"u",price:6,desc:"<em>×2 mult</em>. 1 in 6 chance to run flat at the end of each round.",
  score:(c,me)=>c.add(me,{xmult:2}), roundEnd:(lines,me)=>{ if(S.rng()<1/6){ destroyCharm(me,"ran flat"); lines.push(["Cheap Battery","ran flat"]); } }},
 {id:"hack",ico:"↶",name:"Double Feed",rar:"u",price:6,desc:"Merges that make <em>16 or less</em> count twice: their chips again, and +1 mult each.",
  score:(c,me)=>{ const s=c.merges.filter(m=>m.v<=16); if(s.length) c.add(me,{chips:s.reduce((a,m)=>a+m.v,0),mult:s.length}); }},
 {id:"dusk",ico:"☽",name:"Last Call",rar:"u",price:6,desc:"<em>×2 mult</em> on your last 5 moves of a round.",
  score:(c,me)=>{ if(S.moves<=5) c.add(me,{xmult:2}); }},
 {id:"mono",ico:"■",name:"Heavy Stock",rar:"u",price:6,desc:"<em>×3 mult</em> if every tile on the board is 16 or more.",
  score:(c,me)=>{ const t=allTiles(); if(t.length&&t.every(x=>x.v>=16)) c.add(me,{xmult:3}); }},
 {id:"baseball",ico:"×U",name:"Union Card",rar:"u",price:7,desc:"<em>×1.5 mult</em> for every other uncommon charm you own.",
  score:(c,me)=>{ const k=S.charms.filter(x=>x!==me&&x.rar==="u").length; if(k) c.add(me,{xmult:Math.min(4,Math.round(Math.pow(1.5,k)*100)/100)}); }},
 {id:"fortune",ico:"✦",name:"Toolbox",rar:"u",price:6,desc:"<em>+1 mult</em> per consumable used this run. <span class='st'>Now +{used}</span>",
  score:(c,me)=>{ if(S.consUsed) c.add(me,{mult:S.consUsed}); }},
 {id:"vagabond",ico:"$0",name:"Care Package",rar:"u",price:6,desc:"At the end of a round, if you have <em>$4 or less</em>, get a random consumable.",
  roundEnd:(lines,me)=>{ if(S.money<=4&&S.cons.length<S.maxCons){ const d=CONS[Math.floor(S.rng()*CONS.length)]; S.cons.push({...d}); lines.push(["Care Package","found "+d.name]); } }},
 {id:"bones",ico:"¼",name:"Safety Net",rar:"u",price:6,desc:"If you'd fail a round with at least <em>25% of the target</em>, you win it instead. Then it leaves."},
 {id:"matador",ico:"$8",name:"Hazard Pay",rar:"u",price:6,desc:"<em>+$8</em> whenever you beat a boss.",
  roundEnd:(lines,me)=>{ if(S.blind===2){ S.money+=8; lines.push(["Hazard Pay","+$8"]); } }},
 {id:"stuntman",ico:"150",name:"Hot Rod",rar:"u",price:7,desc:"<em>+150 chips</em>, but <em>6 fewer moves</em> every round.",
  score:(c,me)=>c.add(me,{chips:150}), moves:n=>n-6},
 {id:"cursed",ico:"$−",name:"Lease",rar:"u",price:6,desc:"<em>×2.5 mult</em>. Costs <em>$3</em> at the end of every round.",
  score:(c,me)=>c.add(me,{xmult:2.5}), roundEnd:(lines,me)=>{ S.money-=3; lines.push(["Lease","−$3"]); }},
 {id:"gambler",ico:"⚄",name:"Coin Toss",rar:"u",price:6,desc:"Every scoring move: 50% chance of <em>×3 mult</em>, otherwise ×0.5.",
  score:(c,me)=>{ c.add(me,{xmult:S.rng()<0.5?3:0.5}); }},
 {id:"heavy",ico:"128",name:"Pile Driver",rar:"u",price:6,desc:"+40 chips for every merge that makes <em>128 or higher</em>.",
  score:(c,me)=>{ const k=c.merges.filter(m=>m.v>=128).length; if(k) c.add(me,{chips:40*k}); }},
 {id:"ghost",ico:"∞",name:"Second Wind",rar:"u",price:6,desc:"Once per round, if you have <em>no legal move</em>, the board reshuffles itself."},
 {id:"compactor",ico:"2→4",name:"Heavy Hopper",rar:"u",price:6,desc:"Every <em>2</em> you draw arrives as a <em>4</em> instead.",
  spawnValue:v=>v===2?4:v},
 {id:"glazier",ico:"◇",name:"Prism Guard",rar:"u",price:6,desc:"Prism tiles <em>never shatter</em>."},
 {id:"archivist",ico:"16+",name:"Catalogue",rar:"u",price:6,desc:"<em>+4 mult</em> for each <em>distinct value of 16 or more</em> in your deck.",
  score:(c,me)=>{ const k=new Set(S.deck.filter(x=>x.v>=16).map(x=>x.v)).size*4; if(k) c.add(me,{mult:k}); }},
 {id:"recycler",ico:"↺",name:"Buyback",rar:"u",price:6,desc:"When you file a tile into the deck, get <em>$1 per doubling</em> of it (a 64 pays $6).",
  onRetire:(me,t)=>{ const k=Math.round(Math.log2(t.v)); S.money+=k; log("Buyback paid $"+k+"."); }},
 {id:"demo",ico:"✕",name:"Wrecking Crew",rar:"c",price:4,desc:"+40 extra chips for every <em>rubble</em> you clear."},
 {id:"roadworks",ico:"═",name:"Roadworks",rar:"u",price:6,desc:"Rubble falls every 9 moves."},
 {id:"drumline",ico:"5×",name:"Drumline",rar:"u",price:6,desc:"<em>\u00d72 mult</em> while your chain is <em>5 or longer</em>.",
  score:(c,me)=>{ if(S.chain>=5) c.add(me,{xmult:2}); }},
 {id:"downbeat",ico:"15+",name:"Downbeat",rar:"u",price:6,desc:"<em>+15 chips</em> for each link in your current chain.",
  score:(c,me)=>{ const k=Math.min(20,S.chain)*15; if(k) c.add(me,{chips:k}); }},
 {id:"mint",ico:"$",name:"Gold Rush",rar:"u",price:6,desc:"Every tile drawn from the deck has a <em>1 in 6</em> chance to come in <em>Brass</em>.",
  onDraw:card=>{ if(!card.enh&&S.rng()<1/6) card.enh="gold"; }},
 // ----- rares -----
 {id:"snowball",ico:"+⅕",name:"Compound",rar:"r",price:8,desc:"Gains <em>+0.2 mult</em> per merge, up to +30. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ me.st.m=r1(Math.min(30,me.st.m+0.2*c.merges.length)); c.add(me,{mult:me.st.m}); }},
 {id:"echo",ico:"≋",name:"Double Take",rar:"r",price:8,desc:"×2 mult when a move makes <em>2 or more merges of the same value</em>.",
  score:(c,me)=>{ const vs=c.merges.map(m=>m.v); if(vs.length>=2 && vs.some(v=>vs.filter(x=>x===v).length>=2)) c.add(me,{xmult:2}); }},
 {id:"quad",ico:"Ⅳ",name:"Clean Sweep",rar:"r",price:8,desc:"<em>4 or more merges</em> in one move: ×3 mult.",
  score:(c,me)=>{ if(c.merges.length>=4) c.add(me,{xmult:3}); }},
 {id:"vampire",ico:"½×",name:"Blood Tax",rar:"r",price:8,desc:"Gains <em>×0.1 mult</em> every time a merge makes 256 or more, but that tile is <em>halved</em>. <span class='st'>Now ×{x}</span>",
  st:{x:1}, score:(c,me)=>{ const big=c.merges.filter(m=>m.v>=256); big.forEach(m=>{ me.st.x=r1(Math.min(3,me.st.x+0.1)); if(m.tile) m.tile.v/=2; }); if(me.st.x>1) c.add(me,{xmult:me.st.x}); if(big.length) c.dirty=true; }},
 {id:"constellation",ico:"✧",name:"Calibration",rar:"r",price:8,desc:"Gains <em>×0.15 mult</em> every time you use a consumable. <span class='st'>Now ×{x}</span>",
  st:{x:1}, score:(c,me)=>{ if(me.st.x>1) c.add(me,{xmult:me.st.x}); }, onUseCon:me=>{ me.st.x=Math.min(3,Math.round((me.st.x+0.15)*100)/100); }},
 {id:"campfire",ico:"×½",name:"Trade Up",rar:"r",price:8,desc:"Gains <em>×0.5 mult</em> for every charm you sell. Resets after you beat a boss. <span class='st'>Now ×{x}</span>",
  st:{x:1}, score:(c,me)=>{ if(me.st.x>1) c.add(me,{xmult:me.st.x}); }, onSell:me=>{ me.st.x=r1(Math.min(4,me.st.x+0.5)); }, roundEnd:(lines,me)=>{ if(S.blind===2) me.st.x=1; }},
 {id:"space",ico:"✶",name:"Cosmic Dust",rar:"r",price:8,desc:"1 in 4 each scoring move to gain <em>+1 mult</em>, up to +25. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ if(S.rng()<0.25&&me.st.m<25){ me.st.m++; c.note(me,"grew"); } if(me.st.m) c.add(me,{mult:me.st.m}); }},
 {id:"cavendish",ico:"×3",name:"Long-Life Battery",rar:"r",price:8,desc:"<em>×3 mult</em>. 1 in 1000 chance to run flat at the end of each round.",
  score:(c,me)=>c.add(me,{xmult:3}), roundEnd:(lines,me)=>{ if(S.rng()<0.001){ destroyCharm(me,"ran flat"); lines.push(["Long-Life Battery","ran flat"]); } }},
 {id:"dagger",ico:"†",name:"Scrap Dealer",rar:"r",price:8,desc:"At the start of each round, <em>destroys the charm to its right</em> and gains mult equal to its price. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ if(me.st.m) c.add(me,{mult:me.st.m}); }, roundStart:me=>{ const i=S.charms.indexOf(me); const v=S.charms[i+1]; if(v&&!v.nosell){ me.st.m+=v.price; destroyCharm(v,"sacrificed"); log("Scrap Dealer took <b>"+v.name+"</b> for +"+v.price+" mult."); } }},
 {id:"blueprint",ico:"⇒",name:"Relay",rar:"r",price:9,desc:"Copies the <em>scoring ability</em> of the charm to its right.",
  score:(c,me)=>{ const i=S.charms.indexOf(me); const v=S.charms[i+1]; if(v&&v.score&&v.id!=="blueprint"){ c.as=me; v.score(c,v); c.as=null; } }},
 {id:"shortcut",ico:"↗",name:"Step Ladder",rar:"r",price:9,desc:"A tile can also merge into a tile <em>twice its value</em> (4 + 8 → 16)."},
 {id:"sixth",ico:"5²",name:"Annex",rar:"r",price:9,desc:"The board becomes <em>5×5</em>. Can't be sold.", nosell:true},
 {id:"alchemist",ico:"++",name:"Catalyst",rar:"r",price:8,desc:"When two <em>enhanced</em> tiles merge, the new tile fires both enhancements <em>again</em>."},
];
const CONS=[
 {id:"recast_item",ico:"⇒",name:"Mould",price:5,desc:"Turn one deck tile into an exact copy of another. Keeps the deck size.",deck:true},
 {id:"split_item",ico:"½",name:"Wedge",price:4,desc:"Split a deck tile into two halves. Both keep its enhancement. Needs a free slot.",deck:true},
 {id:"eraser",ico:"−",name:"Eraser",price:3,desc:"Remove one tile.",targets:1},
 {id:"halve",ico:"½",name:"Halve",price:3,desc:"Halve one tile (a 2 is removed).",targets:1},
 {id:"double",ico:"×2",name:"Double",price:5,desc:"Double one tile.",targets:1},
 {id:"swap",ico:"⇄",name:"Swap",price:4,desc:"Swap two tiles.",targets:2},
 {id:"shuffle",ico:"↻",name:"Shuffle",price:3,desc:"Scatter every tile to a random cell.",targets:0},
 {id:"purge",ico:"∅",name:"Purge",price:4,desc:"Remove every 2 and 4 on the board.",targets:0},
 {id:"undo",ico:"↶",name:"Undo",price:4,desc:"Take back your last move.",targets:0},
 {id:"clock",ico:"+6",name:"Clock",price:3,desc:"+6 moves this round.",targets:0},
 {id:"polish",ico:"×2",name:"Polish",price:6,desc:"Your next 3 scoring moves get ×2 mult.",targets:0},
 {id:"st_bonus",ico:"+30",name:"Kick Stamp",price:3,desc:"Enhance one deck tile: +30 chips when it merges.",targets:1,deck:true,stamp:"bonus"},
 {id:"st_mult",ico:"+4",name:"Plus Stamp",price:4,desc:"Enhance one deck tile: +4 mult when it merges.",targets:1,deck:true,stamp:"mult"},
 {id:"st_glass",ico:"◇",name:"Prism Stamp",price:4,desc:"Enhance one deck tile: ×2 mult when it merges, 1 in 4 to shatter.",targets:1,deck:true,stamp:"glass"},
 {id:"st_steel",ico:"▦",name:"Iron Stamp",price:5,desc:"Enhance one deck tile: ×1.2 mult while on the board, at most 6 counted.",targets:1,deck:true,stamp:"steel"},
 {id:"st_gold",ico:"$",name:"Brass Stamp",price:3,desc:"Enhance one deck tile: +$2 when it merges.",targets:1,deck:true,stamp:"gold"},
 {id:"st_lucky",ico:"★",name:"Odds Stamp",price:3,desc:"Enhance one deck tile: 1 in 4 for +8 mult, 1 in 12 for +$4.",targets:1,deck:true,stamp:"lucky"},
 {id:"jack",ico:"✕",name:"Jackhammer",price:3,desc:"Clear every piece of rubble on the board.",targets:0},
 {id:"file",ico:"↓",name:"Archive",price:7,desc:"Send a tile from the board into your deck. ",targets:1,file:true},
 {id:"promote",ico:"↑",name:"Promote",price:4,desc:"Double one card in your deck. A 2 becomes a 4.",deck:true},
 {id:"twin",ico:"Ⅱ",name:"Twin",price:5,desc:"Add a second copy of one card in your deck.",deck:true},
 {id:"burn",ico:"−",name:"Burn",price:3,desc:"Destroy one card in your deck.",deck:true},
 {id:"temper",ico:"✦",name:"Temper",price:5,desc:"Give one deck card a random enhancement.",deck:true},
];
const VOUCHERS=[
 {id:"overclock",ico:"+4",name:"Overclock",price:8,desc:"+4 moves every round. Stacks up to three times.",max:3,apply:()=>{S.bonusMoves+=4;}},
 {id:"purse",ico:"$+",name:"Bigger Purse",price:8,desc:"Interest cap rises by $2.",max:2,apply:()=>{S.interestCap+=2;}},
 {id:"slot",ico:"Ⅵ",name:"Sixth Slot",price:12,desc:"One more charm slot.",max:1,apply:()=>{S.maxCharms++;}},
 {id:"pockets",ico:"+1",name:"Deep Pockets",price:8,desc:"One more consumable slot.",max:1,apply:()=>{S.maxCons++;}},
 {id:"coupon",ico:"−$2",name:"Coupon Book",price:6,desc:"Rerolls cost $2 less.",max:1,apply:()=>{S.rerollDisc+=2;}},
 {id:"headstart",ico:"×2",name:"Head Start",price:10,desc:"Both of your opening tiles start doubled each round.",max:1,apply:()=>{}},
 {id:"printer",ico:"Ⅳ",name:"Print Shop",price:8,desc:"Tile packs offer one extra card and cost $1 less.",max:1,apply:()=>{S.packSize=4;S.packDisc=1;}},
 {id:"occult",ico:"+1",name:"Supply Line",price:9,desc:"One extra consumable offered in every shop.",max:1,apply:()=>{}},
];
const BOSSES=[
 {id:"freeze",name:"The Freeze",desc:"One tile is frozen in place. It won't move or merge."},
 {id:"flood",name:"The Flood",desc:"Two tiles spawn after every move."},
 {id:"tax",name:"The Tax",desc:"Your final mult is halved."},
 {id:"ceiling",name:"The Ceiling",desc:"Merges that create your current highest tile value score no chips."},
 {id:"hourglass",name:"The Hourglass",desc:"Only 16 moves this round (before bonuses)."},
 {id:"mirror",name:"The Mirror",desc:"Left is right. Up is down."},
 {id:"blackout",name:"The Blackout",desc:"Your first two charms are switched off."},
 {id:"weight",name:"The Weight",desc:"Every new tile spawns as an 8."},
 {id:"plain",name:"The Plain",desc:"Tile enhancements do nothing this round."},
 {id:"drought",name:"The Drought",desc:"Rubble falls twice as often."},
 {id:"metronome",name:"The Metronome",desc:"Your chain bonus caps at 3."},
 {id:"quota",name:"The Quota",desc:"Beating the score isn't enough \u2014 you must also build a big tile."},
 {id:"vice",name:"The Vice",desc:"Several cells are walled off for the whole round."},
];

// ---------- state ----------
let queuedDirection=null;
let S=null, els=new Map(), locked=false, tileId=0, target=null, undoSnap=null, revealTimer=[], T=null, pendingReveal=null;

function newDeck(){ const d=[]; for(let i=0;i<16;i++) d.push({v:2,enh:null}); for(let i=0;i<4;i++) d.push({v:4,enh:null}); return d; }
function reshuffle(){ S.pile=S.deck.map(c=>({...c})); for(let i=S.pile.length-1;i>0;i--){ const j=Math.floor(S.rng()*(i+1)); [S.pile[i],S.pile[j]]=[S.pile[j],S.pile[i]]; } }
function markMadeValue(v){ if(v>4) S.madeValues[String(v)]=(S.madeValues[String(v)]||0)+1; }
function unlockedPackValues(){
  const made=Object.keys(S.madeValues||{}).map(Number).filter(v=>Number.isFinite(v)&&v>4);
  return [2,4,...new Set(made)].sort((a,b)=>a-b);
}
function packValue(){
  const unlocked=unlockedPackValues().filter(v=>v>4);
  // A high card is a treat, not the shop's default. Its odds rise gently
  // with the run, and the pool can only contain values this run has made.
  const highChance=Math.min(0.08+Math.max(0,S.ante-1)*0.025+(S.blind===2?0.02:0),0.24);
  if(unlocked.length&&S.rng()<highChance){
    const weights=unlocked.map((v,i)=>1/((i+1)**2)); const total=weights.reduce((a,b)=>a+b,0); let roll=S.rng()*total;
    for(let i=0;i<unlocked.length;i++){ roll-=weights[i]; if(roll<=0) return unlocked[i]; }
    return unlocked[0];
  }
  return S.rng()<0.58?2:4;
}
function draw(){ if(!S.pile.length) reshuffle(); return S.pile.shift(); }
function deckAvg(){ return S.deck.length ? Math.round(S.deck.reduce((a,c)=>a+c.v,0)/S.deck.length*10)/10 : 0; }
const DECK_CAP=22, DECK_MIN=12;
function enhCapTotal(){ return Math.max(3,Math.floor(S.deck.length/3)); }
function enhCapType(){ return Math.max(2,Math.floor(enhCapTotal()/2)); }
function cutWorst(pred){
  let bi=-1;
  S.deck.forEach((c,i)=>{ if(!pred(c)) return; if(bi<0){ bi=i; return; }
    const b=S.deck[bi]; if(c.v<b.v || (c.v===b.v && !c.enh && b.enh)) bi=i; });
  if(bi<0) return null;
  const cut=S.deck.splice(bi,1)[0];
  const j=S.pile.findIndex(c=>c.v===cut.v&&(c.enh||null)===(cut.enh||null)); if(j>=0) S.pile.splice(j,1);
  return cut;
}
function enhCount(e){ return S.deck.filter(c=>e?c.enh===e:!!c.enh).length; }
function fileCard(v,enh){
  const card={v,enh}; S.deck.push(card); S.pile.splice(Math.floor(S.rng()*(S.pile.length+1)),0,{v,enh});
  const notMe=c=>c!==card;
  // Filing a high-value enhanced tile should be a meaningful choice, but it
  // must not let a run quietly snowball into an all-enhanced deck. Keep the
  // same soft cap used by the deck design: at most one third enhanced, and
  // at most half of that cap in any single finish. Trim an existing card so
  // the tile the player just filed is never silently rejected.
  if(enh){
    if(enhCount(enh)>enhCapType()) return cutWorst(c=>c.enh===enh&&notMe(c));
    if(enhCount(null)>enhCapTotal()) return cutWorst(c=>!!c.enh&&notMe(c));
  }
  return S.deck.length>DECK_CAP ? cutWorst(notMe) : null;
}
function retireTile(t){
  if(t.id===S.frozen) return false;
  S.grid[t.r][t.c]=null;
  const before=deckSummary();
  const cut=fileCard(t.v,t.enh);
  recordDeckEdit("archive",before,deckSummary());
  S.retireLeft--; S.retired.push(t.v+(t.enh?t.enh[0]:""));
  log("Filed <b>"+fmt(t.v)+"</b> into the deck"+(cut?", cutting a "+cut.v+".":"."));
  audio.effect("upgrade");
  S.charms.forEach(c=>{ if(c.onRetire) c.onRetire(c,t); });
  const e=els.get(t.id); if(e){ e.classList.add("shatter"); setTimeout(()=>{ e.remove(); els.delete(t.id); },450); }
  syncTiles(); render(); return true;
}

function newRun(seedStr){
  finishReveal(); queuedDirection=null; locked=false; audio.setScene("round");
  const seed=seedStr.slice(0,48)||randSeed();
  S={ seed, rng:mulberry(hashStr(seed)), ante:1, blind:0, N:4, grid:null, score:0, target:0, moves:0, moveCap:0, money:4,
      charms:[], cons:[], boss:null, frozen:null, mom:{dir:null,count:0}, polish:0, ghostUsed:false, consUsed:0, freeReroll:false,
      usedBosses:[], phase:"start", chain:0, banked:false, blewIt:false, movesMade:0, quota:0, quotaMet:false, shop:null, rerollCost:5, roundsWon:0, totalScore:0, bestMove:0, endless:false,
      maxCharms:MAX_CHARMS, maxCons:MAX_CONS, interestCap:5, bonusMoves:0, rerollDisc:0, vouchers:[], voucher:null,
      deck:null, pile:[], packSize:3, packDisc:0, trims:0, retirePerRound:1, retireLeft:0, retired:[], madeValues:{} };
  S.deck=newDeck(); reshuffle();
  S.grid=Array.from({length:4},()=>Array(4).fill(null));
  els.forEach(e=>e.remove()); els.clear();
  $("seedlbl").textContent="seed "+seed;
  $("log").innerHTML=""; log("New run. Seed <b>"+escapeHTML(seed)+"</b>.");
  T={v:VERSION,deckEdits:[],seed,start:new Date().toISOString(),rounds:[],shops:[],end:null};
  buildCells(); syncTiles();
  startRound();
}
function allTiles(){ const a=[]; for(let r=0;r<S.N;r++) for(let c=0;c<S.N;c++) if(S.grid[r][c]) a.push(S.grid[r][c]); return a; }
function emptyCells(){ const a=[]; for(let r=0;r<S.N;r++) for(let c=0;c<S.N;c++) if(!S.grid[r][c]) a.push([r,c]); return a; }
function maxTile(){ return allTiles().reduce((m,t)=>Math.max(m,t.v),0); }
function boardValues(){ return allTiles().filter(t=>!t.rock).map(t=>t.v+(t.enh?t.enh[0]:"")).sort((a,b)=>parseInt(b)-parseInt(a)); }
function charmOff(i){ return S.boss && S.boss.id==="blackout" && S.phase==="round" && i<2; }
function activeCharms(){ return S.charms.filter((c,i)=>!charmOff(i)); }
function has(id){ return activeCharms().some(c=>c.id===id); }
function makeCharm(def){ return {...def, st: def.st?JSON.parse(JSON.stringify(def.st)):{}, sell:Math.floor(def.price/2), uid:++tileId}; }
function destroyCharm(me,why){
  const i=S.charms.indexOf(me); if(i<0) return; S.charms.splice(i,1);
  log("<b>"+me.name+"</b> "+why+".");
  const el=document.querySelector('.card[data-uid="'+me.uid+'"]'); if(el){ el.classList.add("gone"); setTimeout(render,450); } else render();
}
function moneyFloor(){ return has("credit")?-20:0; }
function spawnRock(fixed){
  const e=emptyCells(); if(!e.length) return null;
  const [r,c]=e[Math.floor(S.rng()*e.length)];
  const t={id:++tileId,v:0,rock:true,fixed:!!fixed,r,c}; S.grid[r][c]=t; return t;
}
function rubbleEvery(){
  if(S.boss&&S.boss.id==="drought") return 3;
  if(has("roadworks")) return 9;
  let e = S.ante<=2?6:S.ante<=5?5:4;
  if(S.movesMade>=Math.floor(S.moveCap/2)) e=Math.max(3,e-2);
  return e;
}
function spawn(){
  const e=emptyCells(); if(!e.length) return null;
  const [r,c]=e[Math.floor(S.rng()*e.length)];
  const card=draw(); let v=card.v, enh=card.enh;
  activeCharms().forEach(ch=>{ if(ch.onDraw) ch.onDraw(card); }); enh=card.enh;
  if(S.boss && S.boss.id==="weight" && S.phase==="round") v=8;
  else activeCharms().forEach(ch=>{ if(ch.spawnValue) v=ch.spawnValue(v); });
  const t={id:++tileId,v,enh,r,c}; S.grid[r][c]=t; return t;
}
function targetFor(ante,blind){
  const base= ante<=8 ? TARGETS[ante-1] : TARGETS[7]*Math.pow(ENDLESS_GROWTH,ante-8);
  return Math.floor(base*BLINDS[blind].mult);
}
function roundMoves(){
  let n=BASE_MOVES+S.bonusMoves;
  if(S.boss && S.boss.id==="hourglass") n=16+S.bonusMoves;
  activeCharms().forEach(c=>{ if(c.moves) n=c.moves(n); });
  return Math.max(8,n);
}
function deckSummary(){ const m={}; S.deck.forEach(c=>{ const k=(c.enh?c.enh+" ":"")+c.v; m[k]=(m[k]||0)+1; }); return Object.keys(m).sort((a,b)=>parseInt(a.split(" ").pop())-parseInt(b.split(" ").pop())).map(k=>k.replace(" ","")+"x"+m[k]).join(" "); }

function startRound(){
  audio.setScene(S.blind===2?"boss":"round");
  S.phase="round"; S.score=0; S.frozen=null; S.ghostUsed=false; S.mom={dir:null,count:0}; undoSnap=null;
  S.boss = S.blind===2 ? pickBoss() : null;
  S.target=targetFor(S.ante,S.blind);
  S.grid=Array.from({length:S.N},()=>Array(S.N).fill(null));
  syncTiles();
  S.chain=0; S.banked=false; S.blewIt=false; S.movesMade=0; S.quota=0; S.quotaMet=false; S.rubbleIn=99;
  spawn(); spawn();
  if(S.boss&&S.boss.id==="vice"){ for(let i=0;i<Math.max(2,S.N-2);i++) spawnRock(true); }
  if(S.boss&&S.boss.id==="quota"){ S.quota=S.ante<=2?64:S.ante<=4?128:256; }
  if(S.vouchers.includes("headstart")){ allTiles().sort((a,b)=>a.v-b.v).forEach(t=>{ t.v*=2; }); }
  activeCharms().slice().forEach(c=>{ if(c.roundStart) c.roundStart(c); });
  S.moves=roundMoves(); S.moveCap=S.moves; S.rubbleIn=rubbleEvery();
  if(S.boss && S.boss.id==="freeze"){ const t=allTiles(); const pick=t[Math.floor(S.rng()*t.length)]; S.frozen=pick.id; }
  T.rounds.push({ante:S.ante,blind:BLINDS[S.blind].name,boss:S.boss?S.boss.id:null,target:S.target,movesAllowed:S.moves,moneyStart:S.money,
    boardStart:boardValues(),charms:S.charms.map(c=>c.id),cons:S.cons.map(c=>c.id),vouchers:S.vouchers.slice(),deck:deckSummary(),deckAvg:deckAvg(),moves:[],result:null});
  syncTiles(); render(); calcIdle();
  log("<b>Ante "+S.ante+" · "+BLINDS[S.blind].name+"</b> — target "+fmt(S.target)+".");
  if(S.boss){
    $("bossnm").textContent=S.boss.name; $("bossdesc").textContent=S.boss.desc;
    $("bossprep").innerHTML="Target <b>"+fmt(S.target)+"</b> in <b>"+S.moves+"</b> moves.";
    show("ov-boss"); audio.effect("boss");
  }
}
function curRound(){ return T.rounds[T.rounds.length-1]; }
function pickBoss(){
  let pool=BOSSES.filter(b=>!S.usedBosses.includes(b.id)); if(!pool.length){S.usedBosses=[];pool=BOSSES.slice();}
  const b=pool[Math.floor(S.rng()*pool.length)]; S.usedBosses.push(b.id); return b;
}

// ---------- movement ----------
function lineCells(dir){
  const N=S.N, lines=[];
  for(let i=0;i<N;i++){ const line=[]; for(let j=0;j<N;j++){
    if(dir==="left") line.push([i,j]); else if(dir==="right") line.push([i,N-1-j]);
    else if(dir==="up") line.push([j,i]); else line.push([N-1-j,i]); } lines.push(line); }
  return lines;
}
function isFixed(t){ return t.id===S.frozen || t.fixed; }
function canMerge(a,b){ if(a.rock||b.rock) return false; if(a.v===b.v) return true; return has("shortcut") && (a.v*2===b.v || b.v*2===a.v); }
function slide(dir, commit){
  const N=S.N, out=Array.from({length:N},()=>Array(N).fill(null)), merges=[]; let moved=false;
  for(const line of lineCells(dir)){
    let seg=[];
    const flush=()=>{
      const tiles=seg.map(([r,c])=>S.grid[r][c]).filter(Boolean), res=[];
      for(let i=0;i<tiles.length;i++){
        if(i+1<tiles.length && canMerge(tiles[i],tiles[i+1])){ res.push({tile:tiles[i],eaten:tiles[i+1]}); i++; }
        else res.push({tile:tiles[i]});
      }
      res.forEach((x,k)=>{ const [r,c]=seg[k]; if(x.tile.r!==r||x.tile.c!==c||x.eaten) moved=true;
        out[r][c]=x.tile; if(commit){ x.tile.r=r;x.tile.c=c; if(x.eaten){ x.tile.v=Math.max(x.tile.v,x.eaten.v)*2; markMadeValue(x.tile.v); x.eaten.r=r; x.eaten.c=c;
          const enhs=[x.tile.enh,x.eaten.enh].filter(Boolean); x.tile.enh=x.tile.enh||x.eaten.enh;
          merges.push({tile:x.tile,eaten:x.eaten,v:x.tile.v,r,c,enhs}); } } });
      seg=[];
    };
    for(const [r,c] of line){
      const t=S.grid[r][c];
      if(t && isFixed(t)){ flush(); out[r][c]=t; if(commit){t.r=r;t.c=c;} }
      else seg.push([r,c]);
    }
    flush();
  }
  if(commit) S.grid=out;
  return {moved,merges};
}
function ensureTiles(){ while(allTiles().length<2 && emptyCells().length) spawn(); }
function canMove(){ return ["left","right","up","down"].some(d=>slide(d,false).moved); }
function mirror(d){ return {left:"right",right:"left",up:"down",down:"up"}[d]; }

function move(dir){
  if(!S||S.phase!=="round"||target||document.querySelector(".ov.show")) return;
  if(locked){ queuedDirection=dir; return; }
  finishReveal();
  if(S.boss&&S.boss.id==="mirror") dir=mirror(dir);
  const snap=snapshot();
  const maxBefore=maxTile();
  const res=slide(dir,true);
  if(!res.moved){ $("board").classList.remove("shake"); void $("board").offsetWidth; $("board").classList.add("shake"); audio.effect("bump"); return; }
  undoSnap=snap; locked=true;
  if(S.mom.dir===dir) S.mom.count++; else S.mom={dir,count:1};
  S.moves--;
  allTiles().forEach(t=>place(t));
  res.merges.forEach(m=>{ place(m.eaten); });
  audio.effect("slide");
  setTimeout(()=>{
    res.merges.forEach(m=>{ const e=els.get(m.eaten.id); if(e){e.remove();els.delete(m.eaten.id);} const k=els.get(m.tile.id); if(k){ setVal(k,m.tile); k.classList.remove("pop"); void k.offsetWidth; k.classList.add("pop"); } });
    if(res.merges.length){audio.effect("merge",{count:res.merges.length,peak:Math.max(...res.merges.map(m=>m.v)),chain:S.chain});juice?.merge(res.merges,els);}
    const spawns=(S.boss&&S.boss.id==="flood")?2:1;
    for(let i=0;i<spawns;i++) spawn();
    S.movesMade++;
    if(--S.rubbleIn<=0){ S.rubbleIn=rubbleEvery(); const rk=spawnRock(false); if(rk){ log("Rubble fell."); audio.effect("rubble"); } }
    syncTiles();
    const result=score(res.merges,maxBefore);
    locked=false;
    render();
    afterMove(result);
    if(queuedDirection){ const next=queuedDirection; queuedDirection=null; setTimeout(()=>move(next),0); }
  },reduced?0:120);
}
function score(merges,maxBefore){
  const rec={dir:S.mom.dir[0],merges:merges.map(m=>m.v),chips:0,mult:1,total:0,movesLeft:S.moves};
  if(!merges.length){ S.chain=0; activeCharms().forEach(c=>{ if(c.noscore) c.noscore(c); }); calcNone(); curRound().moves.push(rec); return {total:0,steps:[]}; }
  S.chain++;
  if(S.quota&&merges.some(m=>m.v>=S.quota)) S.quotaMet=true;
  const ctx={merges:merges.map(m=>({v:m.v,r:m.r,c:m.c,tile:m.tile,enhs:m.enhs})),chips:0,mult:1,xmult:1,steps:[],empty:emptyCells().length,newMax:maxTile()>maxBefore,as:null,dirty:false,
    add(me,d){ const who=this.as||me; if(d.chips){ this.chips+=d.chips; } if(d.mult){ this.mult+=d.mult; } if(d.xmult){ this.xmult*=d.xmult; }
      this.steps.push({name:who?who.name:"", uid:who?who.uid:null, chips:d.chips||0, mult:d.mult||0, xmult:d.xmult||0, via:this.as&&me!==this.as?me.name:null}); },
    note(me,txt){ this.steps.push({name:me.name,uid:me.uid,txt}); } };
  const ceiling=S.boss&&S.boss.id==="ceiling"; const mx=maxTile();
  let base=0; const ceil=[];
  ctx.merges.forEach(m=>{ if(ceiling&&m.v===mx) ceil.push(m.v); else base+=m.v; });
  ctx.chips=base; ctx.steps.push({name:"merged "+ctx.merges.map(m=>m.v).join("+"),chips:base,mult:0,xmult:0});
  if(ceil.length) ctx.steps.push({name:"The Ceiling",txt:"0 chips for "+ceil.join(", ")});
  // tile enhancements
  const plain=S.boss&&S.boss.id==="plain"; const shatterList=[]; let glassFired=0;
  const reactions=[],reactionIds=new Set();
  if(!plain)ctx.merges.forEach(m=>{
    const d=reactionFor(m.enhs);
    if(d&&!reactionIds.has(d.id)){reactionIds.add(d.id);reactions.push({d,m});}
  });
  const tempered=new Set(reactions.filter(x=>x.d.id==='tempered').map(x=>x.m.tile.id));
  if(!plain){
    ctx.merges.forEach(m=>{
      let list=m.enhs.slice(); if(has("alchemist")&&m.enhs.length>=2) list=list.concat(m.enhs);
      list.forEach(e=>{
        const add=(d)=>{ if(d.chips) ctx.chips+=d.chips; if(d.mult) ctx.mult+=d.mult; if(d.xmult) ctx.xmult*=d.xmult; ctx.steps.push({name:ENH[e].name+" tile",tid:m.tile.id,chips:d.chips||0,mult:d.mult||0,xmult:d.xmult||0}); };
        if(e==="bonus") add({chips:30});
        else if(e==="mult") add({mult:4});
        else if(e==="glass"){ if(glassFired<2){ glassFired++; add({xmult:2}); } if(!tempered.has(m.tile.id)&&!has("glazier")&&S.rng()<0.25) shatterList.push(m.tile); }
        else if(e==="gold"){ S.money+=2; ctx.steps.push({name:"Brass tile",tid:m.tile.id,txt:"+$2"}); }
        else if(e==="lucky"){ if(S.rng()<0.25) add({mult:8}); else ctx.steps.push({name:"Odds tile",tid:m.tile.id,txt:"no luck"}); if(S.rng()<1/12){ S.money+=4; ctx.steps.push({name:"Odds tile",tid:m.tile.id,txt:"+$4"}); } }
      });
    });
    const steelN=allTiles().filter(t=>t.enh==="steel").length, steelC=Math.min(6,steelN);
    if(steelC){ const x=Math.round(Math.pow(1.2,steelC)*100)/100; ctx.xmult*=x; ctx.steps.push({name:steelN+" Iron on board"+(steelN>6?" (6 count)":""),chips:0,mult:0,xmult:x}); }
  } else if(ctx.merges.some(m=>m.enhs.length)) ctx.steps.push({name:"The Plain",txt:"enhancements off"});
  if(merges.length>1){ const w=(merges.length-1)*2; ctx.mult+=w; ctx.steps.push({name:merges.length+" merges at once",chips:0,mult:w,xmult:0}); }
  const chainCap=(S.boss&&S.boss.id==="metronome")?3:20;
  const cb=Math.min(chainCap,S.chain-1);
  if(cb>0){ ctx.mult+=cb; ctx.steps.push({name:"Chain "+S.chain,chips:0,mult:cb,xmult:0}); }
  const rocks=allTiles().filter(t=>t.rock&&!t.fixed);
  const cleared=rocks.filter(t=>merges.some(m=>m.r===t.r||m.c===t.c));
  if(cleared.length){
    cleared.forEach(t=>{ if(S.grid[t.r][t.c]===t) S.grid[t.r][t.c]=null; const e=els.get(t.id); if(e){ e.classList.add("shatter"); setTimeout(()=>{ e.remove(); els.delete(t.id); },450); } });
    let rc=25*cleared.length; if(has("demo")) rc+=40*cleared.length;
    ctx.chips+=rc; ctx.steps.push({name:"Cleared "+cleared.length+" rubble",chips:rc,mult:0,xmult:0});
    ctx.dirty=true;
  }
  reactions.forEach(({d,m})=>{
    const step={name:d.name,tid:m.tile.id,reaction:d.id};
    if(d.id==='overprint'){ctx.chips+=40;ctx.mult+=2;step.chips=40;step.mult=2;}
    if(d.id==='tempered'){m.tile.enh='steel';ctx.dirty=true;step.txt='kept Iron · no shatter';}
    if(d.id==='shockwave'){
      const rubble=allTiles().filter(t=>t.rock&&!t.fixed&&t.id!==S.frozen).sort((a,b)=>(Math.abs(a.r-m.r)+Math.abs(a.c-m.c))-(Math.abs(b.r-m.r)+Math.abs(b.c-m.c)))[0];
      if(rubble){S.grid[rubble.r][rubble.c]=null;ctx.chips+=25;step.chips=25;ctx.dirty=true;}else step.txt='no loose rubble';
    }
    if(d.id==='scratchcard'){const hit=S.rng()<.25;if(hit)S.money+=3;step.txt=hit?'+$3':'no payout';}
    if(d.id==='refraction'){
      const mult=Math.min(6,2*allTiles().filter(t=>t.id!==m.tile.id&&t.enh&&(t.r===m.r||t.c===m.c)).length);
      if(mult){ctx.mult+=mult;step.mult=mult;}else step.txt='no enhanced neighbours in line';
    }
    if(d.id==='wildfire'){
      const neighbours=allTiles().filter(t=>!t.rock&&!t.enh&&Math.abs(t.r-m.r)+Math.abs(t.c-m.c)===1);
      if(neighbours.length&&S.rng()<1/3){const t=neighbours[Math.floor(S.rng()*neighbours.length)];t.enh='lucky';ctx.dirty=true;step.txt='Odds spread to '+t.v;}else step.txt='no spark';
    }
    ctx.steps.push(step);juice?.reaction(els.get(m.tile.id),d.name);
  });
  if(reactions.length){rec.reactions=reactions.map(x=>x.d.id);audio.effect('reaction');}
  activeCharms().slice().forEach(c=>{ if(c.score) c.score(ctx,c); });
  if(S.polish>0){ ctx.xmult*=2; S.polish--; ctx.steps.push({name:"Polish",chips:0,mult:0,xmult:2}); }
  if(S.boss&&S.boss.id==="tax"){ ctx.xmult*=0.5; ctx.steps.push({name:"The Tax",chips:0,mult:0,xmult:0.5}); }
  const mult=Math.round(ctx.mult*ctx.xmult*100)/100;
  const total=Math.floor(ctx.chips*mult);
  S.score+=total; S.totalScore+=total; if(total>S.bestMove) S.bestMove=total;
  rec.chips=ctx.chips; rec.mult=mult; rec.total=total; if(shatterList.length) rec.shatter=shatterList.length; curRound().moves.push(rec);
  shatterList.forEach(t=>{ if(t.id!==S.frozen && S.grid[t.r]&&S.grid[t.r][t.c]===t){ S.grid[t.r][t.c]=null; ctx.steps.push({name:"Prism",tid:t.id,txt:"shattered "+t.v+"!",shatter:true}); const e=els.get(t.id); if(e){ e.classList.add("shatter"); setTimeout(()=>{ e.remove(); els.delete(t.id); },450); } } });
  if(ctx.dirty) syncTiles();
  return {total,steps:ctx.steps,chips:ctx.chips,mult};
}

// ---------- the receipt reveal ----------
function finishReveal(){ revealTimer.forEach(clearTimeout); revealTimer=[]; if(pendingReveal){ const p=pendingReveal; pendingReveal=null; calcFinal(p); } }
function tapeShell(){
  $("calc").innerHTML="<div class='hd'><span>score receipt</span><span>ante "+S.ante+" · "+BLINDS[S.blind].name.toLowerCase()+" · move "+(S.moveCap-S.moves)+"</span></div><div class='lines' id='cLines'></div><div class='tot'><span class='chips' id='cChips'>0</span><span class='eq'>chips ×</span><span class='mult' id='cMult'>1</span><span class='eq'>mult =</span><span class='sum' id='cTot'></span></div>";
}
function lineEl(s){
  const ln=document.createElement("div"); const l=document.createElement("span"); l.className="l"; const d=document.createElement("span"); d.className="dots"; const r=document.createElement("span"); r.className="r";
  l.textContent=(s.via?s.name+" ⇐ "+s.via:s.name);
  if(s.txt){ ln.className="ln n"; r.textContent=s.txt; }
  else{ const parts=[]; if(s.chips) parts.push("+"+fmt(s.chips)+" chips"); if(s.mult) parts.push("+"+s.mult+" mult"); if(s.xmult) parts.push("×"+s.xmult+" mult"); ln.className="ln "+(s.xmult?"x":s.mult?"m":"c"); r.textContent=parts.join("  "); }
  ln.appendChild(l); ln.appendChild(d); ln.appendChild(r); return ln;
}
function reveal(res){
  finishReveal(); tapeShell();
  let chips=0, mult=1, x=1;
  const stepMs = reduced?0:Math.max(45,Math.min(110,700/res.steps.length));
  pendingReveal=res;
  res.steps.forEach((s,i)=>{
    revealTimer.push(setTimeout(()=>{
      const lines=$("cLines"); if(!lines) return;
      lines.appendChild(lineEl(s)); lines.scrollTop=lines.scrollHeight;
      if(!s.txt){
        if(s.chips){ chips+=s.chips; const e=$("cChips"); e.textContent=fmt(chips); e.classList.remove("punch"); void e.offsetWidth; e.classList.add("punch"); }
        if(s.mult||s.xmult){ if(s.mult) mult+=s.mult; if(s.xmult) x*=s.xmult; const e=$("cMult"); e.textContent=(Math.round(mult*x*100)/100); e.classList.remove("punch"); void e.offsetWidth; e.classList.add("punch"); }
      }
      if(s.uid){ const el=document.querySelector('.card[data-uid="'+s.uid+'"]'); if(el){ el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); } }
      if(s.tid&&!s.shatter){ const el=els.get(s.tid); if(el){ el.classList.remove("zap"); void el.offsetWidth; el.classList.add("zap"); } }
    },stepMs*i));
  });
  revealTimer.push(setTimeout(()=>{ pendingReveal=null; calcFinal(res); },stepMs*res.steps.length+40));
}
function calcFinal(res){
  if(!$("cTot")) tapeShell();
  $("cChips").textContent=fmt(res.chips); $("cMult").textContent=res.mult;
  const lines=$("cLines"); lines.innerHTML=""; res.steps.forEach(s=>lines.appendChild(lineEl(s))); lines.scrollTop=lines.scrollHeight;
  const t=$("cTot"); t.textContent=fmt(res.total); t.classList.remove("slam"); void t.offsetWidth; t.classList.add("slam");
  const big=res.total>=S.target*0.5, huge=res.total>=S.target;
  floatText("+"+fmt(res.total), big);
  if(!reduced){ document.body.classList.remove("quake","quake-big"); void document.body.offsetWidth; if(huge) document.body.classList.add("quake-big"); else if(big||res.mult>=8) document.body.classList.add("quake"); }
  chord(Math.min(7, 2+Math.floor(Math.log2(Math.max(1,res.mult)))));
  const sl=$("scorelbl"); sl.classList.remove("bump"); void sl.offsetWidth; sl.classList.add("bump");
  $("announcer").textContent="Scored "+fmt(res.total)+". Round score "+fmt(S.score)+" of "+fmt(S.target)+".";
  render();
}

function afterMove(result){
  if(result.total>0) reveal(result);
  const r=curRound();
  const quotaOk = !S.quota || S.quotaMet;
  if(S.score>=S.target && quotaOk && !S.banked){ S.banked=true; banner("Target cleared"); audio.effect("bank"); log("<b>Target cleared.</b> Bank now, or keep playing for extra cash."); }
  ensureTiles();
  if(!canMove() && has("ghost") && !S.ghostUsed){ S.ghostUsed=true; shuffleBoard(); log("<b>Second Wind</b> reshuffled the board."); hint("Second Wind saved you. Once per round.",true); render(); if(canMove()&&S.moves>0) return; }
  if(S.banked && (S.moves<=0 || !canMove())){
    if(!canMove()){ S.blewIt=true; log("Locked up after banking — overflow lost."); }
    S.phase="cash"; setTimeout(()=>winRound(),400); return;
  }
  if(S.moves<=0 || !canMove()){
    const bones=S.charms.find(c=>c.id==="bones");
    if(bones && S.score>=S.target*0.25){ destroyCharm(bones,"kept its promise and left"); r.bones=true; S.phase="cash"; setTimeout(()=>winRound(true),600); return; }
    gameOver(S.quota&&!S.quotaMet&&S.score>=S.target ? "You hit the score but never built a "+S.quota+"." : S.moves<=0 ? "Out of moves. You scored "+fmt(S.score)+" of "+fmt(S.target)+"." : "No legal moves. The board locked up at "+fmt(S.score)+" of "+fmt(S.target)+".");
  }
}
function snapshot(){ return {grid:S.grid.map(row=>row.map(t=>t?{...t}:null)),score:S.score,moves:S.moves,money:S.money,madeValues:{...S.madeValues},mom:{...S.mom},polish:S.polish,pile:S.pile.map(c=>({...c})),charmSt:S.charms.map(c=>JSON.stringify(c.st))}; }
function restore(sn){
  S.grid=sn.grid.map(row=>row.map(t=>t?{...t}:null)); S.score=sn.score; S.moves=sn.moves; S.money=sn.money; S.madeValues={...sn.madeValues}; S.mom={...sn.mom}; S.polish=sn.polish; S.pile=sn.pile.map(c=>({...c}));
  S.charms.forEach((c,i)=>{ if(sn.charmSt[i]) c.st=JSON.parse(sn.charmSt[i]); });
  curRound().moves.push({undo:true});
  syncTiles(); render(); calcIdle();
}
function shuffleBoard(){
  const tiles=allTiles(); const cells=[]; for(let r=0;r<S.N;r++) for(let c=0;c<S.N;c++) cells.push([r,c]);
  for(let i=cells.length-1;i>0;i--){ const j=Math.floor(S.rng()*(i+1)); [cells[i],cells[j]]=[cells[j],cells[i]]; }
  S.grid=Array.from({length:S.N},()=>Array(S.N).fill(null));
  tiles.forEach((t,i)=>{ const [r,c]=cells[i]; t.r=r;t.c=c;S.grid[r][c]=t; });
  syncTiles();
}

// ---------- round end / shop ----------
function overflowCash(){ return Math.min(10,Math.floor((S.score-S.target)/Math.max(1,S.target*0.4))); }
function winRound(viaBones){
  finishReveal();
  S.phase="cash"; S.roundsWon++;
  const lines=[]; const b=BLINDS[S.blind];
  S.money+=b.cash; lines.push([b.name+" cleared","+$"+b.cash]);
  if(S.banked && !S.blewIt){
    const over=S.score-S.target;
    const bonus=overflowCash();
    if(bonus){ S.money+=bonus; lines.push(["Overflow "+fmt(over),"+$"+bonus]); }
  } else if(S.blewIt) lines.push(["Locked up after banking","overflow lost"]);
  const interest=Math.min(S.interestCap,Math.floor(Math.max(0,S.money)/5)); if(interest){ S.money+=interest; lines.push(["Interest (1 per $5, max "+S.interestCap+")","+$"+interest]); }
  activeCharms().slice().forEach(c=>{ if(c.roundEnd) c.roundEnd(lines,c); });
  S.frozen=null;
  const r=curRound(); r.result="win"; r.score=S.score; r.movesUsed=r.movesAllowed-S.moves; r.maxTile=maxTile(); r.tilesEnd=allTiles().filter(t=>!t.rock).length; r.moneyEnd=S.money; r.boardEnd=boardValues();
  $("cashtitle").textContent= viaBones ? "Safety Net pulled you through" : S.blind===2 ? S.boss.name+" beaten" : b.name+" cleared";
  $("cashlines").innerHTML=lines.map(([a,b])=>"<div><span>"+a+"</span><b>"+b+"</b></div>").join("")+"<div><span>Score</span><b style='color:var(--ink)'>"+fmt(S.score)+" / "+fmt(S.target)+"</b></div>";
  $("retirehead").style.display="none";
  log("Won with "+fmt(S.score)+". Money now $"+S.money+".");
  banner(S.blind===2?"Boss down":"Target beaten"); confetti(); fanfare(); render(); syncTiles(); saveT();
  setTimeout(()=>{show("ov-cash");juice?.round($("ov-cash"),S.blind===2);},reduced?100:900);
}
function renderRetire(){
  const box=$("retirebox"); box.innerHTML="";
  const tiles=allTiles().filter(t=>!t.rock&&t.id!==S.frozen).sort((a,b)=>b.v-a.v);
  if(S.retireLeft<=0||!tiles.length){ $("retirehead").style.display="none"; box.style.display="none"; $("btncash").textContent="Cash out"; return; }
  $("retirehead").style.display=""; box.style.display="";
  $("retirenote").textContent=S.retireLeft>1?"pick "+S.retireLeft+" tiles to keep":"pick one tile to keep";
  tiles.forEach(t=>{
    const el=document.createElement("button"); el.className="opt";
    const m=miniTile({v:t.v,enh:t.enh}); m.style.cssText="width:54px;height:54px;font-size:22px";
    el.appendChild(m);
    const n=document.createElement("div"); n.className="ds"; n.textContent=t.enh?ENH[t.enh].name.toLowerCase():"plain"; el.appendChild(n);
    el.onclick=()=>{ if(retireTile(t)) renderRetire(); };
    box.appendChild(el);
  });
  $("btncash").textContent="Skip and cash out";
}
function banner(txt){ const b=document.createElement("div"); b.className="banner"; b.innerHTML="<span></span>"; b.firstChild.textContent=txt; $("board").appendChild(b); setTimeout(()=>b.remove(),1300); }
function confetti(){ if(reduced) return; const cols=["#edc15c","#efe8d4","#d75838","#a9c288"]; for(let i=0;i<28;i++){ const c=document.createElement("div"); c.className="conf"; c.style.left=Math.random()*100+"vw"; c.style.top=(-20-Math.random()*60)+"px"; c.style.background=cols[i%cols.length]; c.style.animationDelay=(Math.random()*.4)+"s"; document.body.appendChild(c); setTimeout(()=>c.remove(),1800); } }
$("btncashnow").onclick=()=>{ if(S.phase==="round"&&S.banked){ S.phase="cash"; finishReveal(); winRound(); } };
$("btncash").onclick=()=>{
  const rr=curRound(); if(S.retired.length){ rr.filed=S.retired.slice(); S.retired=[]; }
  hide("ov-cash");
  if(S.blind===2 && S.ante===8 && !S.endless){ winRun(); return; }
  openShop();
};
function nextRound(){
  S.blind++; if(S.blind>2){ S.blind=0; S.ante++; }
  startRound();
}
function weightedCharm(exclude){
  const pool=CHARMS.filter(c=>!exclude.includes(c.id) && !S.charms.some(o=>o.id===c.id));
  if(!pool.length) return null;
  const w=c=>c.rar==="c"?6:c.rar==="u"?3:1;
  let tot=pool.reduce((a,c)=>a+w(c),0), r=S.rng()*tot;
  for(const c of pool){ r-=w(c); if(r<=0) return c; } return pool[pool.length-1];
}
function rollShop(){
  const items=[]; const ex=[];
  for(let i=0;i<3;i++){ const c=weightedCharm(ex); if(c){ ex.push(c.id); items.push({kind:"charm",def:c,sold:false}); } }
  const cx=[]; const nCon=2+(S.vouchers.includes("occult")?1:0);
  for(let i=0;i<nCon;i++){ const pool=CONS.filter(c=>!cx.includes(c.id)); const c=pool[Math.floor(S.rng()*pool.length)]; cx.push(c.id); items.push({kind:"con",def:c,sold:false}); }
  S.shop=items;
}
function openShop(){
  audio.setScene("shop");
  S.pendingJobPack=null; S.pendingTilePack=null;
  S.phase="shop"; S.rerollCost=Math.max(1,5-S.rerollDisc); S.freeReroll=has("chaos"); rollShop(); pickVoucher();
  S.packs=rollPacks();
  T.shops.push({afterAnte:S.ante,afterBlind:BLINDS[S.blind].name,money:S.money,offered:S.shop.map(i=>i.def.id).concat(S.voucher?["v:"+S.voucher.def.id]:[]).concat(S.packs.map(p=>'pack:'+p.kind+':'+p.size)),bought:[],sold:[],rerolls:0});
  const nb=S.blind+1>2?0:S.blind+1, na=nb===0?S.ante+1:S.ante;
  $("shopnext").innerHTML="Next: <b>Ante "+na+" · "+BLINDS[nb].name+"</b>, target "+fmt(targetFor(na,nb))+".";
  renderShop(); show("ov-shop");
}
function curShop(){ return T.shops[T.shops.length-1]; }
function pickVoucher(){
  const pool=VOUCHERS.filter(v=>S.vouchers.filter(x=>x===v.id).length<v.max);
  S.voucher = pool.length ? {def:pool[Math.floor(S.rng()*pool.length)],sold:false} : null;
}
function renderVoucher(){
  const box=$("voucherbox"); box.innerHTML="";
  if(!S.voucher){ box.innerHTML="<div class='empty'>No vouchers left to buy.</div>"; return; }
  const v=S.voucher, d=v.def, afford=S.money-d.price>=moneyFloor();
  const el=document.createElement("div"); el.className="card voucher"+(v.sold?" sold":""); el.style.alignItems="center";
  el.innerHTML="<div class='ico'>"+d.ico+"</div><div style='flex:1'><div class='t'>"+d.name+"</div><div class='d'>"+d.desc+"</div></div><button class='buy' style='margin:0;align-self:center;padding:6px 12px;flex:none' "+(v.sold||!afford?"disabled":"")+">"+(v.sold?"Bought":"Buy $"+d.price)+"</button>";
  el.querySelector(".buy").onclick=()=>{ if(v.sold||S.money-d.price<moneyFloor()) return; S.money-=d.price; v.sold=true; S.vouchers.push(d.id); d.apply(); curShop().bought.push("v:"+d.id); audio.effect("buy"); log("Voucher: <b>"+d.name+"</b>."); renderShop(); };
  box.appendChild(el);
}
const PACK_TYPES={
  tile:{name:'Tile',mark:'Ⅱ',price:6,desc:'Add tiles to your deck. Higher values must be made on the board first.'},
  workshop:{name:'Blueprint',mark:'✦',price:6,desc:'Deck work, supplies, cash and upgrades for the run.'},
  backroom:{name:'Oddity',mark:'◇',price:8,desc:'Experimental deck edits with stronger effects and tradeoffs.'},
};
const PACK_SIZES={
  standard:{name:'',cards:3,picks:1,extra:0},
  large:{name:'Large',cards:5,picks:1,extra:2},
  deluxe:{name:'Deluxe',cards:5,picks:2,extra:5},
};
function rollPacks(){
  return Array.from({length:2},(_,slot)=>{
    const rareChance=S.blind===2 ? .16 : .08;
    const typeRoll=S.rng(),sizeRoll=S.rng();
    const kind=typeRoll<rareChance?'backroom':typeRoll<rareChance+(1-rareChance)/2?'tile':'workshop';
    const size=sizeRoll<.76?'standard':sizeRoll<.96?'large':'deluxe';
    return {slot,kind,size,sold:false};
  });
}
function packName(pack){return [PACK_SIZES[pack.size].name,PACK_TYPES[pack.kind].name,'pack'].filter(Boolean).join(' ');}
function packPrice(pack){return Math.max(1,PACK_TYPES[pack.kind].price+PACK_SIZES[pack.size].extra+(pack.kind==='backroom'&&pack.size==='deluxe'?1:0)-(pack.kind==='tile'?S.packDisc:0));}
function packCardCount(pack){
  const count=PACK_SIZES[pack.size].cards;
  return pack.kind==='tile'?count+Math.max(0,S.packSize-3):Math.min(count,(pack.kind==='workshop'?WORKSHOP:EXPERIMENTS).length);
}
function canOpenPack(pack){return S.phase==='shop'&&S.packs.includes(pack)&&!pack.sold&&!S.pendingTilePack&&!S.pendingJobPack&&S.money-packPrice(pack)>=moneyFloor();}
function renderPacks(){
  $('shopdeck').textContent='Deck: '+S.deck.length+' / '+DECK_CAP+' tiles';
  const row=$('packstock');row.innerHTML='';
  S.packs.forEach(pack=>{
    const type=PACK_TYPES[pack.kind],size=PACK_SIZES[pack.size];
    const full=pack.kind==='tile'&&S.deck.length>=DECK_CAP;
    const card=document.createElement('div');card.className='card con pack-stock-card'+(pack.sold?' sold':'');card.dataset.packKind=pack.kind;card.dataset.packSize=pack.size;
    const count=packCardCount(pack);
    card.innerHTML='<div style="display:flex;gap:10px;align-items:flex-start;width:100%"><div class="ico">'+type.mark+'</div><div><div class="t">'+packName(pack)+'</div><div class="d">'+type.desc+'</div></div></div><div class="pack-contents">Choose '+size.picks+' of '+count+'</div><span class="rare '+(pack.kind==='backroom'?'r':'')+'">'+(pack.kind==='backroom'?'rare · ':'')+(size.name||'standard')+'</span><button class="buy" '+(pack.sold||full||S.money-packPrice(pack)<moneyFloor()?'disabled':'')+'>'+(pack.sold?'Opened':full?'Deck full':'Open $'+packPrice(pack))+'</button>';
    card.querySelector('.buy').onclick=()=>pack.kind==='tile'?openPack(pack):openJobPack(pack);
    row.appendChild(card);
  });
}
function openPack(pack){
  if(!canOpenPack(pack)||S.deck.length>=DECK_CAP)return;
  const price=packPrice(pack),enhKeys=Object.keys(ENH);
  const options=Array.from({length:packCardCount(pack)},()=>({v:packValue(),enh:S.rng()<.6?enhKeys[Math.floor(S.rng()*enhKeys.length)]:null}));
  S.money-=price;pack.sold=true;
  S.pendingTilePack={pack,price,options,remaining:PACK_SIZES[pack.size].picks,taken:[]};
  curShop().bought.push('pack:tile:'+pack.size);
  renderShop();renderTilePack();juice?.pack($('packgrid'),packName(pack).toUpperCase());audio.effect('pack');saveT();
}
function renderTilePack(){
  const pending=S.pendingTilePack,{pack,options,taken,remaining}=pending;
  $('packtitle').textContent=packName(pack);
  $('packnote').textContent='Choose '+remaining+' more. '+(DECK_CAP-S.deck.length)+' deck slots free. Opened packs cannot be refunded.';
  $('btnpackskip').textContent=taken.length?'Leave the rest':'Skip pack';
  const g=$('packgrid');g.innerHTML='';g.classList.toggle('expanded',options.length>3);
  options.forEach((o,index)=>{
    const used=taken.includes(index),el=document.createElement('button');el.className='opt'+(used?' taken':'');el.disabled=used||S.deck.length>=DECK_CAP;
    el.innerHTML="<div class='mini' data-v='"+o.v+"' data-enh='"+(o.enh||'')+"'>"+o.v+(o.enh?"<span class='eb'>"+ENH[o.enh].ico+"</span>":'')+"</div><div class='nm'>"+(o.enh?ENH[o.enh].name+' ':'')+o.v+"</div><div class='ds'>"+(used?'Taken':o.enh?ENH[o.enh].desc:'A plain '+o.v+'.')+'</div>';
    el.onclick=()=>{
      if(S.pendingTilePack!==pending||taken.includes(index)||S.deck.length>=DECK_CAP)return;
      const before=deckSummary();taken.push(index);pending.remaining--;
      S.deck.push({v:o.v,enh:o.enh});recordDeckEdit('tile_pack',before,deckSummary());
      S.pile.splice(Math.floor(S.rng()*(S.pile.length+1)),0,{v:o.v,enh:o.enh});
      curShop().bought.push('card:'+(o.enh||'')+o.v);audio.effect('upgrade');log('Added '+(o.enh?ENH[o.enh].name+' ':'')+'<b>'+o.v+'</b> to the deck.');
      if(!pending.remaining){S.pendingTilePack=null;hide('ov-pack');}else renderTilePack();
      renderShop();saveT();
    };
    g.appendChild(el);
  });
  show('ov-pack');
}
$('btnpackskip').onclick=()=>{
  const pending=S.pendingTilePack||S.pendingJobPack;
  if(pending)curShop().bought.push('pack_skipped:'+pending.pack.kind+':'+pending.remaining);
  S.pendingTilePack=null;S.pendingJobPack=null;
  hide('ov-pack');renderShop();saveT();
};
function renderShop(){
  $("shopwallet").textContent="$"+S.money;
  $("shopgrid").innerHTML="";
  S.shop.forEach((it,i)=>{
    const d=it.def, full = it.kind==="charm" ? S.charms.length>=S.maxCharms : S.cons.length>=S.maxCons;
    const afford = S.money-d.price>=moneyFloor();
    const el=document.createElement("div"); el.className="card"+(it.sold?" sold":"")+(it.kind==="con"?" con":"");
    el.innerHTML="<div style='display:flex;gap:10px;align-items:flex-start;width:100%'><div class='ico'>"+d.ico+"</div><div><div class='t'>"+d.name+"</div><div class='d'>"+descOf(d)+"</div></div></div>"+
      (it.kind==="charm"?"<span class='rare "+d.rar+"'>"+({c:"common",u:"uncommon",r:"rare"})[d.rar]+"</span>":"<span class='rare' style='background:var(--blue2);color:var(--ink)'>"+(d.stamp?"stamp":"consumable")+"</span>")+
      "<button class='buy' "+(it.sold||!afford||full?"disabled":"")+">"+(it.sold?"Sold":full?"No room":"Buy $"+d.price)+"</button>";
    el.querySelector(".buy").onclick=()=>buy(i);
    $("shopgrid").appendChild(el);
  });
  renderPacks(); renderVoucher();
  const rc=S.freeReroll||S.rerollTickets>0?0:S.rerollCost;
  $("btnreroll").textContent=rc?"Reroll $"+rc:"Reroll (free)"+(S.rerollTickets>0?" · "+S.rerollTickets+" tickets":""); $("btnreroll").disabled=S.money-rc<moneyFloor();
  $("shopcharms").innerHTML="";
  if(!S.charms.length) $("shopcharms").innerHTML="<div class='empty' style='width:100%'>Buy a charm to start your build.</div>";
  S.charms.forEach((c,i)=>{
    const el=charmCard(c,i); el.classList.remove("charm"); el.removeAttribute("role"); el.tabIndex=-1; el.onclick=null; el.onkeydown=null;
    const acts=document.createElement("div"); acts.className="acts";
    if(i>0){ const b=document.createElement("button"); b.className="mv"; b.textContent="◀"; b.onclick=()=>{ [S.charms[i-1],S.charms[i]]=[S.charms[i],S.charms[i-1]]; renderShop(); }; acts.appendChild(b); }
    if(i<S.charms.length-1){ const b=document.createElement("button"); b.className="mv"; b.textContent="▶"; b.onclick=()=>{ [S.charms[i+1],S.charms[i]]=[S.charms[i],S.charms[i+1]]; renderShop(); }; acts.appendChild(b); }
    if(!c.nosell){ const b=document.createElement("button"); b.textContent="Sell $"+c.sell; b.onclick=()=>{ S.money+=c.sell; S.charms.splice(i,1); curShop().sold.push(c.id); S.charms.forEach(o=>{ if(o.onSell) o.onSell(o); }); log("Sold "+c.name+"."); audio.effect("buy"); renderShop(); render(); }; acts.appendChild(b); }
    el.appendChild(acts);
    $("shopcharms").appendChild(el);
  });
  render();
}
function buy(i){
  const it=S.shop[i], d=it.def; if(it.sold||S.money-d.price<moneyFloor()) return;
  if(it.kind==="charm"){ if(S.charms.length>=S.maxCharms) return; S.charms.push(makeCharm(d)); if(d.id==="sixth") growBoard(); }
  else { if(S.cons.length>=S.maxCons) return; S.cons.push({...d}); }
  S.money-=d.price; it.sold=true; curShop().bought.push(d.id); audio.effect("buy"); log("Bought <b>"+d.name+"</b> for $"+d.price+".");
  const m=$("shopwallet"); m.classList.remove("bump"); void m.offsetWidth; m.classList.add("bump");
  renderShop();
}
$("btnreroll").onclick=()=>{ const rc=S.freeReroll||S.rerollTickets>0?0:S.rerollCost; if(S.money-rc<moneyFloor()) return; S.money-=rc; if(S.freeReroll) S.freeReroll=false; else if(S.rerollTickets>0)S.rerollTickets--; else S.rerollCost+=2; curShop().rerolls++; rollShop(); audio.effect("shuffle"); renderShop(); };
$("btnshopnext").onclick=()=>{ hide("ov-shop"); nextRound(); };
function growBoard(){
  if(S.N>=5) return; const N=5, g=Array.from({length:N},()=>Array(N).fill(null));
  allTiles().forEach(t=>{ g[t.r][t.c]=t; }); S.N=N; S.grid=g; buildCells(); syncTiles();
}

// ---------- consumables ----------
function useCon(i){
  if(locked) return;
  const d=S.cons[i];
  if(d.deck||d.stamp){ if(target)cancelTarget(); openDeckPick(i,d); return; }
  if(S.phase!=="round") return;
  if(target){ cancelTarget(); return; }
  if(d.targets>0){ target={idx:i,def:d,picks:[]}; $("board").classList.add("targeting"); renderCons(); syncTiles(); hint(d.targets===2?"Pick two tiles to swap. Esc to cancel.":d.stamp?"Pick a tile to stamp. Esc to cancel.":"Pick a tile. Esc to cancel.",true); return; }
  let ok=true;
  if(d.id==="shuffle"){ shuffleBoard(); }
  else if(d.id==="purge"){ let k=0; allTiles().forEach(t=>{ if(t.v<=4 && t.id!==S.frozen){S.grid[t.r][t.c]=null;k++;} }); if(!k){ hint("Nothing to purge.",true); ok=false; } }
  else if(d.id==="undo"){ if(!undoSnap){ hint("Nothing to undo.",true); ok=false; } else { restore(undoSnap); undoSnap=null; } }
  else if(d.id==="jack"){ let k=0; allTiles().forEach(t=>{ if(t.rock&&!t.fixed){ S.grid[t.r][t.c]=null; k++; } }); if(!k){ hint("No rubble to clear.",true); ok=false; } }
  else if(d.id==="clock"){ S.moves+=6; curRound().movesAllowed+=6; }
  else if(d.id==="polish"){ S.polish=3; }
  if(!ok) return;
  finishCon(i);
}
function pickTile(t){
  if(!target) return;
  if(t.rock&&target.def.id!=="eraser"){ hint("Rubble only comes out with an Eraser or a Jackhammer.",true); return; }
  if(t.id===S.frozen){ hint("That tile is frozen.",true); return; }
  target.picks.push(t);
  if(target.picks.length<target.def.targets){ syncTiles(); return; }
  const d=target.def, [a,b]=target.picks;
  if(d.file){ retireTile(a); }
  else if(d.stamp){ a.enh=d.stamp; const e=els.get(a.id); if(e){ e.classList.remove("zap"); void e.offsetWidth; e.classList.add("zap"); } }
  else if(d.id==="eraser"){ S.grid[a.r][a.c]=null; }
  else if(d.id==="halve"){ if(a.v===2) S.grid[a.r][a.c]=null; else a.v/=2; }
  else if(d.id==="double"){ a.v*=2; markMadeValue(a.v); }
  else if(d.id==="swap"){ if(a.id===b.id){ target.picks=[a]; hint("Pick a different second tile.",true); return; } S.grid[a.r][a.c]=b; S.grid[b.r][b.c]=a; const r=a.r,c=a.c; a.r=b.r;a.c=b.c;b.r=r;b.c=c; }
  const idx=target.idx; cancelTarget(); finishCon(idx);
}
function finishCon(i){
  const d=S.cons[i]; S.cons.splice(i,1); S.consUsed++; curRound().moves.push({con:d.id}); log("Used <b>"+d.name+"</b>."); audio.effect("upgrade"); hint("");
  S.charms.forEach(c=>{ if(c.onUseCon) c.onUseCon(c); });
  ensureTiles(); syncTiles(); render(); undoSnap=null;
  if(!canMove()) afterMove({total:0,steps:[]});
}
// ---------- permanent deck work ----------
// Pack contents are used immediately; a Deluxe pack has two separate picks.
const WORKSHOP=[
 {id:'trim',kind:'remove',name:'Trim',ico:'−',price:3,count:2,desc:'Remove up to 2 tiles. Keep at least 12 in your deck.'},
 {id:'recast',kind:'replace',name:'Recast',ico:'⇒',price:5,count:2,desc:'Choose a template, then turn another tile into an exact copy.'},
 {id:'duplicate',kind:'clone',name:'Duplicate',ico:'Ⅱ',price:5,count:1,desc:'Add a copy of a tile, including its enhancement. Needs a free deck slot.'},
 {id:'stamp',kind:'stamp',name:'Stamp',ico:'✦',price:6,count:1,desc:'Choose an enhancement for one tile in your deck.'},
 {id:'dividend',kind:'dividend',name:'Dividend',ico:'$+',count:0,desc:'Gain $1 for every $2 you hold after buying this pack, up to $12.'},
 {id:'parcel',kind:'parcel',name:'Supply Parcel',ico:'▧',count:0,desc:'Receive two different board tools. Needs two empty item slots.'},
 {id:'pocket',kind:'pocket',name:'Side Pocket',ico:'⊔',count:0,desc:'Carry one extra item for the rest of this run. Maximum 5 slots.'},
 {id:'tickets',kind:'tickets',name:'Ticket Roll',ico:'↻',count:0,desc:'Your next two shop rerolls are free. Tickets carry between shops.'},
];
const EXPERIMENTS=[
 {id:'kiln',kind:'kiln',name:'Kiln',ico:'◇',count:2,desc:'Make 2 deck tiles Prism. Permanently lose 2 moves per round. Maximum 3 uses.'},
 {id:'smelt',kind:'smelt',name:'Smelt',ico:'▦',count:2,desc:'Destroy 2 deck tiles. Add one Iron 8. Your deck becomes one tile smaller.'},
 {id:'fracture',kind:'split',name:'Fracture',ico:'½',count:1,desc:'Split a tile into two halves. Both keep its enhancement. Needs a free slot.'},
 {id:'reforge',kind:'reforge',name:'Reforge',ico:'8',count:3,desc:'Turn 3 deck tiles into plain 8s. Their enhancements are removed.'},
];
let deckJob=null;
function recordDeckEdit(kind,before,after){
  S.deckEdits=(S.deckEdits||0)+1;
  const entry={kind,before,after,ante:S.ante,blind:BLINDS[S.blind].name};
  (T.deckEdits||=[]).push(entry);
  activeCharms().forEach(c=>{if(c.onDeckEdit)c.onDeckEdit(c,entry);});
}
function editReason(d){
  if(d.kind==='dividend'&&S.money<2)return 'Needs cash on hand';
  if(d.kind==='parcel'&&S.maxCons-S.cons.length<2)return 'Needs two empty item slots';
  if(d.kind==='pocket'&&S.maxCons>=5)return 'All five item slots unlocked';
  if((d.kind==='clone'||d.kind==='split')&&S.deck.length>=DECK_CAP) return 'Deck full · trim first';
  if(d.kind==='remove'&&S.deck.length<=DECK_MIN) return 'Minimum deck size';
  if(d.kind==='smelt'&&S.deck.length<=DECK_MIN) return 'Needs at least 13 tiles';
  if(d.kind==='kiln'&&(S.kilnUses||0)>=3) return 'Kiln limit reached';
  if(d.kind==='split'&&!S.deck.some(c=>c.v>=4)) return 'Needs a tile of 4 or more';
  return '';
}
function openJobPack(pack){
  if(!canOpenPack(pack))return;
  const pool=(pack.kind==='workshop'?WORKSHOP:EXPERIMENTS).slice();
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(S.rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const price=packPrice(pack);
  S.money-=price;pack.sold=true;
  S.pendingJobPack={pack,kind:pack.kind,price,options:pool.slice(0,packCardCount(pack)),remaining:PACK_SIZES[pack.size].picks,taken:[]};
  curShop().bought.push('pack:'+pack.kind+':'+pack.size);audio.effect('pack');
  renderShop();renderJobPack();juice?.pack($('packgrid'),packName(pack).toUpperCase());saveT();
}
function renderJobPack(){
  const pending=S.pendingJobPack,{pack,kind,options,taken,remaining}=pending;
  const source=kind==='workshop'?'workshop-pack':'backroom-pack';
  $('packtitle').textContent=packName(pack);
  $('packnote').textContent='Choose '+remaining+' more. Effects are included in the price. No refunds.';
  const g=$('packgrid');g.innerHTML='';g.classList.toggle('expanded',options.length>3);
  options.forEach(d=>{
    const used=taken.includes(d.id),reason=editReason(d),el=document.createElement('button');el.className='opt job-opt'+(used?' taken':'');
    el.innerHTML='<div class="job-opt-mark">'+d.ico+'</div><div class="nm">'+d.name+'</div><div class="ds">'+d.desc+'</div><small class="pack-tag">'+(used?'Used':reason||(kind==='workshop'?'WORKSHOP':'BACKROOM'))+'</small>';
    el.disabled=used||!!reason;
    el.onclick=()=>{if(S.pendingJobPack!==pending||taken.includes(d.id))return;hide('ov-pack');beginDeckJob(d,{source,price:0});};
    g.appendChild(el);
  });
  $('btnpackskip').textContent=taken.length?'Leave the rest':'Skip pack';
  show('ov-pack');
}
function cancelDeckJob(){
  deckJob=null;hide('ov-deckedit');
  if(S.pendingJobPack)renderJobPack();
}
function beginDeckJob(def,options={}){
  const reason=editReason(def);if(reason){hint(reason,true);return;}
  deckJob={def,source:options.source||'item',idx:options.idx,price:options.price||0,picks:[],enh:def.stamp||null};
  renderDeckJob();show('ov-deckedit');
}
function renderDeckJob(){
  const job=deckJob,d=job.def,picks=job.picks;
  $('editname').textContent=d.name;
  $('editdesc').textContent=d.desc;
  if(d.count===0){
    $('editstep').textContent='Use now';$('editenh').hidden=true;$('editgrid').innerHTML='';
    $('editpreview').textContent=d.kind==='dividend'?'Collect $'+Math.min(12,Math.floor(Math.max(0,S.money)/2))+'.':d.kind==='pocket'?'Item slots: '+S.maxCons+' → '+(S.maxCons+1)+'.':d.kind==='tickets'?'Add 2 free reroll tickets.': 'Open the parcel for two different board tools.';
    $('editcount').textContent='Run upgrade';$('btneditapply').textContent='Use';$('btneditapply').disabled=!!editReason(d);return;
  }
  const need=d.count||(d.kind==='replace'?2:1);
  $('editstep').textContent=d.kind==='replace'?(picks.length===0?'1 / Choose the tile to copy.':picks.length===1?'2 / Choose the tile to replace.':'Review your conversion.'):
    'Choose '+(d.kind==='remove'?'up to ':'')+need+' tile'+(need>1?'s':'')+' · '+picks.length+' selected';
  const enh=$('editenh');enh.innerHTML='';enh.hidden=d.kind!=='stamp';
  if(d.kind==='stamp')Object.entries(ENH).forEach(([id,e])=>{
    const button=document.createElement('button');button.className='enh-choice'+(job.enh===id?' selected':'');
    button.setAttribute('aria-pressed',String(job.enh===id));button.innerHTML='<b>'+e.ico+' '+e.name+'</b><span>'+e.desc+'</span>';
    button.onclick=()=>{job.enh=id;renderDeckJob();};enh.appendChild(button);
  });
  const grid=$('editgrid');grid.innerHTML='';
  S.deck.forEach((card,i)=>{
    const selected=picks.indexOf(i),b=document.createElement('button');b.className='edit-tile'+(selected>=0?' selected':'');
    const ineligible=(d.kind==='split'&&card.v<4)||(d.kind==='remove'&&picks.length>=Math.min(need,S.deck.length-DECK_MIN)&&selected<0);
    b.disabled=ineligible;
    b.setAttribute('aria-pressed',String(selected>=0));b.setAttribute('aria-label',(card.enh?ENH[card.enh].name+' ':'')+card.v+', tile '+(i+1)+(selected>=0?', selected '+(selected+1):''));
    b.appendChild(miniTile(card));
    const label=document.createElement('span');label.className='edit-tile-label';label.textContent=selected>=0?(d.kind==='replace'?(selected===0?'Template':'Replace'):'Selected '+(selected+1)):card.enh?ENH[card.enh].name:'Plain';b.appendChild(label);
    b.onclick=()=>{
      if(selected>=0)picks.splice(selected,1);
      else if(picks.length<need)picks.push(i);
      else if(need===1)picks[0]=i;
      renderDeckJob();
    };grid.appendChild(b);
  });
  const valid=(d.kind==='remove'?picks.length>0:picks.length===need)&&(d.kind!=='stamp'||job.enh);
  const preview=$('editpreview');preview.textContent='';
  if(valid){
    const cards=picks.map(i=>S.deck[i]);const name=c=>(c.enh?ENH[c.enh].name+' ':'')+c.v;
    if(d.kind==='replace')preview.textContent=name(cards[1])+' → '+name(cards[0])+'. Deck size stays '+S.deck.length+'.';
    else if(d.kind==='remove')preview.textContent='Remove '+cards.map(name).join(' and ')+'. '+(S.deck.length-cards.length)+' tiles remain.';
    else if(d.kind==='clone')preview.textContent='Add one '+name(cards[0])+'. Deck: '+S.deck.length+' → '+(S.deck.length+1)+'.';
    else if(d.kind==='stamp')preview.textContent=name(cards[0])+' → '+ENH[job.enh].name+' '+cards[0].v+'. Future draws use the new enhancement.';
    else if(d.kind==='kiln')preview.textContent='Both become Prism. All future rounds have 2 fewer moves.';
    else if(d.kind==='smelt')preview.textContent='Destroy '+cards.map(name).join(' and ')+'. Add an Iron 8.';
    else if(d.kind==='split')preview.textContent=name(cards[0])+' → two '+name({...cards[0],v:cards[0].v/2})+' tiles.';
    else if(d.kind==='reforge')preview.textContent='Replace all 3 selected tiles with plain 8s.';
    else if(d.kind==='promote')preview.textContent=name(cards[0])+' → '+name({...cards[0],v:cards[0].v*2})+'.';
    else preview.textContent='Give '+name(cards[0])+' a random enhancement.';
  }else preview.textContent=d.kind==='stamp'&&!job.enh?'Choose an enhancement and a tile.':'Choose your tiles above.';
  $('btneditapply').disabled=!valid||!!editReason(d)||S.money-job.price<moneyFloor();
  $('btneditapply').textContent='Apply'+(job.price?' · $'+job.price:'');
  $('editcount').textContent=S.deck.length+' / '+DECK_CAP+' tiles · minimum '+DECK_MIN;
}
function applyDeckJob(){
  const job=deckJob;if(!job||$('btneditapply').disabled)return;
  const d=job.def,indices=job.picks,cards=indices.map(i=>({...S.deck[i]})),before=deckSummary();
  if(editReason(d)||S.money-job.price<moneyFloor())return;
  if(d.kind==='dividend')S.money+=Math.min(12,Math.floor(Math.max(0,S.money)/2));
  else if(d.kind==='pocket')S.maxCons++;
  else if(d.kind==='tickets')S.rerollTickets=(S.rerollTickets||0)+2;
  else if(d.kind==='parcel'){
    const tools=CONS.filter(c=>['eraser','halve','swap','shuffle','purge','clock','jack'].includes(c.id));
    for(let i=0;i<2;i++){const j=Math.floor(S.rng()*tools.length);S.cons.push({...tools.splice(j,1)[0]});}
  }
  else if(d.kind==='replace')S.deck[indices[1]]={...cards[0]};
  else if(d.kind==='remove')indices.slice().sort((a,b)=>b-a).forEach(i=>S.deck.splice(i,1));
  else if(d.kind==='clone')S.deck.push({...cards[0]});
  else if(d.kind==='stamp')S.deck[indices[0]].enh=job.enh;
  else if(d.kind==='promote')S.deck[indices[0]].v*=2;
  else if(d.kind==='random'){const keys=Object.keys(ENH);S.deck[indices[0]].enh=keys[Math.floor(S.rng()*keys.length)];}
  else if(d.kind==='kiln'){indices.forEach(i=>S.deck[i].enh='glass');S.bonusMoves-=2;S.kilnUses=(S.kilnUses||0)+1;}
  else if(d.kind==='smelt'){indices.slice().sort((a,b)=>b-a).forEach(i=>S.deck.splice(i,1));S.deck.push({v:8,enh:'steel'});}
  else if(d.kind==='split'){S.deck[indices[0]].v/=2;S.deck.push({...S.deck[indices[0]]});}
  else if(d.kind==='reforge')indices.forEach(i=>S.deck[i]={v:8,enh:null});
  S.money-=job.price;
  if(job.source.endsWith('-pack')){
    S.pendingJobPack.taken.push(d.id);S.pendingJobPack.remaining--;
    if(!S.pendingJobPack.remaining)S.pendingJobPack=null;
  }
  if(job.source==='item'){
    S.cons.splice(job.idx,1);S.consUsed++;S.charms.forEach(c=>{if(c.onUseCon)c.onUseCon(c);});
    if(S.phase==='round')curRound().moves.push({con:d.id,deck:true});
  }
  if(S.phase==='shop')curShop().bought.push((job.source==='item'?'used:':job.source+':')+d.id);
  if(d.count!==0)recordDeckEdit(d.id,before,deckSummary());
  else {S.consUsed++;S.charms.forEach(c=>{if(c.onUseCon)c.onUseCon(c);});}
  log('<b>'+d.name+'</b>: '+$('editpreview').textContent);
  deckJob=null;undoSnap=null;if(d.count!==0)reshuffle();hide('ov-deckedit');audio.effect('upgrade');
  render();if(S.phase==='shop')renderShop();if(S.pendingJobPack)renderJobPack();saveT();
}
function openDeckPick(i,d){
  const kinds={promote:'promote',twin:'clone',burn:'remove',temper:'random',recast_item:'replace',split_item:'split'};
  beginDeckJob({...d,kind:d.stamp?'stamp':kinds[d.id],count:d.id==='recast_item'?2:1},{source:'item',idx:i});
}
$('btneditapply').onclick=applyDeckJob;
$('btneditcancel').onclick=cancelDeckJob;
$('btnbackroomclose').onclick=()=>hide('ov-backroom');

function cancelTarget(){ target=null; $("board").classList.remove("targeting"); renderCons(); syncTiles(); hint(""); }

// ---------- end states ----------
function statLines(){
  return [["Reached","Ante "+S.ante+" · "+BLINDS[S.blind].name],["Rounds won",S.roundsWon],["Best single move",fmt(S.bestMove)],["Highest tile",fmt(maxTile())],["Charms",S.charms.map(c=>c.name).join(", ")||"none"],["Deck",deckSummary()]];
}
function gameOver(reason){
  finishReveal();
  S.phase="over"; saveStats(false);
  const r=curRound(); if(r&&!r.result){ r.result="loss"; r.score=S.score; r.movesUsed=r.movesAllowed-S.moves; r.maxTile=maxTile(); r.tilesEnd=allTiles().filter(t=>!t.rock).length; r.boardEnd=boardValues(); }
  T.end={reason,ante:S.ante,blind:BLINDS[S.blind].name,charms:S.charms.map(c=>c.id),bestMove:S.bestMove,deck:deckSummary()}; saveT();
  $("overtitle").textContent="Run over"; $("overtext").innerHTML=reason+" Seed <b>"+escapeHTML(S.seed)+"</b>.";
  $("overlines").innerHTML=statLines().map(([a,b])=>"<div><span>"+a+"</span><b style='color:var(--ink)'>"+b+"</b></div>").join("");
  $("btncontinue").style.display="none"; audio.effect("loss"); render();
  setTimeout(()=>show("ov-over"),500);
}
function winRun(){
  S.phase="over"; saveStats(true);
  T.end={reason:"won",ante:S.ante,blind:"Boss",charms:S.charms.map(c=>c.id),bestMove:S.bestMove,deck:deckSummary()}; saveT();
  $("overtitle").textContent="You beat the house"; $("overtext").innerHTML="Ante 8's boss is down. Seed <b>"+escapeHTML(S.seed)+"</b>. Targets keep growing ×"+ENDLESS_GROWTH+" per ante if you continue.";
  $("overlines").innerHTML=statLines().map(([a,b])=>"<div><span>"+a+"</span><b style='color:var(--ink)'>"+b+"</b></div>").join("");
  $("btncontinue").style.display=""; fanfare(); confetti(); show("ov-over");
}
$("btncontinue").onclick=()=>{ hide("ov-over"); S.endless=true; S.phase="shop"; openShop(); };
$("btnagain").onclick=()=>{ hide("ov-over"); $("seedin").value=""; audio.setScene('title'); audio.setIntensity(0); showStats(); show("ov-start"); };
$("btnabandon").onclick=()=>{ if(S&&S.phase!=="over") show("ov-pause"); };
function loadStats(){ try{ return JSON.parse(localStorage.getItem(STORAGE+"stats")||"{}"); }catch(e){ return {}; } }
function saveStats(won){
  try{ const st=loadStats(); st.runs=(st.runs||0)+1; if(won) st.wins=(st.wins||0)+1;
    const reach=S.ante*3+S.blind; if(!st.best||reach>st.best.reach) st.best={reach,ante:S.ante,blind:S.blind};
    if(!st.bestMove||S.bestMove>st.bestMove) st.bestMove=S.bestMove;
    localStorage.setItem(STORAGE+"stats",JSON.stringify(st)); }catch(e){}
}
function showStats(){ const st=loadStats(); $("metastats").textContent= st.runs ? st.runs+" runs · "+(st.wins||0)+" wins · best: Ante "+st.best.ante+" "+BLINDS[st.best.blind].name+" · best move "+fmt(st.bestMove||0) : ""; }

// ---------- telemetry ----------
function loadT(){ try{ return JSON.parse(localStorage.getItem(STORAGE+"runs")||"[]"); }catch(e){ return []; } }
function saveT(){ if(!T) return; try{ const all=loadT().filter(r=>r.start!==T.start); all.push(T); while(all.length>25) all.shift(); localStorage.setItem(STORAGE+"runs",JSON.stringify(all)); }catch(e){} }
function tlogText(){
  const runs=loadT(); if(T && !runs.some(r=>r.start===T.start)) runs.push(T);
  if(!runs.length) return "No runs logged yet.";
  const out=[]; const anteAbbr=b=>({Opening:"O",Raise:"R",Boss:"B"})[b]||b;
  runs.forEach((run,ri)=>{
    out.push("=== run "+(ri+1)+"  seed "+run.seed+"  v"+run.v+"  "+run.start.slice(0,16)+"  end: "+(run.end?run.end.reason:"in progress"));
    run.rounds.forEach(r=>{
      const scoring=r.moves.filter(m=>m.total>0);
      const tot=scoring.reduce((a,m)=>a+m.total,0);
      const avg=scoring.length?Math.round(tot/scoring.length):0;
      const best=scoring.reduce((a,m)=>Math.max(a,m.total),0);
      const used = r.movesUsed!=null ? r.movesUsed : r.moves.filter(m=>m.dir).length;
      out.push(" A"+r.ante+anteAbbr(r.blind)+(r.boss?"("+r.boss+")":"")+"  "+(r.result||"?").padEnd(4)+" "+fmt(r.score||tot).padStart(9)+"/"+fmt(r.target).padEnd(9)
        +" mv "+String(used).padStart(2)+"/"+r.movesAllowed+"  scoring "+scoring.length+"  avg "+fmt(avg).padStart(7)+"  best "+fmt(best).padStart(8)
        +"  max "+(r.maxTile||"?")+"  tiles "+(r.tilesEnd!=null?r.tilesEnd:"?")+"  $"+r.moneyStart+(r.moneyEnd!=null?"→"+r.moneyEnd:"")
        +"  charms ["+r.charms.join(",")+"]"+(r.vouchers&&r.vouchers.length?" v["+r.vouchers.join(",")+"]":"")+(r.deck?" deck{"+r.deck+"}(avg "+r.deckAvg+")":"")+(r.filed&&r.filed.length?" filed["+r.filed.join(",")+"]":"")+(r.bones?" BONES":""));
      out.push("    board start "+r.boardStart.join(" ")+(r.boardEnd?"  | end "+r.boardEnd.join(" "):""));
      out.push("    moves "+r.moves.map(m=>m.undo?"undo":m.con?"c:"+m.con:m.total?fmt(m.total).replace(/,/g,"")+"("+m.chips+"x"+m.mult+")"+(m.shatter?"!":""):"-").join(" "));
    });
    run.shops.forEach(s=>out.push(" shop after A"+s.afterAnte+anteAbbr(s.afterBlind)+" $"+s.money+" offered ["+s.offered.join(",")+"] bought ["+s.bought.join(",")+"]"+(s.sold.length?" sold ["+s.sold.join(",")+"]":"")+(s.rerolls?" rerolls "+s.rerolls:"")));
    out.push("");
  });
  out.push("--- raw json ---"); out.push(JSON.stringify(runs));
  return out.join("\n");
}
$("btntlog").onclick=()=>{ saveT(); $("tlogtext").value=tlogText(); show("ov-tlog"); };
$("btntlogclose").onclick=()=>hide("ov-tlog");
$("btntlogclear").onclick=()=>{ if(confirm("Clear all logged runs on this device?")){ try{ localStorage.removeItem(STORAGE+"runs"); }catch(e){} $("tlogtext").value=tlogText(); } };
$("btntlogcopy").onclick=()=>{ const ta=$("tlogtext"); ta.select(); const done=()=>{ $("btntlogcopy").textContent="Copied"; setTimeout(()=>$("btntlogcopy").textContent="Copy to clipboard",1500); }; if(navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done,()=>{ try{document.execCommand("copy");done();}catch(e){} }); else { try{document.execCommand("copy");done();}catch(e){} } };

// ---------- rendering ----------
function buildCells(){ document.documentElement.style.setProperty("--n",S.N); const c=$("cells"); c.innerHTML=""; for(let i=0;i<S.N*S.N;i++) c.appendChild(document.createElement("i")); }
function place(t){ const e=els.get(t.id); if(!e) return; e.style.setProperty("--r",t.r); e.style.setProperty("--c",t.c); }
function setVal(e,t){ if(t.rock){ e.textContent="\u2715"; e.dataset.v=""; e.dataset.rock=t.fixed?"2":"1"; e.title=t.fixed?"Walled off":"Rubble \u2014 clear it by merging in its row or column"; return; } e.removeAttribute("data-rock"); e.textContent=fmt(t.v); e.dataset.v=t.v; e.dataset.enh=t.enh||""; e.classList.toggle("big",t.v>2048); if(t.enh){ const b=document.createElement("span"); b.className="eb"; b.textContent=({bonus:"+30",mult:"+4",glass:"×2",steel:"×1.2",gold:"+$2",lucky:"★"})[t.enh]; b.title=ENH[t.enh].name; e.appendChild(b); } e.title=fmt(t.v)+(t.enh?" · "+ENH[t.enh].name+": "+ENH[t.enh].desc:""); e.setAttribute("aria-label",e.title+", row "+(t.r+1)+", column "+(t.c+1)); }
function syncTiles(){
  const live=new Set();
  allTiles().forEach(t=>{
    live.add(t.id); let e=els.get(t.id);
    if(!e){ e=document.createElement("div"); e.className="tile spawn"; e.tabIndex=-1; e.setAttribute("role","button"); e.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();e.click();}}); els.set(t.id,e); $("tiles").appendChild(e); e.addEventListener("click",()=>{ const tt=allTiles().find(x=>x.id===t.id); if(tt) pickTile(tt); }); }
    setVal(e,t); place(t);
    e.classList.toggle("frozen",t.id===S.frozen);
    e.classList.toggle("pick",!!target); e.tabIndex=target?0:-1;
    e.classList.toggle("picked",!!target&&target.picks.some(p=>p.id===t.id));
  });
  els.forEach((e,id)=>{ if(!live.has(id)&&!e.classList.contains("shatter")){ e.remove(); els.delete(id); } });
  renderDeck();
}
function miniTile(c){ const d=document.createElement("div"); d.className="mini"; d.dataset.v=c.v; d.dataset.enh=c.enh||""; d.title=c.v+(c.enh?" · "+ENH[c.enh].name+": "+ENH[c.enh].desc:""); d.setAttribute("aria-label",d.title); d.textContent=c.v; if(c.enh){ const b=document.createElement("span"); b.className="eb"; b.textContent=ENH[c.enh].ico; d.appendChild(b); } return d; }
function renderDeck(){
  if(!S) return;
  const nr=$("nextrow"); nr.innerHTML="";
  $("pilelbl").textContent=S.pile.length+" left";
  const preview=S.pile.slice(0,3);
  preview.forEach((c,i)=>{ nr.appendChild(miniTile(c)); if(i<preview.length-1){ const a=document.createElement("span"); a.className="arrow"; a.textContent="›"; nr.appendChild(a); } });
  if(preview.length<3){ const s=document.createElement("span"); s.style.cssText="font-size:11px;color:var(--pink)"; s.textContent=preview.length?"then shuffle":"shuffling"; nr.appendChild(s); }
  const comp=$("deckcomp"); comp.innerHTML="";
  const m={}; S.deck.forEach(c=>{ const k=c.v+"|"+(c.enh||""); m[k]=(m[k]||0)+1; });
  Object.keys(m).sort((a,b)=>parseInt(a)-parseInt(b)||a.localeCompare(b)).forEach(k=>{ const [v,e]=k.split("|"); const d=document.createElement("span"); d.className="dc"+(e?" enh":""); d.innerHTML="<i>"+v+"</i>"+(e?ENH[e].ico+" "+ENH[e].name.toLowerCase():"")+" ×"+m[k]; comp.appendChild(d); });
  $("deckcount").textContent=S.deck.length+" tiles";
}
let lastMoney=null;
function render(){
  if(!S) return;
  $("antelbl").firstChild.textContent="Ante "+S.ante;
  const bl=$("blindlbl"); bl.textContent=S.blind===2&&S.boss?S.boss.name:BLINDS[S.blind].name; bl.classList.toggle("boss",S.blind===2);
  const bn=$("bossnote"); if(S.boss&&S.phase==="round"){ bn.style.display=""; bn.innerHTML="<b>"+S.boss.name+"</b> — "+S.boss.desc; } else bn.style.display="none";
  $("targetlbl").textContent=fmt(S.target); $("scorelbl").textContent=fmt(S.score);
  const pct=S.target?S.score/S.target:0; audio.setIntensity(Math.min(1,Math.max(0,pct))); const bf=$("barfill"); bf.style.width=Math.min(100,pct*100)+"%"; bf.classList.toggle("over",pct>=1); bf.classList.toggle("hot",pct>=.85&&pct<1); $("pctlbl").textContent=Math.floor(pct*100)+"%";
  const cl=$("chainlbl"); const cv=S.chain>1?"+"+Math.min(S.boss?.id==="metronome"?3:20,S.chain-1)+" mult":"—";
  if(cl.textContent!==cv){ cl.textContent=cv; cl.classList.remove("bump"); void cl.offsetWidth; cl.classList.add("bump"); }
  cl.classList.toggle("hot",S.chain>=5);
  const cn=$("btncashnow");
  if(S.phase==="round"&&S.banked){ cn.style.display=""; $("overlbl").textContent="+$"+overflowCash()+" bonus"; } else cn.style.display="none";
  const ml=$("moveslbl"); ml.textContent=S.moves; const low=S.moves<=6; ml.classList.toggle("low",low); if(low){ ml.classList.remove("bump"); void ml.offsetWidth; ml.classList.add("bump"); }
  const mo=$("moneylbl"); mo.textContent="$"+S.money; if(lastMoney!==null&&lastMoney!==S.money){ mo.classList.remove("bump"); void mo.offsetWidth; mo.classList.add("bump"); } lastMoney=S.money;
  $("runlbl").textContent="Round "+((S.ante-1)*3+S.blind+1)+(S.endless?" / endless":" / 24");
  $("charmcount").textContent=S.charms.length+" / "+S.maxCharms;
  const ct=$("charmtray");
  const rackKey=JSON.stringify(S.charms.map((c,i)=>[c.uid,descOf(c),charmOff(i)]))+S.maxCharms;
  if(ct.dataset.key!==rackKey){
    ct.dataset.key=rackKey; ct.innerHTML="";
    S.charms.forEach((c,i)=>ct.appendChild(charmCard(c,i)));
    for(let i=S.charms.length;i<S.maxCharms;i++){
      const slot=document.createElement("div"); slot.className="charm-slot"; slot.setAttribute("aria-hidden","true");
      slot.innerHTML=i===0?"<span>Win a round.<br>Visit the shop.</span>":"+"; ct.appendChild(slot);
    }
  }
  $("rubblelbl").textContent=S.rubbleIn+" move"+(S.rubbleIn===1?"":"s");
  document.querySelector(".rubble-clock").classList.toggle("urgent",S.rubbleIn<=1);
  $("boardstatus").textContent=target?"CHOOSE A TILE":S.banked?"TARGET CLEARED":S.boss?"BOSS ROUND":S.moves<=6?"MAKE THEM COUNT":"MAKE YOUR MOVE";
  document.querySelector(".board-label span:last-child").textContent=S.N+" × "+S.N;
  $("bankhint").textContent=S.movesMade<2?"Merge matching tiles to score.":S.banked?"Bank now, or keep playing for extra cash.":"Score "+fmt(Math.max(0,S.target-S.score))+" more to clear the round.";
  $("roundtrack").innerHTML=[0,1,2].map(i=>(i?"<i></i>":"")+"<span class='"+(i===S.blind?"active ":i<S.blind?"done ":"")+(i===2?"boss":"")+"'>"+(i===2?"B":"0"+(i+1))+"</span>").join("");
  $("roundtrack").setAttribute("aria-label",BLINDS[S.blind].name+", round "+(S.blind+1)+" of this ante");
  renderCons(); renderDeck();
}
function descOf(c){
  let d=c.desc;
  if(c.st) Object.keys(c.st).forEach(k=>{ d=d.replace("{"+k+"}", c.st[k]); });
  d=d.replace("{sell}",c.sell!=null?c.sell:Math.floor(c.price/2)).replace("{used}",S?S.consUsed:0);
  return d;
}
function charmCard(c,i){
  const el=document.createElement("div"); el.className="card charm"+(charmOff(i)?" disabled":""); el.dataset.uid=c.uid; el.dataset.rarity=c.rar; el.tabIndex=0; el.setAttribute("role","button"); el.setAttribute("aria-label",c.name+". "+descOf(c).replace(/<[^>]*>/g,"")); el.onclick=()=>inspectCharm(c); el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();inspectCharm(c);}};
  el.innerHTML="<div class='ico'>"+c.ico+"</div><div><div class='t'>"+c.name+"</div><div class='d'>"+descOf(c)+"</div></div><span class='rare "+c.rar+"'>"+({c:"common",u:"uncommon",r:"rare"})[c.rar]+"</span>";
  return el;
}
function renderCons(){
  $("conscount").textContent=S.cons.length+" / "+S.maxCons;
  const t=$("constray"); t.innerHTML="";
  if(!S.cons.length) t.innerHTML="<div class='empty'>No items. Find them in the shop.</div>";
  S.cons.forEach((c,i)=>{
    const el=document.createElement("button"); el.className="card use"+(target&&target.idx===i?" armed":"");
    el.innerHTML="<div class='ico'>"+c.ico+"</div><div><div class='t'>"+c.name+"</div><div class='d'>"+c.desc+"</div></div>";
    el.onclick=()=>useCon(i); t.appendChild(el);
  });
  if(S.polish>0){ const p=document.createElement("div"); p.className="empty"; p.style.borderColor="var(--purple)"; p.style.color="var(--purple)"; p.textContent="Polish: ×2 mult for "+S.polish+" more scoring moves"; t.appendChild(p); }
}
function calcNone(){ $("calc").innerHTML="<div class='idle'>No merge. Chain reset."+(has("patience")?" Rain Check stored +10 chips.":"")+(has("green")?" Green Light lost 1 mult.":"")+"</div>"; }
function calcIdle(){ $("calc").innerHTML="<div class='idle'>Make a merge to score.</div>"; }
function floatText(txt,huge){ const f=document.createElement("div"); f.className="float"+(huge?" huge":""); f.textContent=txt; $("board").appendChild(f); setTimeout(()=>f.remove(),1000); }
function hint(msg,warn){ const h=$("hint"); h.textContent=msg||"Arrow keys / WASD / swipe"; h.classList.toggle("warn",!!warn); }
function log(html){ const d=document.createElement("div"); d.innerHTML=html; $("log").prepend(d); while($("log").children.length>40) $("log").lastChild.remove(); }

$("enhlist").innerHTML=Object.keys(ENH).map(k=>"<span><b>"+ENH[k].ico+" "+ENH[k].name+"</b> — "+ENH[k].desc+"</span>").join("");

// ---------- screens, settings, and input ----------
const modalStack=['ov-start'];
const focusReturns=new Map();
let pageScrollY=0;
function syncScreens(){
  const top=modalStack.at(-1);
  $('app').inert=!!top;
  document.body.style.overflow=top?'hidden':'';
  document.querySelectorAll('.ov').forEach(ov=>{
    ov.inert=ov.id!==top;
    ov.setAttribute('aria-hidden',String(ov.id!==top));
    ov.style.zIndex=30+modalStack.indexOf(ov.id)*2;
  });
  audio.pause(top==='ov-pause'||top==='ov-confirm');
}
function show(id){
  if(modalStack.includes(id)) return;
  // Locking the page while an overlay is open can make Safari clamp scrollY.
  // Remember the actual game position once, then restore it when the stack closes.
  if(!modalStack.length) pageScrollY=window.scrollY;
  queuedDirection=null;
  focusReturns.set(id,document.activeElement);
  $(id).classList.add('show'); modalStack.push(id); syncScreens();
  const focus=$(id).querySelector('button:not([disabled]):not([hidden]),input,select,textarea');
  focus?.focus({preventScroll:true});
}
function hide(id){
  $(id).classList.remove('show');
  const index=modalStack.indexOf(id); if(index>=0) modalStack.splice(index,1);
  syncScreens();
  const old=focusReturns.get(id), top=modalStack.at(-1);
  if(old?.isConnected&&!old.closest('[inert]')) old.focus({preventScroll:true});
  else if(top) $(top).querySelector('button:not([disabled]):not([hidden])')?.focus({preventScroll:true});
  else $('board').focus({preventScroll:true});
  if(!modalStack.length) window.scrollTo({left:0,top:pageScrollY,behavior:'auto'});
  focusReturns.delete(id);
}
function inspectCharm(c){
  $('inspectname').textContent=c.name;
  $('inspecticon').textContent=c.ico;
  $('inspectdesc').innerHTML=descOf(c);
  $('inspectrarity').textContent=({c:'Common charm',u:'Uncommon charm',r:'Rare charm'})[c.rar];
  show('ov-inspect');
}
function refreshAudio(){
  const p=audio.preferences();
  $('musicvol').value=p.music; $('sfxvol').value=p.effects; $('track').value=p.track;
  $('musicout').textContent=p.music+'%'; $('sfxout').textContent=p.effects+'%';
  $('btnmute').innerHTML=(p.muted?'Unmute sound':'Mute all sound')+' <kbd>M</kbd>';
  $('btnmute').setAttribute('aria-pressed',String(p.muted));
  $('btnsound').innerHTML=(p.muted?'♪':'♫')+' <span>'+(p.muted?'Muted':'Sound')+'</span>';
}
function openAudio(){ refreshAudio(); show('ov-settings'); audio.unlock(); }
$('musicvol').oninput=e=>{ audio.set({music:+e.target.value}); refreshAudio(); };
$('sfxvol').oninput=e=>{ audio.set({effects:+e.target.value}); refreshAudio(); };
$('sfxvol').onchange=()=>audio.effect('score',3);
$('track').onchange=e=>audio.set({track:e.target.value});
$('btnmute').onclick=()=>{audio.set({muted:!audio.preferences().muted});refreshAudio();};
$('btnsound').onclick=openAudio; $('btntitlesound').onclick=openAudio; $('btnpausesound').onclick=openAudio;
$('btnsettingsclose').onclick=()=>hide('ov-settings');
$('btnhelp').onclick=()=>show('ov-help'); $('btntitlerules').onclick=()=>show('ov-help'); $('btnpauserules').onclick=()=>show('ov-help');
$('btnhelpclose').onclick=()=>hide('ov-help');
$('btncredits').onclick=()=>show('ov-credits'); $('btncreditsclose').onclick=()=>hide('ov-credits');
$('btninspectclose').onclick=()=>hide('ov-inspect');
$('btnresume').onclick=()=>hide('ov-pause');
$('btnendrun').onclick=()=>show('ov-confirm');
$('btnkeep').onclick=()=>{hide('ov-confirm');hide('ov-pause');};
$('btnconfirmend').onclick=()=>{
  if(locked) return;
  [...modalStack].reverse().forEach(hide); queuedDirection=null; gameOver('Run abandoned.');
};
$('btnbossgo').onclick=()=>{hide('ov-boss');render();};
$('btnstart').onclick=()=>{audio.unlock();hide('ov-start');newRun($('seedin').value.trim());};
$('seedin').addEventListener('keydown',e=>{if(e.key==='Enter') $('btnstart').click();});
const bankRound=$('btncashnow').onclick;
$('btncashnow').onclick=()=>{if(!locked) bankRound();};
$('btntlogdownload').onclick=()=>{
  saveT();
  const blob=new Blob([JSON.stringify({game:'2048: ANTE',version:VERSION,exported:new Date().toISOString(),runs:loadT()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='ante-playtest-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const KEYS={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
const dismissable=new Set(['ov-help','ov-settings','ov-tlog','ov-credits','ov-pause','ov-confirm','ov-inspect','ov-deckedit','ov-backroom']);
document.addEventListener('keydown',e=>{
  const top=modalStack.at(-1);
  if(e.key==='Tab'&&top){
    const nodes=[...$(top).querySelectorAll('button:not([disabled]):not([hidden]),input,select,textarea,summary,[tabindex="0"]')].filter(n=>n.getClientRects().length);
    const first=nodes[0],last=nodes.at(-1);
    if(!first){e.preventDefault();return;}
    if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement))){e.preventDefault();first.focus();}
    return;
  }
  if(e.key==='Escape'){
    e.preventDefault();
    if(top){if(top==='ov-deckedit')cancelDeckJob();else if(top==='ov-pack')$('btnpackskip').click();else if(dismissable.has(top))hide(top);}
    else if(target) cancelTarget();
    else if(S&&S.phase==='round') show('ov-pause');
    return;
  }
  if(e.target.matches('input,textarea,select')||e.metaKey||e.ctrlKey||e.altKey) return;
  if(e.key.toLowerCase()==='m'){e.preventDefault();audio.set({muted:!audio.preferences().muted});refreshAudio();return;}
  if(top) return;
  if(e.key.toLowerCase()==='p'){e.preventDefault();if(S&&S.phase==='round')show('ov-pause');return;}
  if(e.key===' '&&S?.banked&&!target){e.preventDefault();$('btncashnow').click();return;}
  const dir=KEYS[e.key]||KEYS[e.key.toLowerCase()];
  if(dir){e.preventDefault();audio.unlock();move(dir);}
});
document.querySelectorAll('.dpad button').forEach(b=>b.addEventListener('click',()=>move(b.dataset.dir)));
let touch=null,swiped=false;
$('board').addEventListener('pointerdown',e=>{
  if(e.button!==0||modalStack.length) return;
  touch={x:e.clientX,y:e.clientY,id:e.pointerId};swiped=false;
  // Keep taps on tiles intact while swipes can finish outside the board.
  e.target.setPointerCapture?.(e.pointerId);
});
$('board').addEventListener('pointerup',e=>{
  if(!touch||touch.id!==e.pointerId) return;
  const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<22||target) return;
  swiped=true;move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
});
$('board').addEventListener('pointercancel',()=>{touch=null;});
$('board').addEventListener('click',e=>{if(swiped){e.stopPropagation();swiped=false;}},true);
document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('#tiles'))audio.effect('click');},true);
window.addEventListener('beforeunload',saveT);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveT();});
document.querySelectorAll('.ov').forEach(ov=>{
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  const heading=ov.querySelector('h1,h2');if(heading){heading.id||=ov.id+'-title';ov.setAttribute('aria-labelledby',heading.id);}
});
syncScreens();refreshAudio();showStats();

})();
