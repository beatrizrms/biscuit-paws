// Monta a personagem a partir das camadas do pacote (data/character.json): uma folha por pose,
// no mesmo formato da caminhada (quadros 32x64; 4 colunas; linhas baixo, esquerda, direita, cima).
// As regras (quais arquivos, em que ordem) moram em src/core/appearance.ts.
import Phaser from 'phaser';
import { allFilesFor, allWalkFiles, layerFiles, layerPieces, layerRamps, POSES, type Appearance, type LayerFile, type MannequinLayers, type Pose } from '../core/appearance';
import { lightRanges, recolor } from '../core/recolor';
import { content } from './content';

const C = content.character;

/** Chave da imagem de uma camada no Phaser. */
export const layerKey = (file: string) => `chr:${file}`;
export const layerUrl = (file: string) => `${C.basePath}/${file}`;

/** Textura da caminhada normal e de cada pose (gato: uma por cor de gato). */
export const PLAYER_TEXTURE = 'player';
/** Pose parada do manequim (folha à parte; sem ela, parada = 1º quadro da caminhada). */
export const PLAYER_IDLE_TEXTURE = 'player_idle';
export function poseTexture(pose: Pose, catColor?: string): string {
  return C.poses[pose].catProp ? `player-${pose}-${catColor ?? C.catProp.fallback}` : `player-${pose}`;
}

/** Todas as texturas de pose (para criar as animações). */
export function allPoseTextures(): { key: string; pose: Pose }[] {
  return POSES.flatMap((pose) => (C.poses[pose].catProp ? C.catProp.colors.map((c) => ({ key: poseTexture(pose, c), pose })) : [{ key: poseTexture(pose), pose }]));
}

/** No Boot: as camadas da caminhada de todas as combinações (o criador mostra qualquer uma). */
export function preloadWalkLayers(load: Phaser.Loader.LoaderPlugin): void {
  const L = C.mannequin?.layers;
  if (L) {
    // Manequim em camadas: o criador usa a imagem de frente de toda peça e a caminhada das completas.
    for (const f of creatorLayerFiles(L)) load.image(mqKey(f), mqUrl(f));
    return;
  }
  for (const f of allWalkFiles(C)) load.image(layerKey(f), layerUrl(f));
}

// ---- Manequim em camadas (decisão 077): roupa (figura inteira + máscara de regiões) e cabelo, nas cores escolhidas.

/** Chave e endereço de um arquivo das camadas do manequim. */
const mqKey = (file: string) => `mq:${file}`;
const mqUrl = (file: string) => `${C.mannequin!.basePath}/${file}`;
const outfitFile = (id: string, anim: string) => `outfit_${id}_${anim}.png`;
const maskFile = (id: string, anim: string) => `outfit_${id}_${anim}_mask.png`;
const hairFile = (id: string, anim: string) => `hair_${id}_${anim}.png`;

/** O que o criador precisa: a frente de toda peça (+ máscara) e a caminhada das completas. */
function creatorLayerFiles(L: MannequinLayers): string[] {
  const files: string[] = [];
  for (const [id, full] of Object.entries(L.outfits)) files.push(outfitFile(id, 'front'), maskFile(id, 'front'), ...(full ? [outfitFile(id, 'walk'), maskFile(id, 'walk')] : []));
  for (const [id, full] of Object.entries(L.hair)) files.push(hairFile(id, 'front'), ...(full ? [hairFile(id, 'walk')] : []));
  return files;
}

/** Imagem já carregada (ou null se o arquivo faltou). */
function sourceOf(textures: Phaser.Textures.TextureManager, file: string): CanvasImageSource | null {
  const key = mqKey(file);
  return textures.exists(key) ? (textures.get(key).getSourceImage() as CanvasImageSource) : null;
}

/** Desenha uma imagem num canvas novo e devolve os pixels. */
function pixelsOf(img: CanvasImageSource, w: number, h: number): { canvas: HTMLCanvasElement; data: ImageData } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return { canvas, data: ctx.getImageData(0, 0, w, h) };
}

/**
 * Junta roupa e cabelo de uma animação (ou "front", a prévia de frente) nas cores da aparência.
 * `inGame`: usa as peças que o jogo anima (a de reserva quando a escolhida só tem a frente).
 * A faixa de luz de cada região vem da imagem de frente da peça: a mesma cor em todas as folhas.
 */
