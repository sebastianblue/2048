import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';

// Exercise the game actually shipped in index.html. The export is injected
// only into this in-memory copy; the browser build exposes no testing API.
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../dist/game.js', import.meta.url), 'utf8');
const exports = `
window.gameTest = {
  get state(){ return S; }, get telemetry(){ return T; }, get deckJob(){ return deckJob; },
  newRun, move, slide, score, packValue, unlockedPackValues, markMadeValue,
  openShop, openPack, openJobPack, beginDeckJob, applyDeckJob, render, syncTiles,
  WORKSHOP, EXPERIMENTS, CHARMS, REACTIONS, makeCharm, mulberry, hashStr
};
`;
assert.match(source, /\}\)\(\);\s*$/);

function createGame(t) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, {
    url: 'http://localhost/?qa=1', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole,
  });
  const {window} = dom;
  let prefs = {muted: true, music: 0, effects: 0, track: 'auto'};
  window.AnteAudio = {
    preferences: () => ({...prefs}), set: value => {prefs = {...prefs, ...value};},
    tone() {}, effect() {}, setScene() {}, setIntensity() {}, pause() {}, unlock() {},
  };
  window.matchMedia = query => ({matches: query.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {}});
  window.scrollTo = () => {};
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (callback, delay = 0) => {
    timers.set(++timerId, {callback, delay});
    return timerId;
  };
  window.clearTimeout = id => timers.delete(id);
  const flushMovement = () => {
    for (let rounds = 0; rounds < 20; rounds++) {
      const due = [...timers].filter(([, task]) => task.delay === 0);
      if (!due.length) return;
      for (const [id, task] of due) {
        if (!timers.has(id)) continue;
        timers.delete(id);
        task.callback();
      }
    }
    assert.fail('Movement timers did not settle');
  };
  window.eval(source.replace(/\}\)\(\);\s*$/, `${exports}\n})();`));
  window.document.getElementById('seedin').value = 'current-game-regression';
  window.document.getElementById('btnstart').click();
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'The actual game must not throw during browser interactions');
  });
  const game = window.gameTest;
  const $ = id => window.document.getElementById(id);
  function setBoard(rows) {
    let id = 10000;
    game.state.grid = Array.from({length: 4}, (_, r) => Array.from({length: 4}, (_, c) => {
      const value = rows[r]?.[c];
      if (!value) return null;
      return {id: ++id, r, c, v: typeof value === 'number' ? value : value.v, enh: typeof value === 'number' ? null : value.enh};
    }));
    game.state.rubbleIn = 100;
    game.state.target = 1e9;
    game.syncTiles();
    game.render();
  }
  function shop() {
    game.state.money = 40;
    game.openShop();
  }
  function optionNames() {
    return [...$('packgrid').querySelectorAll('.nm')].map(node => node.textContent);
  }
  function selectJobTiles() {
    const job = game.deckJob;
    if (job.def.kind === 'stamp') $('editenh').querySelector('button').click();
    const count = job.def.kind === 'remove' ? 1 : job.def.count || 1;
    for (let i = 0; i < count; i++) $('editgrid').querySelector('button:not(.selected):not(:disabled)').click();
  }
  return {game, $, window, flushMovement, setBoard, shop, optionNames, selectJobTiles};
}

test('current game charges one move for a valid slide and refreshes the visible counter', t => {
  const {game, $, window, flushMovement, setBoard} = createGame(t);
  setBoard([[4, 2]]);
  const initial = game.state.moves;
  const initialPile = game.state.pile.length;
  $('board').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
  flushMovement();
  assert.equal(game.state.moves, initial, 'A stationary slide is free');
  assert.equal(game.state.pile.length, initialPile, 'A stationary slide does not spawn');
  $('board').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
  flushMovement();
  assert.equal(game.state.moves, initial - 1);
  assert.equal($('moveslbl').textContent, String(initial - 1));
  assert.equal(game.state.pile.length, initialPile - 1);
  assert.equal(game.state.movesMade, 1);
});

test('pack finds unlock after an actual committed merge and reset with the next run', t => {
  const {game, setBoard} = createGame(t);
  setBoard([[4, 4]]);
  game.slide('left', false);
  assert.equal(Object.keys(game.state.madeValues).length, 0, 'Move previews cannot unlock values');
  game.slide('left', true);
  assert.equal(game.state.madeValues['8'], 1);
  assert.deepEqual(Array.from(game.unlockedPackValues()), [2, 4, 8]);
  game.newRun('next-run');
  assert.deepEqual(Array.from(game.unlockedPackValues()), [2, 4]);
});

