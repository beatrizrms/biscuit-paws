// Áudio em dois canais de volume: música (músicas e jingles) e ambiente (sons de fundo e efeitos). Cada um
// liga/desliga e tem volume (configurações à parte do save). Troca de faixa e liga/desliga com fade. Navegadores
// só deixam tocar depois do primeiro gesto do jogador: até lá, o pedido fica guardado e toca quando liberar.
// Faixa sem arquivo (data/audio.json: file null) funciona igual, só não toca nada.
import Phaser from 'phaser';
import audioJson from '../../../data/audio.json';
import { effectiveVolume, type Settings } from '../../core/settings';

type Channel = 'music' | 'ambient';
type Group = 'music' | 'ambient' | 'jingles' | 'sfx';
interface TrackDef {
  /** [ogg, mp3] (o navegador escolhe), um caminho só, ou null. */
  file: string | string[] | null;
  loop: boolean;
  /** Mixagem da faixa (multiplica o volume do canal). */
  gain?: number;
}
interface SceneTracks {
  music: string | null;
  ambient: string | null;
}
interface AudioData {
  fadeMs: number;
  nightFrom: string;
  nightUntil: string;
  music: Record<string, TrackDef>;
  jingles: Record<string, TrackDef>;
  ambient: Record<string, TrackDef>;
  sfx: Record<string, TrackDef>;
  scenes: Record<string, { day: SceneTracks; night?: SceneTracks; busyAmbient?: string }>;
  events: { event: string; sfx?: string; jingle?: string }[];
  loops: Record<string, string>;
}
export const audioData = audioJson as unknown as AudioData;

/** Canal de volume de cada grupo de faixas. */
const CHANNEL: Record<Group, Channel> = { music: 'music', jingles: 'music', ambient: 'ambient', sfx: 'ambient' };

/** Chave da faixa no carregador do Phaser. */
export const trackKey = (group: Group, id: string) => `${group}:${id}`;

/** Carrega as faixas que já têm arquivo (o BootScene chama no preload). */
export function preloadAudio(load: Phaser.Loader.LoaderPlugin): void {
  for (const group of ['music', 'jingles', 'ambient', 'sfx'] as const) {
    for (const [id, t] of Object.entries(audioData[group])) if (t.file) load.audio(trackKey(group, id), t.file);
  }
}

/** Alguma faixa tem arquivo? (as Opções avisam quando ainda não há som nenhum.) */
export const hasAudioFiles = () => (['music', 'ambient', 'sfx'] as const).some((g) => Object.values(audioData[g]).some((t) => t.file));

interface Playing {
  id: string;
  sound: Phaser.Sound.BaseSound | null;
}

export class AudioManager {
  private current: Record<Channel, Playing | null> = { music: null, ambient: null };
  private loops = new Map<string, Phaser.Sound.BaseSound>();
  private fades = new Set<number>();
  /** Menu de pausa aberto: a música fica parada (o ambiente e os efeitos, não). */
  private musicPaused = false;

