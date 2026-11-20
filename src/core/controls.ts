// Controles (data/controls.json): as teclas, os botões do controle de videogame e os do toque de cada ação, e os
// textos que falam deles (Como jogar, dicas). Puro: quem lê o teclado e o controle é o src/game; aqui só os dados, a
// validação e os textos.

/** O controle em uso: teclado e mouse, toque ou controle de videogame. */
export type InputMode = 'keys' | 'touch' | 'pad';
export const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3'] as const;
export type PadButton = (typeof PAD_BUTTONS)[number];
export const PAD_CONTEXTS = ['world', 'placing', 'minigame', 'minigameCursor', 'area'] as const;
export type PadContextName = (typeof PAD_CONTEXTS)[number];
export const SECTIONS = ['move', 'use', 'bar', 'windows', 'furniture'] as const;
export type QuickSlot = 'up' | 'left' | 'right' | 'down';
export const QUICK_OPENS = ['phone', 'backpack', 'menuBoard', 'goals', 'market'] as const;
/** Ações que o controle faz sem tecla (a barra e o cursor dos mini games). */
const PAD_ONLY = new Set(['hotbarPrev', 'hotbarNext', 'mouse', 'mouseRight']);

export interface ControlAction {
  label: string;
  section?: (typeof SECTIONS)[number];
  keys?: string[];
  labels?: Partial<Record<InputMode, string>>;
  show?: Partial<Record<InputMode, string>>;
  /** O controle aperta todas as teclas de uma vez (não só a primeira). */
  sendAll?: boolean;
}

export interface ControlsConfig {
  keyNames: Record<string, string>;
  padNames: Record<string, string>;
  actions: Record<string, ControlAction>;
  pad: Record<PadContextName, Partial<Record<PadButton, string>>>;
  touch: { buttons: string[] };
  quickMenu: Record<QuickSlot, { opens: (typeof QUICK_OPENS)[number]; label: string }>;
}

/** Os problemas do arquivo (vazio = tudo certo). */
export function validateControls(cfg: ControlsConfig): string[] {
  const errors: string[] = [];
  const has = (id: string) => id in cfg.actions;
  for (const [id, a] of Object.entries(cfg.actions)) {
    if (!a.label) errors.push(`controls: ação "${id}" sem label`);
    if (a.section && !(SECTIONS as readonly string[]).includes(a.section)) errors.push(`controls: ação "${id}" com section desconhecida "${a.section}"`);
  }
  for (const ctx of PAD_CONTEXTS) {
    const map = cfg.pad[ctx];
    if (!map) {
      errors.push(`controls: pad.${ctx} faltando`);
      continue;
    }
    for (const [button, action] of Object.entries(map)) {
      if (!(PAD_BUTTONS as readonly string[]).includes(button)) errors.push(`controls: pad.${ctx}: botão desconhecido "${button}"`);
      if (!has(action!)) errors.push(`controls: pad.${ctx}.${button}: ação desconhecida "${action}"`);
      else if (!PAD_ONLY.has(action!) && action !== 'quickMenu' && !(cfg.actions[action!]!.keys?.length)) errors.push(`controls: pad.${ctx}.${button}: a ação "${action}" não tem tecla para apertar`);
    }
  }
  for (const id of cfg.touch.buttons) if (!has(id) || !cfg.actions[id]!.keys?.length) errors.push(`controls: touch.buttons: "${id}" precisa ser uma ação com tecla`);
  for (const slot of ['up', 'left', 'right', 'down'] as const) {
    const q = cfg.quickMenu[slot];
    if (!q) errors.push(`controls: quickMenu.${slot} faltando`);
    else if (!(QUICK_OPENS as readonly string[]).includes(q.opens)) errors.push(`controls: quickMenu.${slot}: "${q.opens}" não abre nada (use ${QUICK_OPENS.join(', ')})`);
  }
  return errors;
}

/** O nome de uma tecla na tela ("ESC" vira "Esc"). */
export function keyName(cfg: ControlsConfig, key: string): string {
  return cfg.keyNames[key] ?? key;
}