export function composeLayers(textures: Phaser.Textures.TextureManager, a: Appearance, anim: string, inGame: boolean): HTMLCanvasElement {
  const m = C.mannequin!;
  const L = m.layers!;
  const p = layerPieces(L, a);
  const outfit = inGame ? p.outfitInGame : p.outfit;
  const hair = inGame ? p.hairInGame : p.hair;
  const ramps = layerRamps(L, a);
  const w = anim === 'front' ? m.frameWidth : m.frameWidth * C.sheet.columns;
  const h = anim === 'front' ? m.frameHeight : m.frameHeight * C.sheet.rows.length;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const piece = (file: string, mask: string | null, front: string, frontMask: string | null) => {
    const img = sourceOf(textures, file);
    if (!img) return;
    const px = pixelsOf(img, w, h);
    const mk = mask ? sourceOf(textures, mask) : null;
    const mkData = mk ? pixelsOf(mk, w, h).data.data : null;
    const fImg = sourceOf(textures, front);
    const fMk = frontMask ? sourceOf(textures, frontMask) : null;
    const ranges = fImg ? lightRanges(pixelsOf(fImg, m.frameWidth, m.frameHeight).data.data, fMk ? pixelsOf(fMk, m.frameWidth, m.frameHeight).data.data : null) : undefined;
    recolor(px.data.data, mask ? mkData : null, ramps, ranges);
    px.canvas.getContext('2d')!.putImageData(px.data, 0, 0);
    ctx.drawImage(px.canvas, 0, 0);
  };
  piece(outfitFile(outfit, anim), maskFile(outfit, anim), outfitFile(outfit, 'front'), maskFile(outfit, 'front'));
  if (hair) piece(hairFile(hair, anim), null, hairFile(hair, 'front'), null);
  return out;
}

/** A prévia do criador anda e gira? Só quando roupa e cabelo escolhidos têm todas as animações. */
export function previewAnimates(a: Appearance): boolean {
  const p = layerPieces(C.mannequin!.layers!, a);
  return p.outfit === p.outfitInGame && p.hair === p.hairInGame;
}

