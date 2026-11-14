import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// As cores da interface ficam todas em theme.css (decisão 243); os outros estilos só usam as variáveis.
const THEMED = ['src/game/ui/ui.css', 'src/game/ui/skin.css', 'src/game/ui/menu/menu.css', 'src/game/touch.css'];

describe('tema da interface', () => {
  it('nenhuma cor solta fora de theme.css', () => {
    for (const f of THEMED) {
      const css = readFileSync(f, 'utf8');
      expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], f).toEqual([]);
      expect(css.match(/\b(rgba?|hsla?)\(/g) ?? [], f).toEqual([]);
    }
  });

  it('toda variável --c-* usada existe em theme.css', () => {
    const theme = readFileSync('src/game/ui/theme.css', 'utf8');
    // As de theme.css, mais as locais de uma peça (--panel-fill, definida no próprio painel em skin.css).
    const defined = new Set([...theme.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).concat('--panel-fill'));
    for (const f of THEMED) {
      const used = [...readFileSync(f, 'utf8').matchAll(/var\((--(?:c-|panel|btn|ribbon|heart)[\w-]*)/g)].map((m) => m[1]!);
      for (const v of used) expect(defined.has(v), `${f}: ${v}`).toBe(true);
    }
  });

  it('sem as molduras de imagem do pacote ui_menus', () => {
    for (const f of THEMED) expect(readFileSync(f, 'utf8'), f).not.toMatch(/assets\/ui\/menu\/ui_(panel|button|ribbon)/);
  });
});