  constructor(
    private game: Phaser.Game,
    private settings: Settings,
  ) {
    // Liberou o áudio (primeiro clique/toque): começa o que estava pedido.
    game.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      for (const ch of ['music', 'ambient'] as const) {
        const p = this.current[ch];
        if (p) {
          this.current[ch] = null;
          this.play(ch, p.id);
        }
      }
    });
  }

  /** Já pode tocar (houve gesto)? */
  isUnlocked(): boolean {
    return !this.game.sound.locked;
  }

  getSettings(): Settings {
    return this.settings;
  }

  private volume(group: Group, id: string): number {
    return effectiveVolume(this.settings[CHANNEL[group]]) * (audioData[group][id]?.gain ?? 1);
  }

  private canPlay(group: Group, id: string): boolean {
    return this.isUnlocked() && !!audioData[group][id]?.file && this.game.cache.audio.exists(trackKey(group, id));
  }

  /** Aplica configurações novas (o volume muda com fade; desligar some devagar). */
  setSettings(s: Settings): void {
    this.settings = s;
    for (const ch of ['music', 'ambient'] as const) {
      const p = this.current[ch];
      if (p?.sound) this.fadeTo(p.sound, this.volume(ch, p.id));
    }
    for (const [id, sound] of this.loops) this.fadeTo(sound, this.volume('sfx', id));
  }

  /**
   * Música e ambiente de um lugar (data/audio.json: scenes), de dia ou de noite. `busy`: há clientes
   * (o café troca o ambiente pelo burburinho). Pode chamar sempre: a mesma faixa não recomeça.
   */
  playScene(sceneId: string, opts: { night?: boolean; busy?: boolean } = {}): void {
    const s = audioData.scenes[sceneId];
    if (!s) return;
    const tracks = (opts.night && s.night) || s.day;
    this.play('music', tracks.music);
    this.play('ambient', opts.busy && s.busyAmbient ? s.busyAmbient : tracks.ambient);
  }

  /** É noite para a música (data/audio.json: nightFrom, nightUntil), em minutos do dia. */
  static isNight(minutes: number): boolean {
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h! * 60 + m!;
    };
    const t = minutes % 1440;
    return t >= toMin(audioData.nightFrom) || t < toMin(audioData.nightUntil);
  }

  /**
   * Pausa (menu de pausa) ou retoma a música de fundo: para na hora e volta de onde parou, com fade. Faixa pedida
   * enquanto pausada fica guardada e começa ao retomar.
   */
  setMusicPaused(paused: boolean): void {
    if (this.musicPaused === paused) return;
    this.musicPaused = paused;
    const p = this.current.music;
    if (!p) return;
    if (paused) {
      p.sound?.pause();
      return;
    }
    if (!p.sound) {
      this.current.music = null;
      this.play('music', p.id);
      return;
    }
    (p.sound as Phaser.Sound.WebAudioSound).setVolume?.(0);
    p.sound.resume();
    this.fadeTo(p.sound, this.volume('music', p.id));
  }

  /** Troca a faixa do canal (com fade); null para. */
  play(channel: Channel, id: string | null): void {
    const cur = this.current[channel];
    if (cur?.id === id && (cur.sound || !this.isUnlocked())) return;
    if (cur?.sound) {
      const old = cur.sound;
      this.fadeTo(old, 0, () => old.destroy());
    }
    if (!id) {
      this.current[channel] = null;
      return;
    }
    // Sem arquivo, ainda bloqueado ou música pausada (menu de pausa): guarda o pedido (toca quando tiver/liberar/retomar).
    if (!this.canPlay(channel, id) || (channel === 'music' && this.musicPaused)) {
      this.current[channel] = { id, sound: null };
      return;
    }
    const sound = this.game.sound.add(trackKey(channel, id), { loop: audioData[channel][id]!.loop, volume: 0 });
    sound.play();
    this.current[channel] = { id, sound };
    this.fadeTo(sound, this.volume(channel, id));
  }

  /** Efeito curto (moeda, sino, miado...). */
  sfx(id: string, opts: { rate?: number } = {}): void {
    // rate: mais rápido = mais agudo (a dica "quente" da caça ao filhote).
    if (this.canPlay('sfx', id)) this.game.sound.play(trackKey('sfx', id), { volume: this.volume('sfx', id), rate: opts.rate ?? 1 });
  }

  /** Jingle (uma vez, por cima da música). */
  jingle(id: string): void {
    if (this.canPlay('jingles', id)) this.game.sound.play(trackKey('jingles', id), { volume: this.volume('jingles', id) });
  }

  /** Efeito em repetição enquanto `on` (cafeteira, pia, ronronar). Pode chamar sempre. */
  setLoop(id: string, on: boolean): void {
    const playing = this.loops.get(id);
    if (on && !playing && this.canPlay('sfx', id)) {
      const sound = this.game.sound.add(trackKey('sfx', id), { loop: true, volume: 0 });
      sound.play();
      this.loops.set(id, sound);
      this.fadeTo(sound, this.volume('sfx', id));
    } else if (!on && playing) {
      this.loops.delete(id);
      this.fadeTo(playing, 0, () => playing.destroy());
    }
  }

  /** Faixa pedida em cada canal (para a interface e os testes). */
  playing(): Record<Channel, string | null> {
    return { music: this.current.music?.id ?? null, ambient: this.current.ambient?.id ?? null };
  }

  /** Abaixa tudo devagar (ao sair de uma cena). */
  fadeOutAll(): void {
    for (const ch of ['music', 'ambient'] as const) {
      const sound = this.current[ch]?.sound;
      if (sound) this.fadeTo(sound, 0, () => sound.destroy());
      this.current[ch] = null;
    }
    for (const id of [...this.loops.keys()]) this.setLoop(id, false);
  }

  private fadeTo(sound: Phaser.Sound.BaseSound, target: number, done?: () => void): void {
    const s = sound as Phaser.Sound.WebAudioSound;
    const from = typeof s.volume === 'number' ? s.volume : 0;
    const ms = audioData.fadeMs;
    const start = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / ms);
      if (typeof s.setVolume === 'function') s.setVolume(from + (target - from) * k);
      if (k >= 1) {
        window.clearInterval(id);
        this.fades.delete(id);
        done?.();
      }
    }, 40);
    this.fades.add(id);
  }
}
