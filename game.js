(function(){
"use strict";
const VERSION="2.1.0";
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

const FIXTURES={
 press:{name:'Press',ico:'▤',price:6,desc:'Merge here for +20 chips.'},
 flywheel:{name:'Flywheel',ico:'◴',price:8,desc:'Each move without a merge here stores 10 chips, up to 60. Merge here to collect them.'},
 toll:{name:'Toll Booth',ico:'$│',price:8,limit:2,desc:'The first 2 merges here each round pay $1 each.'},
 copier:{name:'Copy Desk',ico:'Ⅱ',price:10,limit:1,desc:'Once per round, merge here into 32 or less to spawn a plain copy in an empty cell.'},
 inkwell:{name:'Inkwell',ico:'✦',price:9,limit:1,desc:'Once per round, a plain tile made here gains a random finish. It takes effect on later moves.'},
 trapdoor:{name:'Trapdoor',ico:'⌄',price:10,limit:2,desc:'Twice per round, a merge of 16 or more here gives ×1.6 mult, then removes the result from the board.'},
 switchboard:{name:'Switchboard',ico:'↱',price:7,desc:'Merge here for +4 mult if the direction differs from the last merge here. The first hit primes it.'},
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
 {id:'foreman',ico:'▤+',name:'Foreman',rar:'u',price:6,desc:'<em>+3 mult</em> per board fixture activated this move.',score:(ctx,me)=>{if(ctx.fixtureHits?.length)ctx.add(me,{mult:3*ctx.fixtureHits.length});}},
 {id:'live_circuit',ico:'⚡',name:'Live Circuit',rar:'r',price:8,desc:'Activate <em>2 different fixtures</em> in one move for <em>×2 mult</em>.',score:(ctx,me)=>{if(ctx.fixtureHits?.length>=2)ctx.add(me,{xmult:2});}},
 {id:'field_notes',ico:'▧',name:'Field Notes',rar:'u',price:5,desc:'Gains <em>+2 mult</em> whenever you install a fixture. Moving one does not count. Caps at +12. <span class="st">Now +{m}</span>',st:{m:0},onInstall:me=>{me.st.m=Math.min(12,me.st.m+2);},score:(ctx,me)=>{if(me.st.m)ctx.add(me,{mult:me.st.m});}},
 {id:'compass',ico:'↔↕',name:'Compass',rar:'c',price:5,desc:'<em>+6 mult</em> when a scoring move changes from horizontal to vertical, or vice versa.',st:{axis:null},score:(ctx,me)=>{const axis=['left','right'].includes(S.mom.dir)?'h':'v';if(me.st.axis&&me.st.axis!==axis)ctx.add(me,{mult:6});if(!ctx.as)me.st.axis=axis;},roundStart:me=>{me.st.axis=null;}},
 {id:'clean_cut',ico:'□',name:'Clean Cut',rar:'c',price:4,desc:'<em>+20 chips</em> per merge of two plain tiles. Up to +60 per move.',score:(ctx,me)=>{const n=ctx.merges.filter(m=>!m.enhs.length).length;if(n)ctx.add(me,{chips:Math.min(60,n*20)});}},
 {id:'surveyor',ico:'⌗',name:'Surveyor',rar:'u',price:6,desc:'<em>+8 mult</em> if your merges land in at least 2 different rows <em>and</em> 2 different columns.',score:(ctx,me)=>{if(new Set(ctx.merges.map(m=>m.r)).size>=2&&new Set(ctx.merges.map(m=>m.c)).size>=2)ctx.add(me,{mult:8});}},
 {id:"carbon_press",ico:"Ⅱ",name:"Carbon Press",rar:"u",price:7,desc:"First scoring move each round: if it makes exactly one tile of 64 or less, pay <em>$2</em> to copy it into your deck. Needs a free slot.",st:{ready:true},roundStart:me=>{me.st.ready=true;},score:(ctx,me)=>{
   if(!me.st.ready||ctx.as)return;me.st.ready=false;
   const m=ctx.merges[0];if(ctx.merges.length!==1||m.v>64||S.deck.length>=DECK_CAP||S.money<2)return;
   const before=deckSummary(),card=newDeckCard(m.tile.v,m.tile.enh||null);S.money-=2;S.deck.push(card);S.pile.push({...card});
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
 {id:"baseball",ico:"×U",name:"Union Card",rar:"u",price:7,desc:"<em>×1.5 mult</em> for every other uncommon mod you own.",
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
 {id:"campfire",ico:"×½",name:"Trade Up",rar:"r",price:8,desc:"Gains <em>×0.5 mult</em> for every mod you sell. Resets after you beat a boss. <span class='st'>Now ×{x}</span>",
  st:{x:1}, score:(c,me)=>{ if(me.st.x>1) c.add(me,{xmult:me.st.x}); }, onSell:me=>{ me.st.x=r1(Math.min(4,me.st.x+0.5)); }, roundEnd:(lines,me)=>{ if(S.blind===2) me.st.x=1; }},
 {id:"space",ico:"✶",name:"Cosmic Dust",rar:"r",price:8,desc:"1 in 4 each scoring move to gain <em>+1 mult</em>, up to +25. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ if(S.rng()<0.25&&me.st.m<25){ me.st.m++; c.note(me,"grew"); } if(me.st.m) c.add(me,{mult:me.st.m}); }},
 {id:"cavendish",ico:"×3",name:"Long-Life Battery",rar:"r",price:8,desc:"<em>×3 mult</em>. 1 in 1000 chance to run flat at the end of each round.",
  score:(c,me)=>c.add(me,{xmult:3}), roundEnd:(lines,me)=>{ if(S.rng()<0.001){ destroyCharm(me,"ran flat"); lines.push(["Long-Life Battery","ran flat"]); } }},
 {id:"dagger",ico:"†",name:"Scrap Dealer",rar:"r",price:8,desc:"At the start of each round, <em>destroys the mod to its right</em> and gains mult equal to its price. <span class='st'>Now +{m}</span>",
  st:{m:0}, score:(c,me)=>{ if(me.st.m) c.add(me,{mult:me.st.m}); }, roundStart:me=>{ const i=S.charms.indexOf(me); const v=S.charms[i+1]; if(v&&!v.nosell){ me.st.m+=v.price; destroyCharm(v,"sacrificed"); log("Scrap Dealer took <b>"+v.name+"</b> for +"+v.price+" mult."); } }},
 {id:"blueprint",ico:"⇒",name:"Relay",rar:"r",price:9,desc:"Copies the <em>scoring ability</em> of the mod to its right.",
  score:(c,me)=>{ const i=S.charms.indexOf(me); const v=S.charms[i+1]; if(v&&v.id!=="blueprint"){ c.as=me; scoreMod(c,v); c.as=null; } }},
 {id:"shortcut",ico:"↗",name:"Step Ladder",rar:"r",price:9,desc:"A tile can also merge into a tile <em>twice its value</em> (4 + 8 → 16)."},
 {id:"sixth",ico:"5²",name:"Annex",rar:"r",price:9,desc:"The board becomes <em>5×5</em>. Can't be sold.", nosell:true},
 {id:"alchemist",ico:"++",name:"Catalyst",rar:"r",price:8,desc:"When two <em>enhanced</em> tiles merge, the new tile fires both enhancements <em>again</em>."},
 // ----- night-market hardware -----
 {id:'boot_rom',ico:'ON',name:'Boot ROM',rar:'c',price:4,desc:'Your first scoring move each round gets <em>+100 chips</em>.',st:{ready:true},
  roundStart:me=>{me.st.ready=true;},score:(ctx,me)=>{if(!me.st.ready)return;ctx.add(me,{chips:100});if(!ctx.as)me.st.ready=false;}},
 {id:'cassette_loop',ico:'↺Ⅱ',name:'Cassette Loop',rar:'u',price:6,desc:'Repeat the previous scoring move’s exact merge values for <em>×1.8 mult</em>. Order does not matter.',st:{pattern:''},
  roundStart:me=>{me.st.pattern='';},score:(ctx,me)=>{const pattern=ctx.merges.map(m=>m.v).sort((a,b)=>a-b).join(',');if(pattern===me.st.pattern)ctx.add(me,{xmult:1.8});if(!ctx.as)me.st.pattern=pattern;}},
 {id:'cross_talk',ico:'><',name:'Cross Talk',rar:'c',price:5,desc:'<em>+6 mult</em> for each merge of two different finishes. Up to +12 per move.',
  score:(ctx,me)=>{const n=ctx.merges.filter(m=>new Set(m.enhs).size>=2).length;if(n)ctx.add(me,{mult:Math.min(12,n*6)});}},
 {id:'vacuum_tube',ico:'[○]',name:'Vacuum Tube',rar:'c',price:5,desc:'<em>+80 chips</em> while at least <em>8 cells</em> are empty.',
  score:(ctx,me)=>{if(ctx.empty>=8)ctx.add(me,{chips:80});}},
 {id:'null_modem',ico:'Ø',name:'Null Modem',rar:'r',price:8,desc:'<em>×2.2 mult</em> while exactly <em>one enhanced tile</em> is on the board.',
  score:(ctx,me)=>{if(allTiles().filter(t=>!t.rock&&t.enh).length===1)ctx.add(me,{xmult:2.2});}},
 {id:'minimal_rom',ico:'14',name:'Minimal ROM',rar:'u',price:6,desc:'<em>×1.8 mult</em> while your deck has <em>14 tiles or fewer</em>.',
  score:(ctx,me)=>{if(S.deck.length<=14)ctx.add(me,{xmult:1.8});}},
 {id:'parity_check',ico:'01',name:'Parity Check',rar:'c',price:5,desc:'Make a <em>4, 16, 64…</em> and an <em>8, 32, 128…</em> in the same move for <em>+60 chips</em>.',
  score:(ctx,me)=>{if(ctx.merges.some(m=>oddExp(m.v))&&ctx.merges.some(m=>!oddExp(m.v)))ctx.add(me,{chips:60});}},
 {id:'meter_reader',ico:'$▤',name:'Meter Reader',rar:'u',price:7,desc:'At round end, earn <em>$2</em> for each different fixture type activated. Up to <em>$6</em>.',st:{types:[]},
  roundStart:me=>{me.st.types=[];},score:(ctx,me)=>{if(!ctx.as)me.st.types=[...new Set([...me.st.types,...(ctx.fixtureHits||[]).map(f=>f.kind)])];},
  roundEnd:(lines,me)=>{const cash=Math.min(6,me.st.types.length*2);if(cash){S.money+=cash;lines.push([me.name,'+$'+cash]);}}},
 {id:'pirate_radio',ico:'FM',name:'Pirate Radio',rar:'u',price:6,desc:'Each scoring activation tunes to <em>+60 chips</em>, <em>+8 mult</em> or <em>×1.6 mult</em>. Equal odds.',
  score:(ctx,me)=>{const channel=Math.floor(S.rng()*3);ctx.add(me,channel===0?{chips:60}:channel===1?{mult:8}:{xmult:1.6});}},
 {id:'end_of_tape',ico:'►|',name:'End of Tape',rar:'u',price:5,desc:'<em>+12 mult</em> while your draw pile has <em>3 tiles or fewer</em> left.',
  score:(ctx,me)=>{if(S.pile.length<=3)ctx.add(me,{mult:12});}},
];
const CONS=[
 {id:'read_head',ico:'⇆',name:'Read Head',price:2,desc:'Reverse the order of your next 3 draws. Your deck stays the same.',targets:0},
 {id:'service_pass',ico:'≡',name:'Service Pass',price:4,desc:'Get 2 free shop rerolls. Carry at most 4 tickets.',targets:0},
 {id:'credit_chip',ico:'$5',name:'Credit Chip',price:3,desc:'Cash out $5. Redeem at most 3 Credit Chips per run.',targets:0},
 {id:'scrap_cache',ico:'▣',name:'Scrap Cache',price:4,desc:'Get 2 different basic board tools. Needs one extra empty item slot.',targets:0},
 {id:'patch_cable',ico:'⌁',name:'Patch Cable',price:3,desc:'Move a finish from one board tile to a plain tile. The source becomes plain.',targets:2},
 {id:'echo_chip',ico:'»',name:'Echo Chip',price:5,desc:'Copy one tile’s finish to up to 2 adjacent plain tiles. Board only.',targets:1},
 {id:'skip_trace',ico:'⌜↗',name:'Skip Trace',price:3,desc:'Send one tile to the nearest empty corner. It does not merge.',targets:1},
 {id:'line_driver',ico:'→│',name:'Line Driver',price:3,desc:'Shift one row right by one cell, wrapping at the edge. Frozen tiles and walls block it.',targets:1},
 {id:'plasma_cutter',ico:'✕+',name:'Plasma Cutter',price:4,desc:'Remove one tile and any loose rubble touching it. Walls stay put.',targets:1},
 {id:'heat_sink',ico:'⇈',name:'Heat Sink',price:3,desc:'Strip one tile’s finish and double its value, up to 64. Enhanced tiles only.',targets:1},
 {id:'grease',ico:'≈',name:'Grease',price:3,desc:'Pause the rubble clock for your next 4 moves. Unused moves carry over.',targets:0},
 {id:'hotwire',ico:'⚡',name:'Hot Wire',price:3,desc:'Your next 3 moves that activate a fixture get +20 chips.',targets:0},
 {id:'wrench',ico:'⌁',name:'Wrench',price:3,desc:'Move one fixture to another cell. Keeps its charge and uses left.',targets:0},
 {id:'stack',ico:'↓Ⅲ',name:'Stack',price:2,desc:'Choose one of your next 3 draws and send it to the bottom of the pile.',targets:0},
 {id:"recast_item",ico:"⇒",name:"Mould",price:5,desc:"Turn one tile into an exact copy of another.",deck:true},
 {id:"split_item",ico:"½",name:"Wedge",price:4,desc:"Split a tile into two halves. Both keep its enhancement. Needs a free slot.",deck:true},
 {id:"eraser",ico:"−",name:"Eraser",price:3,desc:"Remove one tile.",targets:1},
 {id:"halve",ico:"½",name:"Halve",price:3,desc:"Halve one tile (a 2 is removed).",targets:1},
 {id:"double",ico:"×2",name:"Double",price:5,desc:"Double one tile.",targets:1},
 {id:"swap",ico:"⇄",name:"Swap",price:4,desc:"Swap two tiles.",targets:2},
 {id:"shuffle",ico:"↻",name:"Shuffle",price:3,desc:"Scatter every tile to a random cell.",targets:0},
 {id:"purge",ico:"∅",name:"Purge",price:4,desc:"Remove every 2 and 4 on the board.",targets:0},
 {id:"undo",ico:"↶",name:"Undo",price:4,desc:"Take back your last move.",targets:0},
 {id:"clock",ico:"◷",name:"Clock",price:3,desc:"+6 moves. In the shop, save them for the next round.",targets:0},
 {id:"polish",ico:"×2",name:"Polish",price:6,desc:"Your next 3 scoring moves get ×2 mult.",targets:0},
 {id:"st_bonus",ico:"+30",name:"Kick Blueprint",price:3,desc:"Enhance one tile: +30 chips when it merges.",targets:1,deck:true,stamp:"bonus"},
 {id:"st_mult",ico:"+4",name:"Plus Blueprint",price:4,desc:"Enhance one tile: +4 mult when it merges.",targets:1,deck:true,stamp:"mult"},
 {id:"st_glass",ico:"◇",name:"Prism Blueprint",price:4,desc:"Enhance one tile: ×2 mult when it merges, 1 in 4 to shatter.",targets:1,deck:true,stamp:"glass"},
 {id:"st_steel",ico:"▦",name:"Iron Blueprint",price:5,desc:"Enhance one tile: ×1.2 mult while on the board, at most 6 counted.",targets:1,deck:true,stamp:"steel"},
 {id:"st_gold",ico:"$",name:"Brass Blueprint",price:3,desc:"Enhance one tile: +$2 when it merges.",targets:1,deck:true,stamp:"gold"},
 {id:"st_lucky",ico:"★",name:"Odds Blueprint",price:3,desc:"Enhance one tile: 1 in 4 for +8 mult, 1 in 12 for +$4.",targets:1,deck:true,stamp:"lucky"},
 {id:"jack",ico:"✕",name:"Jackhammer",price:3,desc:"Clear every piece of rubble on the board.",targets:0},
 {id:"file",ico:"↓",name:"Archive",price:7,desc:"Send a tile from the board into your deck. ",targets:1,file:true},
 {id:"promote",ico:"↑",name:"Promote",price:4,desc:"Double one tile. A 2 becomes a 4.",deck:true},
 {id:"twin",ico:"Ⅱ",name:"Twin",price:5,desc:"Add a second copy of one tile. Needs a free slot.",deck:true},
 {id:"burn",ico:"−",name:"Burn",price:3,desc:"Destroy one tile.",deck:true},
 {id:"temper",ico:"✦",name:"Temper",price:5,desc:"Give one tile a random enhancement.",deck:true},
];
const VOUCHERS=[
 {id:'extension',ico:'▦+',name:'Extension Lead',price:10,desc:'Fit a fourth board fixture. Every fixture still needs its own cell.',max:1,eligible:()=>S.maxFixtures<4,apply:()=>{S.maxFixtures=4;}},
 {id:"overclock",ico:"+4",name:"Overclock",price:8,desc:"+4 moves every round. Stacks up to three times.",max:3,apply:()=>{S.bonusMoves+=4;}},
 {id:"purse",ico:"$+",name:"Bigger Purse",price:8,desc:"Interest cap rises by $2.",max:2,apply:()=>{S.interestCap+=2;}},
 {id:"slot",ico:"Ⅵ",name:"Sixth Slot",price:12,desc:"Unlock a sixth mod slot. Six slots maximum.",max:1,eligible:()=>S.maxCharms<6,apply:()=>{S.maxCharms=Math.min(6,S.maxCharms+1);}},
 {id:"pockets",ico:"+1",name:"Deep Pockets",price:8,desc:"One more consumable slot. Five slots maximum.",max:1,eligible:()=>S.maxCons<5,apply:()=>{S.maxCons=Math.min(5,S.maxCons+1);}},
 {id:"coupon",ico:"−$2",name:"Coupon Book",price:6,desc:"Rerolls cost $2 less.",max:1,apply:()=>{S.rerollDisc+=2;}},
 {id:"headstart",ico:"×2",name:"Head Start",price:10,desc:"Both of your opening tiles start doubled each round.",max:1,apply:()=>{}},
 {id:"printer",ico:"Ⅳ",name:"Print Shop",price:8,desc:"Tile packs offer one extra card and cost $1 less.",max:1,apply:()=>{S.packSize=4;S.packDisc=1;}},
 {id:"occult",ico:"+1",name:"Supply Line",price:9,desc:"One extra consumable offered in every shop.",max:1,apply:()=>{}},
 {id:'wide_bus',ico:'Ⅴ',name:'Wide Bus',price:7,desc:'See your next 5 draws instead of 3.',max:1,apply:()=>{S.previewDraws=5;}},
 {id:'spare_battery',ico:'+2',name:'Spare Battery',price:7,desc:'Clocks give 8 moves instead of 6. Works on Clocks you already hold.',max:1,apply:()=>{S.clockBonus=2;}},
 {id:'thermal_sleeve',ico:'▧',name:'Thermal Sleeve',price:9,desc:'Rubble takes one extra move to fall. Also works against The Drought.',max:1,apply:()=>{S.rubbleDelay=1;}},
 {id:'copper_traces',ico:'+5',name:'Copper Traces',price:10,desc:'Every fixture activation adds 5 chips. Priming a Switchboard does not count.',max:1,apply:()=>{S.fixtureChipBonus=5;}},
 {id:'field_service',ico:'+1',name:'Field Service',price:12,desc:'Toll Booth, Copy Desk, Inkwell and Trapdoor each get one extra use per round.',max:1,apply:()=>{S.fixtureExtraUse=1;}},
 {id:'bulk_license',ico:'▤+',name:'Bulk License',price:9,desc:'Blueprint and Blacksite packs offer one extra choice. The number of picks stays the same.',max:1,apply:()=>{S.jobPackBonus=1;}},
 {id:'price_scanner',ico:'−$1',name:'Price Scanner',price:7,desc:'Shop consumables cost $1 less, to a minimum of $1. Includes Buy & use.',max:1,apply:()=>{S.conDiscount=1;}},
 {id:'signal_amp',ico:'+40',name:'Signal Amp',price:8,desc:'Add 40 chips to your first scoring move each round.',max:1,apply:()=>{S.openingChipBonus=40;}},
 {id:'sorting_buffer',ico:'Ⅱ→',name:'Sorting Buffer',price:12,desc:'Each reshuffle starts with a pair of equal values, if your deck has one. Finishes can differ.',max:1,apply:()=>{S.sortDraws=true;}},
 {id:'fuse_link',ico:'◇─',name:'Fuse Link',price:10,desc:'Save the first Prism tile that would shatter each round. Protects that tile for the whole move.',max:1,apply:()=>{S.prismFuse=true;}},
];
const BOSSES=[
 {id:"freeze",name:"The Freeze",desc:"One tile is frozen in place. It won't move or merge."},
 {id:"flood",name:"The Flood",desc:"Two tiles spawn after every move."},
 {id:"tax",name:"The Tax",desc:"Your final mult is halved."},
 {id:"ceiling",name:"The Ceiling",desc:"Merges that create your current highest tile value score no chips."},
 {id:"hourglass",name:"The Hourglass",desc:"Only 16 moves this round (before bonuses)."},
 {id:"mirror",name:"The Mirror",desc:"Left is right. Up is down."},
 {id:"blackout",name:"The Blackout",desc:"Your first two mods are switched off."},
 {id:"weight",name:"The Weight",desc:"Every new tile spawns as an 8."},
 {id:"plain",name:"The Plain",desc:"Tile enhancements do nothing this round."},
 {id:"drought",name:"The Drought",desc:"Rubble falls twice as often."},
 {id:"metronome",name:"The Metronome",desc:"Your chain bonus caps at 3."},
 {id:"quota",name:"The Quota",desc:"Beating the score isn't enough \u2014 you must also build a big tile."},
 {id:"vice",name:"The Vice",desc:"Several cells are walled off for the whole round."},
];

// ---------- state ----------
let queuedDirection=null,boardJob=null;
let S=null, els=new Map(), locked=false, tileId=0, target=null, undoSnap=null, revealTimer=[], T=null, pendingReveal=null;

function newDeckCard(v,enh=null){return {cid:++S.cardSerial,v,enh};}
function ensureDeckIds(){
  const seen=new Set();S.cardSerial=Math.max(S.cardSerial||0,...S.deck.map(c=>Number.isInteger(c.cid)?c.cid:0));
  S.deck.forEach(c=>{if(!Number.isInteger(c.cid)||seen.has(c.cid))c.cid=++S.cardSerial;seen.add(c.cid);});
}
function newDeck(){const d=[];for(let i=0;i<16;i++)d.push(newDeckCard(2));for(let i=0;i<4;i++)d.push(newDeckCard(4));return d;}
function sourceCard(t){return !t.rock&&t.sourceId?S.deck.find(c=>c.cid===t.sourceId):null;}
function linkedCard(t){const c=sourceCard(t);return c&&c.v===t.v&&(c.enh||null)===(t.enh||null)?c:null;}
function linkedDraws(card){return allTiles().filter(t=>linkedCard(t)===card);}
function updateDeckCard(card,patch){
  const live=linkedDraws(card);Object.assign(card,patch);
  S.pile.forEach(c=>{if(c.cid===card.cid)Object.assign(c,patch);});
  live.forEach(t=>Object.assign(t,patch));
}
function removeDeckCard(card){
  S.deck.splice(S.deck.indexOf(card),1);S.pile=S.pile.filter(c=>c.cid!==card.cid);
  allTiles().forEach(t=>{if(t.sourceId===card.cid)delete t.sourceId;});
}
function reshuffle(){
  ensureDeckIds();
  S.pile=S.deck.map(c=>({...c}));
  for(let i=S.pile.length-1;i>0;i--){const j=Math.floor(S.rng()*(i+1));[S.pile[i],S.pile[j]]=[S.pile[j],S.pile[i]];}
  if(S.sortDraws){
    const first=S.pile.findIndex((card,i)=>S.pile.some((other,j)=>j>i&&other.v===card.v));
    if(first>=0){
      const a=S.pile.splice(first,1)[0],second=S.pile.findIndex(card=>card.v===a.v),b=S.pile.splice(second,1)[0];
      S.pile.unshift(a,b);
    }
  }
}
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
  S.pile=S.pile.filter(c=>c.cid!==cut.cid);
  return cut;
}
function enhCount(e){ return S.deck.filter(c=>e?c.enh===e:!!c.enh).length; }
function fileCard(v,enh){
  const card=newDeckCard(v,enh); S.deck.push(card); S.pile.splice(Math.floor(S.rng()*(S.pile.length+1)),0,{...card});
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
  if(target)cancelTarget();
  finishReveal(); queuedDirection=null; locked=false; audio.setScene("round");
  const seed=seedStr.slice(0,48)||randSeed();
  const difficulty=window.AnteProgression?.getDifficulty()||{id:'street',name:'Street',targetMult:1,movePenalty:0,rubbleAdvance:0,startingCash:4};
  S={ seed, rng:mulberry(hashStr(seed)), ante:1, blind:0, N:4, grid:null, score:0, target:0, moves:0, moveCap:0, money:difficulty.startingCash, difficulty:{...difficulty},cardSerial:0,bossRng:mulberry(hashStr(seed+":bosses")),bossSchedule:{},statsSaved:false,winRecorded:false,
      charms:[], cons:[], boss:null, frozen:null, mom:{dir:null,count:0}, polish:0, ghostUsed:false, consUsed:0, freeReroll:false,
      usedBosses:[], phase:"start", chain:0, banked:false, blewIt:false, movesMade:0, quota:0, quotaMet:false, shop:null, rerollCost:5, roundsWon:0, totalScore:0, bestMove:0, endless:false,
      maxCharms:MAX_CHARMS, maxCons:MAX_CONS, interestCap:5, bonusMoves:0, rerollDisc:0, vouchers:[], voucher:null,
      deck:null, pile:[], packSize:3, packDisc:0, trims:0, retirePerRound:1, retireLeft:0, retired:[], madeValues:{},
      fixtures:[],maxFixtures:3,grease:0,hotwire:0,boardOffer:null,shopRound:null };
  boardJob=null;deckJob=null;resetModJob();
  S.deck=newDeck(); reshuffle();
  S.grid=Array.from({length:4},()=>Array(4).fill(null));
  els.forEach(e=>e.remove()); els.clear();
  $("seedlbl").textContent="seed "+seed;
  $("log").innerHTML=""; log("New run. Seed <b>"+escapeHTML(seed)+"</b>.");
  T={v:VERSION,difficulty:S.difficulty.id,deckEdits:[],seed,start:new Date().toISOString(),rounds:[],shops:[],end:null};
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
  const delay=(S.rubbleDelay||0)-(S.difficulty.rubbleAdvance||0);
  if(S.boss&&S.boss.id==="drought") return Math.max(2,3+delay);
  if(has("roadworks")) return 9+delay;
  let e = S.ante<=2?6:S.ante<=5?5:4;
  if(S.movesMade>=Math.floor(S.moveCap/2)) e=Math.max(3,e-2);
  return Math.max(2,e+delay);
}
function spawn(){
  const e=emptyCells(); if(!e.length) return null;
  const [r,c]=e[Math.floor(S.rng()*e.length)];
  const card=draw(); let v=card.v, enh=card.enh;
  activeCharms().forEach(ch=>{ if(ch.onDraw) ch.onDraw(card); }); enh=card.enh;
  if(S.boss && S.boss.id==="weight" && S.phase==="round") v=8;
  else activeCharms().forEach(ch=>{ if(ch.spawnValue) v=ch.spawnValue(v); });
  const t={id:++tileId,v,enh,r,c,sourceId:card.cid}; S.grid[r][c]=t; return t;
}
function targetFor(ante,blind){
  const base= ante<=8 ? TARGETS[ante-1] : TARGETS[7]*Math.pow(ENDLESS_GROWTH,ante-8);
  return Math.floor(base*BLINDS[blind].mult*(S?.difficulty?.targetMult||1));
}
function roundMoves(){
  let n=BASE_MOVES+S.bonusMoves-(S.difficulty.movePenalty||0);
  if(S.boss && S.boss.id==="hourglass") n=16+S.bonusMoves-(S.difficulty.movePenalty||0);
  activeCharms().forEach(c=>{ if(c.moves) n=c.moves(n); });
  return Math.max(8,n);
}
function deckSummary(){ const m={}; S.deck.forEach(c=>{ const k=(c.enh?c.enh+" ":"")+c.v; m[k]=(m[k]||0)+1; }); return Object.keys(m).sort((a,b)=>parseInt(a.split(" ").pop())-parseInt(b.split(" ").pop())).map(k=>k.replace(" ","")+"x"+m[k]).join(" "); }

function startRound(){
  audio.setScene(S.blind===2?"boss":"round");
  S.phase="round"; S.score=0; S.frozen=null; S.ghostUsed=false; S.mom={dir:null,count:0}; undoSnap=null;
  S.openingBonusUsed=false;S.prismFuseUsed=false;
  S.fixtures.forEach(f=>{f.uses=0;f.charge=0;f.dir=null;f.firedAt=-1;});
  S.upcomingBoss=bossForAnte(S.ante);
  S.boss = S.blind===2 ? S.upcomingBoss : null;
  S.target=targetFor(S.ante,S.blind);
  S.grid=Array.from({length:S.N},()=>Array(S.N).fill(null));
  syncTiles();
  S.chain=0; S.banked=false; S.blewIt=false; S.movesMade=0; S.quota=0; S.quotaMet=false; S.rubbleIn=99;
  spawn(); spawn();
  if(S.boss&&S.boss.id==="vice"){ for(let i=0;i<Math.max(2,S.N-2);i++) spawnRock(true); }
  if(S.boss&&S.boss.id==="quota"){ S.quota=S.ante<=2?64:S.ante<=4?128:256; }
  if(S.vouchers.includes("headstart")){ allTiles().sort((a,b)=>a.v-b.v).forEach(t=>{ t.v*=2; }); }
  activeCharms().slice().forEach(c=>{ if(c.roundStart) c.roundStart(c); });
  S.moves=roundMoves()+(S.nextMoves||0); S.nextMoves=0; S.moveCap=S.moves; S.rubbleIn=rubbleEvery();
  if(S.boss && S.boss.id==="freeze"){ const t=allTiles(); const pick=t[Math.floor(S.rng()*t.length)]; S.frozen=pick.id; }
  T.rounds.push({ante:S.ante,blind:BLINDS[S.blind].name,boss:S.boss?S.boss.id:null,upcomingBoss:S.upcomingBoss.id,difficulty:S.difficulty.id,target:S.target,movesAllowed:S.moves,moneyStart:S.money,
    boardStart:boardValues(),charms:S.charms.map(c=>c.id),cons:S.cons.map(c=>c.id),vouchers:S.vouchers.slice(),deck:deckSummary(),deckAvg:deckAvg(),fixtures:S.fixtures.map(f=>({kind:f.kind,r:f.r,c:f.c})),moves:[],result:null});
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
  const b=pool[Math.floor(S.bossRng()*pool.length)]; S.usedBosses.push(b.id); return b;
}

function bossForAnte(ante){return S.bossSchedule[ante]||(S.bossSchedule[ante]=pickBoss());}
function renderBossPreview(){
  const nextAnte=S.phase==='shop'&&S.blind===2?S.ante+1:S.ante,boss=bossForAnte(nextAnte);
  const label=(nextAnte===S.ante&&S.blind===2&&S.phase!=='shop'?'Current boss':'Upcoming boss')+' · Ante '+nextAnte;
  ['bossforecast','shopbossforecast'].forEach(id=>{
    const box=$(id);if(!box)return;box.innerHTML='<summary><span>'+label+'</span><strong>'+boss.name+'</strong></summary><p>'+boss.desc+'</p><small>Target '+fmt(targetFor(nextAnte,2))+' · '+S.difficulty.name+'</small>';
  });
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
        out[r][c]=x.tile; if(commit){ x.tile.r=r;x.tile.c=c; if(x.eaten){ delete x.tile.sourceId;delete x.eaten.sourceId;x.tile.v=Math.max(x.tile.v,x.eaten.v)*2; markMadeValue(x.tile.v); x.eaten.r=r; x.eaten.c=c;
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
    if(S.grease>0)S.grease--;
    else if(--S.rubbleIn<=0){ S.rubbleIn=rubbleEvery(); const rk=spawnRock(false); if(rk){ log("Rubble fell."); audio.effect("rubble"); } }
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
  S.fixtures.forEach(f=>{if(f.kind==='flywheel'&&!merges.some(m=>m.r===f.r&&m.c===f.c))f.charge=Math.min(60,f.charge+10);});
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
  if(S.openingChipBonus&&!S.openingBonusUsed){S.openingBonusUsed=true;ctx.chips+=S.openingChipBonus;ctx.steps.push({name:'Signal Amp',chips:S.openingChipBonus});}
  // tile enhancements
  const plain=S.boss&&S.boss.id==="plain"; const shatterList=[],fuseSaved=new Set(); let glassFired=0;
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
        else if(e==="glass"){
          if(glassFired<2){glassFired++;add({xmult:2});}
          if(!tempered.has(m.tile.id)&&!fuseSaved.has(m.tile.id)&&!has("glazier")&&S.rng()<0.25){
            if(S.prismFuse&&!S.prismFuseUsed){S.prismFuseUsed=true;fuseSaved.add(m.tile.id);ctx.steps.push({name:'Fuse Link',tid:m.tile.id,txt:'Prism saved'});}
            else if(!shatterList.includes(m.tile))shatterList.push(m.tile);
          }
        }
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
  scoreFixtures(ctx);
  if(ctx.fixtureHits.length)rec.fixtures=ctx.fixtureHits.map(f=>f.kind+'@'+(f.r+1)+','+(f.c+1));
  activeCharms().slice().forEach(c=>scoreMod(ctx,c));
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

// Fixtures belong to cells, not tiles. Their effects run after tile finishes
// and before charms; new tiles never join the current move's merge list.
function scoreFixtures(ctx){
  ctx.fixtureHits=[];
  S.fixtures.forEach(f=>{
    const d=FIXTURES[f.kind],m=ctx.merges.find(m=>m.r===f.r&&m.c===f.c);
    const limit=fixtureLimit(f);
    if(!m||(limit&&f.uses>=limit))return;
    const step={name:d.name+' ['+(f.r+1)+','+(f.c+1)+']',tid:m.tile.id};
    if(f.kind==='press')step.chips=20;
    else if(f.kind==='flywheel'){
      if(!f.charge)return;step.chips=f.charge;f.charge=0;
    }
    else if(f.kind==='toll'){S.money++;step.txt='+$1';}
    else if(f.kind==='copier'){
      const cells=emptyCells();if(m.v>32||!cells.length)return;
      const [r,c]=cells[Math.floor(S.rng()*cells.length)];S.grid[r][c]={id:++tileId,v:m.v,enh:null,r,c};
      step.txt='spawned a plain '+m.v;ctx.dirty=true;
    }
    else if(f.kind==='inkwell'){
      if(m.tile.enh||S.grid[f.r][f.c]!==m.tile)return;
      const keys=Object.keys(ENH);m.tile.enh=keys[Math.floor(S.rng()*keys.length)];
      step.txt='added '+ENH[m.tile.enh].name;ctx.dirty=true;
    }
    else if(f.kind==='trapdoor'){
      if(m.v<16)return;
      if(S.grid[f.r][f.c]===m.tile)S.grid[f.r][f.c]=null;
      step.xmult=1.6;ctx.dirty=true;
    }
    else if(f.kind==='switchboard'){
      const changed=f.dir&&f.dir!==S.mom.dir;f.dir=S.mom.dir;
      if(!changed){ctx.steps.push({...step,txt:'primed '+S.mom.dir});return;}
      step.mult=4;
    }
    f.uses++;f.firedAt=S.movesMade;ctx.fixtureHits.push(f);
    if(step.chips)ctx.chips+=step.chips;
    if(step.mult)ctx.mult+=step.mult;
    if(step.xmult)ctx.xmult*=step.xmult;
    ctx.steps.push(step);
    if(S.fixtureChipBonus){ctx.chips+=S.fixtureChipBonus;ctx.steps.push({name:'Copper Traces',tid:m.tile.id,chips:S.fixtureChipBonus});}
  });
  if(ctx.fixtureHits.length&&S.hotwire>0){S.hotwire--;ctx.chips+=20;ctx.steps.push({name:'Hot Wire',chips:20});}
  ctx.empty=emptyCells().length;
}
function fixtureAt(r,c){return S.fixtures.find(f=>f.r===r&&f.c===c);}
function fixtureLimit(f){const limit=FIXTURES[f.kind].limit;return limit?limit+(S.fixtureExtraUse||0):0;}
function fixtureDescription(kind){
  const d=FIXTURES[kind];let desc=d.desc;
  if(d.limit&&S.fixtureExtraUse){
    const limit=d.limit+S.fixtureExtraUse;
    desc=kind==='toll'?'The first '+limit+' merges here each round pay $1 each.':desc.replace(/^(Once|Twice) per round,/,limit+' times per round,');
  }
  if(S.fixtureChipBonus)desc+=' Each activation also gives '+S.fixtureChipBonus+' chips.';
  return desc;
}
function fixtureStatus(f){
  const limit=fixtureLimit(f);
  if(limit)return Math.max(0,limit-f.uses)+' / '+limit+' left';
  if(f.kind==='flywheel')return f.charge+' / 60 chips';
  if(f.kind==='switchboard')return f.dir?'last: '+f.dir:'unprimed';
  return '+'+(20+(S.fixtureChipBonus||0))+' chips';
}
function fixtureSummary(){return S.fixtures.map(f=>FIXTURES[f.kind].name+' ['+(f.r+1)+','+(f.c+1)+']').join(', ')||'none';}
function renderFixtureBoard(){
  [...$('cells').children].forEach((cell,i)=>{
    const f=fixtureAt(Math.floor(i/S.N),i%S.N);cell.textContent=f?FIXTURES[f.kind].ico:'';
    if(f){cell.dataset.fixture=f.kind;cell.title=FIXTURES[f.kind].name+': '+fixtureStatus(f);}else{delete cell.dataset.fixture;cell.removeAttribute('title');}
  });
  allTiles().forEach(t=>{
    const e=els.get(t.id);if(!e)return;
    e.querySelector('.socket-mark')?.remove();
    e.setAttribute('aria-label',e.title+', row '+(t.r+1)+', column '+(t.c+1));
    const f=fixtureAt(t.r,t.c);if(!f)return;
    const d=FIXTURES[f.kind],tag=document.createElement('span');tag.className='socket-mark';tag.textContent=d.ico;
    tag.dataset.spent=String(!!fixtureLimit(f)&&f.uses>=fixtureLimit(f));tag.dataset.fired=String(S.phase==='round'&&f.firedAt===S.movesMade);tag.title=d.name+' · '+fixtureStatus(f);e.appendChild(tag);
    e.setAttribute('aria-label',e.title+'; on '+d.name+', '+fixtureStatus(f));
  });
  const hud=$('fixturehud');hud.innerHTML='';hud.hidden=!S.fixtures.length;
  S.fixtures.forEach(f=>{
    const d=FIXTURES[f.kind],label=document.createElement('button');label.className='fixture-label';label.title=fixtureDescription(f.kind);label.dataset.fired=String(S.phase==='round'&&f.firedAt===S.movesMade);
    label.innerHTML='<b>'+d.ico+' '+d.name+'</b><small>'+(f.r+1)+','+(f.c+1)+' · '+fixtureStatus(f)+'</small>';
    label.onclick=()=>{ $('inspectname').textContent=d.name;$('inspecticon').textContent=d.ico;$('inspectrarity').textContent='Board fixture · '+(f.r+1)+','+(f.c+1);$('inspectdesc').textContent=fixtureDescription(f.kind)+' '+fixtureStatus(f)+'. Charges reset each round.';show('ov-inspect'); };
    hud.appendChild(label);
  });
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
function snapshot(){
  return {grid:S.grid.map(row=>row.map(t=>t?{...t}:null)),deck:S.deck.map(c=>({...c})),deckEdits:S.deckEdits||0,deckLogLength:T.deckEdits.length,
    score:S.score,moves:S.moves,money:S.money,madeValues:{...S.madeValues},mom:{...S.mom},polish:S.polish,fixtures:S.fixtures.map(f=>({...f})),
    grease:S.grease,hotwire:S.hotwire,rubbleIn:S.rubbleIn,movesMade:S.movesMade,chain:S.chain,openingBonusUsed:S.openingBonusUsed,prismFuseUsed:S.prismFuseUsed,
    totalScore:S.totalScore,bestMove:S.bestMove,quotaMet:S.quotaMet,banked:S.banked,blewIt:S.blewIt,ghostUsed:S.ghostUsed,
    pile:S.pile.map(c=>({...c})),charmSt:S.charms.map(c=>JSON.stringify(c.st))};
}
function restore(sn){
  S.grid=sn.grid.map(row=>row.map(t=>t?{...t}:null));S.deck=sn.deck.map(c=>({...c}));S.pile=sn.pile.map(c=>({...c}));
  S.madeValues={...sn.madeValues};S.mom={...sn.mom};S.fixtures=sn.fixtures.map(f=>({...f}));
  ['score','moves','money','polish','grease','hotwire','rubbleIn','movesMade','chain','openingBonusUsed','prismFuseUsed','totalScore','bestMove','quotaMet','banked','blewIt','ghostUsed','deckEdits'].forEach(k=>{S[k]=sn[k];});
  T.deckEdits.length=sn.deckLogLength;
  S.charms.forEach((c,i)=>{if(sn.charmSt[i])c.st=JSON.parse(sn.charmSt[i]);});
  curRound().moves.push({undo:true});syncTiles();render();calcIdle();
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
  if(target)cancelTarget();
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
function confetti(){ if(reduced) return; const cols=["#60d4df","#efba68","#f079a0","#ca9bf0"]; for(let i=0;i<28;i++){ const c=document.createElement("div"); c.className="conf"; c.style.left=Math.random()*100+"vw"; c.style.top=(-20-Math.random()*60)+"px"; c.style.background=cols[i%cols.length]; c.style.animationDelay=(Math.random()*.4)+"s"; document.body.appendChild(c); setTimeout(()=>c.remove(),1800); } }
$("btncashnow").onclick=()=>{ if(S.phase==="round"&&S.banked){ S.phase="cash"; finishReveal(); winRound(); } };
$("btncash").onclick=()=>{
  const rr=curRound(); if(S.retired.length){ rr.filed=S.retired.slice(); S.retired=[]; }
  if(S.blind===2 && S.ante===8 && !S.endless){ hide("ov-cash"); winRun(); return; }
  openShop();
  hide("ov-cash");
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
  if(target)cancelTarget();
  ensureShopLayout();
  audio.setScene("shop");
  S.pendingJobPack=null; S.pendingTilePack=null;
  if(S.shopRound!==S.ante+':'+S.blind){
    S.phase="shop"; S.rerollCost=Math.max(1,5-S.rerollDisc); S.freeReroll=has("chaos"); rollShop(); pickVoucher();
    S.packs=rollPacks();
    const kinds=Object.keys(FIXTURES);S.boardOffer={kind:kinds[Math.floor(S.rng()*kinds.length)],sold:false};
    S.shopRound=S.ante+':'+S.blind;
    T.shops.push({afterAnte:S.ante,afterBlind:BLINDS[S.blind].name,money:S.money,offered:S.shop.map(i=>i.def.id).concat(S.voucher?["v:"+S.voucher.def.id]:[]).concat(S.packs.map(p=>'pack:'+p.kind+':'+p.size)),bought:[],sold:[],rerolls:0});
    curShop().offered.push('fixture:'+S.boardOffer.kind);
  }
  S.phase='shop';
  const nb=S.blind+1>2?0:S.blind+1, na=nb===0?S.ante+1:S.ante;
  $("shopnext").innerHTML="Next: <b>Ante "+na+" · "+BLINDS[nb].name+"</b>, target "+fmt(targetFor(na,nb))+".";
  renderShop(); show("ov-shop");
}
// Older cached HTML used separate Deck and Special stock sections. Upgrade
// that layout before rendering, so a mixed-version page can still open the shop.
function ensureShopLayout(){
  if(!$('bossforecast')){const box=document.createElement('details');box.id='bossforecast';box.className='boss-forecast';$('bossnote').after(box);}
  if(!$('shopbossforecast')){const box=document.createElement('details');box.id='shopbossforecast';box.className='boss-forecast shop-forecast';box.open=true;$('shopnext').after(box);}
  if(!$('decklinklegend')){const note=document.createElement('p');note.id='decklinklegend';note.className='deck-link-legend';note.textContent='↗ Linked draw · permanent Blueprints change its deck card too. Merged, copied or temporarily changed tiles are not eligible.';$('bankbar').before(note);}
  if(!$('after-hours-theme')){
    const theme=document.createElement('link');theme.id='after-hours-theme';theme.rel='stylesheet';theme.href='./cyberpunk.css?v='+VERSION;document.head.appendChild(theme);
  }
  const version=document.querySelector('.footer small');if(version)version.textContent=VERSION;
  if(!$('packstock')){
    const section=document.createElement('div');section.className='shopsec packs-section';
    section.innerHTML='<h3>Packs <span>Two offers · new stock next shop</span></h3><div id="packstock" class="shopgrid pack-stock"></div><p id="shopdeck" class="pack-decknote"></p>';
    const old=$('deckrow')?.closest('.shopsec');
    if(old)old.replaceWith(section);else $('shopgrid').after(section);
    $('workshoprow')?.closest('.shopsec')?.remove();
  }
  if(!$('shopcons')){
    const section=document.createElement('div');section.className='shopsec';
    section.innerHTML='<h3>Your items <span id="shopconsnote"></span></h3><div class="item-rack" id="shopcons"></div>';
    $('shopcharms').closest('.shopsec').before(section);
  }
  if(!$('packworkbench')){
    const section=document.createElement('div');section.id='packworkbench';section.className='pack-workbench';section.hidden=true;
    section.innerHTML='<h3>On the table <span id="packhandnote"></span></h3><div class="pack-hand" id="packhand"></div><p class="hand-note">These are the tiles you can edit. Both picks use the same hand.</p><h3>Your items</h3><div class="item-rack" id="packcons"></div>';
    $('packgrid').after(section);
  }
  ensureBoardWorkshop();
}
function ensureBoardWorkshop(){
  if(!$('boardstock')){
    const section=document.createElement('div');section.className='shopsec board-stock-section';
    section.innerHTML='<h3>Board work <span id="boardstockcount"></span></h3><div id="boardstock"></div><p class="hand-note">Fixtures stay on their cells between rounds. One offer per shop. Replacing one gives no refund.</p>';
    $('voucherbox').closest('.shopsec').before(section);
  }
  if(!$('fixturehud')){
    const hud=document.createElement('div');hud.id='fixturehud';hud.className='fixture-hud';hud.hidden=true;$('bankbar').before(hud);
  }
  if(!$('ov-boardwork')){
    const modal=document.createElement('div');modal.className='ov over';modal.id='ov-boardwork';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','boardworktitle');
    modal.innerHTML='<div class="modal board-workshop"><span class="eyebrow">BOARD WORKSHOP</span><h2 id="boardworktitle"></h2><p id="boardworkdesc"></p><div class="board-plan" id="boardplan"></div><p class="edit-preview" id="boardworkpreview" aria-live="polite"></p><div class="btnrow"><button class="btn ghost" id="btnboardcancel">Back</button><button class="btn" id="btnboardapply" disabled>Install</button></div></div>';
    document.body.appendChild(modal);
    $('btnboardcancel').onclick=cancelBoardJob;$('btnboardapply').onclick=applyBoardJob;
  }
}
function installReason(kind){
  return S.fixtures.length>=S.maxFixtures&&S.fixtures.every(f=>f.kind===kind)?'All slots already hold this fixture':'';
}
function renderBoardStock(){
  $('boardstockcount').textContent=S.fixtures.length+' / '+S.maxFixtures+' installed';
  const box=$('boardstock');box.innerHTML='';
  const offer=S.boardOffer;if(!offer)return;
  const d=FIXTURES[offer.kind],reason=installReason(offer.kind),card=document.createElement('div');card.className='card fixture-stock'+(offer.sold?' sold':'');
  card.innerHTML='<div class="fixture-mark">'+d.ico+'</div><div><div class="t">'+d.name+'</div><div class="d">'+fixtureDescription(offer.kind)+'</div></div><button class="buy">'+(offer.sold?'Installed':reason||'Fit $'+d.price)+'</button>';
  const button=card.querySelector('button');button.disabled=offer.sold||!!reason||S.money-d.price<moneyFloor();
  button.onclick=()=>beginBoardJob({kind:'install',fixture:offer.kind,source:'shop',price:d.price});box.appendChild(card);
}
function beginBoardJob(options){
  if(boardJob||deckJob)return;
  if(options.kind==='install'&&installReason(options.fixture))return;
  boardJob={...options,price:options.price||0,from:null,to:null,card:null};
  renderBoardJob();show('ov-boardwork');
}
function cancelBoardJob(){boardJob=null;hide('ov-boardwork');if(S.pendingJobPack)renderJobPack();}
function renderBoardJob(){
  const job=boardJob,grid=$('boardplan');grid.innerHTML='';grid.classList.toggle('draw-plan',job.kind==='stack');
  const d=job.fixture?FIXTURES[job.fixture]:null;
  $('boardworktitle').textContent=d?'Fit '+d.name:job.kind==='move'?'Move a fixture':'Stack';
  $('boardworkdesc').textContent=d?fixtureDescription(job.fixture):job.kind==='move'?'Choose a fixture, then a new cell. Moving it does not refill its charge or uses.':'Send one of these draws to the bottom. The other draws keep their order.';
  if(job.kind==='stack'){
    S.pile.slice(0,3).forEach((card,i)=>{
      const button=document.createElement('button');button.className='plan-draw'+(job.card===card?' selected':'');
      button.disabled=i===S.pile.length-1;button.setAttribute('aria-pressed',String(job.card===card));button.appendChild(miniTile(card));
      const label=document.createElement('span');label.textContent='Draw '+(i+1);button.appendChild(label);
      button.onclick=()=>{job.card=card;renderBoardJob();};grid.appendChild(button);
    });
    $('boardworkpreview').textContent=job.card?'Send '+(job.card.enh?ENH[job.card.enh].name+' ':'')+job.card.v+' to the bottom.':'Choose one of the upcoming draws.';
  }else{
    grid.style.setProperty('--plan-n',S.N);
    for(let r=0;r<S.N;r++)for(let c=0;c<S.N;c++){
      const existing=fixtureAt(r,c),selected=job.to?.r===r&&job.to?.c===c,source=job.from===existing&&!!existing;
      const button=document.createElement('button');button.className='plan-cell'+(selected?' selected':'')+(source?' source':'');
      button.disabled=job.kind==='install'?(existing?.kind===job.fixture||(!existing&&S.fixtures.length>=S.maxFixtures)):!existing&&!job.from;
      button.setAttribute('aria-label','Row '+(r+1)+', column '+(c+1)+(existing?', '+FIXTURES[existing.kind].name:', empty fixture slot'));
      button.setAttribute('aria-pressed',String(selected||source));
      button.innerHTML='<small>'+(r+1)+','+(c+1)+'</small><b>'+(existing?FIXTURES[existing.kind].ico:'＋')+'</b><span>'+(existing?FIXTURES[existing.kind].name:'')+'</span>';
      button.onclick=()=>{
        if(job.kind==='move'&&existing){job.from=existing;job.to=null;}else job.to={r,c};
        renderBoardJob();
      };grid.appendChild(button);
    }
    const old=job.to?fixtureAt(job.to.r,job.to.c):null;
    $('boardworkpreview').textContent=job.to?(job.kind==='move'?'Move '+FIXTURES[job.from.kind].name:'Install '+d.name)+' at '+(job.to.r+1)+','+(job.to.c+1)+'.'+(old?' Replaces '+FIXTURES[old.kind].name+' with no refund.':''):
      job.kind==='move'?(job.from?'Choose an empty fixture slot.':'Choose the fixture to move.'):'Choose a cell. '+S.fixtures.length+' / '+S.maxFixtures+' installed.';
  }
  $('btnboardapply').textContent=(job.kind==='stack'?'Send to bottom':job.kind==='move'?'Move fixture':'Install')+(job.price?' · $'+job.price:'');
  $('btnboardapply').disabled=!(job.kind==='stack'?job.card:job.to)||S.money-job.price<moneyFloor();
}
function applyBoardJob(){
  const job=boardJob;if(!job||$('btnboardapply').disabled)return;
  if(S.money-job.price<moneyFloor())return;
  if(job.source==='shop'&&(!S.boardOffer||S.boardOffer.sold||S.boardOffer.kind!==job.fixture))return;
  if(job.source==='pack'&&(!S.pendingJobPack||S.pendingJobPack.taken.includes(job.packId)))return;
  if(job.kind==='install'){
    if(!job.to)return;
    const old=fixtureAt(job.to.r,job.to.c);if(!old&&S.fixtures.length>=S.maxFixtures)return;
    if(old)S.fixtures.splice(S.fixtures.indexOf(old),1);
    S.fixtures.push({kind:job.fixture,...job.to,uses:0,charge:0,dir:null,firedAt:-1});
    activeCharms().forEach(c=>{if(c.onInstall)c.onInstall(c);});
    log('Installed <b>'+FIXTURES[job.fixture].name+'</b> at '+(job.to.r+1)+','+(job.to.c+1)+'.');
  }else if(job.kind==='move'){
    if(!job.to||!S.fixtures.includes(job.from)||fixtureAt(job.to.r,job.to.c))return;
    job.from.r=job.to.r;job.from.c=job.to.c;
  }else if(job.kind==='stack'){
    const i=S.pile.indexOf(job.card);if(i<0||i>=3)return;
    S.pile.push(S.pile.splice(i,1)[0]);
  }
  S.money-=job.price;
  if(job.kind!=='stack')(T.boardEdits||=[]).push({kind:job.kind,fixture:job.fixture||job.from.kind,to:job.to,ante:S.ante,blind:S.blind});
  boardJob=null;undoSnap=null;hide('ov-boardwork');
  if(job.source==='item'){finishCon(job.idx);return;}
  if(job.source==='shop'){S.boardOffer.sold=true;curShop().bought.push('fixture:'+job.fixture);}
  if(job.source==='pack'){
    S.pendingJobPack.taken.push(job.packId);S.pendingJobPack.remaining--;
    if(!S.pendingJobPack.remaining){S.pendingJobPack=null;hide('ov-pack');}
    curShop().bought.push('workshop-pack:'+job.packId);
    S.consUsed++;S.charms.forEach(c=>{if(c.onUseCon)c.onUseCon(c);});
  }
  audio.effect('upgrade');render();renderShop();if(S.pendingJobPack)renderJobPack();saveT();
}
function curShop(){ return T.shops[T.shops.length-1]; }
function pickVoucher(){
  const pool=VOUCHERS.filter(v=>S.vouchers.filter(x=>x===v.id).length<v.max&&(!v.eligible||v.eligible()));
  S.voucher = pool.length ? {def:pool[Math.floor(S.rng()*pool.length)],sold:false} : null;
}
function renderVoucher(){
  const box=$("voucherbox"); box.innerHTML="";
  if(!S.voucher){ box.innerHTML="<div class='empty'>All firmware installed.</div>"; return; }
  const v=S.voucher, d=v.def, afford=S.money-d.price>=moneyFloor(),eligible=!d.eligible||d.eligible();
  const el=document.createElement("div"); el.className="card voucher"+(v.sold?" sold":""); el.style.alignItems="center";
  el.innerHTML="<div class='ico'>"+d.ico+"</div><div style='flex:1'><div class='t'>"+d.name+"</div><div class='d'>"+d.desc+"</div></div><button class='buy' style='margin:0;align-self:center;padding:6px 12px;flex:none' "+(v.sold||!afford||!eligible?"disabled":"")+">"+(v.sold?"Installed":!eligible?"At limit":"Install $"+d.price)+"</button>";
  el.querySelector(".buy").onclick=()=>{ if(v.sold||S.money-d.price<moneyFloor()||(d.eligible&&!d.eligible())) return; S.money-=d.price; v.sold=true; S.vouchers.push(d.id); d.apply(); curShop().bought.push("v:"+d.id); audio.effect("buy"); log("Installed <b>"+d.name+"</b>."); renderShop();saveT(); };
  box.appendChild(el);
}
const PACK_TYPES={
  tile:{name:'Tile',mark:'Ⅱ',price:6,desc:'Add tiles to your deck. Higher values must be made on the board first.'},
  workshop:{name:'Blueprint',mark:'✦',price:6,desc:'Deck work, board fixtures, supplies and upgrades for the run.'},
  backroom:{name:'Blacksite',mark:'◇',price:8,desc:'Experimental deck edits. Big changes, lasting costs.'},
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
  return pack.kind==='tile'?count+Math.max(0,S.packSize-3):Math.min(count+(S.jobPackBonus||0),(pack.kind==='workshop'?WORKSHOP:EXPERIMENTS).length);
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
  $('packworkbench').hidden=true;
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
      const card=newDeckCard(o.v,o.enh);S.deck.push(card);recordDeckEdit('tile_pack',before,deckSummary());
      S.pile.splice(Math.floor(S.rng()*(S.pile.length+1)),0,{...card});
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
function shopPrice(it){return Math.max(1,it.def.price-(it.kind==='con'?(S.conDiscount||0):0));}
function renderShop(){
  $("shopwallet").textContent="$"+S.money;renderBossPreview();
  $("shopgrid").innerHTML="";
  S.shop.forEach((it,i)=>{
    const d=it.def, full = it.kind==="charm" ? S.charms.length>=S.maxCharms : S.cons.length>=S.maxCons;
    const price=shopPrice(it),afford=S.money-price>=moneyFloor();
    const el=document.createElement("div"); el.className="card"+(it.sold?" sold":"")+(it.kind==="con"?" con":"");
    el.innerHTML="<div style='display:flex;gap:10px;align-items:flex-start;width:100%'><div class='ico'>"+d.ico+"</div><div><div class='t'>"+d.name+"</div><div class='d'>"+(it.kind==='con'?conDescription(d,'shop'):descOf(d))+"</div></div></div>"+
      (it.kind==="charm"?"<span class='rare "+d.rar+"'>"+({c:"common",u:"uncommon",r:"rare"})[d.rar]+"</span>":"<span class='rare' style='background:var(--blue2);color:var(--ink)'>"+(d.stamp?"blueprint":"consumable")+"</span>")+
      "<button class='buy' "+(it.sold||!afford||full?"disabled":"")+">"+(it.sold?"Sold":full?"No room":"Buy $"+price)+"</button>";
    el.querySelector(".buy").onclick=()=>buy(i);
    if(it.kind==='con'&&instantCon(d)){
      const use=document.createElement('button');use.className='buy use-now';use.textContent='Buy & use $'+price;
      const reason=conReason(d,'shop',false);use.disabled=it.sold||!afford||!!reason;use.title=reason;use.onclick=()=>buyAndUse(i);el.appendChild(use);
    }
    $("shopgrid").appendChild(el);
  });
  renderPacks(); renderVoucher();renderBoardStock();
  renderItemRack($('shopcons'),'shop');
  $('shopconsnote').textContent=(S.nextMoves?'+'+S.nextMoves+' moves next round · ':'')+S.cons.length+' / '+S.maxCons;
  const rc=S.freeReroll||S.rerollTickets>0?0:S.rerollCost;
  $("btnreroll").textContent=rc?"Reroll $"+rc:"Reroll (free)"+(S.rerollTickets>0?" · "+S.rerollTickets+" tickets":""); $("btnreroll").disabled=S.money-rc<moneyFloor();
  $("shopcharms").innerHTML="";
  if(!S.charms.length) $("shopcharms").innerHTML="<div class='empty' style='width:100%'>Buy a mod to start your build.</div>";
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
  const it=S.shop[i],d=it.def,price=shopPrice(it);if(S.phase!=='shop'||it.sold||S.money-price<moneyFloor())return;
  if(it.kind==="charm"){ if(S.charms.length>=S.maxCharms) return; S.charms.push(makeCharm(d)); if(d.id==="sixth") growBoard(); }
  else { if(S.cons.length>=S.maxCons) return; S.cons.push({...d}); }
  S.money-=price; it.sold=true; curShop().bought.push(d.id); audio.effect("buy"); log("Bought <b>"+d.name+"</b> for $"+price+".");
  const m=$("shopwallet"); m.classList.remove("bump"); void m.offsetWidth; m.classList.add("bump");
  renderShop();
}
function buyAndUse(i){
  const it=S.shop[i],d=it.def,price=shopPrice(it);
  if(locked||deckJob||boardJob||isModJobOpen()||S.phase!=='shop'||it.kind!=='con'||!instantCon(d)||it.sold||S.money-price<moneyFloor()||conReason(d,'shop',false))return;
  if(target)cancelTarget();
  S.money-=price;it.sold=true;curShop().bought.push(d.id);
  S.cons.push({...d});useCon(S.cons.length-1,'shop');
}
$("btnreroll").onclick=()=>{ const rc=S.freeReroll||S.rerollTickets>0?0:S.rerollCost; if(S.money-rc<moneyFloor()) return; S.money-=rc; if(S.freeReroll) S.freeReroll=false; else if(S.rerollTickets>0)S.rerollTickets--; else S.rerollCost+=2; curShop().rerolls++; rollShop(); audio.effect("shuffle"); renderShop(); };
$("btnshopnext").onclick=()=>{ hide("ov-shop"); nextRound(); };
function growBoard(){
  if(S.N>=5) return; const N=5, g=Array.from({length:N},()=>Array(N).fill(null));
  allTiles().forEach(t=>{ g[t.r][t.c]=t; }); S.N=N; S.grid=g; buildCells(); syncTiles();
}

// ---------- consumables ----------
function instantCon(d){return ['clock','polish','grease','hotwire','read_head','service_pass','credit_chip','scrap_cache'].includes(d.id);}
function conNeighbors(t){return allTiles().filter(other=>Math.abs(other.r-t.r)+Math.abs(other.c-t.c)===1);}
function conEmptyCorners(){return emptyCells().filter(([r,c])=>(r===0||r===S.N-1)&&(c===0||c===S.N-1));}
function conTileReason(d,t,picks=[]){
  if(['patch_cable','echo_chip','skip_trace','line_driver','plasma_cutter','heat_sink'].includes(d.id)&&isFixed(t))return 'That tile is locked in place';
  if(d.id==='patch_cable'){
    if(!picks.length&&!t.enh)return 'Choose an enhanced tile first';
    if(picks.length&&(t.enh||t.rock||t.id===picks[0].id))return 'Choose a different, plain tile';
  }
  if(d.id==='echo_chip'){
    if(!t.enh)return 'Choose an enhanced tile';
    if(!conNeighbors(t).some(other=>!other.rock&&!other.enh&&!isFixed(other)))return 'Needs a plain tile touching it';
  }
  if(d.id==='skip_trace'&&!conEmptyCorners().length)return 'Needs an empty corner';
  if(d.id==='line_driver'&&S.grid[t.r].some(other=>other&&isFixed(other)))return 'A frozen tile or wall blocks this row';
  if(d.id==='heat_sink'&&(!t.enh||t.v>32))return 'Choose an enhanced tile of 32 or less';
  return '';
}
function deckDef(d){
  const kinds={promote:'promote',twin:'clone',burn:'remove',temper:'random',recast_item:'replace',split_item:'split',eraser:'remove',halve:'halve',double:'promote'};
  const kind=d.stamp?'stamp':kinds[d.id];
  return kind?{...d,kind,count:kind==='replace'?2:1}:null;
}
function permanentItem(d){return !!(d.deck||d.stamp);}
function permanentTileReason(d,t,picks=[]){
  const card=linkedCard(t);
  if(!card)return 'Choose a linked draw. Merged, copied or temporarily changed tiles cannot edit the deck';
  if(isFixed(t))return 'That tile is locked in place';
  if(d.stamp&&card.enh===d.stamp)return 'This deck tile already has '+ENH[d.stamp].name;
  if(d.id==='burn'&&S.deck.length<=DECK_MIN)return 'Keep at least 12 deck tiles';
  if(d.id==='twin'||d.id==='split_item'){
    if(S.deck.length>=DECK_CAP)return 'Your deck is full';
    if(!emptyCells().length)return 'Needs an empty board cell';
    if(d.id==='split_item'&&card.v<4)return 'Choose a linked tile of 4 or more';
  }
  if(d.id==='recast_item'&&picks.length){
    const from=linkedCard(picks[0]);
    if(!from||from.cid===card.cid)return 'Choose a different linked deck tile';
    if(from.v===card.v&&(from.enh||null)===(card.enh||null))return 'These deck tiles already match';
  }
  return '';
}
function permanentItemReason(d){
  const tiles=allTiles().filter(t=>!permanentTileReason(d,t));
  if(!tiles.length){
    if((d.id==='twin'||d.id==='split_item')&&S.deck.length>=DECK_CAP)return 'Deck full · 22 tiles';
    if((d.id==='twin'||d.id==='split_item')&&!emptyCells().length)return 'Needs an empty board cell';
    if(d.id==='burn'&&S.deck.length<=DECK_MIN)return 'Minimum deck size · 12 tiles';
    return 'No eligible linked draws on the board';
  }
  if(d.id==='recast_item'&&!tiles.some(a=>tiles.some(b=>!permanentTileReason(d,b,[a]))))return 'Needs two different linked deck tiles';
  return '';
}
function applyPermanentBoardItem(d,picks){
  const [tile,other]=picks,card=linkedCard(tile),before=deckSummary();
  if(!card||permanentTileReason(d,tile)||other&&permanentTileReason(d,other,[tile]))return false;
  let detail='';
  if(d.stamp){updateDeckCard(card,{enh:d.stamp});detail='Added '+ENH[d.stamp].name;}
  else if(d.id==='promote'){updateDeckCard(card,{v:card.v*2});markMadeValue(tile.v);detail='Doubled to '+card.v;}
  else if(d.id==='temper'){
    const keys=Object.keys(ENH).filter(e=>e!==card.enh),enh=keys[Math.floor(S.rng()*keys.length)];updateDeckCard(card,{enh});detail='Added '+ENH[enh].name;
  }
  else if(d.id==='burn'){removeDeckCard(card);S.grid[tile.r][tile.c]=null;detail='Removed one deck tile';}
  else if(d.id==='recast_item'){const receiver=linkedCard(other);updateDeckCard(receiver,{v:card.v,enh:card.enh});detail='Copied the linked deck tile';}
  else if(d.id==='twin'||d.id==='split_item'){
    if(d.id==='split_item')updateDeckCard(card,{v:card.v/2});
    const copy=newDeckCard(card.v,card.enh);S.deck.push(copy);
    S.pile.splice(Math.floor(S.rng()*(S.pile.length+1)),0,{...copy});
    const cells=emptyCells(),[r,c]=cells[Math.floor(S.rng()*cells.length)];
    S.grid[r][c]={id:++tileId,v:copy.v,enh:copy.enh,r,c,sourceId:copy.cid};
    detail=d.id==='twin'?'Added an exact deck copy':'Split one deck tile into two';
  }else return false;
  recordDeckEdit('board:'+d.id,before,deckSummary());
  log('<b>'+d.name+'</b>: '+detail+'. Permanent deck edit.');
  $('announcer').textContent=detail+'. Your deck and its linked draws have changed.';
  return true;
}
function boardTargets(d){return d.deck||d.stamp?(d.id==='recast_item'?2:1):d.targets;}
function conReason(d,place,held=true){
  if(d.id==='read_head'&&S.pile.length<2)return 'Needs at least two upcoming draws';
  if(d.id==='service_pass'&&(S.rerollTickets||0)>2)return 'Room for two tickets needed · max 4';
  if(d.id==='credit_chip'&&(S.creditChipsUsed||0)>=3)return 'All three chips redeemed';
  if(d.id==='scrap_cache'&&S.maxCons-S.cons.length<(held?1:2))return held?'Needs one extra empty item slot':'Needs two empty item slots';
  if(d.id==='polish'&&S.polish>=3)return 'Polish is already ready';
  if(d.id==='grease'&&S.grease>=4)return 'Grease is already ready';
  if(d.id==='hotwire'&&!S.fixtures.length)return 'Install a fixture first';
  if(d.id==='hotwire'&&S.hotwire>=3)return 'Hot Wire is already ready';
  if(d.id==='wrench')return S.fixtures.length?'':'Install a fixture first';
  if(d.id==='stack')return place==='pack'?'Use before opening a pack':S.pile.length>1?'':'Needs at least two upcoming draws';
  if(place==='shop')return instantCon(d)?'':deckDef(d)?'Use on the board or in a Blueprint / Blacksite pack':'Use on the board';
  if(place==='pack'){
    if(!S.pendingJobPack)return 'Open a Blueprint or Blacksite pack first';
    if(instantCon(d))return '';
    const def=deckDef(d);return def?editReason(def,packHand()):'Board only';
  }
  if(S.phase!=='round')return 'Use during a round';
  if(permanentItem(d))return permanentItemReason(d);
  if(['patch_cable','echo_chip','skip_trace','line_driver','plasma_cutter','heat_sink'].includes(d.id)){
    const tiles=allTiles().filter(t=>!t.rock&&!isFixed(t));
    if(d.id==='patch_cable'&&!tiles.some(t=>!t.enh))return 'Needs a plain tile to receive the finish';
    if(!tiles.some(t=>!conTileReason(d,t)))return d.id==='skip_trace'?'Needs an empty corner':d.id==='heat_sink'?'Needs an enhanced tile of 32 or less':d.id==='echo_chip'?'Needs an enhanced tile beside a plain one':d.id==='patch_cable'?'Needs an enhanced tile':'No eligible tiles';
  }
  if((d.id==='twin'||d.id==='split_item')&&!emptyCells().length)return 'Needs an empty cell';
  if(d.id==='undo'&&!undoSnap)return 'No move to undo';
  return '';
}
function conDescription(d,place){
  if(d.stamp)return 'Permanent: give one '+(place==='pack'?'dealt deck tile':'linked draw')+' '+ENH[d.stamp].name+'. '+ENH[d.stamp].desc;
  if(d.deck)return 'Permanent deck edit. '+d.desc.replace('Needs a free slot.',place==='pack'?'Needs a free deck slot.':'Needs a free deck slot and board cell.')+' '+(place==='pack'?'Choose from this hand.':'Choose an unmerged draw marked ↗.');
  if(d.id==='clock'&&S.clockBonus)return d.desc.replace('+6','+'+(6+S.clockBonus));
  if(d.id==='credit_chip')return d.desc+' '+Math.max(0,3-(S.creditChipsUsed||0))+' redemptions left.';
  if(d.id==='service_pass')return d.desc+' '+(S.rerollTickets||0)+' held.';
  return d.desc.replace('Needs a free slot.','Needs a free '+(place==='pack'?'deck slot.':'cell.'));
}
function renderItemRack(container,place){
  container.innerHTML='';
  if(!S.cons.length){container.innerHTML='<div class="empty">No items held.</div>';return;}
  S.cons.forEach((d,i)=>{
    const reason=conReason(d,place),button=document.createElement('button');button.className='card use';button.disabled=!!reason;
    button.innerHTML='<div class="ico">'+d.ico+'</div><div><div class="t">'+d.name+'</div><div class="d">'+conDescription(d,place)+'</div><small class="item-action">'+(reason|| (place==='pack'&&deckDef(d)?'Use on this hand':'Use now'))+'</small></div>';
    button.onclick=()=>useCon(i,place);container.appendChild(button);
  });
}
function useCon(i,place='board'){
  if(locked||deckJob||boardJob||isModJobOpen()) return;
  const d=S.cons[i];if(!d)return;
  const reason=conReason(d,place);if(reason){hint(reason,true);return;}
  if(d.id==='wrench'||d.id==='stack'){if(target)cancelTarget();beginBoardJob({kind:d.id==='wrench'?'move':'stack',idx:i,source:'item'});return;}
  if(place==='pack'&&deckDef(d)){openDeckPick(i,d);return;}
  if(target){ cancelTarget(); return; }
  const targets=boardTargets(d);
  if(targets>0){
    target={idx:i,def:{...d,targets},picks:[]};$("board").classList.add("targeting");renderCons();syncTiles();
    hint(permanentItem(d)?(d.id==='recast_item'?'Permanent: choose a linked template, then a linked tile to replace.':'Permanent: choose a marked ↗ tile. Your deck changes too.')+ ' Esc to cancel.':d.id==='patch_cable'?'Pick the enhanced tile, then a plain tile. Esc to cancel.':d.id==='line_driver'?'Pick a tile in the row to shift right. Esc to cancel.':d.id==='recast_item'?'Pick the tile to copy, then the tile to replace. Esc to cancel.':targets===2?'Pick two tiles to swap. Esc to cancel.':'Pick a tile. Esc to cancel.',true);return;
  }
  let ok=true;
  if(d.id==="shuffle"){ shuffleBoard(); }
  else if(d.id==="purge"){ let k=0; allTiles().forEach(t=>{ if(t.v<=4 && t.id!==S.frozen){S.grid[t.r][t.c]=null;k++;} }); if(!k){ hint("Nothing to purge.",true); ok=false; } }
  else if(d.id==="undo"){ if(!undoSnap){ hint("Nothing to undo.",true); ok=false; } else { restore(undoSnap); undoSnap=null; } }
  else if(d.id==="jack"){ let k=0; allTiles().forEach(t=>{ if(t.rock&&!t.fixed){ S.grid[t.r][t.c]=null; k++; } }); if(!k){ hint("No rubble to clear.",true); ok=false; } }
  else if(d.id==="clock"){
    const moves=6+(S.clockBonus||0);
    if(S.phase==='shop')S.nextMoves=(S.nextMoves||0)+moves;
    else {S.moves+=moves;curRound().movesAllowed+=moves;}
  }
  else if(d.id==="polish"){ S.polish=3; }
  else if(d.id==='grease'){S.grease=4;}
  else if(d.id==='hotwire'){S.hotwire=3;}
  else if(d.id==='read_head'){S.pile.unshift(...S.pile.splice(0,3).reverse());}
  else if(d.id==='service_pass'){S.rerollTickets=(S.rerollTickets||0)+2;}
  else if(d.id==='credit_chip'){S.money+=5;S.creditChipsUsed=(S.creditChipsUsed||0)+1;}
  else if(d.id==='scrap_cache'){
    const pool=CONS.filter(c=>['eraser','halve','swap','shuffle','jack'].includes(c.id));
    for(let n=0;n<2;n++){const at=Math.floor(S.rng()*pool.length);S.cons.push({...pool.splice(at,1)[0]});}
  }
  if(!ok) return;
  finishCon(i);
}
function pickTile(t){
  if(!target) return;
  if(permanentItem(target.def)){
    const reason=permanentTileReason(target.def,t,target.picks);if(reason){hint(reason+'.',true);return;}
    target.picks.push(t);
    if(target.picks.length<target.def.targets){syncTiles();return;}
    const idx=target.idx;if(applyPermanentBoardItem(target.def,target.picks)){cancelTarget();finishCon(idx);}return;
  }
  if(t.rock&&!['eraser','plasma_cutter'].includes(target.def.id)){ hint("Rubble needs a clearing tool.",true); return; }
  if(t.id===S.frozen){ hint("That tile is frozen.",true); return; }
  const reason=conTileReason(target.def,t,target.picks);if(reason){hint(reason+'.',true);return;}
  if(target.def.id==='split_item'&&t.v<4){hint('Choose a tile of 4 or more.',true);return;}
  target.picks.push(t);
  if(target.picks.length<target.def.targets){ syncTiles(); return; }
  const d=target.def, [a,b]=target.picks;
  if(d.file){ retireTile(a); }
  else if(d.stamp){ a.enh=d.stamp; const e=els.get(a.id); if(e){ e.classList.remove("zap"); void e.offsetWidth; e.classList.add("zap"); } }
  else if(d.id==="eraser"||d.id==='burn'){ S.grid[a.r][a.c]=null; }
  else if(d.id==="halve"){ if(a.v===2) S.grid[a.r][a.c]=null; else a.v/=2; }
  else if(d.id==="double"||d.id==='promote'){ a.v*=2; markMadeValue(a.v); }
  else if(d.id==='temper'){const keys=Object.keys(ENH);a.enh=keys[Math.floor(S.rng()*keys.length)];}
  else if(d.id==='patch_cable'){b.enh=a.enh;a.enh=null;}
  else if(d.id==='echo_chip'){
    conNeighbors(a).filter(t=>!t.rock&&!t.enh&&!isFixed(t)).slice(0,2).forEach(t=>{t.enh=a.enh;});
  }
  else if(d.id==='skip_trace'){
    const [r,c]=conEmptyCorners().sort((x,y)=>(Math.abs(x[0]-a.r)+Math.abs(x[1]-a.c))-(Math.abs(y[0]-a.r)+Math.abs(y[1]-a.c)))[0];
    S.grid[a.r][a.c]=null;a.r=r;a.c=c;S.grid[r][c]=a;
  }
  else if(d.id==='line_driver'){
    const row=S.grid[a.r];row.unshift(row.pop());row.forEach((t,c)=>{if(t)t.c=c;});
  }
  else if(d.id==='plasma_cutter'){
    conNeighbors(a).filter(t=>t.rock&&!isFixed(t)).forEach(t=>{S.grid[t.r][t.c]=null;});S.grid[a.r][a.c]=null;
  }
  else if(d.id==='heat_sink'){a.v*=2;a.enh=null;markMadeValue(a.v);}
  else if(d.id==='twin'||d.id==='split_item'){
    const cells=emptyCells();if(!cells.length){hint('Needs an empty cell.',true);target.picks=[];return;}
    if(d.id==='split_item')a.v/=2;
    const [r,c]=cells[Math.floor(S.rng()*cells.length)];S.grid[r][c]={id:++tileId,v:a.v,enh:a.enh,r,c};
  }
  else if(d.id==='recast_item'){
    if(a.id===b.id){target.picks=[a];hint('Pick a different tile to replace.',true);return;}
    b.v=a.v;b.enh=a.enh;
  }
  else if(d.id==="swap"){ if(a.id===b.id){ target.picks=[a]; hint("Pick a different second tile.",true); return; } S.grid[a.r][a.c]=b; S.grid[b.r][b.c]=a; const r=a.r,c=a.c; a.r=b.r;a.c=b.c;b.r=r;b.c=c; }
  const idx=target.idx; cancelTarget(); finishCon(idx);
}
function finishCon(i){
  const d=S.cons[i]; S.cons.splice(i,1); S.consUsed++;
  if(S.phase==='shop')curShop().bought.push('used:'+d.id);else curRound().moves.push({con:d.id});
  log("Used <b>"+d.name+"</b>."); audio.effect("upgrade"); hint("");
  S.charms.forEach(c=>{ if(c.onUseCon) c.onUseCon(c); });
  undoSnap=null;
  if(S.phase==='round'){ensureTiles();syncTiles();render();if(!canMove())afterMove({total:0,steps:[]});}
  else {renderShop();if(S.pendingJobPack)renderJobPack();}
  saveT();
}
// ---------- permanent deck work ----------
// Pack contents are used immediately; a Deluxe pack has two separate picks.
const WORKSHOP=[
 {id:'mod_heat_trace',kind:'mod',action:'chips',name:'Heat Trace',ico:'+20',count:1,cost:3,desc:'Pay $3 to solder +20 chips onto one mod. Triggers each scoring move. Maximum +40 chips from regular tuning.'},
 {id:'mod_gain_stage',kind:'mod',action:'mult',name:'Gain Stage',ico:'+2',count:1,cost:4,desc:'Pay $4 to tune one mod for +2 mult each scoring move. Maximum +4 mult from regular tuning.'},
 {id:'mod_buyout',kind:'mod',action:'sell',name:'Buyout',ico:'$↑',count:1,desc:'Remove one sellable mod. Collect twice its current sell value, plus $3. Its tuning is lost.'},
 {id:'mod_swap_rom',kind:'mod',action:'reroll',name:'Swap ROM',ico:'⇄',count:1,cost:2,desc:'Pay $2 to trade one sellable mod for a random unowned mod of the same rarity. Starts fresh; tuning is lost.'},
 {id:'mod_spare_parts',kind:'mod',action:'grant',name:'Spare Parts',ico:'▣+',count:0,desc:'Receive a random unowned common mod. Needs an empty mod slot.'},
 {id:'mod_transplant',kind:'mod',action:'transfer',name:'Transplant',ico:'⇢',count:2,desc:'Move regular chip and mult tuning from one mod to another. Donor loses that tuning. Receiver caps: +40 chips, +4 mult. Overdrive cannot move.'},
 ...Object.entries(FIXTURES).map(([fixture,d])=>({id:'plan_'+fixture,kind:'fixture',fixture,name:d.name+' Plans',ico:d.ico,count:0,desc:'Install a '+d.name+' on one board cell for the run. '+d.desc})),
 {id:'trim',kind:'remove',name:'Trim',ico:'−',price:3,count:2,desc:'Remove up to 2 tiles. Keep at least 12 in your deck.'},
 {id:'recast',kind:'replace',name:'Recast',ico:'⇒',price:5,count:2,desc:'Choose a template, then turn another tile into an exact copy.'},
 {id:'duplicate',kind:'clone',name:'Duplicate',ico:'Ⅱ',price:5,count:1,desc:'Add a copy of a tile, including its enhancement. Needs a free deck slot.'},
 ...Object.entries(ENH).map(([stamp,enh])=>({id:'blueprint_'+stamp,kind:'stamp',name:enh.name+' Blueprint',ico:enh.ico,count:1,stamp,desc:'Give one deck tile '+enh.name+'. '+enh.desc})),
 {id:'dividend',kind:'dividend',name:'Dividend',ico:'$+',count:0,desc:'Gain $1 for every $2 you hold after buying this pack, up to $12.'},
 {id:'parcel',kind:'parcel',name:'Supply Parcel',ico:'▧',count:0,desc:'Receive two different board tools. Needs two empty item slots.'},
 {id:'pocket',kind:'pocket',name:'Side Pocket',ico:'⊔',count:0,desc:'Carry one extra item for the rest of this run. Maximum 5 slots.'},
 {id:'tickets',kind:'tickets',name:'Ticket Roll',ico:'↻',count:0,desc:'Your next two shop rerolls are free. Tickets carry between shops; hold at most 4.'},
 {id:'bp_splice',kind:'splice',name:'Splice',ico:'⇢',count:2,labels:['Donor','Receiver'],steps:['Choose the enhanced donor.','Choose the tile receiving its finish.'],desc:'Move a finish from one tile to another. The donor becomes plain; both values stay the same.',
  checkHand:cards=>cards.some(a=>a.enh&&cards.some(b=>a!==b&&a.enh!==b.enh))?'':'Needs a finish that can be transferred',
  checkPick:cards=>!cards[0].enh?'The donor needs a finish':cards[0].enh===cards[1].enh?'Choose a receiver with a different finish':'',
  review:(cards,name)=>name(cards[0])+' becomes plain '+cards[0].v+'. '+name(cards[1])+' becomes '+ENH[cards[0].enh].name+' '+cards[1].v+'.',
  run:cards=>{cards[1].enh=cards[0].enh;cards[0].enh=null;}},
 {id:'bp_crosswire',kind:'crosswire',name:'Crosswire',ico:'⇄',count:2,desc:'Swap the finishes on two tiles. Plain counts as a finish. Their values stay the same.',
  checkHand:cards=>cards.some(a=>cards.some(b=>a.enh!==b.enh))?'':'Needs two different finishes in this hand',
  checkPick:cards=>cards[0].enh===cards[1].enh?'Choose two different finishes':'',
  review:(cards,name)=>name(cards[0])+' → '+name({...cards[0],enh:cards[1].enh})+'. '+name(cards[1])+' → '+name({...cards[1],enh:cards[0].enh})+'.',
  run:cards=>{[cards[0].enh,cards[1].enh]=[cards[1].enh,cards[0].enh];}},
 {id:'bp_downlink',kind:'downlink',name:'Downlink',ico:'↓↓',count:2,desc:'Halve two tiles of 4 or more. Both keep their finishes.',canPick:card=>card.v>=4,
  review:(cards,name)=>cards.map(c=>name(c)+' → '+name({...c,v:c.v/2})).join('. ')+'.',run:cards=>{cards.forEach(c=>{c.v/=2;});}},
 {id:'bp_pairing',kind:'pairing',name:'Pairing',ico:'==',count:2,desc:'Choose two different values. Lower the larger tile to match the smaller. Both keep their finishes.',
  checkHand:cards=>cards.some(a=>cards.some(b=>a.v!==b.v))?'':'Needs two different values in this hand',
  checkPick:cards=>cards[0].v===cards[1].v?'These values already match':'',
  review:(cards,name)=>{const high=cards[0].v>cards[1].v?cards[0]:cards[1],v=Math.min(...cards.map(c=>c.v));return name(high)+' → '+name({...high,v})+'. The smaller tile stays unchanged.';},
  run:cards=>{const v=Math.min(...cards.map(c=>c.v));cards.forEach(c=>{c.v=v;});}},
 {id:'bp_salvage',kind:'salvage',name:'Salvage',ico:'$−',count:2,minCount:1,desc:'Strip the finishes from up to two tiles. Collect $3 per finish. Tile values stay the same.',canPick:card=>!!card.enh,
  review:(cards,name)=>'Strip '+cards.map(name).join(' and ')+'. Collect $'+(cards.length*3)+'. No tiles are removed.',
  run:cards=>{cards.forEach(c=>{c.enh=null;});S.money+=cards.length*3;}},
 {id:'bp_bootstrap',kind:'bootstrap',name:'Bootstrap',ico:'2↑',count:1,desc:'Double one plain 2 or 4. The new tile stays plain; maximum result 8.',canPick:card=>!card.enh&&card.v<=4,
  review:cards=>'Plain '+cards[0].v+' → plain '+(cards[0].v*2)+'.',run:cards=>{cards[0].v*=2;}},
 {id:'bp_multicast',kind:'multicast',name:'Multicast',ico:'Ⅲ',count:1,desc:'Add two plain copies of a tile worth 8 or less. Its finish is not copied. Needs two free deck slots.',canPick:card=>card.v<=8,
  checkHand:()=>S.deck.length>DECK_CAP-2?'Needs two free deck slots':'',
  review:cards=>'Add two plain '+cards[0].v+'s. Original unchanged. Deck: '+S.deck.length+' → '+(S.deck.length+2)+'.',
  run:cards=>{S.deck.push({v:cards[0].v,enh:null},{v:cards[0].v,enh:null});}},
 {id:'bp_reboot',kind:'reboot',name:'Reboot',ico:'02',count:2,desc:'Reset two tiles to plain 2s. Both values and finishes are erased.',canPick:card=>card.v!==2||!!card.enh,
  review:(cards,name)=>cards.map(name).join(' and ')+' → two plain 2s. Deck size stays '+S.deck.length+'.',
  run:cards=>{cards.forEach(c=>Object.assign(c,{v:2,enh:null}));}},
 {id:'bp_service_window',kind:'service_window',name:'Service Window',ico:'+4',count:0,cost:2,desc:'Pay $2 for 4 extra moves next round. Requires at most 8 moves already banked.',
  checkHand:()=>((S.nextMoves||0)>8?'Already more than 8 moves banked':''),
  review:()=> 'Next round bonus: '+(S.nextMoves||0)+' → '+((S.nextMoves||0)+4)+' moves.',run:()=>{S.nextMoves=(S.nextMoves||0)+4;}},
 {id:'bp_bypass_lead',kind:'bypass_lead',name:'Bypass Lead',ico:'▦+',count:0,moveCost:2,desc:'Unlock a fourth fixture slot. Permanently lose 2 moves per round. Four slots maximum.',
  checkHand:()=>S.maxFixtures>=4?'All four fixture slots unlocked':'',
  review:()=> 'Fixture capacity: '+S.maxFixtures+' → 4. Existing fixtures stay in place.',run:()=>{S.maxFixtures=4;}},
];
const EXPERIMENTS=[
 {id:'mod_hot_swap',kind:'mod',action:'promote',name:'Hot Swap',ico:'↑R',count:1,cost:4,desc:'Pay $4 and give up a common or uncommon mod for a random unowned mod of the next rarity. Starts fresh; tuning is lost.'},
 {id:'mod_overdrive',kind:'mod',action:'overdrive',name:'Overdrive',ico:'OD',count:1,moveCost:2,desc:'Replace one mod’s tuning with +60 chips and +6 mult each scoring move. Permanently lose 2 moves per round. Once per mod; twice per run.'},
 {id:'kiln',kind:'kiln',name:'Kiln',ico:'◇',count:2,desc:'Make 2 deck tiles Prism. Permanently lose 2 moves per round. Maximum 3 uses.'},
 {id:'smelt',kind:'smelt',name:'Smelt',ico:'▦',count:2,desc:'Destroy 2 deck tiles. Add one Iron 8. Your deck becomes one tile smaller.'},
 {id:'fracture',kind:'split',name:'Fracture',ico:'½',count:1,desc:'Split a tile into two halves. Both keep its enhancement. Needs a free slot.'},
 {id:'reforge',kind:'reforge',name:'Reforge',ico:'8',count:3,desc:'Turn 3 deck tiles into plain 8s. Their enhancements are removed.'},
 {id:'bs_mirror_rom',kind:'mirror_rom',name:'Mirror ROM',ico:'Ⅲ',count:3,cost:4,labels:['Template','Overwrite','Overwrite'],steps:['Choose a template worth 32 or less.','Choose the first tile to overwrite.','Choose the second tile to overwrite.'],desc:'Pay $4. Copy a tile worth 32 or less onto two other tiles, including its finish. Deck size stays the same.',
  checkHand:cards=>cards.some(c=>c.v<=32)?'':'No template of 32 or less in this hand',
  checkPick:cards=>cards[0].v>32?'Template must be worth 32 or less':cards.slice(1).every(c=>c.v===cards[0].v&&c.enh===cards[0].enh)?'Both tiles already match the template':'',
  review:(cards,name)=>'Overwrite '+cards.slice(1).map(name).join(' and ')+' with '+name(cards[0])+'. The template stays unchanged.',
  run:cards=>{const {v,enh}=cards[0];cards.slice(1).forEach(c=>Object.assign(c,{v,enh}));}},
 {id:'bs_black_ice',kind:'black_ice',name:'Black Ice',ico:'▥',count:3,moveCost:2,maxUses:2,desc:'Give three tiles Iron. Permanently lose 2 moves per round. Twice per run maximum.',canPick:card=>card.enh!=='steel',
  review:(cards,name)=>cards.map(name).join(', ')+' all gain Iron. Values stay the same.',run:cards=>{cards.forEach(c=>{c.enh='steel';});}},
 {id:'bs_glass_cannon',kind:'glass_cannon',name:'Glass Cannon',ico:'◇↑',count:1,moveCost:1,maxUses:3,desc:'Quadruple a tile worth 16 or less and give it Prism. Permanently lose 1 move per round. Three uses per run.',canPick:card=>card.v<=16,
  review:(cards,name)=>name(cards[0])+' → Prism '+(cards[0].v*4)+'. Its previous finish is lost.',run:cards=>{cards[0].v*=4;cards[0].enh='glass';}},
 {id:'bs_counterfeit',kind:'counterfeit',name:'Counterfeit',ico:'$$',count:2,cost:5,desc:'Pay $5 to give two tiles Brass. Their values stay the same.',canPick:card=>card.enh!=='gold',
  review:(cards,name)=>cards.map(name).join(' and ')+' both gain Brass. Previous finishes are lost.',run:cards=>{cards.forEach(c=>{c.enh='gold';});}},
 {id:'bs_loaded_dice',kind:'loaded_dice',name:'Loaded Dice',ico:'★★',count:3,cost:4,desc:'Pay $4 to give three tiles Odds. Their values stay the same.',canPick:card=>card.enh!=='lucky',
  review:(cards,name)=>cards.map(name).join(', ')+' all gain Odds. Previous finishes are lost.',run:cards=>{cards.forEach(c=>{c.enh='lucky';});}},
 {id:'bs_memory_hole',kind:'memory_hole',name:'Memory Hole',ico:'∅',count:3,cost:3,desc:'Pay $3 to destroy three tiles. Keep at least 12 in the deck.',
  checkHand:()=>S.deck.length<DECK_MIN+3?'Needs at least 15 deck tiles':'',
  review:(cards,name)=>'Destroy '+cards.map(name).join(', ')+'. Deck: '+S.deck.length+' → '+(S.deck.length-3)+'.',
  run:cards=>{cards.forEach(c=>S.deck.splice(S.deck.indexOf(c),1));}},
 {id:'bs_mass_driver',kind:'mass_driver',name:'Mass Driver',ico:'2→1',count:2,cost:2,desc:'Pay $2. Fuse two equal tiles worth 32 or less into one plain tile of twice the value. Keep at least 12 deck tiles.',canPick:card=>card.v<=32,
  checkHand:cards=>S.deck.length<=DECK_MIN?'Needs at least 13 deck tiles':cards.some(a=>a.v<=32&&cards.some(b=>a!==b&&a.v===b.v))?'':'Needs a matching pair of 32 or less',
  checkPick:cards=>cards[0].v===cards[1].v?'':'Choose two equal values',
  review:(cards,name)=>name(cards[0])+' + '+name(cards[1])+' → plain '+(cards[0].v*2)+'. Deck: '+S.deck.length+' → '+(S.deck.length-1)+'. Both finishes are lost.',
  run:cards=>{cards[0].v*=2;cards[0].enh=null;S.deck.splice(S.deck.indexOf(cards[1]),1);}},
 {id:'bs_ghost_image',kind:'ghost_image',name:'Ghost Image',ico:'Ⅲ◇',count:1,cost:4,desc:'Pay $4. Add two exact copies of a tile worth 16 or less, including its finish. Needs two free deck slots.',canPick:card=>card.v<=16,
  checkHand:()=>S.deck.length>DECK_CAP-2?'Needs two free deck slots':'',
  review:(cards,name)=>'Add two '+name(cards[0])+' tiles. Original unchanged. Deck: '+S.deck.length+' → '+(S.deck.length+2)+'.',
  run:cards=>{const {v,enh}=cards[0];S.deck.push({v,enh},{v,enh});}},
 {id:'bs_dead_drop',kind:'dead_drop',name:'Dead Drop',ico:'Ⅵ−',count:1,cost:5,desc:'Pay $5 and destroy one enhanced tile to unlock a sixth mod slot. Keep at least 12 tiles. Six slots maximum.',canPick:card=>!!card.enh,
  checkHand:()=>S.maxCharms>=6?'All six mod slots unlocked':S.deck.length<=DECK_MIN?'Needs at least 13 deck tiles':'',
  review:(cards,name)=>'Destroy '+name(cards[0])+'. Mod slots: '+S.maxCharms+' → 6. Deck: '+S.deck.length+' → '+(S.deck.length-1)+'.',
  run:cards=>{S.deck.splice(S.deck.indexOf(cards[0]),1);S.maxCharms=6;}},
 {id:'bs_neon_bloom',kind:'neon_bloom',name:'Neon Bloom',ico:'+×',count:2,cost:3,labels:['Kick','Plus'],desc:'Pay $3. Give Kick and Plus to two equal plain tiles worth 16 or less. Their values stay the same.',canPick:card=>!card.enh&&card.v<=16,
  checkHand:cards=>cards.some(a=>!a.enh&&a.v<=16&&cards.some(b=>a!==b&&!b.enh&&a.v===b.v))?'':'Needs two equal plain tiles of 16 or less',
  checkPick:cards=>cards[0].v===cards[1].v?'':'Choose two equal values',
  review:cards=>'Plain '+cards[0].v+' + plain '+cards[1].v+' → Kick '+cards[0].v+' + Plus '+cards[1].v+'. Merge them on the board to trigger Overprint.',
  run:cards=>{cards[0].enh='bonus';cards[1].enh='mult';}},
];
// Mod blueprints tune owned hardware; their pack pick is spent only on Apply.
let modJob=null;
function resetModJob(){modJob=null;}
function isModJobOpen(){return !!modJob;}
function modPool(rarity){return CHARMS.filter(c=>c.rar===rarity&&!c.nosell&&!S.charms.some(owned=>owned.id===c.id));}
function modPickReason(d,c,picks=[]){
  const tuning=c.firmware||{};
  if(d.action==='chips'&&(tuning.chips||0)>=40)return 'Chip tuning is at its limit';
  if(d.action==='mult'&&(tuning.mult||0)>=4)return 'Mult tuning is at its limit';
  if(['sell','reroll','promote'].includes(d.action)&&c.nosell)return 'This mod cannot be removed';
  if(d.action==='reroll'&&!modPool(c.rar).length)return 'No unowned mods of this rarity';
  if(d.action==='promote'&&(c.rar==='r'||!modPool(c.rar==='c'?'u':'r').length))return 'Needs a common or uncommon mod with an available upgrade';
  if(d.action==='overdrive'&&c.overdriven)return 'Already overdriven';
  if(d.action==='transfer'){
    if(!picks.length&&(!(tuning.chips||tuning.mult)||c.overdriven))return 'Choose a mod with regular tuning';
    if(picks.length){
      if(c===picks[0])return 'Choose a different receiver';
      const from=picks[0].firmware||{};
      if(c.overdriven||(tuning.chips||0)+(from.chips||0)>40||(tuning.mult||0)+(from.mult||0)>4)return 'Receiver would exceed its tuning limit';
    }
  }
  return '';
}
function modJobReason(d){
  if(d.cost&&S.money-d.cost<moneyFloor())return 'Needs an extra $'+d.cost;
  if(d.moveCost&&S.bonusMoves-d.moveCost< -8)return 'Permanent move penalty would exceed 8';
  if(d.action==='overdrive'&&(S.overdriveUses||0)>=2)return 'Both Overdrives used';
  if(d.action==='grant')return S.charms.length>=S.maxCharms?'No free mod slot':!modPool('c').length?'All common mods already owned':'';
  const choices=S.charms.filter(c=>!modPickReason(d,c));
  if(!choices.length)return 'No eligible mods owned';
  if(d.action==='transfer'&&!choices.some(a=>S.charms.some(b=>!modPickReason(d,b,[a]))))return 'Needs a tuned donor and a receiver with room';
  return '';
}
function ensureModWorkshop(){
  if($('ov-modwork'))return;
  const ov=document.createElement('div');ov.id='ov-modwork';ov.className='ov over';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','modworktitle');
  ov.innerHTML='<div class="modal mod-workshop"><span class="eyebrow">MOD WORKSHOP</span><h2 id="modworktitle"></h2><p id="modworkdesc"></p><div id="modworkgrid" class="modwork-grid"></div><p class="edit-preview" id="modworkpreview" aria-live="polite"></p><div class="btnrow"><button class="btn ghost" id="btnmodcancel">Back</button><button class="btn" id="btnmodapply">Apply</button></div></div>';
  document.body.appendChild(ov);$('btnmodcancel').onclick=cancelModJob;$('btnmodapply').onclick=applyModJob;
}
function beginModJob(def){
  if(modJob||deckJob||boardJob||!S.pendingJobPack||!S.pendingJobPack.options.includes(def)||S.pendingJobPack.taken.includes(def.id))return;
  const reason=modJobReason(def);if(reason){hint(reason,true);return;}
  ensureModWorkshop();modJob={def,picks:[],pending:S.pendingJobPack};renderModJob();show('ov-modwork');
}
function cancelModJob(){modJob=null;hide('ov-modwork');if(S.pendingJobPack)renderJobPack();}
function renderModJob(){
  const {def:d,picks}=modJob;$('modworktitle').textContent=d.name;$('modworkdesc').textContent=d.desc;
  const grid=$('modworkgrid');grid.innerHTML='';
  if(d.count)S.charms.forEach(c=>{
    const chosen=picks.indexOf(c),reason=modPickReason(d,c,picks),b=document.createElement('button');b.className='card modwork-card'+(chosen>=0?' selected':'');b.disabled=chosen<0&&!!reason;b.setAttribute('aria-pressed',String(chosen>=0));
    b.innerHTML='<div class="ico">'+c.ico+'</div><div class="t">'+c.name+'</div><div class="d">'+descOf(c)+'</div><small>'+(chosen>=0?(d.action==='transfer'?(chosen===0?'Donor':'Receiver'):'Selected'):reason||({c:'Common',u:'Uncommon',r:'Rare'})[c.rar])+'</small>';
    b.onclick=()=>{if(chosen>=0)picks.splice(chosen,1);else if(picks.length<d.count)picks.push(c);else if(d.count===1)picks[0]=c;renderModJob();};grid.appendChild(b);
  });
  const ready=picks.length===d.count,valid=ready&&!modJobReason(d)&&picks.every((c,i)=>S.charms.includes(c)&&!modPickReason(d,c,picks.slice(0,i)));
  let preview=d.action==='grant'?'Receive one random common mod.':!ready?(d.action==='transfer'?(picks.length?'Choose the receiver.':'Choose the tuned donor.'):'Choose a mod above.'):'Apply to '+picks.map(c=>c.name).join(' → ')+'.';
  if(valid&&d.action==='sell')preview='Remove '+picks[0].name+' and collect $'+(picks[0].sell*2+3)+'.';
  if(d.cost)preview+=' Extra cost: $'+d.cost+'.';if(d.moveCost)preview+=' Lose '+d.moveCost+' moves in every future round.';
  $('modworkpreview').textContent=preview;$('btnmodapply').disabled=!valid;$('btnmodapply').textContent=d.cost?'Apply · $'+d.cost:'Apply';
}
function applyModJob(){
  const job=modJob;if(!job||$('btnmodapply').disabled||S.pendingJobPack!==job.pending)return;
  const {def:d,picks}=job;if(modJobReason(d)||picks.length!==d.count||picks.some((c,i)=>!S.charms.includes(c)||modPickReason(d,c,picks.slice(0,i))))return;
  const c=picks[0];let result='';
  if(d.action==='chips'||d.action==='mult'){c.firmware||={chips:0,mult:0};c.firmware[d.action]=(c.firmware[d.action]||0)+(d.action==='chips'?20:2);result='Tuned '+c.name;}
  else if(d.action==='sell'){const amount=c.sell*2+3;S.money+=amount;S.charms.splice(S.charms.indexOf(c),1);S.charms.forEach(other=>{if(other.onSell)other.onSell(other);});result='Sold '+c.name+' for $'+amount;}
  else if(d.action==='reroll'||d.action==='promote'||d.action==='grant'){
    const rarity=d.action==='grant'?'c':d.action==='promote'?(c.rar==='c'?'u':'r'):c.rar,pool=modPool(rarity),newMod=makeCharm(pool[Math.floor(S.rng()*pool.length)]);
    if(c)S.charms.splice(S.charms.indexOf(c),1,newMod);else S.charms.push(newMod);result='Installed '+newMod.name;
  }
  else if(d.action==='transfer'){const to=picks[1];to.firmware||={chips:0,mult:0};to.firmware.chips=(to.firmware.chips||0)+(c.firmware.chips||0);to.firmware.mult=(to.firmware.mult||0)+(c.firmware.mult||0);c.firmware={chips:0,mult:0};result='Moved tuning to '+to.name;}
  else if(d.action==='overdrive'){c.firmware={chips:60,mult:6};c.overdriven=true;S.overdriveUses=(S.overdriveUses||0)+1;result='Overdriven '+c.name;}
  S.money-=d.cost||0;S.bonusMoves-=d.moveCost||0;S.consUsed++;S.charms.forEach(c=>{if(c.onUseCon)c.onUseCon(c);});
  job.pending.taken.push(d.id);job.pending.remaining--;if(!job.pending.remaining)S.pendingJobPack=null;
  (T.modEdits||=[]).push({kind:d.id,mods:picks.map(c=>c.id),result,ante:S.ante,blind:S.blind});curShop().bought.push('mod-blueprint:'+d.id);
  log('<b>'+d.name+'</b>: '+result+'.');modJob=null;undoSnap=null;hide('ov-modwork');audio.effect('upgrade');
  renderShop();if(S.pendingJobPack)renderJobPack();else hide('ov-pack');saveT();
}

let deckJob=null;
const EDIT_HAND_SIZE=8;
function dealEditHand(){
  const hand=S.deck.slice();
  for(let i=hand.length-1;i>0;i--){const j=Math.floor(S.rng()*(i+1));[hand[i],hand[j]]=[hand[j],hand[i]];}
  return hand.slice(0,EDIT_HAND_SIZE);
}
function packHand(){return (S.pendingJobPack?.hand||[]).filter(card=>S.deck.includes(card));}
function recordDeckEdit(kind,before,after){
  ensureDeckIds();
  S.deckEdits=(S.deckEdits||0)+1;
  const entry={kind,before,after,ante:S.ante,blind:BLINDS[S.blind].name};
  (T.deckEdits||=[]).push(entry);
  activeCharms().forEach(c=>{if(c.onDeckEdit)c.onDeckEdit(c,entry);});
}
function editReason(d,hand=null){
  if(d.kind==='mod')return modJobReason(d);
  if(d.kind==='fixture')return installReason(d.fixture);
  if(d.cost&&S.money-d.cost<moneyFloor())return 'Needs $'+d.cost+' in addition to the pack';
  if(d.maxUses&&(S.packUses?.[d.id]||0)>=d.maxUses)return d.name+' limit reached';
  if(d.moveCost&&S.bonusMoves-d.moveCost< -8)return 'Cannot reduce the permanent move bonus below −8';
  if(d.kind==='dividend'&&S.money<2)return 'Needs cash on hand';
  if(d.kind==='parcel'&&S.maxCons-S.cons.length<2)return 'Needs two empty item slots';
  if(d.kind==='pocket'&&S.maxCons>=5)return 'All five item slots unlocked';
  if(d.kind==='tickets'&&(S.rerollTickets||0)>2)return 'Room for two tickets needed · max 4';
  if((d.kind==='clone'||d.kind==='split')&&S.deck.length>=DECK_CAP) return 'Deck full · trim first';
  if(d.kind==='remove'&&S.deck.length<=DECK_MIN) return 'Minimum deck size';
  if(d.kind==='smelt'&&S.deck.length<=DECK_MIN) return 'Needs at least 13 tiles';
  if(d.kind==='kiln'&&(S.kilnUses||0)>=3) return 'Kiln limit reached';
  if(d.kind==='kiln'&&S.bonusMoves-2< -8)return 'Cannot reduce the permanent move bonus below −8';
  const cards=hand||S.deck;
  if(d.checkHand){const reason=d.checkHand(cards);if(reason)return reason;}
  if(d.canPick&&cards.filter(d.canPick).length<(d.minCount||d.count||1))return 'Not enough eligible tiles in this hand';
  if(d.kind==='split'&&!cards.some(c=>c.v>=4)) return 'No tile of 4 or more in this hand';
  if(d.kind==='stamp'&&d.stamp&&!cards.some(c=>c.enh!==d.stamp))return 'Every tile already has '+ENH[d.stamp].name;
  if(d.kind==='halve'&&!cards.some(c=>c.v>2||S.deck.length>DECK_MIN))return 'Cannot remove a tile at minimum deck size';
  if(d.count!==0&&cards.length<(d.kind==='remove'?1:d.minCount||d.count||1))return 'Not enough tiles left in this hand';
  return '';
}
function openJobPack(pack){
  if(!canOpenPack(pack))return;
  const pool=(pack.kind==='workshop'?WORKSHOP:EXPERIMENTS).slice();
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(S.rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const price=packPrice(pack);
  S.money-=price;pack.sold=true;
  S.pendingJobPack={pack,kind:pack.kind,price,options:pool.slice(0,packCardCount(pack)),remaining:PACK_SIZES[pack.size].picks,taken:[],hand:dealEditHand()};
  curShop().bought.push('pack:'+pack.kind+':'+pack.size);audio.effect('pack');
  renderShop();renderJobPack();juice?.pack($('packgrid'),packName(pack).toUpperCase());saveT();
}
function renderJobPack(){
  const pending=S.pendingJobPack,{pack,kind,options,taken,remaining}=pending;
  const source=kind==='workshop'?'workshop-pack':'backroom-pack';
  $('packtitle').textContent=packName(pack);
  $('packnote').textContent='Choose '+remaining+' more. Some cards have an extra cost. No refunds.';
  const g=$('packgrid');g.innerHTML='';g.classList.toggle('expanded',options.length>3);
  options.forEach(d=>{
    const used=taken.includes(d.id),reason=editReason(d,packHand()),el=document.createElement('button');el.className='opt job-opt'+(used?' taken':'');
    const desc=d.kind==='fixture'?'Install on one cell for the run. '+fixtureDescription(d.fixture):d.desc;
    el.innerHTML='<div class="job-opt-mark">'+d.ico+'</div><div class="nm">'+d.name+'</div><div class="ds">'+desc+'</div><small class="pack-tag">'+(used?'Used':reason||(d.kind==='fixture'?'BOARD FIXTURE':kind==='workshop'?'BLUEPRINT':'BLACKSITE'))+'</small>';
    el.disabled=used||!!reason;
    el.onclick=()=>{if(S.pendingJobPack!==pending||taken.includes(d.id))return;beginDeckJob(d,{source,price:0,hand:packHand()});};
    g.appendChild(el);
  });
  $('btnpackskip').textContent=taken.length?'Leave the rest':'Skip pack';
  $('packworkbench').hidden=false;
  const hand=packHand(),tray=$('packhand');tray.innerHTML='';hand.forEach(card=>tray.appendChild(miniTile(card)));
  $('packhandnote').textContent=hand.length+' of '+S.deck.length+' tiles';
  renderItemRack($('packcons'),'pack');
  show('ov-pack');
}
function cancelDeckJob(){
  deckJob=null;hide('ov-deckedit');
  if(S.pendingJobPack)renderJobPack();
}
function beginDeckJob(def,options={}){
  if(def.kind==='mod'){beginModJob(def);return;}
  if(def.kind==='fixture'){beginBoardJob({kind:'install',fixture:def.fixture,source:'pack',packId:def.id});return;}
  const hand=options.hand||packHand();
  const reason=editReason(def,hand);if(reason){hint(reason,true);return;}
  deckJob={def,source:options.source||'item',idx:options.idx,price:(options.price||0)+(def.cost||0),picks:[],enh:def.stamp||null,hand};
  renderDeckJob();show('ov-deckedit');
}
function renderDeckJob(){
  const job=deckJob,d=job.def,picks=job.picks;
  const costs=[job.price?'$'+job.price:'',d.moveCost?d.moveCost+' fewer moves every round':''].filter(Boolean);
  const costNote=costs.length?' Cost: '+costs.join(' and ')+'.':'';
  $('editname').textContent=d.name;
  $('editdesc').textContent=d.desc;
  if(d.count===0){
    $('editstep').textContent='Use now';$('editenh').hidden=true;$('editgrid').innerHTML='';
    $('editpreview').textContent=(d.review?d.review([]):d.kind==='dividend'?'Collect $'+Math.min(12,Math.floor(Math.max(0,S.money)/2))+'.':d.kind==='pocket'?'Item slots: '+S.maxCons+' → '+(S.maxCons+1)+'.':d.kind==='tickets'?'Add 2 free reroll tickets.': 'Open the parcel for two different board tools.')+costNote;
    $('editcount').textContent='Run upgrade';$('btneditapply').textContent='Use'+(job.price?' · $'+job.price:'');$('btneditapply').disabled=!!editReason(d,job.hand)||S.money-job.price<moneyFloor();return;
  }
  const need=d.count||(d.kind==='replace'?2:1);
  $('editstep').textContent=d.steps?(d.steps[picks.length]||'Review your conversion.'):d.kind==='replace'?(picks.length===0?'1 / Choose the tile to copy.':picks.length===1?'2 / Choose the tile to replace.':'Review your conversion.'):
    'Choose '+(d.kind==='remove'||d.minCount?'up to ':'')+need+' tile'+(need>1?'s':'')+' · '+picks.length+' selected';
  const enh=$('editenh');enh.innerHTML='';enh.hidden=d.kind!=='stamp'||!!d.stamp;
  if(d.kind==='stamp'&&!d.stamp)Object.entries(ENH).forEach(([id,e])=>{
    const button=document.createElement('button');button.className='enh-choice'+(job.enh===id?' selected':'');
    button.setAttribute('aria-pressed',String(job.enh===id));button.innerHTML='<b>'+e.ico+' '+e.name+'</b><span>'+e.desc+'</span>';
    button.onclick=()=>{job.enh=id;renderDeckJob();};enh.appendChild(button);
  });
  const grid=$('editgrid');grid.innerHTML='';
  job.hand.filter(card=>S.deck.includes(card)).forEach(card=>{
    const i=S.deck.indexOf(card);
    const selected=picks.indexOf(i),b=document.createElement('button');b.className='edit-tile'+(selected>=0?' selected':'');
    const ineligible=(d.canPick&&!d.canPick(card))||(d.kind==='split'&&card.v<4)||(d.kind==='stamp'&&card.enh===job.enh)||(d.kind==='halve'&&card.v===2&&S.deck.length<=DECK_MIN)||(d.kind==='remove'&&picks.length>=Math.min(need,S.deck.length-DECK_MIN)&&selected<0);
    b.disabled=ineligible;
    b.setAttribute('aria-pressed',String(selected>=0));b.setAttribute('aria-label',(card.enh?ENH[card.enh].name+' ':'')+card.v+', tile '+(i+1)+(selected>=0?', selected '+(selected+1):''));
    b.appendChild(miniTile(card));
    const label=document.createElement('span');label.className='edit-tile-label';label.textContent=selected>=0?(d.labels?d.labels[selected]:d.kind==='replace'?(selected===0?'Template':'Replace'):'Selected '+(selected+1)):card.enh?ENH[card.enh].name:'Plain';b.appendChild(label);
    b.onclick=()=>{
      if(selected>=0)picks.splice(selected,1);
      else if(picks.length<need)picks.push(i);
      else if(need===1)picks[0]=i;
      renderDeckJob();
    };grid.appendChild(b);
  });
  const countReady=picks.length>=(d.kind==='remove'?1:d.minCount||need)&&picks.length<=need;
  const pickReason=countReady&&d.checkPick?d.checkPick(picks.map(i=>S.deck[i])):'';
  const valid=countReady&&!pickReason&&(d.kind!=='stamp'||job.enh);
  const preview=$('editpreview');preview.textContent='';
  if(valid){
    const cards=picks.map(i=>S.deck[i]);const name=c=>(c.enh?ENH[c.enh].name+' ':'')+c.v;
    if(d.review)preview.textContent=d.review(cards,name);
    else if(d.kind==='replace')preview.textContent=name(cards[1])+' → '+name(cards[0])+'. Deck size stays '+S.deck.length+'.';
    else if(d.kind==='remove')preview.textContent='Remove '+cards.map(name).join(' and ')+'. '+(S.deck.length-cards.length)+' tiles remain.';
    else if(d.kind==='clone')preview.textContent='Add one '+name(cards[0])+'. Deck: '+S.deck.length+' → '+(S.deck.length+1)+'.';
    else if(d.kind==='stamp')preview.textContent=name(cards[0])+' → '+ENH[job.enh].name+' '+cards[0].v+'. Future draws use the new enhancement.';
    else if(d.kind==='kiln')preview.textContent='Both become Prism. All future rounds have 2 fewer moves.';
    else if(d.kind==='smelt')preview.textContent='Destroy '+cards.map(name).join(' and ')+'. Add an Iron 8.';
    else if(d.kind==='split')preview.textContent=name(cards[0])+' → two '+name({...cards[0],v:cards[0].v/2})+' tiles.';
    else if(d.kind==='reforge')preview.textContent='Replace all 3 selected tiles with plain 8s.';
    else if(d.kind==='promote')preview.textContent=name(cards[0])+' → '+name({...cards[0],v:cards[0].v*2})+'.';
    else if(d.kind==='halve')preview.textContent=cards[0].v===2?'Remove '+name(cards[0])+'.':name(cards[0])+' → '+name({...cards[0],v:cards[0].v/2})+'.';
    else preview.textContent='Give '+name(cards[0])+' a random enhancement.';
    preview.textContent+=costNote;
  }else preview.textContent=pickReason||(d.kind==='stamp'&&!job.enh?'Choose an enhancement and a tile.':'Choose your tiles above.');
  $('btneditapply').disabled=!valid||!!editReason(d,job.hand)||S.money-job.price<moneyFloor();
  $('btneditapply').textContent='Apply'+(job.price?' · $'+job.price:'');
  $('editcount').textContent=job.hand.filter(c=>S.deck.includes(c)).length+' tiles dealt · '+S.deck.length+' in deck';
}
function applyDeckJob(){
  const job=deckJob;if(!job||$('btneditapply').disabled)return;
  const d=job.def,indices=job.picks,cards=indices.map(i=>({...S.deck[i]})),before=deckSummary();
  if(editReason(d,job.hand)||S.money-job.price<moneyFloor())return;
  if(d.count!==0&&(!indices.length||indices.some(i=>!job.hand.includes(S.deck[i]))||new Set(indices).size!==indices.length))return;
  if(d.count!==0){
    const need=d.count||(d.kind==='replace'?2:1),minimum=d.kind==='remove'?1:d.minCount||need;
    if(indices.length<minimum||indices.length>need||(d.canPick&&cards.some(c=>!d.canPick(c)))||(d.checkPick&&d.checkPick(cards)))return;
    if(d.kind==='remove'&&S.deck.length-indices.length<DECK_MIN)return;
  }
  if(d.run)d.run(indices.map(i=>S.deck[i]));
  else if(d.kind==='dividend')S.money+=Math.min(12,Math.floor(Math.max(0,S.money)/2));
  else if(d.kind==='pocket')S.maxCons++;
  else if(d.kind==='tickets')S.rerollTickets=(S.rerollTickets||0)+2;
  else if(d.kind==='parcel'){
    const tools=CONS.filter(c=>['eraser','halve','swap','shuffle','purge','clock','jack'].includes(c.id));
    for(let i=0;i<2;i++){const j=Math.floor(S.rng()*tools.length);S.cons.push({...tools.splice(j,1)[0]});}
  }
  else if(d.kind==='replace')Object.assign(S.deck[indices[1]],{v:cards[0].v,enh:cards[0].enh});
  else if(d.kind==='remove')indices.slice().sort((a,b)=>b-a).forEach(i=>S.deck.splice(i,1));
  else if(d.kind==='clone')S.deck.push({...cards[0]});
  else if(d.kind==='stamp')S.deck[indices[0]].enh=d.stamp||job.enh;
  else if(d.kind==='promote')S.deck[indices[0]].v*=2;
  else if(d.kind==='halve'){if(cards[0].v===2)S.deck.splice(indices[0],1);else S.deck[indices[0]].v/=2;}
  else if(d.kind==='random'){const keys=Object.keys(ENH);S.deck[indices[0]].enh=keys[Math.floor(S.rng()*keys.length)];}
  else if(d.kind==='kiln'){indices.forEach(i=>S.deck[i].enh='glass');S.bonusMoves-=2;S.kilnUses=(S.kilnUses||0)+1;}
  else if(d.kind==='smelt'){indices.slice().sort((a,b)=>b-a).forEach(i=>S.deck.splice(i,1));S.deck.push({v:8,enh:'steel'});}
  else if(d.kind==='split'){S.deck[indices[0]].v/=2;S.deck.push({...S.deck[indices[0]]});}
  else if(d.kind==='reforge')indices.forEach(i=>Object.assign(S.deck[i],{v:8,enh:null}));
  S.money-=job.price;
  if(d.moveCost)S.bonusMoves-=d.moveCost;
  if(d.maxUses){S.packUses||={};S.packUses[d.id]=(S.packUses[d.id]||0)+1;}
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
  else if(job.source!=='item'){S.consUsed++;S.charms.forEach(c=>{if(c.onUseCon)c.onUseCon(c);});}
  log('<b>'+d.name+'</b>: '+$('editpreview').textContent);
  deckJob=null;undoSnap=null;if(d.count!==0)reshuffle();hide('ov-deckedit');audio.effect('upgrade');
  render();if(S.phase==='shop')renderShop();if(S.pendingJobPack)renderJobPack();else hide('ov-pack');saveT();
}
function openDeckPick(i,d){
  if(!S.pendingJobPack)return;
  const def=deckDef(d);if(def)beginDeckJob(def,{source:'item',idx:i,hand:packHand()});
}
$('btneditapply').onclick=applyDeckJob;
$('btneditcancel').onclick=cancelDeckJob;
$('btnbackroomclose').onclick=()=>hide('ov-backroom');

function cancelTarget(){ target=null; $("board").classList.remove("targeting"); renderCons(); syncTiles(); hint(""); }

// ---------- end states ----------
function statLines(){
  return [["Difficulty",S.difficulty.name],["Reached","Ante "+S.ante+" · "+BLINDS[S.blind].name],["Rounds won",S.roundsWon],["Best single move",fmt(S.bestMove)],["Highest tile",fmt(maxTile())],["Mods",S.charms.map(c=>c.name).join(", ")||"none"],["Fixtures",fixtureSummary()],["Deck",deckSummary()]];
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
  S.phase="over";saveStats(true);
  const unlocks=S.winRecorded?[]:(window.AnteProgression?.recordWin(S.difficulty.id)||[]);S.winRecorded=true;
  T.end={reason:"won",ante:S.ante,blind:"Boss",charms:S.charms.map(c=>c.id),bestMove:S.bestMove,deck:deckSummary()}; saveT();
  $("overtitle").textContent="You beat the house"; $("overtext").innerHTML="Ante 8's boss is down. Seed <b>"+escapeHTML(S.seed)+"</b>. Targets keep growing ×"+ENDLESS_GROWTH+" per ante if you continue."+(unlocks.length?"<br><b>Unlocked: "+unlocks.map(escapeHTML).join(", ")+".</b>":"");
  $("overlines").innerHTML=statLines().map(([a,b])=>"<div><span>"+a+"</span><b style='color:var(--ink)'>"+b+"</b></div>").join("");
  $("btncontinue").style.display=""; fanfare(); confetti(); show("ov-over");
}
$("btncontinue").onclick=()=>{ hide("ov-over"); S.endless=true; S.phase="shop"; openShop(); };
$("btnagain").onclick=()=>{ hide("ov-over"); $("seedin").value=""; audio.setScene('title'); audio.setIntensity(0); showStats(); show("ov-start"); };
$("btnabandon").onclick=()=>{ if(S&&S.phase!=="over") show("ov-pause"); };
function loadStats(){ try{ return JSON.parse(localStorage.getItem(STORAGE+"stats")||"{}"); }catch(e){ return {}; } }
function saveStats(won){
  const first=!S.statsSaved;S.statsSaved=true;
  try{ const st=loadStats();if(first){st.runs=(st.runs||0)+1;if(won)st.wins=(st.wins||0)+1;}
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
    out.push("=== run "+(ri+1)+"  seed "+run.seed+"  "+(run.difficulty||"street")+"  v"+run.v+"  "+run.start.slice(0,16)+"  end: "+(run.end?run.end.reason:"in progress"));
    run.rounds.forEach(r=>{
      const scoring=r.moves.filter(m=>m.total>0);
      const tot=scoring.reduce((a,m)=>a+m.total,0);
      const avg=scoring.length?Math.round(tot/scoring.length):0;
      const best=scoring.reduce((a,m)=>Math.max(a,m.total),0);
      const used = r.movesUsed!=null ? r.movesUsed : r.moves.filter(m=>m.dir).length;
      out.push(" A"+r.ante+anteAbbr(r.blind)+(r.boss?"("+r.boss+")":"")+"  "+(r.result||"?").padEnd(4)+" "+fmt(r.score||tot).padStart(9)+"/"+fmt(r.target).padEnd(9)
        +" mv "+String(used).padStart(2)+"/"+r.movesAllowed+"  scoring "+scoring.length+"  avg "+fmt(avg).padStart(7)+"  best "+fmt(best).padStart(8)
        +"  max "+(r.maxTile||"?")+"  tiles "+(r.tilesEnd!=null?r.tilesEnd:"?")+"  $"+r.moneyStart+(r.moneyEnd!=null?"→"+r.moneyEnd:"")
        +"  charms ["+r.charms.join(",")+"]"+(r.vouchers&&r.vouchers.length?" v["+r.vouchers.join(",")+"]":"")+(r.deck?" deck{"+r.deck+"}(avg "+r.deckAvg+")":"")+(r.fixtures?.length?" fixtures["+r.fixtures.map(f=>f.kind+'@'+(f.r+1)+','+(f.c+1)).join(' ')+"]":"")+(r.filed&&r.filed.length?" filed["+r.filed.join(",")+"]":"")+(r.bones?" BONES":""));
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
    const linked=linkedCard(t);e.dataset.linked=String(!!linked);
    if(linked){const mark=document.createElement('span');mark.className='deck-link';mark.textContent='↗';mark.title='Linked draw: permanent edits change its deck card too.';mark.setAttribute('aria-hidden','true');e.appendChild(mark);e.title+=' · Linked to your deck';}
    const permanent=!!target&&permanentItem(target.def),eligible=!!target&&(!permanent||!permanentTileReason(target.def,t,target.picks));
    e.classList.toggle('permanent-pick',permanent&&eligible);e.classList.toggle('not-eligible',permanent&&!eligible);
    e.setAttribute('aria-disabled',String(!!target&&!eligible));
    e.classList.toggle("pick",eligible); e.tabIndex=eligible?0:-1;
    e.classList.toggle("picked",!!target&&target.picks.some(p=>p.id===t.id));
  });
  els.forEach((e,id)=>{ if(!live.has(id)&&!e.classList.contains("shatter")){ e.remove(); els.delete(id); } });
  renderDeck();
  renderFixtureBoard();
}
function miniTile(c){ const d=document.createElement("div"); d.className="mini"; d.dataset.v=c.v; d.dataset.enh=c.enh||""; d.title=c.v+(c.enh?" · "+ENH[c.enh].name+": "+ENH[c.enh].desc:""); d.setAttribute("aria-label",d.title); d.textContent=c.v; if(c.enh){ const b=document.createElement("span"); b.className="eb"; b.textContent=ENH[c.enh].ico; d.appendChild(b); } return d; }
function renderDeck(){
  if(!S) return;
  const nr=$("nextrow"); nr.innerHTML="";nr.classList.toggle("expanded",(S.previewDraws||3)>3);
  $("pilelbl").textContent=S.pile.length+" left";
  const previewCount=S.previewDraws||3,preview=S.pile.slice(0,previewCount);
  preview.forEach((c,i)=>{ nr.appendChild(miniTile(c)); if(i<preview.length-1){ const a=document.createElement("span"); a.className="arrow"; a.textContent="›"; nr.appendChild(a); } });
  if(preview.length<previewCount){ const s=document.createElement("span"); s.style.cssText="font-size:11px;color:var(--pink)"; s.textContent=preview.length?"then shuffle":"shuffling"; nr.appendChild(s); }
  const comp=$("deckcomp"); comp.innerHTML="";
  const m={}; S.deck.forEach(c=>{ const k=c.v+"|"+(c.enh||""); m[k]=(m[k]||0)+1; });
  Object.keys(m).sort((a,b)=>parseInt(a)-parseInt(b)||a.localeCompare(b)).forEach(k=>{ const [v,e]=k.split("|"); const d=document.createElement("span"); d.className="dc"+(e?" enh":""); d.innerHTML="<i>"+v+"</i>"+(e?ENH[e].ico+" "+ENH[e].name.toLowerCase():"")+" ×"+m[k]; comp.appendChild(d); });
  $("deckcount").textContent=S.deck.length+" tiles";
}
let lastMoney=null;
function render(){
  if(!S) return;
  renderBossPreview();
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
  $("rubblelbl").textContent=S.grease?'Paused · '+S.grease+' moves':S.rubbleIn+" move"+(S.rubbleIn===1?"":"s");
  document.querySelector(".rubble-clock").classList.toggle("urgent",S.rubbleIn<=1&&!S.grease);
  $("boardstatus").textContent=target?"CHOOSE A TILE":S.banked?"TARGET CLEARED":S.boss?"BOSS ROUND":S.moves<=6?"MAKE THEM COUNT":"MAKE YOUR MOVE";
  document.querySelector(".board-label span:last-child").textContent=S.N+" × "+S.N;
  $("bankhint").textContent=S.movesMade<2?"Merge matching tiles to score.":S.banked?"Bank now, or keep playing for extra cash.":"Score "+fmt(Math.max(0,S.target-S.score))+" more to clear the round.";
  $("roundtrack").innerHTML=[0,1,2].map(i=>(i?"<i></i>":"")+"<span class='"+(i===S.blind?"active ":i<S.blind?"done ":"")+(i===2?"boss":"")+"'>"+(i===2?"B":"0"+(i+1))+"</span>").join("");
  $("roundtrack").setAttribute("aria-label",BLINDS[S.blind].name+", round "+(S.blind+1)+" of this ante");
  renderCons(); renderDeck();renderFixtureBoard();
}
function scoreMod(ctx,c){
  if(c.score)c.score(ctx,c);
  if(c.firmware&&(c.firmware.chips||c.firmware.mult))ctx.add({name:c.name+' tuning',uid:c.uid},c.firmware);
}
function descOf(c){
  let d=c.desc;
  if(c.st) Object.keys(c.st).forEach(k=>{ d=d.replace("{"+k+"}", c.st[k]); });
  d=d.replace("{sell}",c.sell!=null?c.sell:Math.floor(c.price/2)).replace("{used}",S?S.consUsed:0);
  if(c.firmware&&(c.firmware.chips||c.firmware.mult))d+='<span class="st">'+(c.overdriven?'Overdrive: ':'Tuned: ')+[c.firmware.chips?'+'+c.firmware.chips+' chips':'',c.firmware.mult?'+'+c.firmware.mult+' mult':''].filter(Boolean).join(' · ')+' each scoring move.</span>';
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
    el.disabled=!!conReason(c,'board');
    el.innerHTML="<div class='ico'>"+c.ico+"</div><div><div class='t'>"+c.name+"</div><div class='d'>"+conDescription(c,'board')+"</div><small class='item-action'>"+(conReason(c,'board')||(permanentItem(c)?"Permanent · choose ↗ tile":c.file?"Add board tile to deck":"Board / immediate effect"))+"</small></div>";
    el.onclick=()=>useCon(i); t.appendChild(el);
  });
  if(S.polish>0){ const p=document.createElement("div"); p.className="empty"; p.style.borderColor="var(--purple)"; p.style.color="var(--purple)"; p.textContent="Polish: ×2 mult for "+S.polish+" more scoring moves"; t.appendChild(p); }
  if(S.grease||S.hotwire){const p=document.createElement('div');p.className='empty';p.textContent=[S.grease?'Grease: '+S.grease+' moves left':'',S.hotwire?'Hot Wire: '+S.hotwire+' payouts left':''].filter(Boolean).join(' · ');t.appendChild(p);}
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
  $('inspectrarity').textContent=({c:'Common mod',u:'Uncommon mod',r:'Rare mod'})[c.rar];
  show('ov-inspect');
}
function refreshAudio(){
  const p=audio.preferences();
  $('musicvol').value=p.music; $('sfxvol').value=p.effects; $('track').value=p.track;
  $('musicout').textContent=p.music+'%'; $('sfxout').textContent=p.effects+'%';
  $('btnmute').innerHTML=(p.muted?'Unmute sound':'Mute all sound')+' <kbd>M</kbd>';
  $('btnmute').setAttribute('aria-pressed',String(p.muted));
  $('btnsound').innerHTML=(p.muted?'♪':'♫')+' <span>'+(p.muted?'Muted':'Settings')+'</span>';
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
const dismissable=new Set(['ov-help','ov-settings','ov-tlog','ov-credits','ov-pause','ov-confirm','ov-inspect','ov-deckedit','ov-backroom','ov-collection']);
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
    if(top){if(top==='ov-deckedit')cancelDeckJob();else if(top==='ov-boardwork')cancelBoardJob();else if(top==='ov-modwork')cancelModJob();else if(top==='ov-pack')$('btnpackskip').click();else if(dismissable.has(top))hide(top);}
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
window.AnteProgression?.init({storage:STORAGE,stats:loadStats()});
window.AnteCollection?.init({mods:CHARMS,items:CONS,blueprints:WORKSHOP,blacksite:EXPERIMENTS,firmware:VOUCHERS,fixtures:FIXTURES,finishes:ENH,open:show,close:hide});
document.querySelectorAll('.ov').forEach(ov=>{
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  const heading=ov.querySelector('h1,h2');if(heading){heading.id||=ov.id+'-title';ov.setAttribute('aria-labelledby',heading.id);}
});
ensureShopLayout();syncScreens();refreshAudio();showStats();

})();
