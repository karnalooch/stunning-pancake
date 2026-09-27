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

type SynthWaveform = 'sine' | 'square' | 'triangle' | 'sawtooth';

interface SoundDef {
  freq: number;
  durationMs: number;
  waveform: SynthWaveform;
  freq2?: number;
  sweepEndFreq?: number;
}

const FRESH_DEFS: Record<SoundCategory, SoundDef> = {
  ui_click: { freq: 760, durationMs: 45, waveform: 'sine' },
  ui_confirm: { freq: 520, durationMs: 130, waveform: 'triangle', freq2: 660 },
  ui_cancel: { freq: 390, durationMs: 100, waveform: 'triangle', sweepEndFreq: 300 },
  achievement: { freq: 540, durationMs: 320, waveform: 'triangle', freq2: 810 },
  level_up: { freq: 350, durationMs: 260, waveform: 'triangle', sweepEndFreq: 900 },
  coin_pickup: { freq: 1320, durationMs: 65, waveform: 'sine' },
  damage: { freq: 140, durationMs: 120, waveform: 'sawtooth' },
  explosion: { freq: 120, durationMs: 280, waveform: 'sawtooth', freq2: 55 },
};

const SAMPLE_RATE = 44100;
const AMPLITUDE = 0.24;

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

  const wave = (type: SynthWaveform, freq: number, t: number) => {
    const phase = (freq * t) % 1;
    switch (type) {
      case 'square':
        return phase < 0.5 ? 1 : -1;
      case 'triangle':
        return 1 - 4 * Math.abs(Math.round(phase) - phase);
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
    const freq =
      def.sweepEndFreq === undefined
        ? def.freq
        : def.freq + (def.sweepEndFreq - def.freq) * progress;

    let sample = wave(def.waveform, freq, t);
    if (def.freq2 !== undefined) sample += wave(def.waveform, def.freq2, t) * 0.4;

    const envelope = Math.min(1, progress / 0.025) * Math.min(1, (1 - progress) / 0.12);
    sample *= envelope * AMPLITUDE;
    view.setInt16(offset, Math.floor(Math.max(-1, Math.min(1, sample)) * 32767), true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] ?? 0);
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

      for (const [category, def] of Object.entries(FRESH_DEFS) as [SoundCategory, SoundDef][]) {
        const player = createAudioPlayer({ uri: generateWavBase64(def) });
        player.volume = this.volume;
        player.muted = this.isMuted;
        this.players.set(category, player);
      }
      this.initialized = true;
    } catch (error) {
      console.warn('[SoundService] Init failed:', error);
    }
  }

  async play(category: SoundCategory): Promise<void> {
    if (this.isMuted) return;
    const player = this.players.get(category);
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn(`[SoundService] Play failed for "${category}":`, error);
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

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
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
        // no-op
      }
    }
    this.players.clear();
    this.initialized = false;
  }
}

export const SoundService = new SoundServiceImpl();