/** Carrega os arquivos que faltam das camadas. Arquivo que falha fica de fora. */
function loadMq(scene: Phaser.Scene, files: string[]): Promise<void> {
  const missing = files.filter((f) => !scene.textures.exists(mqKey(f)));
  if (missing.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    for (const f of missing) scene.load.image(mqKey(f), mqUrl(f));
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

/** Folha do jogo (quadros numerados) a partir de um canvas montado. */
function sheetFromCanvas(textures: Phaser.Textures.TextureManager, key: string, canvas: HTMLCanvasElement): void {
  const m = C.mannequin!;
  if (textures.exists(key)) textures.remove(key);
  // Cada textura com o seu canvas: várias poses usam a mesma animação, e apagar uma textura apaga o canvas dela.
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')!.drawImage(canvas, 0, 0);
  const tex = textures.addCanvas(key, copy)!;
  const { columns, rows } = C.sheet;
  for (let i = 0; i < columns * rows.length; i++) tex.add(i, 0, (i % columns) * m.frameWidth, Math.floor(i / columns) * m.frameHeight, m.frameWidth, m.frameHeight);
}

/** Monta caminhada, parada e poses com as camadas da aparência. */
async function buildLayered(scene: Phaser.Scene, a: Appearance): Promise<void> {
  const L = C.mannequin!.layers!;
  const p = layerPieces(L, a);
  const files = [outfitFile(p.outfitInGame, 'front'), maskFile(p.outfitInGame, 'front')];
  for (const anim of L.anims) files.push(outfitFile(p.outfitInGame, anim), maskFile(p.outfitInGame, anim));
  if (p.hairInGame) {
    files.push(hairFile(p.hairInGame, 'front'));
    for (const anim of L.anims) files.push(hairFile(p.hairInGame, anim));
  }
  await loadMq(scene, files);
  const sheets = new Map<string, HTMLCanvasElement>();
  const sheet = (anim: string) => sheets.get(anim) ?? sheets.set(anim, composeLayers(scene.textures, a, anim, true)).get(anim)!;
  sheetFromCanvas(scene.textures, PLAYER_TEXTURE, sheet('walk'));
  sheetFromCanvas(scene.textures, PLAYER_IDLE_TEXTURE, sheet('idle'));
  for (const { key, pose } of allPoseTextures()) sheetFromCanvas(scene.textures, key, sheet(L.poseAnim[pose]));
}

/** Carrega as camadas que ainda faltam (ex.: as poses da aparência escolhida). Arquivo que falha fica de fora. */
export function loadLayers(scene: Phaser.Scene, files: string[]): Promise<void> {
  const missing = files.filter((f) => !scene.textures.exists(layerKey(f)));
  if (missing.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    for (const f of missing) scene.load.image(layerKey(f), layerUrl(f));
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

/** Desenha as camadas, de trás para a frente, num canvas do tamanho de uma folha. */
export function drawLayers(ctx: CanvasRenderingContext2D, textures: Phaser.Textures.TextureManager, layers: LayerFile[]): void {
  const { frameWidth: w, frameHeight: h, columns, rows } = C.sheet;
  ctx.imageSmoothingEnabled = false;
  for (const l of layers) {
    const key = layerKey(l.file);
    if (!textures.exists(key)) continue; // arquivo que faltou: a camada não aparece (o import avisa)
    const img = textures.get(key).getSourceImage() as CanvasImageSource;
    if (!l.still) {
      ctx.drawImage(img, 0, 0);
      continue;
    }
    // Pose parada: a camada repete o quadro 0 (parado) de cada direção nas 4 colunas.
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < columns; c++) ctx.drawImage(img, 0, r * h, w, h, c * w, r * h, w, h);
  }
}

/** Cria (ou recria) uma folha com quadros numerados 0..15. */
function composeSheet(textures: Phaser.Textures.TextureManager, key: string, layers: LayerFile[]): void {
  const { frameWidth: w, frameHeight: h, columns, rows } = C.sheet;
  if (textures.exists(key)) textures.remove(key);
  const tex = textures.createCanvas(key, w * columns, h * rows.length)!;
  drawLayers(tex.getContext(), textures, layers);
  tex.refresh();
  for (let i = 0; i < columns * rows.length; i++) tex.add(i, 0, (i % columns) * w, Math.floor(i / columns) * h, w, h);
}

/** Tamanho do quadro e escala do desenho da jogadora: o do manequim (arte em 64 px) ou o das camadas. */
export function playerFrame(): { width: number; height: number; resolution: number } {
  const m = C.mannequin;
  return m ? { width: m.frameWidth, height: m.frameHeight, resolution: m.resolution } : { width: C.sheet.frameWidth, height: C.sheet.frameHeight, resolution: 1 };
}

/** A pose já desenha o objeto (bandeja, gato, vassoura)? O manequim não: aí o jogo desenha. */
export const poseDrawsProp = (): boolean => !C.mannequin;

/** Carrega as folhas prontas do manequim com as chaves da caminhada e das poses. Folha que falha fica de fora. */
function loadMannequin(scene: Phaser.Scene): Promise<void> {
  const m = C.mannequin!;
  const frame = { frameWidth: m.frameWidth, frameHeight: m.frameHeight };
  const sheets = [{ key: PLAYER_TEXTURE, file: m.walk }, ...(m.idle ? [{ key: PLAYER_IDLE_TEXTURE, file: m.idle }] : []), ...allPoseTextures().map(({ key, pose }) => ({ key, file: m.poses[pose] }))];
  for (const { key } of sheets) if (scene.textures.exists(key)) scene.textures.remove(key);
  return new Promise((resolve) => {
    for (const { key, file } of sheets) scene.load.spritesheet(key, `${m.basePath}/${file}`, frame);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

/** Monta a caminhada e todas as poses da aparência (antes de abrir o mundo). */
export async function buildPlayerTextures(scene: Phaser.Scene, a: Appearance): Promise<void> {
  if (C.mannequin?.layers) return buildLayered(scene, a);
  if (C.mannequin) return loadMannequin(scene);
  await loadLayers(scene, allFilesFor(C, a));
  composeSheet(scene.textures, PLAYER_TEXTURE, layerFiles(C, a));
  for (const pose of POSES) {
    const colors = C.poses[pose].catProp ? C.catProp.colors : [undefined];
    for (const c of colors) composeSheet(scene.textures, poseTexture(pose, c), layerFiles(C, a, pose, c));
  }
}
