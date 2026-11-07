import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/core/content';
import { rawContent } from './content';

describe('validateContent', () => {
  it('acusa nota de desenvolvimento em texto da jogadora', () => {
    const raw = rawContent();
    raw.story.beats.find((b) => b.id === 'story.warm_corner')!.goal!.steps[0]!.text = 'Faça isso (no próximo marco)';
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

describe('cenas e gatos', () => {
  it('acusa gato, animação e cena inexistentes', () => {
    const raw = rawContent();
    raw.cutscenes.cutscenes['cs.broken'] = { background: '#000', steps: [{ type: 'cat', cat: 'cat.nope', animation: 'dance' }] };
    raw.story.beats.push({ id: 'story.broken_cs', act: 0, effects: [{ cutscene: 'cs.nope' }] });
    raw.cats.cats.push({ id: 'cat.nameless', variant: 'tigre', personality: 'x', tags: [] });
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/gato inexistente "cat.nope"/);
    expect(errors).toMatch(/animação inexistente "dance"/);
    expect(errors).toMatch(/cena inexistente "cs.nope"/);
    expect(errors).toMatch(/variante inexistente "tigre"/);
    expect(errors).toMatch(/precisa de nameSuggestions/);
  });

  it('textos das cenas também não podem ter notas de bastidor', () => {
    const raw = rawContent();
    raw.cutscenes.cutscenes['cs.prologue_end']!.steps = [{ type: 'card', text: 'TODO final' }];
    expect(validateContent(raw).join()).toMatch(/cutscene "cs.prologue_end": texto da jogadora/);
  });
});

describe('roteiros e NPCs', () => {
  it('acusa NPC, animação, mapa, fala e item inexistentes no roteiro', () => {
    const raw = rawContent();
    raw.scripts.scripts['scr.broken'] = { steps: [
      { npcSpawn: 'npc.nope', map: 'map.lua', at: [0, 0] },
      { npcAnim: 'npc.realtor', anim: 'dançar', ms: 100 },
      { dialogue: 'dlg.nope' },
      { showItem: 'item.nope' },
    ] };
    raw.story.beats.push({ id: 'story.broken_script', act: 0, effects: [{ script: 'scr.nope' }] });
    raw.dialogue.dialogues['dlg.intro']!.lines[0]!.npc = 'npc.ghost';
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/NPC inexistente "npc.nope"/);
    expect(errors).toMatch(/mapa inexistente "map.lua"/);
    expect(errors).toMatch(/animação "dançar" não existe/);
    expect(errors).toMatch(/fala inexistente "dlg.nope"/);
    expect(errors).toMatch(/item inexistente "item.nope"/);
    expect(errors).toMatch(/roteiro inexistente "scr.nope"/);
    expect(errors).toMatch(/NPC inexistente "npc.ghost"/);
  });
});
