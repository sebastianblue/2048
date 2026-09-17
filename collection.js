(function(){
'use strict';
let config,groups,active='mods',query='',rarity='all';
const $=id=>document.getElementById(id);
const plain=s=>{const e=document.createElement('div');e.innerHTML=s||'';return e.textContent||'';};
function description(d){
 let text=plain(d.desc);text=text.replace(/\{([^}]+)\}/g,(_,key)=>String(key==='sell'?Math.floor((d.price||0)/2):key==='used'?0:d.st?.[key]??0));return text;
}
function sourceLine(d){
 if(active==='mods')return ({c:'Common',u:'Uncommon',r:'Rare'})[d.rar]+' mod · $'+d.price;
 if(active==='items')return '$'+d.price+' · '+(d.deck||d.stamp?'Permanent deck edit':d.file?'Board → deck':'Consumable');
 if(active==='blueprints'||active==='blacksite')return 'Pack choice'+(d.kind==='mod'?' · Mod upgrade':d.kind==='fixture'?' · Board fixture':'')+(d.cost?' · +$'+d.cost:'')+(d.moveCost?' · −'+d.moveCost+' moves/round':'');
 if(active==='firmware')return '$'+d.price+' · '+(d.max===1?'Once per run':'Up to '+d.max+' purchases');
 if(active==='fixtures')return '$'+d.price+' · Fixed board cell';
 return 'Tile finish';
}
function render(){
 document.querySelectorAll('#collection-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===active)));
 $('collection-rarity').hidden=active!=='mods';
 const pool=groups.find(g=>g.id===active).cards;
 const matches=pool.filter(d=>(active!=='mods'||rarity==='all'||d.rar===rarity)&&(!query||(d.name+' '+description(d)+' '+sourceLine(d)).toLowerCase().includes(query)));
 $('collection-count').textContent=matches.length+' / '+pool.length+' entries';
 const grid=$('collection-grid');grid.innerHTML='';
 matches.forEach(d=>{
  const article=document.createElement('article');article.className='collection-card';article.dataset.rarity=d.rar||'';
  const icon=document.createElement('span');icon.className='collection-icon';icon.textContent=d.ico||'▣';icon.setAttribute('aria-hidden','true');
  const head=document.createElement('h3');head.textContent=d.name;
  const info=document.createElement('small');info.className='collection-source';info.textContent=sourceLine(d);
  const desc=document.createElement('p');desc.textContent=description(d);
  article.append(icon,head,info,desc);
  if(active==='items'&&(d.deck||d.stamp)){
   const note=document.createElement('small');note.textContent='During rounds, target a linked draw marked ↗. In packs, use the dealt hand. The exact deck card changes permanently.';article.appendChild(note);
  }
  grid.appendChild(article);
 });
 if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent='No cards match. Try another name or effect.';grid.appendChild(p);}
 $('collection-note').textContent=active==='blueprints'||active==='blacksite'?'Buy a pack to find these. The listed extra costs are paid on use; opened packs have no refunds.':active==='mods'?'All mods are shown from the start. Their changing counters are shown at starting values. Tuning from Blueprints adds to the printed ability.':'Every entry is visible. This is a reference, not a shop.';
}
function open(){render();config.open('ov-collection');}
function init(options){
 if($('ov-collection'))return;config=options;
 const list=value=>Array.isArray(value)?value:Object.entries(value||{}).map(([id,d])=>({id,...d}));
 groups=[['mods','Mods'],['items','Items'],['blueprints','Blueprints'],['blacksite','Blacksite'],['firmware','Firmware'],['fixtures','Fixtures'],['finishes','Finishes']].map(([id,name])=>({id,name,cards:list(options[id]).slice().sort((a,b)=>a.name.localeCompare(b.name))}));
 const ov=document.createElement('div');ov.id='ov-collection';ov.className='ov over';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','collection-title');
 ov.innerHTML='<div class="modal collection-modal"><span class="eyebrow">ANTE / PARTS CATALOGUE</span><div class="collection-heading"><h2 id="collection-title">Collection</h2><span id="collection-count" aria-live="polite"></span></div><nav id="collection-tabs" aria-label="Card families"></nav><div class="collection-filters"><label for="collection-search">Search cards<input type="search" id="collection-search" placeholder="Name or effect…" autocomplete="off"></label><label id="collection-rarity" for="collection-rarity-select">Rarity<select id="collection-rarity-select"><option value="all">All rarities</option><option value="c">Common</option><option value="u">Uncommon</option><option value="r">Rare</option></select></label></div><p id="collection-note"></p><div id="collection-grid" class="collection-grid"></div><div class="btnrow"><button id="btncollectionclose" class="btn">Back</button></div></div>';
 document.body.appendChild(ov);
 groups.forEach(group=>{const b=document.createElement('button');b.type='button';b.dataset.group=group.id;b.textContent=group.name+' '+group.cards.length;b.onclick=()=>{active=group.id;render();};$('collection-tabs').appendChild(b);});
 $('collection-search').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};$('collection-rarity-select').onchange=e=>{rarity=e.target.value;render();};$('btncollectionclose').onclick=()=>config.close('ov-collection');
 [['.title-bottom','btn-title-collection','Collection'],['.pause-actions','btn-pause-collection','Collection'],['.footer','btn-collection','Collection']].forEach(([selector,id,label])=>{
  const b=document.createElement('button');b.id=id;b.type='button';b.textContent=label;if(selector==='.pause-actions')b.className='btn ghost';b.onclick=open;const parent=document.querySelector(selector);if(selector==='.pause-actions')parent.querySelector('#btnendrun').before(b);else parent.appendChild(b);
 });
 render();
}
window.AnteCollection={init,open};
})();
