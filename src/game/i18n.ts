// Textos traduzíveis (data/i18n/<locale>.json). Hoje só pt-BR; outro idioma é outro arquivo com as mesmas chaves.
import gameJson from '../../data/game.json';
import ptBR from '../../data/i18n/pt-BR.json';

type Dict = { [key: string]: string | string[] | Dict };
const LOCALES: Record<string, Dict> = { 'pt-BR': ptBR as unknown as Dict };

export const gameInfo = gameJson as { title: string; locale: string };
const dict: Dict = LOCALES[gameInfo.locale] ?? (ptBR as unknown as Dict);

function lookup(key: string): string | string[] | Dict | undefined {
  return key.split('.').reduce<string | string[] | Dict | undefined>((node, part) => (node && typeof node === 'object' && !Array.isArray(node) ? node[part] : undefined), dict);
}

/** Texto da chave ("home.continue"), com {nome} trocado por vars.nome. Chave que falta aparece como ela mesma. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const v = lookup(key);
  const text = typeof v === 'string' ? v : key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Lista de textos (ex.: as linhas dos créditos). */
export function tList(key: string): string[] {
  const v = lookup(key);
  return Array.isArray(v) ? v : [];
}
