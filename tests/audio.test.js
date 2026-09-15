import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code = fs.readFileSync(new URL('../dist/audio.js', import.meta.url), 'utf8');
function rig() {
  let wall = 1000, id = 0;
  const timers = new Map(), sources = [], fetches = [], listeners = {}, contexts = [];
  const param = () => ({ value: 0, events: [], setValueAtTime(...v) { this.events.push(['set', ...v]); }, linearRampToValueAtTime(...v) { this.events.push(['ramp', ...v]); }, setTargetAtTime(...v) { this.events.push(['target', ...v]); }, cancelScheduledValues() {} });
  const node = () => ({ connections: [], connect(to) { this.connections.push(to); }, disconnect() {}, gain: param(), frequency: param() });
  class AudioContext {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'suspended'; this.destination = {}; contexts.push(this); }
    createGain() { return node(); }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
    createBiquadFilter() { return node(); }
    createBuffer(channels, length, rate) { const data = new Float32Array(length); return { duration: length / rate, getChannelData: () => data }; }
    createBufferSource() { const source = { ...node(), start(at) { this.started = at; }, stop(at = contexts[0].currentTime) { this.stopped = at; }, playbackRate: param() }; sources.push(source); return source; }
    decodeAudioData(name) { return Promise.resolve({ name, duration: name.startsWith('blue_') ? 240 : 35 }); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  const sandbox = { window: { AudioContext }, document: { hidden: false, getElementById: () => null, addEventListener: (name, fn) => { listeners[name] = fn; } }, location: { search: '?qa=1' }, localStorage: { getItem: () => null, setItem() {} }, URLSearchParams, performance: { now: () => wall }, Math: Object.assign(Object.create(Math), { random: () => 0 }), setTimeout: (fn, delay) => { timers.set(++id, { fn, at: wall + delay }); return id; }, clearTimeout: key => timers.delete(key), fetch: async url => { const name = url.split('/').pop().replace('.mp3', ''); fetches.push({ name, at: contexts[0].currentTime }); return { ok: true, arrayBuffer: async () => name }; } };
  vm.runInNewContext(code, sandbox);
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  async function advance(seconds) {
    wall += seconds * 1000;
    if (contexts[0]?.state === 'running') contexts[0].currentTime += seconds;
    for (const [key, item] of [...timers]) if (item.at <= wall) { timers.delete(key); item.fn(); }
    for (const source of sources) if (source.stopped !== undefined && source.stopped <= contexts[0].currentTime && !source.ended) { source.ended = true; source.onended?.(); }
    await flush();
  }
  return { audio: sandbox.window.AnteAudio, sandbox, sources, fetches, timers, contexts, advance, flush, listeners };
}

test('scene changes preserve source and preloading begins before the fade', async () => {
  const r = rig(); await r.audio.unlock(); await r.flush();
  assert.equal(r.sources.length, 1);
  const first = r.sources[0]; r.audio.setScene('shop'); r.audio.setIntensity(1);
  assert.equal(r.sources.length, 1); assert.equal(first.stopped, undefined);
  const due = Math.min(...[...r.timers.values()].map(t => t.at));
  await r.advance((due - 1000) / 1000);
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[1].started - r.contexts[0].currentTime >= 14.9);
  assert.ok(r.sources[1].started >= 90);
  assert.equal(first.stopped, r.sources[1].started + 2.52);
});

test('pause and hidden tab freeze song time and resume the same source', async () => {
  const r = rig(); await r.audio.unlock(); await r.flush(); await r.advance(8);
  r.audio.pause(true); const position = r.contexts[0].currentTime;
  await r.advance(120); assert.equal(r.contexts[0].currentTime, position);
  r.audio.pause(false); await r.flush(); assert.equal(r.sources.length, 1);
  await r.advance(2); assert.equal(r.contexts[0].currentTime, position + 2);
  r.sandbox.document.hidden = true; r.listeners.visibilitychange();
  await r.advance(40); assert.equal(r.contexts[0].currentTime, position + 2);
  r.sandbox.document.hidden = false; r.listeners.visibilitychange(); await r.flush();
  assert.equal(r.sources.length, 1);
});

