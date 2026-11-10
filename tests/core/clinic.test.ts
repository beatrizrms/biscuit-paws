import { describe, expect, it } from 'vitest';
import { bookingBlock, clinicBill, dischargeChoice, friendDiscount, neuterBlock, newClinic, procedureOf, runTests } from '../../src/core/clinic';
import { ageMonths, fixedRepro, neuteredChance, rngForCat, rollRepro, sexText, weightKg } from '../../src/core/repro';
import { createRng } from '../../src/core/rng';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.clinic;
const neuter = procedureOf(cfg, 'proc.neuter')!;

describe('estado reprodutivo (repro.ts)', () => {
  it('o mesmo gato sorteia sempre a mesma coisa (semente pelo id)', () => {
    const a = rollRepro(cfg.repro, rngForCat('cat.gen.7'), { day: 10, ageBand: 'adult' });
    const b = rollRepro(cfg.repro, rngForCat('cat.gen.7'), { day: 10, ageBand: 'adult' });
    expect(a).toEqual(b);
    expect(a.known).toBe('unknown');
    expect(a.origin).toBe('shelter');
  });

  it('chance por condição vale primeiro (filhote nunca), depois por modelo, depois a padrão', () => {
    expect(neuteredChance(cfg.repro, { condition: 'kitten', model: 'vizinho_traz' })).toBe(0);
    expect(neuteredChance(cfg.repro, { model: 'vizinho_traz' })).toBe(cfg.repro.neuteredChance.byModel.vizinho_traz);
    expect(neuteredChance(cfg.repro, { model: 'na_porta' })).toBe(cfg.repro.neuteredChance.default);
  });

  it('a chegada pode fixar o estado; marca na orelha é sempre castrado e já se sabe', () => {
    for (let s = 0; s < 20; s++) {
      expect(rollRepro(cfg.repro, createRng(s), { day: 5, ageBand: 'adult', neutered: true }).status).toBe('neutered');
      expect(rollRepro(cfg.repro, createRng(s), { day: 5, ageBand: 'adult', neutered: false }).status).toBe('intact');
      const tipped = rollRepro(cfg.repro, createRng(s), { day: 5, ageBand: 'kitten', neutered: false, earTipped: true });
      expect(tipped.status).toBe('neutered');
      expect(tipped.known).toBe('neutered');
    }
  });

  it('filhote nunca chega castrado pela chance padrão', () => {
    for (let s = 0; s < 50; s++) expect(rollRepro(cfg.repro, createRng(s), { day: 5, ageBand: 'kitten', condition: 'kitten' }).status).toBe('intact');
  });

  it('a idade cresce com os dias e o peso acompanha', () => {
    const r = fixedRepro(cfg.repro, { status: 'intact', sex: 'female', ageMonths: 2 }, 10);
    expect(ageMonths(cfg.repro, r, 10)).toBe(2);
    expect(ageMonths(cfg.repro, r, 10 + 2 * cfg.repro.daysPerMonth)).toBe(4);
    expect(weightKg(cfg.repro, r, 10 + 4 * cfg.repro.daysPerMonth)).toBeGreaterThan(weightKg(cfg.repro, r, 10));
  });

  it('o gato fixo pode já começar sabido (o do prólogo)', () => {
    expect(fixedRepro(cfg.repro, { status: 'neutered', sex: 'male', ageMonths: 24, known: true }, 1).known).toBe('neutered');
    expect(fixedRepro(cfg.repro, { status: 'intact', sex: 'male', ageMonths: 24 }, 1).known).toBe('unknown');
  });

  it('texto pelo sexo do gato', () => {
    expect(sexText('castrad{sex:o|a}', 'male')).toBe('castrado');
    expect(sexText('castrad{sex:o|a}', 'female')).toBe('castrada');
  });
});

describe('clínica (clinic.ts)', () => {
  const adult = fixedRepro(cfg.repro, { status: 'intact', sex: 'male', ageMonths: 12 }, 1);

  it('adulto inteiro e saudável pode operar', () => {
    expect(neuterBlock(cfg, neuter, { repro: adult, health: 80, sick: false }, 1)).toBeNull();
  });

  it('já castrado: não opera', () => {
    expect(neuterBlock(cfg, neuter, { repro: { ...adult, status: 'neutered' }, health: 80, sick: false }, 1)?.block).toBe('already_neutered');
  });

  it('novo demais: diz o dia em que terá a idade', () => {
    const kitten = fixedRepro(cfg.repro, { status: 'intact', sex: 'female', ageMonths: 2 }, 10);
    const b = neuterBlock(cfg, neuter, { repro: kitten, health: 80, sick: false }, 10);
    expect(b?.block).toBe('too_young');
    expect(b?.readyDay).toBe(10 + 2 * cfg.repro.daysPerMonth);
    expect(neuterBlock(cfg, neuter, { repro: kitten, health: 80, sick: false }, b!.readyDay!)).toBeNull();
  });

  it('doente ou fraco: espera', () => {
    expect(neuterBlock(cfg, neuter, { repro: adult, health: 80, sick: true }, 1)?.block).toBe('sick');
    expect(neuterBlock(cfg, neuter, { repro: adult, health: neuter.requirements.minHealth - 1, sick: false }, 1)?.block).toBe('too_weak');
  });

  it('agenda: leitos e cirurgias por dia', () => {
    const st = newClinic();
    expect(bookingBlock(cfg, neuter, st, 0, 3)).toBeNull();
    expect(bookingBlock(cfg, neuter, st, cfg.ward.beds, 3)).toBe('no_beds');
    st.surgeries['3'] = neuter.surgeriesPerDay;
    expect(bookingBlock(cfg, neuter, st, 0, 3)).toBe('no_slots');
    expect(bookingBlock(cfg, neuter, st, 0, 4)).toBeNull();
  });

  it('desconto de amiga a partir da 5ª consulta', () => {
    const st = newClinic();
    st.consults = cfg.discount.fromConsult - 2;
    expect(friendDiscount(cfg, st)).toBe(false);
    expect(clinicBill(cfg, st, { consult: 30, medicine: 0, procedure: 60 }).total).toBe(90);
    st.consults = cfg.discount.fromConsult - 1;
    expect(friendDiscount(cfg, st)).toBe(true);
    const bill = clinicBill(cfg, st, { consult: 30, medicine: 0, procedure: 60 });
    expect(bill.discount).toBe(Math.round(90 * cfg.discount.share));
    expect(bill.total).toBe(90 - bill.discount);
  });

  it('testes de doenças transmissíveis: sempre negativos por enquanto', () => {
    expect(Object.values(runTests(cfg)).every((r) => r === 'negative')).toBe(true);
    expect(Object.keys(runTests(cfg)).length).toBe(cfg.tests.length);
  });

  it('gancho da CED: sorteia até as vagas livres, sem repetir', () => {
    const cats = ['a', 'b', 'c', 'd'];
    const chosen = dischargeChoice(cats, 2, createRng(1));
    expect(chosen).toHaveLength(2);
    expect(new Set(chosen).size).toBe(2);
    expect(dischargeChoice(cats, 0, createRng(1))).toEqual([]);
    expect(dischargeChoice(cats, 9, createRng(1)).sort()).toEqual(cats);
  });
});
