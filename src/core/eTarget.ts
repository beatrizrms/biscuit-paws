// O alvo do E: uma regra só para tudo o que está ao alcance (sujeira, equipamento, gato, pote, janela, ponto de pedido...).
// Antes, cada coisa nova entrava como mais uma exceção numa fila de "se"; com sujeira perto dos itens, a ordem errava
// (a vassoura na mão e um monte de pó na diagonal tomavam o E da cafeteira bem na frente dela).
// Puro: sem Phaser, DOM ou window. O jogo monta os candidatos (células e tipo) e esta função escolhe.
import type { Cell, Facing } from './map';

export interface ECandidate<T> {
  /** As células da coisa (a peça inteira; o gato e a sujeira, as deles). */
  cells: readonly Cell[];
  /** Ordem do tipo quando empata no resto (menor vence). */
  tier: number;
  /** Combina com o que ela tem na mão (vassoura → sujeira; ração ou areia → o pote; latinha → o cercadinho). */
  tool?: boolean;
  /** Estado que vence tudo ao alcance (entregar ao cliente, soltar o saco pesado, levantar da cadeira). */
  sticky?: boolean;
  /** Só explica o que falta (o pote sem a ração na mão, o cercadinho sem nada a fazer): perde de qualquer ação de verdade. */
  weak?: boolean;
  value: T;
}

/** Até onde a frente dela conta (células à frente, com uma de cada lado). */
const CONE_DEPTH = 2;

/**
 * Quanto a coisa está na frente dela: 0 = bem na frente (a célula para onde ela olha, ou nos pés dela); 1 = em linha
 * reta à frente, um pouco mais adiante (a janela atrás do lambri); 2 = na diagonal da frente; 3 = do lado ou atrás.
 * A linha reta vence a diagonal: virada para a janela, a cortina ganha do armário do lado.
 */
export function facingScore(cells: readonly Cell[], feet: readonly Cell[], at: Cell, facing: Facing): 0 | 1 | 2 | 3 {
  const [dx, dy] = facing === 'up' ? [0, -1] : facing === 'down' ? [0, 1] : facing === 'left' ? [-1, 0] : [1, 0];
  const ahead: Cell = [at[0] + dx, at[1] + dy];
  const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
  // Nos pés: a célula principal (at). Um pedaço do corpo na célula do lado (encostada no armário) não conta como
  // "na frente" quando ela olha para outro lado.
  if (cells.some((c) => same(c, ahead) || same(c, at))) return 0;
  void feet;
  const inCone = ([c, r]: Cell) => {
    // Distância para a frente e para o lado, no referencial dela.
    const fwd = (c - at[0]) * dx + (r - at[1]) * dy;
    const side = Math.abs((c - at[0]) * dy - (r - at[1]) * dx);
    return fwd >= 1 && fwd <= CONE_DEPTH && side <= 1;
  };
  const straight = ([c, r]: Cell) => {
    const fwd = (c - at[0]) * dx + (r - at[1]) * dy;
    return fwd >= 1 && fwd <= CONE_DEPTH && (c - at[0]) * dy - (r - at[1]) * dx === 0;
  };
  if (cells.some(straight)) return 1;
  return cells.some(inCone) ? 2 : 3;
}

/**
 * Escolhe o alvo do E. Ordem: o que é estado (sticky); a ação de verdade antes do que só explica (weak); depois o
 * que está mais na frente dela (facingScore) e, nisso, o mais perto da célula da frente (o item mais próximo na direção
 * dela, decisão dela de 2026-11-15); no empate (a mesma célula), o que combina com a ferramenta na mão; depois o tipo
 * (tier); e, por fim, a ordem em que os candidatos vieram. `at`: a célula dos pés dela (de onde sai a frente).
 */
export function pickETarget<T>(candidates: readonly ECandidate<T>[], feet: readonly Cell[], at: Cell, facing: Facing): T | null {
  if (candidates.length === 0) return null;
  const [dx, dy] = facing === 'up' ? [0, -1] : facing === 'down' ? [0, 1] : facing === 'left' ? [-1, 0] : [1, 0];
  const front: Cell = [at[0] + dx, at[1] + dy];
  // Perto dela: quantas células até a coisa (a diagonal encostada conta 1, como o lado); no empate, a mais perto da
  // célula da frente.
  const near = (cells: readonly Cell[]) => Math.min(...cells.map(([c, r]) => Math.max(Math.abs(c - at[0]), Math.abs(r - at[1]))));
  const dist = (cells: readonly Cell[]) => Math.min(...cells.map(([c, r]) => Math.abs(c - front[0]) + Math.abs(r - front[1])));
  const ranked = candidates.map((c, i) => ({
    c,
    key: [c.sticky ? 0 : 1, c.weak ? 1 : 0, c.sticky ? 0 : facingScore(c.cells, feet, at, facing), c.cells.length ? near(c.cells) : 99, c.cells.length ? dist(c.cells) : 99, c.tool ? 0 : 1, c.tier, i],
  }));
  ranked.sort((a, b) => {
    for (let k = 0; k < a.key.length; k++) if (a.key[k] !== b.key[k]) return a.key[k]! - b.key[k]!;
    return 0;
  });
  return ranked[0]!.c.value;
}
