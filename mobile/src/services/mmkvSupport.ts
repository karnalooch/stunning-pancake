/** MMKV needs on-device JSI — fails when Chrome Remote Debugger is attached. */
let mmkvUnavailableWarned = false;
let mmkvFallbackActive = false;

/** True when MMKV fell back to in-memory storage (typical with Remote JS Debugging). */
export function isMmkvFallbackActive(): boolean {
  return mmkvFallbackActive;
}

export function warnMmkvUnavailable(context: string, error: unknown): void {
  mmkvFallbackActive = true;
  if (mmkvUnavailableWarned) return;
  mmkvUnavailableWarned = true;
  if (!__DEV__) return;
  console.warn(
    `[${context}] MMKV unavailable (usually Chrome Remote Debugger). Using in-memory fallback — disable remote JS debugging for persistent storage.`,
    error,
  );
}
