// Paleta do estilo novo (decisão 047): quente, mais escura e contrastada que a Cosy, com acentos pastel.
// Cada rampa vai do mais escuro ao mais claro. Luz sempre de cima à esquerda.
export type RGB = readonly [number, number, number];
export type Ramp = readonly RGB[];

export function hex(h: string): RGB {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const ramp = (...h: string[]): Ramp => h.map(hex);

export const LINE = hex('#2e1a22'); // contorno de tudo (marrom quase preto, nunca preto puro)

export const P = {
  // madeiras
  walnut: ramp('#3a1e22', '#4a2428', '#5a2e2c', '#7a3d33', '#9a5640', '#c27a52'), // móveis escuros (estante, balcão)
  oak: ramp('#5a3024', '#6b3a2a', '#8a4e32', '#a8663e', '#c4824e', '#dba068'), // piso, mesas
  pine: ramp('#7a4a30', '#9a6440', '#b8804e', '#d4a066', '#ecc48a'), // madeira clara (sisal, caixas)
  // tecidos e superfícies
  cream: ramp('#7a5a50', '#a88a76', '#ccb092', '#e6d2b0', '#f6e8cc', '#fff6e4'),
  rose: ramp('#5a2438', '#7e3448', '#a44a5e', '#c86e7c', '#e49aa0', '#f6c4c0'),
  wine: ramp('#3e1424', '#5a1e30', '#7a2a3c', '#9c3a48', '#bc5258'),
  mint: ramp('#1e3c3c', '#2a5450', '#3c7266', '#5a967e', '#82b89a', '#b0d8bc'),
  teal: ramp('#162e38', '#1f4048', '#2c5a5e', '#3e7a76', '#5c9c90'),
  sky: ramp('#2a4468', '#3c6290', '#5a86b8', '#86b0d8', '#b8d6ee', '#e4f2fa'),
  navy: ramp('#18203a', '#1f2a4a', '#2f4a7a', '#4d6ea6', '#7e9ccc'),
  lilac: ramp('#3a2a4a', '#54406a', '#74608e', '#9a86b4', '#c0b0d6', '#e2d8ee'),
  butter: ramp('#6a4a1e', '#8f6a24', '#c99a3a', '#e6c06a', '#f6dc96', '#fff0c4'),
  red: ramp('#4a1420', '#6e1f2c', '#9c2f3a', '#c4525a', '#e07a78'),
  green: ramp('#1a3024', '#24402e', '#3f6a40', '#5e9a5a', '#8ac476', '#b8e09a'),
  terracotta: ramp('#4a2420', '#6e3426', '#9a4e34', '#c0704a', '#de9a6e'),
  metal: ramp('#2a2632', '#3a3440', '#5a5662', '#8a8692', '#c0bcc4', '#e8e6ea'),
  porcelain: ramp('#8a8290', '#b8b0b8', '#dcd6dc', '#f4f0f2', '#ffffff'),
  chalk: ramp('#14201e', '#1c2c28', '#243832', '#30463e'),
  coffee: ramp('#2a1610', '#3e2218', '#5a3424', '#8a5a3a', '#c09070'),
  gold: ramp('#5a3a14', '#8a5e1e', '#b88a2e', '#e0b850', '#f8e08a'),
} as const;
