/**
 * SoundService — 8-bit arcade SFX via expo-audio (ADR 014).
 * Procedural WAV tones until bundled sfx land in assets/generated/sounds/.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundCategory =
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_cancel'
  | 'achievement'
  | 'level_up'
  | 'coin_pickup'
  | 'damage'
  | 'explosion';

interface SoundDef {
  freq: number;
  durationMs: number;
  waveform: OscillatorType;
  freq2?: number;
  sweepEndFreq?: number;
}

const SOUND_DEFS: Record<SoundCategory, SoundDef> = {
  ui_click: { freq: 800, durationMs: 60, waveform: 'square' },
  ui_confirm: { freq: 523, durationMs: 150, waveform: 'square', freq2: 659 },
  ui_cancel: { freq: 440, durationMs: 120, waveform: 'square', sweepEndFreq: 330 },
  achievement: { freq: 523, durationMs: 400, waveform: 'square', freq2: 784 },
  level_up: { freq: 330, durationMs: 300, waveform: 'square', sweepEndFreq: 880 },
  coin_pickup: { freq: 1760, durationMs: 80, waveform: 'triangle' },
  damage: { freq: 110, durationMs: 150, waveform: 'sawtooth' },
  explosion: { freq: 150, durationMs: 350, waveform: 'sawtooth', freq2: 60 },
};

const SAMPLE_RATE = 44100;
const AMPLITUDE = 0.3;

function generateWavBase64(def: SoundDef): string {
  const numSamples = Math.floor(SAMPLE_RATE * (def.durationMs / 1000));
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const wave = (type: OscillatorType, freq: number, t: number) => {
    const phase = (freq * t) % 1;
    switch (type) {
      case 'square':
        return phase < 0.5 ? 1 : -1;
      case 'triangle':
        return 4 * Math.abs(phase - 0.5) * 2 - 1;
      case 'sawtooth':
        return 2 * phase - 1;
      default:
        return Math.sin(2 * Math.PI * freq * t);
    }
  };

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / numSamples;
    let freq = def.freq;
    if (def.sweepEndFreq !== undefined) {
      freq = def.freq + (def.sweepEndFreq - def.freq) * progress;
    }
    let sample = wave(def.waveform, freq, t);
    if (def.freq2 !== undefined) {
      sample += wave(def.waveform, def.freq2, t) * 0.5;
    }
    const fadeProgress = Math.min(1, (1 - progress) / 0.1);
    const envelope = Math.min(1, progress / 0.02) * fadeProgress;
    sample *= envelope * AMPLITUDE;
    view.setInt16(offset, Math.floor(Math.max(-1, Math.min(1, sample)) * 32767), true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

class SoundServiceImpl {
  private players = new Map<SoundCategory, AudioPlayer>();
  private isMuted = false;
  private volume = 0.7;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });

      const categories = Object.keys(SOUND_DEFS) as SoundCategory[];
      for (const cat of categories) {
        const uri = generateWavBase64(SOUND_DEFS[cat]);
        const player = createAudioPlayer({ uri });
        player.volume = this.volume;
        player.muted = this.isMuted;
        this.players.set(cat, player);
      }
      this.initialized = true;
    } catch (e) {
      console.warn('[SoundService] Init failed:', e);
    }
  }

  async play(category: SoundCategory): Promise<void> {
    if (this.isMuted) return;
    const player = this.players.get(category);
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch (e) {
      console.warn(`[SoundService] Play failed for "${category}":`, e);
    }
  }

  mute(muted: boolean): void {
    this.isMuted = muted;
    this.players.forEach((player) => {
      player.muted = muted;
    });
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.players.forEach((player) => {
      player.volume = this.volume;
    });
  }

  getVolume(): number {
    return this.volume;
  }

  async cleanup(): Promise<void> {
    for (const player of this.players.values()) {
      try {
        player.release();
      } catch {
        /* ignore */
      }
    }
    this.players.clear();
    this.initialized = false;
  }
}

export const SoundService = new SoundServiceImpl();
