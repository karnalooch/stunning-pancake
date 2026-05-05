/**
 * SoundService — 8-bit arcade SFX engine powered by expo-av.
 *
 * Provides retro game sound effects inspired by Metal Slug / classic
 * arcade cabinets. Sounds are generated programmatically as simple
 * synthesized tones since we don't bundle actual .wav/.mp3 files.
 *
 * Sound Categories (Metal Slug / 8-bit era descriptors):
 *   - ui_click       — metallic short click (menu navigation)
 *   - ui_confirm     — ascending chime (purchase, confirm)
 *   - ui_cancel      — descending blip (back, cancel)
 *   - achievement    — triumphant ascending arpeggio
 *   - level_up       — ascending energy burst
 *   - coin_pickup    — short metallic "clink"
 *   - damage         — low thud/hit
 *   - explosion      — chunky explosion burst
 *
 * Usage:
 *   import { SoundService, SoundCategory } from '../services/SoundService';
 *   SoundService.init();
 *   SoundService.play('ui_click');
 *   SoundService.mute(true);
 *   SoundService.cleanup();
 */

import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';

// ─── Types ──────────────────────────────────────────────────────────

/** All recognized sound effect categories */
export type SoundCategory =
    | 'ui_click'
    | 'ui_confirm'
    | 'ui_cancel'
    | 'achievement'
    | 'level_up'
    | 'coin_pickup'
    | 'damage'
    | 'explosion';

// ─── Sound Definitions ──────────────────────────────────────────────

/**
 * Each sound category maps to a simple synthesized tone descriptor.
 * In production, these would be replaced with actual .wav/.mp3 file
 * paths (e.g. require('../../assets/sfx/ui_click.wav')).
 *
 * Currently using expo-av's ability to play base64-encoded WAV data
 * generated from simple tone parameters.
 */
interface SoundDef {
    /** Frequency in Hz for the primary tone */
    freq: number;
    /** Duration in milliseconds */
    durationMs: number;
    /** Type of waveform: 'sine', 'square', 'triangle', 'sawtooth' */
    waveform: OscillatorType;
    /** Optional secondary tone frequency for layered/chord sounds */
    freq2?: number;
    /** Optional frequency sweep target (for rising/falling effects) */
    sweepEndFreq?: number;
}

const SOUND_DEFS: Record<SoundCategory, SoundDef> = {
    ui_click: {
        freq: 800,
        durationMs: 60,
        waveform: 'square', // metallic short click
    },
    ui_confirm: {
        freq: 523,
        durationMs: 150,
        waveform: 'square',
        freq2: 659, // C5 → E5 ascending chime
    },
    ui_cancel: {
        freq: 440,
        durationMs: 120,
        waveform: 'square',
        sweepEndFreq: 330, // descending blip
    },
    achievement: {
        freq: 523,
        durationMs: 400,
        waveform: 'square',
        freq2: 784, // C5 → E5 → G5 arpeggio feel
    },
    level_up: {
        freq: 330,
        durationMs: 300,
        waveform: 'square',
        sweepEndFreq: 880, // ascending energy burst
    },
    coin_pickup: {
        freq: 1760,
        durationMs: 80,
        waveform: 'triangle', // bright metallic clink
    },
    damage: {
        freq: 110,
        durationMs: 150,
        waveform: 'sawtooth', // low thud / hit
    },
    explosion: {
        freq: 150,
        durationMs: 350,
        waveform: 'sawtooth', // chunky burst
        freq2: 60, // sub-bass rumble layer
    },
};

// ─── WAV Generator ───────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const AMPLITUDE = 0.3; // master volume multiplier

/**
 * Generate a WAV file as a base64-encoded data URI from tone parameters.
 * Creates simple 8-bit style square/triangle/sawtooth waves.
 */
function generateWavBase64(def: SoundDef): string {
    const numSamples = Math.floor(SAMPLE_RATE * (def.durationMs / 1000));
    const numChannels = 1; // mono
    const bitsPerSample = 16;
    const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Generate samples
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const progress = i / numSamples; // 0 → 1 over duration

        // Frequency: optional sweep
        let freq = def.freq;
        if (def.sweepEndFreq !== undefined) {
            freq = def.freq + (def.sweepEndFreq - def.freq) * progress;
        }

        let sample = generateWaveform(def.waveform, freq, t);

        // Optional second layer
        if (def.freq2 !== undefined) {
            const freq2actual = def.sweepEndFreq !== undefined
                ? (def.freq2 ?? def.freq) + ((def.sweepEndFreq - def.freq) * progress * 0.5)
                : def.freq2;
            sample += generateWaveform(def.waveform, freq2actual, t) * 0.5;
        }

        // Apply short fade-out envelope to avoid clicks
        const fadeProgress = Math.min(1, (1 - progress) / 0.1); // fade last 10%
        const envelope = Math.min(1, progress / 0.02) * fadeProgress; // quick attack
        sample *= envelope * AMPLITUDE;

        // Clamp to 16-bit range
        const clamped = Math.max(-1, Math.min(1, sample));
        const intSample = Math.floor(clamped * 32767);
        view.setInt16(offset, intSample, true);
        offset += 2;
    }

    // Convert to base64
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

