// Modo debug: só existe em `npm run dev`. No build de produção, import.meta.env.DEV é false
// e o Vite remove todo o código que depende dele.
// Liga/desliga com F9 (ou ?debug na URL, que fica gravado no aparelho). Usa um save separado, para os truques
// não estragarem o save "de verdade".

const KEY = 'biscuit-paws:debug';

export function isDebugOn(): boolean {
  if (!import.meta.env.DEV) return false;
  const param = new URLSearchParams(window.location.search).get('debug');
  if (param !== null) {
    // Fica gravado: "Voltar ao menu" e "Jogo novo" recarregam sem a URL, e o app da tela de início do celular reabre
    // na última página (sem o ?debug). Desliga pelo botão "Desligar" do painel (ou ?debug=0).
    try {
      window.localStorage.setItem(KEY, param !== '0' ? '1' : '0');
    } catch {
      // sem armazenamento: vale só nesta página
    }
    return param !== '0';
  }
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Liga ou desliga e recarrega o jogo (cada modo tem o seu save). */
export function setDebug(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // sem armazenamento: o ?debug abaixo ainda funciona nesta aba
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('debug');
  url.searchParams.delete('novo');
  if (on) url.searchParams.set('debug', '1');
  window.location.href = url.toString();
}