test('deck edits cannot unlock a value that has never been merged on the board', t => {
  const {game, $, shop, selectJobTiles} = createGame(t);
  shop();
  for (const def of [{id: 'promote', kind: 'promote', name: 'Promote', desc: '', count: 1}, game.EXPERIMENTS.find(item => item.id === 'smelt')]) {
    game.state.deck[0].v = 4;
    game.beginDeckJob(def, {source: 'workshop', price: 0});
    selectJobTiles();
    $('btneditapply').click();
  }
  assert.deepEqual(Array.from(game.unlockedPackValues()), [2, 4]);
});

test('pack offers stay inside the run unlocks, with larger numbers progressively rarer', t => {
  const {game} = createGame(t);
  game.state.ante = 8;
  game.state.blind = 2;
  for (let i = 0; i < 5000; i++) assert.ok([2, 4].includes(game.packValue()));
  game.state.madeValues = {8: 1, 16: 1, 64: 1, 256: 1};
  game.state.rng = game.mulberry(game.hashStr('pack-distribution'));
  const counts = new Map([2, 4, 8, 16, 64, 256].map(value => [value, 0]));
  for (let i = 0; i < 40000; i++) {
    const value = game.packValue();
    assert.ok(counts.has(value), `Never-made value ${value} appeared`);
    counts.set(value, counts.get(value) + 1);
  }
  assert.ok(counts.get(8) > counts.get(16));
  assert.ok(counts.get(16) > counts.get(64));
  assert.ok(counts.get(64) > counts.get(256));
  const highRate = [...counts].filter(([value]) => value > 4).reduce((sum, [, count]) => sum + count, 0) / 40000;
  assert.ok(highRate > 0.21 && highRate < 0.27, `Late-run high-card frequency ${highRate} is outside the rare-find range`);
});

test('rare number finds increase gradually as the run advances', t => {
  const {game} = createGame(t);
  game.state.madeValues = {8: 1};
  function highCount(ante) {
    game.state.ante = ante;
    game.state.rng = game.mulberry(game.hashStr('ante-comparison'));
    let count = 0;
    for (let i = 0; i < 15000; i++) if (game.packValue() > 4) count++;
    return count;
  }
  const opening = highCount(1), middle = highCount(4), late = highCount(8);
  assert.ok(opening < middle && middle < late);
  assert.ok(late < 15000 * 0.27);
});

test('skipping a job pack forfeits its price and cannot reroll its offers for free', t => {
  const {game, $, shop, optionNames} = createGame(t);
  shop();
  const originalRng = game.state.rng;
  let rngCalls = 0;
  game.state.rng = () => {rngCalls++; return originalRng();};
  game.openJobPack('workshop', 6);
  const options = optionNames();
  const callsAfterOpen = rngCalls;
  assert.equal(game.state.money, 34);
  assert.equal(options.length, 3);
  $('btnpackskip').click();
  assert.equal(game.state.money, 34);
  assert.equal(game.state.workshopPack.sold, true);
  assert.equal(game.state.pendingJobPack, null);
  $('btnpackskip').click();
  assert.equal(game.state.money, 34, 'Closing never refunds the gamble');
  game.openJobPack('workshop', 6);
  assert.equal($('ov-pack').classList.contains('show'), false, 'A discarded job pack is sold for this shop');
  assert.equal(rngCalls, callsAfterOpen, 'Discarded packs cannot generate new random choices');
  assert.equal(game.state.money, 34);
});

test('skipping a tile pack keeps its cost and the next pack costs more', t => {
  const {game, $, shop} = createGame(t);
  shop();
  const originalDeck = JSON.stringify(game.state.deck);
  game.openPack(6);
  assert.equal(game.state.money, 34);
  $('btnpackskip').click();
  assert.equal(game.state.money, 34);
  assert.equal(game.state.packCount, 1);
  assert.equal(game.state.pendingPackPrice, null);
  assert.equal(JSON.stringify(game.state.deck), originalDeck);
  assert.match($('deckrow').querySelector('.buy').textContent, /9/);
  $('deckrow').querySelector('.buy').click();
  assert.equal(game.state.money, 25);
  assert.equal(game.state.packCount, 2);
});

test('canceling a pack deck edit returns to its choices and keeps its paid credit', t => {
  const {game, $, shop, optionNames, selectJobTiles} = createGame(t);
  shop();
  // Guarantee a targeted choice so this test is about editor cancellation;
  // instant-use utility options have no tile editor to cancel.
  game.state.workshopPack.options = game.WORKSHOP.filter(item => item.count > 0).slice(0, 3);
  game.openJobPack('workshop', 6);
  const options = optionNames();
  $('packgrid').querySelector('button:not(:disabled)').click();
  assert.ok(game.deckJob);
  assert.ok(game.state.pendingJobPack, 'A selected job stays pending until applied');
  $('btneditcancel').click();
  assert.equal(game.deckJob, null);
  assert.ok($('ov-pack').classList.contains('show'));
  assert.deepEqual(optionNames(), options);
  assert.equal(game.state.money, 34);
  $('packgrid').querySelector('button:not(:disabled)').click();
  selectJobTiles();
  assert.equal($('btneditapply').disabled, false);
  $('btneditapply').click();
  assert.equal(game.state.money, 34, 'Applying the chosen job must not charge a second price');
  assert.equal(game.state.pendingJobPack, null);
  assert.equal(game.state.workshopPack.sold, true);
  const deckAfter = JSON.stringify(game.state.deck);
  $('btneditapply').click();
  assert.equal(JSON.stringify(game.state.deck), deckAfter, 'A job applies only once');
  assert.equal(game.state.money, 34);
});