function generateWaveform(
    type: OscillatorType,
    freq: number,
    t: number,
): number {
    const phase = (freq * t) % 1;
    switch (type) {
        case 'square':
            return phase < 0.5 ? 1 : -1;
        case 'triangle':
            return 4 * Math.abs(phase - 0.5) * 2 - 1;
        case 'sawtooth':
            return 2 * phase - 1;
        case 'sine':
        default:
            return Math.sin(2 * Math.PI * freq * t);
    }
}

// ─── Sound Service Singleton ────────────────────────────────────────

class SoundServiceImpl {
    private sounds: Map<SoundCategory, Audio.Sound> = new Map();
    private isMuted: boolean = false;
    private volume: number = 0.7;
    private initialized: boolean = false;

    /**
     * Initialize the sound service: create Audio mode and preload all sounds.
     * Call once during app startup (e.g., after splash screen).
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: false,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Preload all sounds (generated from tone definitions)
            const categories: SoundCategory[] = [
                'ui_click', 'ui_confirm', 'ui_cancel',
                'achievement', 'level_up', 'coin_pickup',
                'damage', 'explosion',
            ];

            for (const cat of categories) {
                await this.preload(cat);
            }

            this.initialized = true;
            console.log('[SoundService] Initialized with', categories.length, '8-bit SFX');
        } catch (e) {
            console.warn('[SoundService] Init failed:', e);
        }
    }

    /**
     * Preload a single sound category.
     */
    private async preload(category: SoundCategory): Promise<void> {
        try {
            const def = SOUND_DEFS[category];
            const wavUri = generateWavBase64(def);
            const { sound } = await Audio.Sound.createAsync(
                { uri: wavUri },
                { volume: this.volume, isMuted: this.isMuted },
            );
            this.sounds.set(category, sound);
        } catch (e) {
            console.warn(`[SoundService] Failed to preload "${category}":`, e);
        }
    }

    /**
     * Play a sound effect by category.
     * No-ops if muted or sound not loaded.
     */
    async play(category: SoundCategory): Promise<void> {
        if (this.isMuted) return;

        const sound = this.sounds.get(category);
        if (!sound) {
            console.warn(`[SoundService] Sound "${category}" not loaded`);
            return;
        }

        try {
            // Check if sound is already playing and rewind
            const status = await sound.getStatusAsync();
            if ((status as AVPlaybackStatusSuccess).isLoaded) {
                if ((status as AVPlaybackStatusSuccess).isPlaying) {
                    await sound.stopAsync();
                }
                await sound.setPositionAsync(0);
            }
            await sound.playAsync();
        } catch (e) {
            console.warn(`[SoundService] Play failed for "${category}":`, e);
        }
    }

    /**
     * Toggle mute state.
     * @param muted - true to mute, false to unmute
     */
    mute(muted: boolean): void {
        this.isMuted = muted;
        this.sounds.forEach((sound) => {
            sound.setIsMutedAsync(muted).catch(() => { });
        });
    }

    /**
     * Get current mute state.
     */
    getMuted(): boolean {
        return this.isMuted;
    }

    /**
     * Set master volume (0.0 to 1.0).
     */
    setVolume(vol: number): void {
        this.volume = Math.max(0, Math.min(1, vol));
        this.sounds.forEach((sound) => {
            sound.setVolumeAsync(this.volume).catch(() => { });
        });
    }

    /**
     * Get current master volume.
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * Unload all sounds and release Audio resources.
     * Call on app teardown or when sounds are no longer needed.
     */
    async cleanup(): Promise<void> {
        for (const [category, sound] of this.sounds) {
            try {
                await sound.unloadAsync();
            } catch (e) {
                console.warn(`[SoundService] Cleanup failed for "${category}":`, e);
            }
        }
        this.sounds.clear();
        this.initialized = false;
    }
}

/** Singleton instance — import and use directly */
export const SoundService = new SoundServiceImpl();