test('manual track loops continuously without auto shuffle timers', async () => {
  const r = rig(); r.audio.set({ track: 'blue_flores' }); await r.audio.unlock(); await r.flush();
  assert.equal(r.sources[0].buffer.name, 'blue_flores'); assert.equal(r.sources[0].loop, true);
  assert.equal(r.timers.size, 0);
});

test('muting kills effect tails and suppresses new sounds without a queued burst', async () => {
  const r = rig(); await r.audio.unlock(); await r.flush(); r.audio.effect('win');
  const effect = r.sources.at(-1); r.audio.set({ muted: true });
  assert.notEqual(effect.stopped, undefined); const count = r.sources.length;
  r.audio.effect('bank'); r.audio.set({ muted: false }); await r.advance(1);
  assert.equal(r.sources.length, count);
});

test('effects have calibrated RMS levels and peak headroom, including reactions', async () => {
  const r = rig(); await r.audio.unlock(); await r.flush();
  const report = [];
  for (const name of ['click', 'bump', 'score', 'merge', 'pack', 'buy', 'bank', 'shuffle', 'rubble', 'boss', 'loss', 'upgrade', 'reaction', 'win']) {
    await r.advance(1); r.audio.effect(name, 3);
    const data = r.sources.at(-1).buffer.getChannelData(0);
    let peak = 0, sum = 0;
    for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
    const rmsDb = 20 * Math.log10(Math.sqrt(sum / data.length)), peakDb = 20 * Math.log10(peak);
    assert.ok(peakDb <= -9.99, `${name} peak ${peakDb}`);
    assert.ok(rmsDb >= -32 && rmsDb <= -23, `${name} RMS ${rmsDb}`);
    report.push({ name, rmsDb: +rmsDb.toFixed(2), peakDb: +peakDb.toFixed(2) });
  }
  fs.writeFileSync('/tmp/ante-effects-levels.json', JSON.stringify(report, null, 2));
});


test('a slow next-track load cannot fade out the current source prematurely', async () => {
  const r = rig(); await r.audio.unlock(); await r.flush();
  let deliver;
  r.sandbox.fetch = () => new Promise(resolve => { deliver = () => resolve({ ok: true, arrayBuffer: async () => 'bossa' }); });
  const due = Math.min(...[...r.timers.values()].map(t => t.at));
  await r.advance((due - 1000) / 1000);
  assert.equal(r.sources[0].stopped, undefined);
  await r.advance(30); assert.equal(r.sources[0].stopped, undefined);
  deliver(); await r.flush();
  assert.ok(r.sources[1].started > r.contexts[0].currentTime);
  assert.equal(r.sources[0].loop, true);
});

test('larger multi-merges gain weight while keeping the same peak ceiling', async () => {
  const r = rig(); await r.audio.unlock(); await r.flush();
  r.audio.effect('merge', { count: 1, peak: 4 });
  const small = r.sources.at(-1).buffer.getChannelData(0);
  await r.advance(1); r.audio.effect('merge', { count: 4, peak: 512 });
  const large = r.sources.at(-1).buffer.getChannelData(0);
  const rms = data => Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
  assert.ok(rms(large) > rms(small));
  assert.ok(Math.max(...large.map(Math.abs)) <= .3163);
});


test('calibrated per-track gain is applied before music reaches the shared bus', async () => {
  const r = rig(); r.audio.set({ track: 'blue_not_afraid' }); await r.audio.unlock(); await r.flush();
  const definition = r.audio.tracks().find(track => track.id === 'blue_not_afraid');
  assert.equal(definition.gainDb, -.01);
  const gain = r.sources[0].connections[0].gain;
  const ramp = gain.events.find(event => event[0] === 'ramp');
  assert.ok(Math.abs(ramp[1] - 10 ** (definition.gainDb / 20)) < 1e-9);
  assert.equal(r.audio.tracks().filter(track => Number.isFinite(track.gainDb)).length, 12);
});
