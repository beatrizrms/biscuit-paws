// Pronome da protagonista (escolhido no criador). Os textos são escritos com o mínimo de gênero possível
// ("você", primeira pessoa); quando não dá, o marcador {g:feminino|masculino} escolhe pela escolha dela.
// Puro: sem Phaser, DOM ou window.

export type Pronoun = 'she' | 'he';
export const PRONOUNS: readonly Pronoun[] = ['she', 'he'];

/** Saves de antes da escolha (v20 ou antes): o jogo foi escrito com ela. */
export const DEFAULT_PRONOUN: Pronoun = 'she';

const MARKER = /\{g:([^|{}]*)\|([^{}]*)\}/g;

/** Troca cada {g:feminino|masculino} pela forma do pronome ("Bom dia, {g:querida|querido}!"). As formas são texto puro. */
export function genderText(text: string, pronoun: Pronoun): string {
  return text.replace(MARKER, (_, fem: string, masc: string) => (pronoun === 'he' ? masc : fem));
}

export function isPronoun(v: unknown): v is Pronoun {
  return v === 'she' || v === 'he';
}

/** Marcador quebrado (sem a barra ou sem fechar): devolve o trecho, para a validação apontar. */
export function brokenGenderMarker(text: string): string | null {
  const rest = text.replace(MARKER, '');
  const i = rest.indexOf('{g:');
  return i < 0 ? null : rest.slice(i, i + 30);
}