/** Os botões do controle que fazem esta ação, nos momentos dados (o primeiro momento que tiver, ganha). */
export function padButtonsFor(cfg: ControlsConfig, action: string, contexts: readonly PadContextName[] = ['world', 'placing']): string[] {
  for (const ctx of contexts) {
    const found = Object.entries(cfg.pad[ctx] ?? {})
      .filter(([, a]) => a === action)
      .map(([b]) => cfg.padNames[b] ?? b);
    if (found.length > 0) return found;
  }
  return [];
}

/** O controle de uma ação no modo, como texto ("E", "Setas / WASD", "A"), ou "" quando o modo não tem. */
export function controlText(cfg: ControlsConfig, action: string, mode: InputMode, contexts?: readonly PadContextName[]): string {
  const a = cfg.actions[action];
  if (!a) return '';
  if (a.show?.[mode] !== undefined) return a.show[mode]!;
  if (mode === 'keys') return (a.keys ?? []).map((k) => keyName(cfg, k)).join(' / ');
  if (mode === 'pad') return padButtonsFor(cfg, action, contexts).join(' / ');
  // Toque: o botão da coluna, com o texto do label de toque.
  return cfg.touch.buttons.includes(action) ? (a.labels?.touch ?? a.label) : '';
}

/** O que a ação faz, no texto do modo. */
export function actionLabel(cfg: ControlsConfig, action: string, mode: InputMode): string {
  const a = cfg.actions[action];
  return a?.labels?.[mode] ?? a?.label ?? action;
}

/** As linhas de um cartão do Como jogar no modo: [controles, o que faz], só as que o modo tem. */
export function howToRows(cfg: ControlsConfig, section: (typeof SECTIONS)[number], mode: InputMode): { controls: string[]; what: string }[] {
  return Object.entries(cfg.actions)
    .filter(([, a]) => a.section === section)
    .map(([id]) => ({ id, text: controlText(cfg, id, mode) }))
    .filter((r) => r.text !== '')
    .map((r) => ({ controls: r.text.split(' / '), what: actionLabel(cfg, r.id, mode) }));
}

/**
 * Troca {ação} pelo controle dela no modo ("{interact}: interagir" vira "E: interagir" ou "A: interagir"). Com o
 * momento, os botões do controle vêm dele primeiro (posicionando, o A solta).
 */
export function fillControls(cfg: ControlsConfig, text: string, mode: InputMode, contexts?: readonly PadContextName[]): string {
  // Um trecho ("{market}: Market") cujo controle o modo não tem sai inteiro (no controle, o Market é pelo celular).
  return text
    .split(' · ')
    .map((part) => {
      let missing = false;
      const filled = part.replace(/\{(\w+)\}/g, (m, id: string) => {
        if (!(id in cfg.actions)) return m;
        const t = controlText(cfg, id, mode, contexts);
        if (!t) missing = true;
        return t;
      });
      return missing ? null : filled;
    })
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/**
 * O botão do controle de uma tecla entre parênteses num texto ("(E)" -> "A"): a ação com essa tecla que o momento
 * usa. Sem botão, devolve a própria tecla.
 */
export function padNameForKey(cfg: ControlsConfig, key: string, contexts: readonly PadContextName[]): string {
  const upper = key.toUpperCase() === 'ESPAÇO' ? 'SPACE' : key.toUpperCase();
  for (const ctx of contexts) {
    for (const [button, action] of Object.entries(cfg.pad[ctx] ?? {})) {
      if ((cfg.actions[action!]?.keys ?? []).includes(upper)) return cfg.padNames[button] ?? button;
    }
  }
  // Sem botão próprio, mas no losango de atalhos (a mochila, o cardápio): o botão do losango.
  const opens = Object.entries(cfg.actions).find(([id, a]) => a.keys?.includes(upper) && Object.values(cfg.quickMenu).some((q) => q.opens === id));
  if (opens) {
    const quick = padButtonsFor(cfg, 'quickMenu', contexts);
    if (quick.length > 0) return quick[0]!;
  }
  return key;
}
