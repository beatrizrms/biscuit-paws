// Monta a personagem a partir das camadas do pacote (data/character.json): uma folha por pose,
// no mesmo formato da caminhada (quadros 32x64; 4 colunas; linhas baixo, esquerda, direita, cima).
// As regras (quais arquivos, em que ordem) moram em src/core/appearance.ts.
import Phaser from 'phaser';
import { allFilesFor, allWalkFiles, layerFiles, POSES, type Appearance, type LayerFile, type Pose } from '../core/appearance';
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
  for (const f of allWalkFiles(C)) load.image(layerKey(f), layerUrl(f));
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
  if (C.mannequin) return loadMannequin(scene);
  await loadLayers(scene, allFilesFor(C, a));
  composeSheet(scene.textures, PLAYER_TEXTURE, layerFiles(C, a));
  for (const pose of POSES) {
    const colors = C.poses[pose].catProp ? C.catProp.colors : [undefined];
    for (const c of colors) composeSheet(scene.textures, poseTexture(pose, c), layerFiles(C, a, pose, c));
  }
}
