// Fila de momentos: cenas que acontecem sozinhas no mundo (a Fernanda trazendo o gato operado, o Tião perguntando
// depois da obra, a fala da obra que terminou de noite). Antes cada uma esperava a tela livre por conta própria e,
// quando várias vinham juntas (de manhã, com a ligação da Fernanda no meio), uma passava por cima da outra e as falas
// se perdiam. Aqui: uma de cada vez, na ordem em que entraram; cada uma só quando a tela está livre e a hora dela
// chegou (ready: no café, no salão). As pendências de verdade ficam no save (o núcleo guarda); a fila só ordena.

export interface Moment {
  /** Identifica o momento (o mesmo momento não entra duas vezes). */
  key: string;
  /** Já pode acontecer (ex.: ela está no café)? Se não, espera e os outros prontos passam na frente. */
  ready: () => boolean;
  /** A cena; o próximo só começa quando ela termina. */
  run: () => Promise<void>;
}

export class MomentQueue {
  private items: Moment[] = [];
  private running: string | null = null;

  /** Entra no fim da fila (se já não está nela nem acontecendo agora). */
  add(m: Moment): void {
    if (this.has(m.key)) return;
    this.items.push(m);
  }

  has(key: string): boolean {
    return this.running === key || this.items.some((x) => x.key === key);
  }

  /** Algum momento acontecendo agora. */
  get busy(): boolean {
    return this.running !== null;
  }

  /** A cada quadro: com a tela livre e nada acontecendo, começa o primeiro que já pode. */
  tick(free: boolean): void {
    if (this.running || !free) return;
    const i = this.items.findIndex((m) => m.ready());
    if (i < 0) return;
    const [m] = this.items.splice(i, 1);
    this.running = m!.key;
    void m!
      .run()
      .catch((e: unknown) => console.error('momento', m!.key, e))
      .finally(() => (this.running = null));
  }
}
