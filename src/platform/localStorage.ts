import type { Storage } from './storage';

const PREFIX = 'biscuit-paws:';

/** Armazenamento no navegador. Cada chave vira "biscuit-paws:<chave>". */
export class LocalStorage implements Storage {
  async load(key: string): Promise<string | null> {
    return window.localStorage.getItem(PREFIX + key);
  }

  async save(key: string, json: string): Promise<void> {
    window.localStorage.setItem(PREFIX + key, json);
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(PREFIX + key);
  }

  async list(): Promise<string[]> {
    return Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length));
  }
}
