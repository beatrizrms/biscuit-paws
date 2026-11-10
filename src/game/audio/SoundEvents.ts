// Liga o jogo ao áudio: eventos do núcleo -> efeitos e jingles (tabela em data/audio.json: events),
// efeitos em repetição enquanto algo acontece (preparo, pia, gato no colo) e a música/ambiente do lugar
// (dia ou noite; burburinho com clientes no café). Só toca: não decide regra nenhuma.
import type { GameSession } from '../../core/session';
import { AudioManager, audioData } from './AudioManager';

/** Equipamentos que "chiam" (o resto borbulha como a cafeteira). */
const SIZZLE = new Set(['stove', 'oven']);

export class SoundEvents {
  private hands = 0;

  constructor(
    private session: GameSession,
    private audio: AudioManager,
  ) {
    this.hands = session.state.hands.length;
    session.bus.onAny((name) => {
      for (const rule of audioData.events) {
        if (rule.event !== name) continue;
        if (rule.sfx) audio.sfx(rule.sfx);
        if (rule.jingle) audio.jingle(rule.jingle);
      }
    });
    // Pegar e soltar: pelo número de coisas nas mãos.
    session.bus.on('hands.changed', ({ count }) => {
      if (count > this.hands) audio.sfx('pick_up');
      else if (count < this.hands) audio.sfx('put_down');
      this.hands = count;
    });
  }

  /** A cada quadro: música do lugar (dia/noite, movimento) e efeitos em repetição. */
  update(): void {
    const { session, audio } = this;
    const st = session.state;
    const home = session.atHome();
    audio.playScene(session.location(), {
      night: AudioManager.isNight(st.time),
      busy: home && st.service.customers.length > 0,
    });
    const equipment = home ? st.service.preps.map((p) => session.service.equipmentOf(p.stationUid) ?? '') : [];
    audio.setLoop('coffee_brewing', equipment.some((e) => e && !SIZZLE.has(e)));
    audio.setLoop('stove_sizzle', equipment.some((e) => SIZZLE.has(e)));
    // A água da pia só corre com ela lavando ali (fora, a lavagem pausa); a lava-louças lava sozinha.
    audio.setLoop('sink_water', home && ((st.sink.washing !== null && !session.service.sinkPaused()) || Object.values(st.washers).some((w) => w.washing !== null)));
    audio.setLoop('purr', session.service.carriedCat() !== undefined);
  }
}
