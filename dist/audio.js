/*
 * Audio for 2048: ANTE.
 *
 * Music stays separate from the seeded game RNG. A screen change changes the
 * room tone and the next-track pool, but never cuts the song already playing.
 * Files are loaded lazily so a sound problem cannot keep the game from starting.
 */
window.AnteAudio = (() => {
  const trackDefs = [
    { id: 'starlight', title: 'Starlight Lounge', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'bossa', title: 'Bossa Lounger', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'swing', title: 'Side Pocket Swing', mood: 'bright', rooms: ['round', 'shop'] },
    { id: 'velvet', title: 'Velvet Switch', mood: 'low', rooms: ['round', 'boss'] },
    { id: 'wildcard', title: 'Wildcard Shuffle', mood: 'bright', rooms: ['round', 'boss'] },
    { id: 'fireside', title: 'After Hours', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'headspin', title: 'Headspin', mood: 'low', rooms: ['boss', 'loss'] },
    { id: 'highlight', title: 'House Lights', mood: 'bright', rooms: ['win', 'title', 'shop'] },
  ];
  const tracks = trackDefs.map(track => track.id);
  const defaults = { music: 24, effects: 65, track: 'auto', muted: false };
  const storageKey = new URLSearchParams(location.search).has('qa') ? 'ante2048.qa.audio' : 'ante2048.audio';

  let prefs = { ...defaults };
  try { prefs = { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch {}
  for (const key of ['music', 'effects']) {
    const value = Number(prefs[key]);
    prefs[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : defaults[key];
  }
  if (!['auto', ...tracks].includes(prefs.track)) prefs.track = defaults.track;

  let context;
  let master;
  let musicGain;
  let effectsGain;
  let filter;
  let ready;
  let musicTimer = null;
  let timerDue = null;
  let loadingNext = false;
  let unlocked = false;
  let paused = false;
  let scene = 'title';
  let intensity = 0;
  let musicGeneration = 0;
  let currentTrack = null;
  let recentTracks = [];
  const buffers = new Map();
  const requests = new Map();
  const voices = new Set();
  const lastEffect = new Map();
  let lastClick = 0;

  const status = message => {
    const node = document.getElementById('audiostatus');
    if (node) node.textContent = message;
  };

  function create() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.65;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    master.connect(limiter);
    limiter.connect(context.destination);

    musicGain = context.createGain();
    effectsGain = context.createGain();
    filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 7200;
    musicGain.connect(filter);
    filter.connect(master);
    effectsGain.connect(master);
    updateLevels();
    populateTrackControl();
  }

  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (requests.has(name)) return requests.get(name);
    const request = fetch(`./audio/${name}.mp3`).then(response => {
      if (!response.ok) throw new Error('Audio unavailable');
      return response.arrayBuffer();
    }).then(data => context.decodeAudioData(data)).then(buffer => {
      buffers.set(name, buffer);
      requests.delete(name);
      return buffer;
    }).catch(() => {
      requests.delete(name);
      return null;
    });
    requests.set(name, request);
    return request;
  }

  function populateTrackControl() {
    const select = document.getElementById('track');
    if (!select) return;
    const existing = new Set([...select.options].map(option => option.value));
    if (!existing.has('auto')) {
      const option = document.createElement('option');
      option.value = 'auto';
      option.textContent = 'Auto · follow the room';
      select.insertBefore(option, select.firstChild);
    }
    trackDefs.forEach(track => {
      let option = [...select.options].find(item => item.value === track.id);
      if (!option) {
        option = document.createElement('option');
        option.value = track.id;
        select.appendChild(option);
      }
      if (!option.dataset.customLabel) option.textContent = track.title;
    });
    select.value = prefs.track;
  }

  async function unlock() {
    create();
    if (!context) {
      status('Audio is unavailable in this browser.');
      return;
    }
    unlocked = true;
    try { await context.resume(); } catch {
      status('Tap Sound to enable audio.');
      return;
    }
    populateTrackControl();
    ready ||= Promise.all(['switch', 'coin', 'ratchet', 'cash'].map(load));
    ensureMusic();
    return ready;
  }

  function updateLevels() {
    if (!context) return;
    const now = context.currentTime;
    const silent = prefs.muted || paused || document.hidden;
    const roomMusic = scene === 'shop' ? 0.72 : scene === 'boss' ? 0.54 : scene === 'win' ? 0.78 : 0.62;
    const roomFilter = scene === 'boss' ? 2300 : scene === 'shop' ? 5800 : scene === 'loss' ? 1800 : 7200;
    master.gain.setTargetAtTime(silent ? 0 : 0.65, now, 0.07);
    const energy = 0.72 + intensity * 0.28;
    musicGain.gain.setTargetAtTime((prefs.music / 100) * roomMusic * energy, now, 0.4);
    effectsGain.gain.setTargetAtTime(prefs.effects / 100, now, 0.03);
    filter.frequency.setTargetAtTime(roomFilter * (0.88 + intensity * 0.12), now, 0.8);
  }

  function setIntensity(value) {
    const next = Number(value);
    intensity = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
    updateLevels();
  }

  function clearMusicTimer() {
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null;
  }

  function stopMusic() {
    musicGeneration++;
    clearMusicTimer();
    timerDue = null;
    loadingNext = false;
    for (const voice of voices) {
      try { voice.source.stop(); } catch {}
      voice.gain.disconnect();
    }
    voices.clear();
    currentTrack = null;
  }

  function chooseTrack() {
    if (prefs.track !== 'auto') return prefs.track;
    const inRoom = trackDefs.filter(track => track.rooms.includes(scene));
    const pool = inRoom.length ? inRoom : trackDefs;
    const fresh = pool.filter(track => track.id !== currentTrack && !recentTracks.includes(track.id));
    const candidates = fresh.length ? fresh : pool.filter(track => track.id !== currentTrack);
    const selected = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length ? candidates.length : pool.length))];
    return selected.id;
  }

  function armMusicTimer(at, generation) {
    clearMusicTimer();
    timerDue = at;
    if (!context || generation !== musicGeneration) return;
    const wait = Math.max(16, (at - context.currentTime) * 1000);
    musicTimer = setTimeout(() => {
      musicTimer = null;
      if (generation !== musicGeneration || paused || document.hidden) return;
      timerDue = null;
      queueTrackAt(Math.max(context.currentTime + 0.03, at), generation);
    }, wait);
  }

  function scheduleTrack(name, buffer, at, generation) {
    if (!context || generation !== musicGeneration || paused || document.hidden) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(musicGain);
    const fade = Math.min(2.5, Math.max(0.6, buffer.duration / 4));
    const end = at + buffer.duration;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + fade);
    gain.gain.setValueAtTime(1, Math.max(at + fade, end - fade));
    gain.gain.linearRampToValueAtTime(0, end);
    source.start(at);
    source.stop(end + 0.02);
    const voice = { source, gain, name, at, end };
    voices.add(voice);
    currentTrack = name;
    recentTracks = [name, ...recentTracks.filter(id => id !== name)].slice(0, 3);
    source.onended = () => {
      voices.delete(voice);
      gain.disconnect();
      source.disconnect();
    };
    armMusicTimer(end - fade, generation);
  }

  async function queueTrackAt(at, generation) {
    if (loadingNext || !context || generation !== musicGeneration || paused || document.hidden) return;
    loadingNext = true;
    const candidates = prefs.track === 'auto'
      ? trackDefs.filter(track => track.rooms.includes(scene)).map(track => track.id)
      : [prefs.track];
    const ordered = [...new Set([chooseTrack(), ...candidates])];
    let loaded = null;
    let name = null;
    for (const candidate of ordered) {
      const buffer = await load(candidate);
      if (buffer) { loaded = buffer; name = candidate; break; }
    }
    loadingNext = false;
    if (generation !== musicGeneration || paused || document.hidden) return;
    if (!loaded) {
      timerDue = null;
      status('Music could not load. Effects are still available.');
      return;
    }
    status('');
    scheduleTrack(name, loaded, at, generation);
  }

  function ensureMusic() {
    if (!context || !unlocked || paused || document.hidden || prefs.muted || prefs.music === 0) return;
    const generation = musicGeneration;
    if (timerDue !== null && !musicTimer) {
      armMusicTimer(timerDue, generation);
      return;
    }
    if (!voices.size && !loadingNext) queueTrackAt(context.currentTime + 0.03, generation);
  }

  function restartMusic() {
    stopMusic();
    ensureMusic();
  }

  function canFire(name, gap) {
    const now = performance.now();
    const previous = lastEffect.get(name) || 0;
    if (now - previous < gap) return false;
    lastEffect.set(name, now);
    return true;
  }

  function sample(name, level = 0.4, rate = 1) {
    if (!context || !unlocked || prefs.muted || paused || document.hidden || !prefs.effects) return;
    const buffer = buffers.get(name);
    if (!buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = level;
    source.connect(gain);
    gain.connect(effectsGain);
    source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  function tone(frequency = 440, duration = 0.12, level = 0.1) {
    if (!context || !unlocked || prefs.muted || paused || document.hidden || !prefs.effects) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(effectsGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  function effect(name, value) {
    const gaps = { click: 65, slide: 45, bump: 150, score: 95, buy: 100, bank: 180, shuffle: 160, rubble: 180, boss: 300, loss: 300, upgrade: 160, win: 400 };
    if (!canFire(name, gaps[name] || 55)) return;
    if (name === 'click') {
      if (performance.now() - lastClick < 65) return;
      lastClick = performance.now();
      sample('switch', 0.38);
    } else if (name === 'slide') sample('switch', 0.24, 0.75);
    else if (name === 'bump') sample('ratchet', 0.14, 0.6);
    // Merges get a quiet pitched tick; keep the cash register texture for purchases.
    // This preserves the feedback without turning a long chain into a coin shower.
    else if (name === 'score') tone(180 + Math.min(12, Number(value) || 0) * 12, 0.075, 0.026);
    else if (name === 'buy' || name === 'bank') sample('cash', name === 'bank' ? 0.58 : 0.32);
    else if (name === 'shuffle') sample('ratchet', 0.28, 1.15);
    else if (name === 'rubble') sample('ratchet', 0.20, 0.65);
    else if (name === 'boss' || name === 'loss') { sample('ratchet', 0.30, 0.55); tone(110, 0.5, 0.08); }
    else if (name === 'upgrade') { sample('coin', 0.18, 1.2); tone(660, 0.24, 0.06); }
    else if (name === 'win') {
      sample('cash', 0.50);
      [0, 4, 7, 12].forEach((note, i) => setTimeout(() => tone(330 * 2 ** (note / 12), 0.25, 0.07), i * 85));
    }
  }

  function set(values) {
    const old = { ...prefs };
    Object.assign(prefs, values);
    for (const key of ['music', 'effects']) {
      const value = Number(prefs[key]);
      prefs[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : defaults[key];
    }
    if (!['auto', ...tracks].includes(prefs.track)) prefs.track = defaults.track;
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch {}
    updateLevels();
    if (old.track !== prefs.track) restartMusic();
    else if ((old.music === 0 && prefs.music > 0) || (old.muted && !prefs.muted)) ensureMusic();
  }

  function setScene(next) {
    if (!['title', 'round', 'shop', 'boss', 'win', 'loss'].includes(next)) return;
    scene = next;
    updateLevels();
    // The room changes its filter and future-track choices; the current song continues.
  }

  function pause(value) {
    paused = !!value;
    updateLevels();
    // Mute the bus but preserve source position and crossfade timing.
    if (!paused) ensureMusic();
  }

  document.addEventListener('visibilitychange', () => {
    updateLevels();
    if (document.hidden) {
      // AudioContext time does not advance while suspended, so keep the due
      // boundary and re-arm it when the tab returns.
      clearMusicTimer();
      context?.suspend().catch(() => {});
    } else if (unlocked) {
      context?.resume().catch(() => {});
      ensureMusic();
    }
  });

  // The audio script is loaded at the end of the page, so the turntable can
  // show every installed track before the settings sheet is first opened.
  populateTrackControl();

  return {
    unlock,
    effect,
    tone,
    set,
    setScene,
    setIntensity,
    pause,
    preferences: () => ({ ...prefs }),
    tracks: () => trackDefs.map(track => ({ ...track })),
  };
})();
