// Faixa de teclas desenhada (guia de estilo, seções 6 e 8): "Enter: Pôr · G: Girar" vira teclas desenhadas com uma
// palavra ao lado, em vez de uma frase. Trecho sem ":" fica como texto. Mais de uma tecla: "Ctrl+Arrastar", "1–8".

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** HTML da faixa: cada "tecla: ação" vira <kbd>tecla</kbd> ação; as teclas com "+" ficam juntas. */
export function keyHintHtml(text: string): string {
  return text
    .split(' · ')
    .map((part) => {
      const at = part.indexOf(': ');
      if (at < 0) return `<span class="kh-item">${esc(part)}</span>`;
      // Mais de uma tecla para a mesma coisa ("Enter / F"): cada uma desenhada, com a barra entre elas.
      const keys = part
        .slice(0, at)
        .split(' / ')
        .map((alt) => alt.split('+').map((k) => `<kbd>${esc(k.trim())}</kbd>`).join(''))
        .join('<i class="kh-or">/</i>');
      return `<span class="kh-item">${keys}${esc(part.slice(at + 2))}</span>`;
    })
    .join('');
}
