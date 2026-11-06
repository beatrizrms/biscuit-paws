import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/core/content';
import { rawContent } from './content';

describe('validateContent', () => {
  it('acusa nota de desenvolvimento em texto da jogadora', () => {
    const raw = rawContent();
    raw.story.beats[1]!.goal!.steps[0]!.text = 'Faça isso (no próximo marco)';
    raw.dialogue.dialogues['dlg.intro']!.lines[0]!.text = 'TODO escrever';
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/story "story.warm_corner": texto da jogadora/);
    expect(errors).toMatch(/dialogue "dlg.intro": texto da jogadora/);
  });

  it('o conteúdo de data/ é válido', () => {
    expect(validateContent(rawContent())).toEqual([]);
  });

  it('acusa item com tile inexistente e id sem prefixo', () => {
    const raw = rawContent();
    raw.items.items.push({ id: 'lamp', name: 'Lâmpada', price: 5, tile: 'lamp', tags: [] });
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/deve começar com "item."/);
    expect(errors).toMatch(/tile inexistente "lamp"/);
  });

  it('acusa referências quebradas na história', () => {
    const raw = rawContent();
    raw.story.beats.push({
      id: 'story.broken',
      act: 1,
      after: ['story.nope'],
      goal: { title: 'x', steps: [{ text: 'x', when: { placed: 'item.nope' } }] },
      when: { placedTag: 'tag_que_ninguem_tem' },
      effects: [{ dialogue: 'dlg.nope' }],
    });
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/"story.nope", que não existe/);
    expect(errors).toMatch(/item inexistente "item.nope"/);
    expect(errors).toMatch(/nenhum item tem a tag/);
    expect(errors).toMatch(/fala inexistente "dlg.nope"/);
  });
});
