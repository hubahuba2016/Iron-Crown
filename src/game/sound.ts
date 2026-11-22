import type { GameState } from './types';

const MUTE_STORAGE_KEY = 'iron_crown_muted';
const MUSIC_STORAGE_KEY = 'iron_crown_music_enabled';

const BPM = 124;
const STEP_SEC = 60 / BPM / 4; // 16th note (~0.12097s)
const STEPS_PER_BAR = 16;
const TOTAL_BARS = 8;

interface ChordBar {
  bass: number;
  pad: number[];
  lead: (number | null)[];
}

// 8-bar sci-fi action progression in D minor (Dm - Dm - Bb - C - Dm - F - Gm - A)
const PROGRESSION: ChordBar[] = [
  {
    // Bar 0: Dm
    bass: 73.42, // D2
    pad: [146.83, 220.0, 349.23], // D3, A3, F4
    lead: [587.33, null, 698.46, null, 659.25, null, 587.33, null, 523.25, null, 587.33, null, 440.0, null, null, null],
  },
  {
    // Bar 1: Dm
    bass: 73.42, // D2
    pad: [146.83, 220.0, 349.23],
    lead: [587.33, null, 698.46, null, 880.0, null, 783.99, null, 698.46, null, 659.25, null, 587.33, null, 523.25, null],
  },
  {
    // Bar 2: Bb
    bass: 58.27, // Bb1
    pad: [116.54, 174.61, 293.66], // Bb2, F3, D4
    lead: [466.16, null, 587.33, null, 698.46, null, 587.33, null, 659.25, null, 587.33, null, 523.25, null, null, null],
  },
  {
    // Bar 3: C
    bass: 65.41, // C2
    pad: [130.81, 196.0, 329.63], // C3, G3, E4
    lead: [523.25, null, 659.25, null, 783.99, null, 659.25, null, 698.46, null, 659.25, null, 587.33, null, 523.25, null],
  },
  {
    // Bar 4: Dm
    bass: 73.42, // D2
    pad: [146.83, 220.0, 349.23],
    lead: [587.33, null, 880.0, null, 783.99, null, 698.46, null, 659.25, null, 587.33, null, 440.0, null, 523.25, null],
  },
  {
    // Bar 5: F
    bass: 87.31, // F2
    pad: [174.61, 261.63, 349.23], // F3, C4, F4
    lead: [698.46, null, 880.0, null, 1046.5, null, 880.0, null, 783.99, null, 698.46, null, 659.25, null, null, null],
  },
  {
    // Bar 6: Gm
    bass: 98.0, // G2
    pad: [196.0, 233.08, 293.66], // G3, Bb3, D4
    lead: [783.99, null, 698.46, null, 587.33, null, 698.46, null, 587.33, null, 523.25, null, 466.16, null, null, null],
  },
  {
    // Bar 7: A (turnaround)
    bass: 55.0, // A1
    pad: [110.0, 220.0, 277.18], // A2, A3, C#4
    lead: [440.0, null, 554.37, null, 659.25, null, 880.0, null, 783.99, null, 659.25, null, 554.37, null, 493.88, null],
  },
];

