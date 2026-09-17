(function(){
'use strict';
const difficulties=[
 {id:'street',name:'Street',targetMult:1,movePenalty:0,rubbleAdvance:0,startingCash:4},
 {id:'wired',name:'Wired',targetMult:1.15,movePenalty:0,rubbleAdvance:0,startingCash:4},
 {id:'hardline',name:'Hardline',targetMult:1.15,movePenalty:2,rubbleAdvance:0,startingCash:4},
 {id:'lockdown',name:'Lockdown',targetMult:1.3,movePenalty:2,rubbleAdvance:1,startingCash:4},
 {id:'kill_screen',name:'Kill Screen',targetMult:1.45,movePenalty:4,rubbleAdvance:1,startingCash:2},
];
const skins=[
 {id:'after-hours',name:'After Hours',wins:0,color:'#090e18'},
 {id:'paper',name:'Paper Arcade',wins:0,color:'#ded5ba'},
 {id:'amber',name:'Amber Terminal',wins:1,color:'#101b16'},
 {id:'ice',name:'Ice Station',wins:3,color:'#101e2c'},
 {id:'scarlet',name:'Scarlet Circuit',wins:5,color:'#1b1017'},
];
let key,state;
const $=id=>document.getElementById(id);
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(e){}}
function levelUnlocked(i){return i===0||!!state.wins[difficulties[i-1].id];}
function unlockedNames(){return [...difficulties.filter((d,i)=>levelUnlocked(i)).map(d=>d.name),...skins.filter(s=>state.totalWins>=s.wins).map(s=>s.name)];}
function applySkin(){
 const skin=skins.find(s=>s.id===state.skin&&state.totalWins>=s.wins)||skins[0];state.skin=skin.id;
 document.documentElement.dataset.skin=skin.id;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',skin.color);
 const label=document.querySelector('.title-top>span');if(label)label.textContent=skin.name.toUpperCase()+' / ARCADE SYSTEMS';
}
function rules(d){
 const parts=[d.targetMult===1?'Standard targets':Math.round((d.targetMult-1)*100)+'% higher targets',24-d.movePenalty+' starting moves',d.rubbleAdvance?'Rubble arrives 1 move sooner':'Standard rubble','$'+d.startingCash+' starting cash'];
 return parts.join(' · ')+'. Boss rules still apply.';
}
function refresh(){
 const difficulty=$('run-difficulty');difficulty.innerHTML='';
 difficulties.forEach((d,i)=>{const o=document.createElement('option');o.value=d.id;o.disabled=!levelUnlocked(i);o.textContent=(i+1)+' / '+d.name+(o.disabled?' — beat '+difficulties[i-1].name:'');difficulty.appendChild(o);});difficulty.value=state.selectedDifficulty;
 $('difficulty-rules').textContent=rules(getDifficulty());
 $('progress-count').textContent=state.totalWins+' full-run win'+(state.totalWins===1?'':'s')+' · beat Ante 8 to unlock the next level';
 ['run-skin','settings-skin'].forEach(id=>{
  const select=$(id);select.innerHTML='';skins.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.disabled=state.totalWins<s.wins;o.textContent=s.name+(o.disabled?' — '+s.wins+' wins':'');select.appendChild(o);});select.value=state.skin;
 });
 applySkin();
}
function init({storage,stats={}}){
 if($('run-setup'))return;key=storage+'progression';let saved=null;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}
 state={selectedDifficulty:'street',skin:'after-hours',wins:{},totalWins:Math.max(0,Number(stats.wins)||0)};
 if(saved&&typeof saved==='object'){
  state.wins={};difficulties.forEach(d=>{state.wins[d.id]=Math.max(0,Number(saved.wins?.[d.id])||0);});
  state.totalWins=Math.max(state.totalWins,Number(saved.totalWins)||0);state.skin=saved.skin;state.selectedDifficulty=saved.selectedDifficulty;
 }else if(state.totalWins>0)state.wins.street=1;
 if(!difficulties.some((d,i)=>d.id===state.selectedDifficulty&&levelUnlocked(i)))state.selectedDifficulty='street';
 if(!skins.some(s=>s.id===state.skin&&state.totalWins>=s.wins))state.skin='after-hours';
 const setup=document.createElement('div');setup.id='run-setup';setup.className='run-setup';
 setup.innerHTML='<label for="run-difficulty">Difficulty<select id="run-difficulty"></select></label><label for="run-skin">Cabinet skin<select id="run-skin"></select></label><p id="difficulty-rules"></p><small id="progress-count"></small>';
 document.querySelector('.title-actions').before(setup);
 const settings=document.createElement('label');settings.className='setting-row';settings.htmlFor='settings-skin';settings.innerHTML='<span>Cabinet skin <small>Cosmetic only</small></span><select id="settings-skin"></select><small class="skin-unlocks">More skins unlock at 1, 3 and 5 full-run wins. Progress stays on this browser.</small>';
 $('btnmute').before(settings);
 $('run-difficulty').onchange=e=>{const i=difficulties.findIndex(d=>d.id===e.target.value);if(i>=0&&levelUnlocked(i)){state.selectedDifficulty=difficulties[i].id;save();refresh();}};
 ['run-skin','settings-skin'].forEach(id=>{$(id).onchange=e=>{const skin=skins.find(s=>s.id===e.target.value);if(skin&&state.totalWins>=skin.wins){state.skin=skin.id;save();refresh();}};});
 refresh();save();
}
function getDifficulty(){return {...(difficulties.find((d,i)=>d.id===state?.selectedDifficulty&&levelUnlocked(i))||difficulties[0])};}
function recordWin(id){
 if(!state||!difficulties.some(d=>d.id===id))return [];
 const before=new Set(unlockedNames());state.wins[id]=(state.wins[id]||0)+1;state.totalWins++;save();refresh();return unlockedNames().filter(name=>!before.has(name));
}
window.AnteProgression={init,getDifficulty,recordWin,getSkin:()=>state?.skin||'after-hours'};
})();
