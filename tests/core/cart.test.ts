import { describe, expect, it } from 'vitest';
import { Cart } from '../../src/core/cart';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const price = (id: string) => content.items[id]!.price;

function market(money: number) {
  const state = newGameState(money, 'map.market');
  // Café já evoluído: todas as receitas destrancadas, então o mercado vende todos os ingredientes.
  state.service.served = 999;
  const session = new GameSession(content, state);
  const events: string[] = [];
  session.bus.onAny((name) => events.push(name));
  return { session, events };
}

describe('Cart', () => {
  it('soma unidades e valor; tirar tudo some com a linha', () => {
    const cart = new Cart();
    cart.add('a', 3);
    cart.add('b');
    expect(cart.count()).toBe(4);
    expect(cart.total((id) => (id === 'a' ? 2 : 10))).toBe(16);
    cart.remove('a', 3);
    expect(cart.lines()).toEqual([{ itemId: 'b', qty: 1 }]);
  });

  it('respeita o máximo e nunca fica negativo', () => {
    const cart = new Cart();
    cart.add('t', 5, 1);
    expect(cart.qty('t')).toBe(1);
    cart.remove('t', 9);
    expect(cart.isEmpty()).toBe(true);
  });
});

describe('carrinho do mercado na sessão', () => {
  it('pôr no carrinho não cobra; o caixa cobra tudo e entrega na mochila', () => {
    const { session, events } = market(100);
    session.addToCart('item.orange');
    session.addToCart('item.orange');
    session.addToCart('item.sugar');
    expect(session.state.money).toBe(100);
    expect(session.state.inventory['item.orange']).toBeUndefined();
    const total = 2 * price('item.orange') + price('item.sugar');
    expect(session.cartTotal()).toBe(total);
    expect(session.checkout()).toEqual({ ok: true });
    expect(session.state.money).toBe(100 - total);
    expect(session.state.inventory['item.orange']).toBe(2);
    expect(session.cart.isEmpty()).toBe(true);
    expect(events.filter((e) => e === 'item.bought')).toHaveLength(3);
    expect(events).toContain('cart.checked_out');
  });

  it('sem dinheiro o caixa avisa quanto falta e nada muda; tirando itens, passa', () => {
    const { session } = market(20);
    session.addToCart('item.coffee_beans_bag');
    session.addToCart('item.sugar');
    expect(session.cartShortfall()).toBe(price('item.coffee_beans_bag') + price('item.sugar') - 20);
    expect(session.checkout()).toEqual({ ok: false, reason: 'no_money' });
    expect(session.state.money).toBe(20);
    expect(session.state.inventory['item.sugar']).toBeUndefined();
    session.removeFromCart('item.coffee_beans_bag', true);
    expect(session.checkout()).toEqual({ ok: true });
    expect(session.state.inventory['item.sugar']).toBe(1);
  });

  it('carrinho vazio não passa no caixa', () => {
    expect(market(50).session.checkout()).toEqual({ ok: false, reason: 'cart_empty' });
  });

  it('ferramenta: só uma; saco pesado: um por compra, vai para as mãos', () => {
    const { session } = market(500);
    expect(session.addToCart('item.tray')).toEqual({ ok: true });
    expect(session.addToCart('item.tray').ok).toBe(false);
    expect(session.addToCart('item.cat_food_sack')).toEqual({ ok: true });
    expect(session.addToCart('item.litter_sack')).toEqual({ ok: false, reason: 'one_heavy_per_trip' });
    expect(session.checkout()).toEqual({ ok: true });
    expect(session.state.inventory['item.tray']).toBe(1);
    expect(session.state.inventory['item.cat_food_sack']).toBeUndefined();
    expect(session.state.hands.some((h) => h.kind === 'heavy' && h.item === 'item.cat_food_sack')).toBe(true);
  });

  it('o carrinho fica ao sair do mercado e esvazia ao dormir', () => {
    const { session } = market(50);
    session.addToCart('item.lemon');
    session.enter('map.street');
    expect(session.cart.count()).toBe(1);
    session.endDay('home');
    expect(session.cart.isEmpty()).toBe(true);
  });
});
