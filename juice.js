/* Impact belongs to the action: hit, settle, then get out of the way. */
window.AnteJuice = (() => {
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#f5d77c', '#fff3c9', '#adcc99', '#dc7654'];
  const pieces = new Set();
  function burst(element, count = 8, strength = 1) {
    if (!element || reduced()) return;
    const box = element.getBoundingClientRect();
    if (!box.width) return;
    for (let i = 0; i < count && pieces.size < 96; i++) {
      const p = document.createElement('i');
      p.className = 'impact-piece'; p.setAttribute('aria-hidden', 'true');
      const angle = Math.PI * 2 * i / count + Math.random() * .4;
      const distance = (24 + Math.random() * 24) * strength;
      p.style.cssText = `left:${box.left + box.width / 2}px;top:${box.top + box.height / 2}px;background:${colors[i % colors.length]};--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance + 18}px;--turn:${Math.random() * 240}deg;`;
      pieces.add(p); document.body.appendChild(p);
      setTimeout(() => { p.remove(); pieces.delete(p); }, 650);
    }
  }
  function pulse(element, className) {
    if (!element || reduced()) return;
    element.classList.remove(className); void element.offsetWidth;
    element.classList.add(className);
    element.addEventListener('animationend', () => element.classList.remove(className), {once:true});
  }
  function merge(merges, elements) {
    if (reduced()) return;
    merges.forEach(m => {
      const e = elements.get(m.tile.id);
      e?.classList.remove('merge-heavy','merge-hit');
      const heavy = m.v >= 256 || m.enhs.length > 0;
      pulse(e, heavy ? 'merge-heavy' : 'merge-hit');
      if(heavy)burst(e, 7, 1);
    });
    if (merges.some(m => m.v >= 256) || merges.filter(m => m.enhs.length > 0).length >= 2) {
      pulse(document.querySelector('.board-bezel'), 'cabinet-kick');
    }
  }
  function pack(grid, title) {
    grid.closest('.modal').querySelector('.pack-wrapper')?.remove();
    if (reduced()) return;
    const wrapper = document.createElement('div'); wrapper.className = 'pack-wrapper';
    wrapper.setAttribute('aria-hidden', 'true');
    const top = document.createElement('span'); top.className = 'wrapper-top';
    top.textContent = title;
    const bottom = document.createElement('span'); bottom.className = 'wrapper-bottom';
    bottom.textContent = '2048: ANTE'; wrapper.append(top, bottom);
    grid.before(wrapper);
    [...grid.children].forEach((card, i) => {
      card.style.setProperty('--deal-delay', `${190 + i * 85}ms`);
      card.style.setProperty('--deal-turn', `${(i - 1) * 5}deg`);
      pulse(card, 'pack-deal');
    });
    setTimeout(() => { if(wrapper.isConnected)burst(wrapper, 16, 1.7); }, 220);
    setTimeout(() => wrapper.remove(), 850);
  }
  function reaction(element, name) {
    if (!element) return;
    pulse(element, 'reaction-hit'); burst(element, 12, 1.4);
    if (reduced()) return;
    const box = element.getBoundingClientRect();
    const label = document.createElement('span'); label.className = 'reaction-pop';
    label.setAttribute('aria-hidden', 'true'); label.textContent = name;
    label.style.left = `${box.left + box.width / 2}px`; label.style.top = `${box.top + 6}px`;
    document.body.appendChild(label); setTimeout(() => label.remove(), 1100);
  }
  function round(overlay, boss) {
    pulse(overlay.querySelector('h1,h2'), 'round-stamp');
    overlay.classList.toggle('boss-cleared', boss);
    [...overlay.querySelectorAll('.cash > div')].forEach((row, i) => {
      row.style.setProperty('--deal-delay', `${100 + i * 65}ms`); pulse(row, 'cash-arrive');
    });
    burst(overlay.querySelector('h1,h2'), boss ? 28 : 18, boss ? 2.6 : 1.8);
  }
  return { merge, pack, reaction, round };
})();
