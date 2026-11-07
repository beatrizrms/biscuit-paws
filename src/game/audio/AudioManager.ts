// Áudio em dois canais independentes: música de fundo e sons ambientes. Cada um liga/desliga e tem volume
// (configurações à parte do save). Troca de faixa e liga/desliga com fade. Navegadores só deixam tocar depois
// do primeiro gesto do jogador: até lá, o pedido fica guardado e toca quando liberar.
// Sem arquivo ainda (data/audio.json: file null)? O canal funciona igual, só não toca nada.
import Phaser from 'phaser';
import audioJson from '../../../data/audio.json';
import { effectiveVolume, type Settings } from '../../core/settings';

type Channel = 'music' | 'ambient';
interface TrackDef {
  file: string | null;
  loop: boolean;
}
interface AudioData {
  fadeMs: number;
  music: Record<string, TrackDef>;
  ambient: Record<string, TrackDef>;
  scenes: Record<string, { music: string | null; ambient: string | null }>;
}
export const audioData = audioJson as unknown as AudioData;

/** Chave da faixa no carregador do Phaser. */
export const trackKey = (channel: Channel, id: string) => `${channel}:${id}`;

/** Carrega as faixas que já têm arquivo (o BootScene chama no preload). */
export function preloadAudio(load: Phaser.Loader.LoaderPlugin): void {
  for (const channel of ['music', 'ambient'] as const) {
    for (const [id, t] of Object.entries(audioData[channel])) if (t.file) load.audio(trackKey(channel, id), t.file);
  }
}

interface Playing {
  id: string;
  sound: Phaser.Sound.BaseSound | null;
}

export class AudioManager {
  private current: Record<Channel, Playing | null> = { music: null, ambient: null };
  private fades = new Set<number>();

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

  /** Aplica configurações novas (o volume muda com fade; desligar some devagar). */
  setSettings(s: Settings): void {
    this.settings = s;
    for (const ch of ['music', 'ambient'] as const) {
      const sound = this.current[ch]?.sound;
      if (sound) this.fadeTo(sound, effectiveVolume(s[ch]));
    }
  }

  /** Música e ambiente de um lugar (data/audio.json: scenes). */
  playScene(sceneId: string): void {
    const s = audioData.scenes[sceneId];
    if (!s) return;
    this.play('music', s.music);
    this.play('ambient', s.ambient);
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
    const def = audioData[channel][id];
    const key = trackKey(channel, id);
    // Sem arquivo ou ainda bloqueado: guarda o pedido (toca quando tiver/liberar).
    if (!def?.file || !this.isUnlocked() || !this.game.cache.audio.exists(key)) {
      this.current[channel] = { id, sound: null };
      return;
    }
    const sound = this.game.sound.add(key, { loop: def.loop, volume: 0 });
    sound.play();
    this.current[channel] = { id, sound };
    this.fadeTo(sound, effectiveVolume(this.settings[channel]));
  }

  /** Som curto no canal ambiente (ex.: passos). */
  sfx(id: string): void {
    const key = trackKey('ambient', id);
    if (!this.isUnlocked() || !this.game.cache.audio.exists(key)) return;
    this.game.sound.play(key, { volume: effectiveVolume(this.settings.ambient) });
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
