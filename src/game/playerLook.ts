// Desenha a personagem (decisões 077, 083 e 087): o manequim com a roupa (figura inteira + máscara da pele) e o
// cabelo por cima, com a pele e a cor do cabelo escolhidas. Uma folha por animação (4 colunas; linhas baixo,
// esquerda, direita, cima). As regras (quais peças, quais cores) moram em src/core/appearance.ts.
import Phaser from 'phaser';
import { layerPieces, layerRamps, POSES, type Appearance, type Pose } from '../core/appearance';
import { lightRanges, recolor } from '../core/recolor';
import { content } from './content';

const C = content.character;
const M = C.mannequin;

/** Textura da caminhada e de cada pose. */
export const PLAYER_TEXTURE = 'player';
/** Pose parada (em pé, pernas juntas). */
export const PLAYER_IDLE_TEXTURE = 'player_idle';
export const poseTexture = (pose: Pose): string => `player-${pose}`;

/** Todas as texturas de pose (para criar as animações). */
export function allPoseTextures(): { key: string; pose: Pose }[] {
  return POSES.map((pose) => ({ key: poseTexture(pose), pose }));
}

/** Tamanho do quadro e escala do desenho da jogadora (a arte tem `resolution` pixels por pixel do jogo). */
export function playerFrame(): { width: number; height: number; resolution: number } {
  return { width: M.frameWidth, height: M.frameHeight, resolution: M.resolution };
}

/** Chave e endereço de um arquivo das camadas. */
const mqKey = (file: string) => `mq:${file}`;
const mqUrl = (file: string) => `${M.basePath}/${file}`;
const outfitFile = (id: string, anim: string) => `outfit_${id}_${anim}.png`;
const maskFile = (id: string, anim: string) => `outfit_${id}_${anim}_mask.png`;
const hairFile = (id: string, anim: string) => `hair_${id}_${anim}.png`;

/** No Boot: o que o criador precisa, a frente de toda peça (+ máscara) e a caminhada das completas. */
export function preloadCreatorLayers(load: Phaser.Loader.LoaderPlugin): void {
  const files: string[] = [];
  for (const [id, full] of Object.entries(M.outfits)) files.push(outfitFile(id, 'front'), maskFile(id, 'front'), ...(full ? [outfitFile(id, 'walk'), maskFile(id, 'walk')] : []));
  for (const [id, full] of Object.entries(M.hair)) files.push(hairFile(id, 'front'), ...(full ? [hairFile(id, 'walk')] : []));
  for (const f of files) load.image(mqKey(f), mqUrl(f));
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
  const p = layerPieces(M, a);
  const outfit = inGame ? p.outfitInGame : p.outfit;
  const hair = inGame ? p.hairInGame : p.hair;
  const ramps = layerRamps(M, a);
  const w = anim === 'front' ? M.frameWidth : M.frameWidth * C.sheet.columns;
  const h = anim === 'front' ? M.frameHeight : M.frameHeight * C.sheet.rows.length;
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
    const ranges = fImg ? lightRanges(pixelsOf(fImg, M.frameWidth, M.frameHeight).data.data, fMk ? pixelsOf(fMk, M.frameWidth, M.frameHeight).data.data : null) : undefined;
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
  const p = layerPieces(M, a);
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
  if (textures.exists(key)) textures.remove(key);
  // Cada textura com o seu canvas: várias poses usam a mesma animação, e apagar uma textura apaga o canvas dela.
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')!.drawImage(canvas, 0, 0);
  const tex = textures.addCanvas(key, copy)!;
  const { columns, rows } = C.sheet;
  for (let i = 0; i < columns * rows.length; i++) tex.add(i, 0, (i % columns) * M.frameWidth, Math.floor(i / columns) * M.frameHeight, M.frameWidth, M.frameHeight);
}

/** Monta caminhada, parada e poses da aparência (antes de abrir o mundo). */
export async function buildPlayerTextures(scene: Phaser.Scene, a: Appearance): Promise<void> {
  const p = layerPieces(M, a);
  const files = [outfitFile(p.outfitInGame, 'front'), maskFile(p.outfitInGame, 'front')];
  for (const anim of M.anims) files.push(outfitFile(p.outfitInGame, anim), maskFile(p.outfitInGame, anim));
  if (p.hairInGame) {
    files.push(hairFile(p.hairInGame, 'front'));
    for (const anim of M.anims) files.push(hairFile(p.hairInGame, anim));
  }
  await loadMq(scene, files);
  const sheets = new Map<string, HTMLCanvasElement>();
  const sheet = (anim: string) => sheets.get(anim) ?? sheets.set(anim, composeLayers(scene.textures, a, anim, true)).get(anim)!;
  sheetFromCanvas(scene.textures, PLAYER_TEXTURE, sheet('walk'));
  sheetFromCanvas(scene.textures, PLAYER_IDLE_TEXTURE, sheet('idle'));
  for (const { key, pose } of allPoseTextures()) sheetFromCanvas(scene.textures, key, sheet(M.poseAnim[pose]));
}
