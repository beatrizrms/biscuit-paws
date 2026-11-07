// npx tsx scripts/import-character.ts: copia as camadas do pacote "personagem_principal"
// (assets/personagem_principal, fora do Git) para public/assets/characters/player (também fora do Git)
// e confere se existe todo arquivo que alguma combinação de data/character.json usa (caminhada e poses).
// Não muda os arquivos originais. Rode de novo se o pacote for atualizado.
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { allWalkFiles, layerFiles, POSES, type Appearance, type CharacterData } from '../src/core/appearance';

const SRC = 'assets/_originais_pacotes/personagem_principal/personagem_principal';
const data = JSON.parse(readFileSync('data/character.json', 'utf8')) as CharacterData;
const OUT = `public/${data.basePath}`;

for (const dir of ['corpo', 'olhos', 'calcado', 'calca', 'camisa', 'cabelo', 'acessorio', 'poses']) {
  cpSync(`${SRC}/${dir}`, `${OUT}/${dir}`, { recursive: true, filter: (f) => !f.endsWith('.md') && !f.endsWith('.json') && !f.includes('preview') });
}

// Toda pele, roupa (estilo x cor) e pose: o corpo e a roupa da pose existem para cada uma?
const needed = new Set(allWalkFiles(data));
for (const skin of data.skins) {
  for (const top of data.top.styles) {
    for (const color of data.top.colors) {
      const a: Appearance = { ...data.default, skin: skin.id, top: top.id, topColor: color.id };
      for (const pose of POSES) {
        const cats = data.poses[pose].catProp ? data.catProp.colors : [undefined];
        for (const c of cats) for (const l of layerFiles(data, a, pose, c)) needed.add(l.file);
      }
    }
  }
}
const missing = [...needed].filter((f) => !existsSync(`${OUT}/${f}`));
if (missing.length > 0) {
  console.error(`✗ faltam ${missing.length} arquivos do pacote:\n  ${missing.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ personagem: ${needed.size} camadas conferidas em ${OUT}`);
