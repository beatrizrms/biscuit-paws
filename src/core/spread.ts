// Espalha caixas que se sobrepõem (os balões de pedido dos clientes numa mesa cheia): cada uma sai o mínimo do lugar.
// Puro: sem Phaser, DOM ou window.

/** Caixa pela base: (x, y) é o meio da borda de baixo (a ponta do balão), w x h o tamanho. */
export interface AnchoredBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Deslocamento de cada caixa para nenhuma encostar na outra (com `gap` de folga). Empurra pelo eixo de menor
 * sobreposição: de lado, as duas saem meio a meio; na vertical, só a de cima sobe (descer cobriria a cabeça de quem
 * está embaixo). Nenhuma sai mais que `max` do lugar. Mesma entrada, mesma saída (sem sorteio).
 */
export function spreadBoxes(boxes: readonly AnchoredBox[], gap = 2, max = 28, rounds = 6): [number, number][] {
  const off: [number, number][] = boxes.map(() => [0, 0]);
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const dx = b.x + off[j]![0] - (a.x + off[i]![0]);
        const dy = b.y + off[j]![1] - (a.y + off[i]![1]);
        const ox = (a.w + b.w) / 2 + gap - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox <= oy) {
          // Lado a lado: meio a meio (empate: a de índice menor vai para a esquerda).
          const s = dx >= 0 ? 1 : -1;
          off[i]![0] = clamp(off[i]![0] - (s * ox) / 2);
          off[j]![0] = clamp(off[j]![0] + (s * ox) / 2);
        } else {
          // Uma em cima da outra: a de cima sobe.
          const up = dy >= 0 ? i : j;
          off[up]![1] = clamp(off[up]![1] - oy);
        }
      }
    }
    if (!moved) break;
  }
  return off;
}
