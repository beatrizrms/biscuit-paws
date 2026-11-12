// Falas da Fernanda sobre a clínica (data/vet_text.json): preenche {cat}, {day}, {days}..., o sexo do gato
// ({sex:o|a}) e o gênero da protagonista ({g:...}, pelo fillNames).
import type { GameSession } from '../../core/session';
import { sexText } from '../../core/repro';
import { content } from '../content';
import { fillNames } from './text';

/** Texto de data/vet_text.json ("intake.hello"), com as variáveis e o sexo do gato (catId). */
export function vetLine(session: GameSession, path: string, vars: Record<string, string | number> = {}, catId?: string): string {
  const [section, key] = path.split('.') as [string, string];
  const group = content.vetText[section];
  const raw = group && typeof group === 'object' ? (group[key] ?? '') : '';
  const sex = catId ? session.state.cats[catId]?.repro?.sex : undefined;
  const withVars = raw.replace(/\{(cat|day|days|aftercare|disease|price|cans)\}/g, (_m, k: string) => (k === 'cat' && catId && vars.cat === undefined ? session.catName(catId) : String(vars[k] ?? '')));
  return fillNames(session, sex ? sexText(withVars, sex) : withVars.replace(/\{sex:([^|{}]*)\|[^{}]*\}/g, '$1'));
}

/** Preenche {sex:macho|fêmea} pelo sexo do gato (textos da interface). */
export function catSexText(session: GameSession, text: string, catId: string): string {
  const sex = session.state.cats[catId]?.repro?.sex;
  return sex ? sexText(text, sex) : text.replace(/\{sex:([^|{}]*)\|[^{}]*\}/g, '$1');
}
