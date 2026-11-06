// Interface de armazenamento. Hoje: localStorage. No Electron/Steam: arquivos em disco.
// Assíncrona de propósito, porque ler arquivos no Electron é assíncrono.

export interface Storage {
  load(key: string): Promise<string | null>;
  save(key: string, json: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(): Promise<string[]>;
}