test('Escape returns an unfinished edit to its pack, then discards the pack without a refund', t => {
  const {game, $, shop, window, optionNames} = createGame(t);
  shop();
  game.state.workshopPack.options = game.WORKSHOP.filter(item => item.count > 0).slice(0, 3);
  game.openJobPack('workshop', 6);
  const options = optionNames();
  $('packgrid').querySelector('button:not(:disabled)').click();
  $('board').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  assert.ok($('ov-pack').classList.contains('show'));
  assert.deepEqual(optionNames(), options);
  assert.equal(game.state.money, 34);
  $('board').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  assert.equal($('ov-pack').classList.contains('show'), false);
  assert.equal(game.state.pendingJobPack, null);
  assert.equal(game.state.workshopPack.sold, true);
  assert.equal(game.state.money, 34);
});

test('workshop utility choices charge only the pack price and deliver their stated run upgrades', t => {
  const {game, $, shop} = createGame(t);
  for (const def of game.WORKSHOP.filter(item => item.count === 0)) {
    game.newRun('utility-' + def.kind);
    shop();
    game.state.workshopPack.options = [def];
    game.openJobPack('workshop', 6);
    $('packgrid').querySelector('button').click();
    assert.equal($('btneditapply').disabled, false, def.name);
    $('btneditapply').click();
    assert.equal(game.state.money, def.kind === 'dividend' ? 46 : 34, def.name);
    assert.equal(game.state.pendingJobPack, null);
    if (def.kind === 'parcel') {
      assert.equal(game.state.cons.length, 2);
      assert.notEqual(game.state.cons[0].id, game.state.cons[1].id);
    }
    if (def.kind === 'pocket') assert.equal(game.state.maxCons, 4);
    if (def.kind === 'tickets') {
      assert.equal(game.state.rerollTickets, 2);
      $('btnreroll').click();
      $('btnreroll').click();
      assert.equal(game.state.rerollTickets, 0);
      assert.equal(game.state.money, 34);
      $('btnreroll').click();
      assert.equal(game.state.money, 29, 'After two free rerolls, regular pricing resumes');
    }
  }
});

test('mixed finish reactions trigger once per pairing, even with Catalyst', t => {
  const {game, setBoard} = createGame(t);
  game.state.charms = [game.makeCharm(game.CHARMS.find(item => item.id === 'alchemist'))];
  setBoard([
    [{v: 4, enh: 'bonus'}, {v: 4, enh: 'mult'}],
    [{v: 4, enh: 'bonus'}, {v: 4, enh: 'mult'}],
  ]);
  game.state.mom = {dir: 'left', count: 1};
  const {merges} = game.slide('left', true);
  const result = game.score(merges, 4);
  const reactions = result.steps.filter(step => step.reaction === 'overprint');
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].chips, 40);
  assert.equal(reactions[0].mult, 2);
  assert.ok(Number.isFinite(result.total) && result.total > 0);
});

test('Tempered saves its Prism merge from shattering and leaves Iron', t => {
  const {game, setBoard} = createGame(t);
  setBoard([[{v: 4, enh: 'glass'}, {v: 4, enh: 'steel'}]]);
  game.state.rng = () => 0; // Every unprotected Prism would shatter.
  game.state.mom = {dir: 'left', count: 1};
  const {merges} = game.slide('left', true);
  const result = game.score(merges, 4);
  assert.equal(game.state.grid[0][0]?.v, 8);
  assert.equal(game.state.grid[0][0]?.enh, 'steel');
  assert.equal(result.steps.filter(step => step.shatter).length, 0);
  assert.equal(result.steps.filter(step => step.reaction === 'tempered').length, 1);
});

test('The Plain disables every mixed finish reaction and its random rolls', t => {
  const {game, setBoard} = createGame(t);
  for (const reaction of game.REACTIONS) {
    game.newRun('plain-' + reaction.id);
    game.state.boss = {id: 'plain'};
    setBoard([[...reaction.pair.map(enh => ({v: 4, enh}))]]);
    game.state.mom = {dir: 'left', count: 1};
    game.state.rng = () => assert.fail('Disabled enhancements must not roll random reactions');
    const {merges} = game.slide('left', true);
    const result = game.score(merges, 4);
    assert.equal(result.steps.filter(step => step.reaction).length, 0, reaction.name);
    assert.equal(result.total, 8, reaction.name);
  }
});
