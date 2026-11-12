import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brokenGenderMarker, genderText } from '../../src/core/pronoun';
import { knownIds, parseSave } from '../../src/core/save';
import { loadContent } from './content';

/** Arquivos cujos textos passam por fillNames (src/game/ui/text.ts) antes de ir para a tela. */
// npcs.json: as falas e os balões dos passeios (walks) passam por fillNames no WorldScene.
const FILLED = ['dialogue.json', 'cutscenes.json', 'news.json', 'vet_text.json', 'ced_text.json', 'npcs.json'];

/** Todas as strings de um JSON (com o caminho), para varrer os dados. */
function strings(o: unknown, path = ''): [string, string][] {
  if (typeof o === 'string') return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

describe('pronome da protagonista', () => {
  it('{g:feminino|masculino} escolhe pela escolha do criador; sem marcador, nada muda', () => {
    const t = 'Bom dia, {g:querida|querido}! {g:A nova dona|O novo dono} chegou.';
    expect(genderText(t, 'she')).toBe('Bom dia, querida! A nova dona chegou.');
    expect(genderText(t, 'he')).toBe('Bom dia, querido! O novo dono chegou.');
    expect(genderText('Você veio pela padaria?', 'he')).toBe('Você veio pela padaria?');
    expect(brokenGenderMarker('oi {g:querida} tudo')).toContain('{g:querida}');
    expect(brokenGenderMarker('oi {g:querida|querido}')).toBeNull();
  });

  it('nos dados: nenhum marcador quebrado, e só onde o texto passa por fillNames', () => {
    for (const file of readdirSync('data').filter((f) => f.endsWith('.json'))) {
      for (const [path, s] of strings(JSON.parse(readFileSync(`data/${file}`, 'utf8')))) {
        if (path.includes('_comment') || !s.includes('{g:')) continue;
        expect(brokenGenderMarker(s), `${file}: ${path}`).toBeNull();
        expect(FILLED, `${file}: ${path} usa {g:} mas o texto não passa por fillNames`).toContain(file);
      }
    }
  });

  it('save v21 guarda ela/ele; v20 vira ela; valor estranho volta a ela', () => {
    const known = knownIds(loadContent());
    expect(parseSave(readFileSync('tests/fixtures/save_v21.json', 'utf8'), known).state.player.pronoun).toBe('he');
    expect(parseSave(readFileSync('tests/fixtures/save_v20.json', 'utf8'), known).state.player.pronoun).toBe('she');
    const bad = JSON.parse(readFileSync('tests/fixtures/save_v21.json', 'utf8'));
    bad.player.pronoun = 'they';
    expect(parseSave(JSON.stringify(bad), known).state.player.pronoun).toBe('she');
  });
});
