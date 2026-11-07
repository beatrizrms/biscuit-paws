// Arquivos do jogador: baixar um save como .json e escolher um arquivo para importar.
// Hoje: navegador. No Electron/Steam, troca por diálogos de arquivo nativos sem mexer no resto.

/** Baixa um texto como arquivo. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre o seletor de arquivos e devolve o texto do .json escolhido (ou null se cancelar). */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      resolve(file ? await file.text() : null);
    });
    // Sem "change" (cancelou): o foco volta para a janela.
    window.addEventListener('focus', () => window.setTimeout(() => !input.files?.length && resolve(null), 500), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
