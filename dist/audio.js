/*
 * Audio for 2048: ANTE.
 *
 * Music stays separate from the seeded game RNG. A screen change changes the
 * room tone and the next-track pool, but never cuts the song already playing.
 * Files are loaded lazily so a sound problem cannot keep the game from starting.
 */
window.AnteAudio = (() => {
  const trackDefs = [
    { id: 'starlight', gainDb: -6.32, title: 'Starlight Lounge', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'bossa', gainDb: -5.84, title: 'Bossa Lounger', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'swing', gainDb: -2.35, title: 'Side Pocket Swing', mood: 'bright', rooms: ['round', 'shop'] },
    { id: 'velvet', gainDb: -4.76, title: 'Velvet Switch', mood: 'low', rooms: ['round', 'boss'] },
    { id: 'wildcard', gainDb: -6.85, title: 'Wildcard Shuffle', mood: 'bright', rooms: ['round', 'boss'] },
    { id: 'fireside', gainDb: -3.36, title: 'After Hours', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'headspin', gainDb: -7.58, title: 'Headspin', mood: 'low', rooms: ['boss', 'loss'] },
    { id: 'highlight', gainDb: -4.94, title: 'House Lights', mood: 'bright', rooms: ['win', 'title', 'shop'] },
    { id: 'blue_mary', gainDb: -7.07, title: 'Mary Margaret Bounce', mood: 'bright', rooms: ['round', 'shop'] },
    { id: 'blue_nitemare', gainDb: -0.25, title: 'Nitemare', mood: 'low', rooms: ['boss', 'loss', 'round'] },
    { id: 'blue_not_afraid', gainDb: -0.01, title: 'Not Afraid', mood: 'warm', rooms: ['title', 'round', 'shop'] },
    { id: 'blue_flores', gainDb: 1.9, title: 'Flores Árvores', mood: 'warm', rooms: ['title', 'shop', 'round'] },
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

  const localFiles = location.protocol === 'file:';
  let localPlayer = null;
  let localLevel = 1;
  let localPlayed = 0;

  // File pages cannot fetch/decode local MP3s in many browsers. Native media
  // playback can read them without routing through a cross-origin audio graph.
  function ensureLocalMusic() {
    if (!unlocked || paused || document.hidden || prefs.muted || !prefs.music) return;
    if (!localPlayer) {
      const name = chooseTrack();
      localPlayer = new Audio(new URL('./audio/' + name + '.mp3', location.href).href);
      localLevel = 10 ** ((trackDefs.find(track => track.id === name)?.gainDb || 0) / 20);
      currentTrack = name;
      recentTracks = [name, ...recentTracks.filter(id => id !== name)].slice(0,3);
      localPlayer.preload = 'auto';
      localPlayer.onended = () => {
        localPlayed += localPlayer.duration || 0;
        if (prefs.track === 'auto' && localPlayed >= 90) {localPlayer = null;localPlayed = 0;}
        else localPlayer.currentTime = 0;
        ensureLocalMusic();
      };
      localPlayer.onerror = () => status('This track could not load. Try another track in Sound.');
    }
    updateLocalLevel();
    if (localPlayer.paused) localPlayer.play().then(() => status('')).catch(() => status('Tap Sound to start the music.'));
  }
  function updateLocalLevel() {
    if (!localPlayer) return;
    const room = scene === 'shop' ? .72 : scene === 'boss' ? .54 : .62;
    localPlayer.volume = Math.max(0,Math.min(1,(prefs.muted || paused || document.hidden ? 0 : prefs.music / 100) * localLevel * room * .72));
  }

  let context;
  let master;
  let musicGain;
  let effectsGain;
  let filter;

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
  const effectBuffers = new Map();
  const effectVoices = new Set();


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
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 3;
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
      trimMusicBuffers(name);
      requests.delete(name);
      return buffer;
    }).catch(() => {
      requests.delete(name);
      return null;
    });
    requests.set(name, request);
    return request;
  }

  function trimMusicBuffers(incoming) {
    // Active sources own their buffers; keep only the current and next song cached.
    const keep = new Set([incoming, ...[...voices].map(voice => voice.name)]);
    for (const name of buffers.keys()) if (!keep.has(name)) buffers.delete(name);
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
    try { if (!paused && !document.hidden) await context.resume(); } catch {
      status('Tap Sound to enable audio.');
      return;
    }
    populateTrackControl();
    ensureMusic();

  }

  function updateLevels() {
    updateLocalLevel();
    if (!context) return;
    const now = context.currentTime;
    const silent = prefs.muted || paused || document.hidden;
    const roomMusic = scene === 'shop' ? 0.72 : scene === 'boss' ? 0.54 : scene === 'win' ? 0.78 : 0.62;
    const roomFilter = scene === 'boss' ? 2300 : scene === 'shop' ? 5800 : scene === 'loss' ? 1800 : 7200;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(silent ? 0 : 0.72, now, 0.07);
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
    if (localPlayer) {localPlayer.pause();localPlayer.src='';localPlayer=null;localPlayed=0;}
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
      queueTrackAt(Math.max(context.currentTime + 0.03, at + 15), generation);
    }, wait);
  }

  function scheduleTrack(name, buffer, at, generation) {
    if (!context || generation !== musicGeneration) return;
    at = Math.max(at, context.currentTime + 0.03);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    // A slow connection cannot leave a silent hole: hold the current song until
    // the next has decoded, then schedule both sides of the same crossfade.
    source.loop = true;
    source.loopEnd = buffer.duration;
    source.connect(gain);
    gain.connect(musicGain);
    const fade = Math.min(2.5, Math.max(0.6, buffer.duration / 4));
    const level = 10 ** ((trackDefs.find(track => track.id === name)?.gainDb || 0) / 20);
    const loopCount = buffer.duration < 90 ? Math.ceil(90 / buffer.duration) : 1;
    const end = at + buffer.duration * loopCount;
    for (const previous of voices) {
      if (previous.ending) continue;
      previous.ending = true;
      previous.gain.gain.setValueAtTime(previous.level, at);
      previous.gain.gain.linearRampToValueAtTime(0, at + fade);
      previous.source.stop(at + fade + 0.02);
    }
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + fade);
    source.start(at);
    const voice = { source, gain, name, at, end, level, ending: false };
    voices.add(voice);
    currentTrack = name;
    recentTracks = [name, ...recentTracks.filter(id => id !== name)].slice(0, 3);
    source.onended = () => {
      voices.delete(voice);
      gain.disconnect();
      source.disconnect();
      trimMusicBuffers(currentTrack);
    };
    if (prefs.track === 'auto') armMusicTimer(end - fade - 15, generation);
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
    if (generation !== musicGeneration) return;
    loadingNext = false;
    if (!loaded) {
      timerDue = null;
      status('Music could not load. Effects are still available.');
      return;
    }
    status('');
    scheduleTrack(name, loaded, at, generation);
  }

  function ensureMusic() {
    if(localFiles){ensureLocalMusic();return;}
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

  function effectsAllowed() {
    return context && unlocked && !prefs.muted && !paused && !document.hidden && prefs.effects > 0;
  }

  function stopEffects() {
    for (const voice of effectVoices) {
      try { voice.stop(); } catch {}
    }
    effectVoices.clear();
  }

  // Short physical sounds: a felted body, pitched wooden modes, and a little
  // surface noise. RMS targets keep their perceived weight consistent; a peak
  // ceiling leaves room for simultaneous slide / merge / reaction feedback.
  function makeEffect(name, value = 0) {
    const presets = {
      click: [.065, 440, -30, 'wood'], slide: [.10, 130, -31, 'brush'],
      merge: [.19, 140, -25, 'impact'],
      bump: [.13, 85, -28, 'wood'], score: [.16, 220, -29, 'wood'],
      buy: [.24, 310, -26, 'pluck'], bank: [.48, 360, -25, 'chord'],
      shuffle: [.24, 180, -29, 'brush'], pack: [.42, 160, -26, 'brush'], rubble: [.23, 75, -28, 'wood'],
      boss: [.65, 86, -28, 'chord'], loss: [.62, 74, -29, 'chord'],
      upgrade: [.40, 390, -25, 'pluck'], reaction: [.33, 330, -25, 'spring'],
      win: [.72, 330, -25, 'chord'], tone: [.12, value || 440, -28, 'pluck'],
    };
    const preset = presets[name];
    if (!preset) return null;
    let [duration, root, target, material] = preset;
    const step = Math.max(0, Math.min(9, Math.round(Number(value?.tier ?? value) || 0)));
    if (name === 'merge') {
      root = 115 * 2 ** (step / 12);
      target = -25 + Math.min(2, step * .2) + Math.min(1.5, (value.count - 1) * .5);
      duration += Math.min(.06, step * .008);
    }
    if (name === 'score') {
      const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
      root *= 2 ** (pentatonic[step] / 12);
      target += Math.min(1.5, step * .18);
    }
    const rate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.ceil(duration * rate), rate);
    const data = buffer.getChannelData(0);
    let noise = 0, seed = 173 + step * 71, sum = 0, peak = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      seed = (1664525 * seed + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      noise += .20 * (white - noise);
      const attack = Math.min(1, t / .002);
      const release = Math.min(1, (duration - t) / .018);
      let sample = 0;
      if (material === 'brush') {
        const flutter = name === 'shuffle' ? .4 + .6 * Math.sin(t * 48) ** 8 : name === 'pack' ? .2 + .8 * Math.sin(t * 97) ** 4 : 1;
        sample = noise * Math.sin(Math.PI * t / duration) ** 1.6 * flutter;
        sample += .08 * Math.sin(2 * Math.PI * root * t) * Math.exp(-t * 38);
        if (name === 'pack' && t > .27) {
          const q = t - .27;
          sample += .45 * Math.sin(2 * Math.PI * 170 * q) * Math.exp(-q * 38) * Math.min(1, q / .002);
        }
      } else {
        const modes = material === 'wood' || material === 'impact' ? [1, 2.76, 5.4] : material === 'spring' ? [1, 1.501, 3.03] : [1, 2, 3];
        for (let k = 0; k < modes.length; k++) {
          const bend = material === 'spring' ? 1 + .09 * Math.exp(-t * 22) : 1;
          sample += Math.sin(2 * Math.PI * root * modes[k] * t * bend) * Math.exp(-t * (12 + k * 17)) / (1 + k * 2.4);
        }
        sample += noise * .45 * Math.exp(-t * 120);
        if (material === 'impact') {
          sample += .8 * Math.sin(2 * Math.PI * (root * .6 * t + .028 * root * (1 - Math.exp(-t * 55)))) * Math.exp(-t * 30);
          sample += .45 * noise * Math.exp(-t * 65);
        }
        if (material === 'chord' || material === 'pluck') {
          for (let k = 1; k <= 2; k++) {
            const q = t - k * (material === 'chord' ? .08 : .033);
            if (q > 0) sample += .4 * Math.sin(2 * Math.PI * root * (k === 1 ? 1.5 : 2) * q) * Math.exp(-q * 10) * Math.min(1, q / .005);
          }
        }
      }
      if (material === 'impact') sample = Math.tanh(sample * 3) / 2;
      data[i] = sample * attack * release;
      sum += data[i] * data[i];
      peak = Math.max(peak, Math.abs(data[i]));
    }
    const rms = Math.sqrt(sum / data.length);
    const gain = Math.min(10 ** (target / 20) / Math.max(rms, .0001), 10 ** (-10 / 20) / Math.max(peak, .0001));
    for (let i = 0; i < data.length; i++) data[i] *= gain;
    return buffer;
  }

  function effect(name, value) {
    if(name === 'slide')return;

    if (!effectsAllowed()) return;
    const gaps = { merge: 90, click: 65, slide: 55, bump: 150, score: 95, buy: 120, bank: 250, shuffle: 160, rubble: 180, boss: 400, loss: 400, upgrade: 160, win: 500, reaction: 180 };
    if (!canFire(name, gaps[name] || 65)) return;
    const step = name === 'score' ? Math.max(0, Math.min(9, Math.round(Number(value) || 0))) : 0;
    const merge = name === 'merge' ? { tier: Math.max(0, Math.min(9, Math.log2(Math.max(4, Number(value?.peak) || 4)) - 2)), count: Math.max(1, Math.min(4, Number(value?.count) || 1)) } : null;
    const key = name + ':' + (merge ? merge.tier + ':' + merge.count : step);
    if (!effectBuffers.has(key)) {
      if (effectBuffers.size >= 48) effectBuffers.delete(effectBuffers.keys().next().value);
      effectBuffers.set(key, makeEffect(name, merge || step));
    }
    const buffer = effectBuffers.get(key);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(effectsGain);
    effectVoices.add(source);
    source.onended = () => { effectVoices.delete(source); source.disconnect(); };
    source.start(context.currentTime);
  }

  function tone(frequency = 440) {
    if (!effectsAllowed()) return;
    const source = context.createBufferSource();
    source.buffer = makeEffect('tone', frequency);
    source.connect(effectsGain);
    effectVoices.add(source);
    source.onended = () => { effectVoices.delete(source); source.disconnect(); };
    source.start(context.currentTime);
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
    if (prefs.muted || prefs.effects === 0) stopEffects();
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

  function syncTransport() {
    updateLevels();
    if(localPlayer && (paused || document.hidden))localPlayer.pause();
    if (paused || document.hidden) {
      stopEffects();
      clearMusicTimer();
      context?.suspend().catch(() => {});
    } else if (unlocked && context) {
      context.resume().then(ensureMusic).catch(() => {});
    }
  }

  function pause(value) {
    paused = !!value;
    syncTransport();
  }

  document.addEventListener('visibilitychange', syncTransport);

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
