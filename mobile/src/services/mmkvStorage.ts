/**
 * Stable MMKV boundary for 4VELO.
 *
 * react-native-mmkv v4 moved instance creation to createMMKV() and renamed
 * delete() to remove(). Keep those native API details behind this adapter so
 * domain/storage code can retain a small, testable contract.
 */

import { createMMKV } from 'react-native-mmkv';

export type AppMmkvValue = string | number | boolean | ArrayBuffer;

export interface AppMmkvConfig {
  id: string;
  encryptionKey?: string;
}

export interface AppMmkvStorage {
  getString(key: string): string | undefined;
  set(key: string, value: AppMmkvValue): void;
  delete(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
  contains(key: string): boolean;
}

export function createAppMmkv(): AppMmkvStorage;
export function createAppMmkv(config: AppMmkvConfig): AppMmkvStorage;
export function createAppMmkv(config?: AppMmkvConfig): AppMmkvStorage {
  const native = config ? createMMKV(config) : createMMKV();

  return {
    getString: (key) => native.getString(key),
    set: (key, value) => {
      native.set(key, value);
    },
    delete: (key) => {
      native.remove(key);
    },
    clearAll: () => {
      native.clearAll();
    },
    getAllKeys: () => native.getAllKeys(),
    contains: (key) => native.contains(key),
  };
}
