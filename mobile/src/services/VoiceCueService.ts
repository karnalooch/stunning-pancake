/**
 * VoiceCueService — eyes-free navigation TTS (ADR 014 layer 4).
 */

import * as Speech from 'expo-speech';

export interface VoiceCueOptions {
  language?: string;
  rate?: number;
  pitch?: number;
}

class VoiceCueServiceImpl {
  private enabled = true;
  private language = 'pl-PL';

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) Speech.stop();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setLanguage(lang: string): void {
    this.language = lang;
  }

  async speak(text: string, options?: VoiceCueOptions): Promise<void> {
    if (!this.enabled || !text.trim()) return;
    Speech.stop();
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: options?.language ?? this.language,
        rate: options?.rate ?? 1,
        pitch: options?.pitch ?? 1,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  stop(): void {
    Speech.stop();
  }
}

export const VoiceCueService = new VoiceCueServiceImpl();