// Driving 16th-note synthwave bass pattern: 1 = root, 2 = octave up, 0 = rest
const BASS_PATTERN = [1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2];
const MENU_BASS_PATTERN = [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private musicEchoSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private musicEnabled = true;
  private gameState: GameState = 'TITLE_MENU';

  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private currentBar = 0;
  private visibilityBound = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
      const storedMusic = localStorage.getItem(MUSIC_STORAGE_KEY);
      this.musicEnabled = storedMusic === null ? true : storedMusic === 'true';
    } catch {
      this.muted = false;
      this.musicEnabled = true;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(mute));
    } catch {
      // Ignore storage errors in restricted iframes
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 1, now, 0.03);
    }

    if (mute) {
      this.stopMusicLoop();
    } else {
      this.unlock();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage errors in restricted iframes
    }

    this.applyMusicMix();
    if (!enabled) {
      this.stopMusicLoop();
    } else if (!this.muted) {
      this.unlock();
    }
  }

  public toggleMusic(): boolean {
    this.setMusicEnabled(!this.musicEnabled);
    return this.musicEnabled;
  }

  public setGameState(nextState: GameState): void {
    const prevState = this.gameState;
    this.gameState = nextState;

    // Reset groove cleanly on new run start
    if (prevState !== 'PLAYING' && nextState === 'PLAYING' && prevState !== 'PAUSED') {
      this.currentBar = 0;
      this.currentStep = 0;
      if (this.ctx) {
        this.nextStepTime = this.ctx.currentTime + 0.05;
      }
    }

    this.applyMusicMix();

    if (nextState === 'GAME_OVER') {
      // Let pad fade cleanly and halt beat loop
      this.stopMusicLoop();
    } else if (!this.muted && this.musicEnabled && this.ctx && this.ctx.state === 'running') {
      this.startMusicLoop();
    }
  }

  public unlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (!this.muted && this.musicEnabled && this.gameState !== 'GAME_OVER') {
            this.startMusicLoop();
          }
        })
        .catch(() => {});
    } else if (this.musicEnabled && this.gameState !== 'GAME_OVER') {
      this.startMusicLoop();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.ctx = ctx;
        this.setupAudioGraph(ctx);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private setupAudioGraph(ctx: AudioContext): void {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;

    const masterGain = ctx.createGain();
    masterGain.gain.value = this.muted ? 0 : 1;

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.95;

    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 16000;
    musicFilter.Q.value = 0.7;

    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.34;

    // Subtle rhythmic synthwave delay bus
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = STEP_SEC * 3; // Dotted 8th echo
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.28;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2400;
    const musicEchoSend = ctx.createGain();
    musicEchoSend.gain.value = 0.22;

    delay.connect(delayTone);
    delayTone.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayTone.connect(musicFilter);
    musicEchoSend.connect(delay);

    musicFilter.connect(musicGain);
    musicGain.connect(compressor);
    sfxGain.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Pre-generate shared noise buffer
    const bufLen = Math.floor(ctx.sampleRate * 0.3);
    const noiseBuffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      channel[i] = Math.random() * 2 - 1;
    }

    this.compressor = compressor;
    this.masterGain = masterGain;
    this.sfxGain = sfxGain;
    this.musicFilter = musicFilter;
    this.musicGain = musicGain;
    this.musicEchoSend = musicEchoSend;
    this.noiseBuffer = noiseBuffer;

    this.applyMusicMix();

    if (!this.visibilityBound && typeof document !== 'undefined') {
      this.visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopMusicLoop();
        } else if (!this.muted && this.musicEnabled && this.gameState !== 'GAME_OVER') {
          if (this.ctx && this.ctx.state === 'running') {
            this.nextStepTime = this.ctx.currentTime + 0.06;
            this.startMusicLoop();
          }
        }
      });
    }
  }

  private applyMusicMix(): void {
    if (!this.ctx || !this.musicGain || !this.musicFilter) return;
    const now = this.ctx.currentTime;

    let targetGain = 0;
    let targetCutoff = 16000;

    if (!this.muted && this.musicEnabled) {
      if (this.gameState === 'PLAYING') {
        targetGain = 0.34;
        targetCutoff = 16000;
      } else if (this.gameState === 'TITLE_MENU') {
        targetGain = 0.24;
        targetCutoff = 2200;
      } else if (this.gameState === 'PAUSED') {
        targetGain = 0.12;
        targetCutoff = 440;
      } else {
        targetGain = 0;
        targetCutoff = 600;
      }
    }

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.musicFilter.frequency.cancelScheduledValues(now);
    this.musicFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);
  }

  private startMusicLoop(): void {
    if (this.schedulerTimer !== null || this.muted || !this.musicEnabled) return;
    if (!this.ctx || this.gameState === 'GAME_OVER') return;
    if (typeof document !== 'undefined' && document.hidden) return;

    this.nextStepTime = Math.max(this.nextStepTime, this.ctx.currentTime + 0.04);
    this.schedulerTimer = window.setInterval(() => {
      this.scheduleMusicAhead();
    }, 25);
  }

  private stopMusicLoop(): void {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleMusicAhead(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.muted || !this.musicEnabled) return;
    if (this.gameState === 'GAME_OVER') return;

    const lookahead = 0.12;
    // Prevent catch-up flood if timer stalled briefly
    if (this.nextStepTime < ctx.currentTime - 0.25) {
      this.nextStepTime = ctx.currentTime + 0.04;
    }

    while (this.nextStepTime < ctx.currentTime + lookahead) {
      this.triggerMusicStep(this.currentBar, this.currentStep, this.nextStepTime);
      this.nextStepTime += STEP_SEC;
      this.currentStep += 1;
      if (this.currentStep >= STEPS_PER_BAR) {
        this.currentStep = 0;
        this.currentBar = (this.currentBar + 1) % TOTAL_BARS;
      }
    }
  }

  private triggerMusicStep(bar: number, step: number, time: number): void {
    if (!this.ctx || !this.musicFilter) return;

    const chord = PROGRESSION[bar];
    const isPlaying = this.gameState === 'PLAYING';
    const isMenu = this.gameState === 'TITLE_MENU';
    const isPaused = this.gameState === 'PAUSED';

    // 1. Warm ambient sci-fi pad on beat 0 of every bar
    if (step === 0) {
      this.playPadChord(chord.pad, time, STEP_SEC * STEPS_PER_BAR * 1.04, isMenu ? 0.11 : 0.075);
    }

    // 2. Synthwave Bassline
    const bassHit = isPlaying ? BASS_PATTERN[step] : MENU_BASS_PATTERN[step];
    if (bassHit > 0 && !isPaused) {
      const freq = bassHit === 2 ? chord.bass * 2 : chord.bass;
      this.playBassNote(freq, time, isPlaying ? STEP_SEC * 0.85 : STEP_SEC * 1.4, isPlaying ? 0.22 : 0.13);
    }

    // 3. Driving Drums (active gameplay only, ducked pause skips hard transients)
    if (isPlaying) {
      const isFillBar = bar === 3 || bar === 7;
      if (step === 0 || step === 4 || step === 8 || step === 12 || (bar % 2 === 1 && step === 14)) {
        this.playKick(time);
      }
      if (step === 4 || step === 12 || (isFillBar && (step === 14 || step === 15))) {
        this.playSnare(time, step >= 14 ? 0.12 : 0.18);
      }
      if (step % 2 === 0) {
        const accented = step % 4 === 2;
        this.playHiHat(time, accented ? 0.095 : 0.045, accented && step === 14);
      } else if (bar >= 2 && step % 4 === 3) {
        this.playHiHat(time, 0.032, false);
      }
    }

    // 4. Heroic Lead Melody
    const leadFreq = chord.lead[step];
    if (leadFreq && isPlaying) {
      this.playLeadNote(leadFreq, time, STEP_SEC * 1.65, 0.105);
    }
  }

  private playPadChord(freqs: number[], time: number, duration: number, level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(780, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.28);
    gain.gain.setValueAtTime(level * 0.88, time + duration - 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    padFilter.connect(gain);
    gain.connect(this.musicFilter);
    if (this.musicEchoSend) {
      gain.connect(this.musicEchoSend);
    }

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, time);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 10, time);
      osc.connect(padFilter);
      osc.start(time);
      osc.stop(time + duration + 0.03);
    }
  }

  private playBassNote(freq: number, time: number, duration: number, level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2.6;
    filter.frequency.setValueAtTime(980, time);
    filter.frequency.exponentialRampToValueAtTime(210, time + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);

    osc.start(time);
    sub.start(time);
    osc.stop(time + duration + 0.02);
    sub.stop(time + duration + 0.02);
  }

  private playLeadNote(freq: number, time: number, duration: number, level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;

    const oscA = ctx.createOscillator();
    oscA.type = 'square';
    oscA.frequency.setValueAtTime(freq, time);
    oscA.detune.setValueAtTime(-5, time);

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(freq, time);
    oscB.detune.setValueAtTime(6, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.frequency.exponentialRampToValueAtTime(1100, time + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    if (this.musicEchoSend) {
      gain.connect(this.musicEchoSend);
    }

    oscA.start(time);
    oscB.start(time);
    oscA.stop(time + duration + 0.02);
    oscB.stop(time + duration + 0.02);
  }

  private playKick(time: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(132, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.095);

    gain.gain.setValueAtTime(0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playSnare(time: number, level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter || !this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1850, time);
    filter.Q.value = 0.85;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(level, time);
    nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.musicFilter);
    noise.start(time);
    noise.stop(time + 0.14);

    // Subtle tonal body
    const body = ctx.createOscillator();
    const bGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(195, time);
    body.frequency.exponentialRampToValueAtTime(110, time + 0.06);
    bGain.gain.setValueAtTime(level * 0.55, time);
    bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    body.connect(bGain);
    bGain.connect(this.musicFilter);
    body.start(time);
    body.stop(time + 0.08);
  }

  private playHiHat(time: number, level: number, open: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter || !this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, time);

    const dur = open ? 0.11 : 0.036;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  private getSfxTarget(): AudioNode | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return null;
    return this.sfxGain;
  }

  public playShoot(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.085);

    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(target);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playJump(isDouble: boolean): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isDouble ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isDouble ? 290 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(isDouble ? 640 : 460, now + 0.14);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(target);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playEnemyHit(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.05);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(target);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    noise.start(now);
  }

  public playShieldOn(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.16);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(target);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playDeflect(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(target);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playPickup(isHeal: boolean): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const notes = isHeal ? [523.25, 659.25, 783.99] : [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(target);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playDamage(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(target);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    const target = this.getSfxTarget();
    if (!ctx || !target) return;

    const now = ctx.currentTime;
    const freqs = [330, 261.6, 196, 130.8];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.11;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(target);
      osc.start(t);
      osc.stop(t + 0.21);
    });
  }
}

export const sound = new SoundEngine();
