// Plural nos textos dos dados: "{n} dia(s)" vira "1 dia" ou "3 dias" depois de preenchido.
// O "(s)" (ou "(es)") segue o número mais próximo antes dele: "2 visitante(s) interessado(s)" -> "2 visitantes interessados".

/** Resolve os "(s)" e "(es)" de um texto já preenchido, pelo número que vem antes de cada um. */
export function plural(text: string): string {
  let n = 2;
  return text.replace(/(\d+)|\((s|es)\)/g, (m, num: string | undefined, suffix: string | undefined) => {
    if (num !== undefined) {
      n = Number(num);
      return m;
    }
    return n === 1 ? '' : suffix!;
  });
}
