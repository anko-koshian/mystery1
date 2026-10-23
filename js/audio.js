/* Tiny WebAudio synth: no audio files needed. */
(function (global) {
  'use strict';
  let ac = null;
  let enabled = true;

  function ctx() {
    if (!enabled) return null;
    if (!ac) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function noiseBuffer(a, secs) {
    const b = a.createBuffer(1, Math.floor(a.sampleRate * secs), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function env(a, node, t0, peak, attack, decay) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    g.connect(a.destination);
    return g;
  }

  function noise(a, t0, secs, peak, type, freq, q) {
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a, secs + 0.1);
    const f = a.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq || 1000;
    f.Q.value = q || 0.7;
    src.connect(f);
    env(a, f, t0, peak, 0.005, secs);
    src.start(t0);
    src.stop(t0 + secs + 0.1);
  }

  function tone(a, t0, freq, secs, peak, type) {
    const o = a.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    env(a, o, t0, peak, 0.01, secs);
    o.start(t0);
    o.stop(t0 + secs + 0.05);
    return o;
  }

  const SFX = {
    tick() {
      const a = ctx(); if (!a) return;
      const t = a.currentTime;
      tone(a, t, 2400, 0.03, 0.05, 'square');
      tone(a, t + 0.012, 1600, 0.03, 0.03, 'square');
    },
    sting() {
      const a = ctx(); if (!a) return;
      const t = a.currentTime;
      [55, 58.3, 82.4, 110.6].forEach((f, i) => tone(a, t + i * 0.02, f, 3.2, 0.09, 'sawtooth'));
      noise(a, t, 1.4, 0.25, 'bandpass', 600, 0.6);
      tone(a, t, 880, 2.2, 0.03, 'triangle');
    },
    shot() { const a = ctx(); if (!a) return; const t = a.currentTime; noise(a, t, 0.5, 0.9, 'lowpass', 2400); tone(a, t, 70, 0.4, 0.4); },
    stab() { const a = ctx(); if (!a) return; const t = a.currentTime; tone(a, t, 90, 0.25, 0.5); noise(a, t, 0.18, 0.3, 'bandpass', 900, 2); },
    clash() {
      const a = ctx(); if (!a) return; const t = a.currentTime;
      [1830, 2410, 3170, 4020].forEach((f) => tone(a, t, f, 0.7, 0.06, 'square'));
      noise(a, t, 0.1, 0.4, 'highpass', 3000);
    },
    glass() { const a = ctx(); if (!a) return; const t = a.currentTime; for (let i = 0; i < 9; i++) tone(a, t + Math.random() * 0.25, 2500 + Math.random() * 3500, 0.25, 0.05); },
    crash() { const a = ctx(); if (!a) return; const t = a.currentTime; noise(a, t, 2.2, 0.9, 'lowpass', 500); tone(a, t, 42, 1.4, 0.5); },
    storm() { const a = ctx(); if (!a) return; const t = a.currentTime; noise(a, t, 2.6, 0.5, 'lowpass', 300); noise(a, t + 0.3, 2.2, 0.15, 'highpass', 4000); },
    silence() {},
    lock() {
      const a = ctx(); if (!a) return; const t = a.currentTime;
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(a, t + i * 0.11, f, 1.2, 0.12, 'triangle'));
    },
    page() { const a = ctx(); if (!a) return; noise(a, a.currentTime, 0.12, 0.12, 'highpass', 2500); },
  };

  global.SFX = {
    play(name) { try { if (SFX[name]) SFX[name](); } catch (e) { /* audio is optional */ } },
    unlock() { try { ctx(); } catch (e) { /* ignore */ } },
    set enabled(v) { enabled = !!v; },
    get enabled() { return enabled; },
  };
})(window);
