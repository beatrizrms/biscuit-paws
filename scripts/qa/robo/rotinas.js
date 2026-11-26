// Rotinas do robô de teste (rodam dentro da página do jogo). Usadas por scripts/qa/robo-jogadora.ts.
// Só apertam teclas, clicam e leem o estado: não mudam regra nenhuma do jogo. O relógio pode correr mais depressa
// (window.__K), para um dia não levar 10 minutos reais.
(() => {
  const W = window;
  const KC = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, e: 69, r: 82, ' ': 32, Enter: 13, Escape: 27 };
  const code = (k) => (k.startsWith('Arrow') ? k : k === ' ' ? 'Space' : k === 'Enter' ? 'Enter' : k === 'Escape' ? 'Escape' : /^[0-9]$/.test(k) ? 'Digit' + k : 'Key' + k.toUpperCase());
  const ev = (t, k) => W.dispatchEvent(new KeyboardEvent(t, { key: k, code: code(k), keyCode: KC[k] ?? (/^[0-9]$/.test(k) ? 48 + +k : 0), which: KC[k] ?? 0, bubbles: true }));
  W.__ev = ev;
  W.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  W.__hold = async (k, ms) => { ev('keydown', k); await __wait(ms); ev('keyup', k); };
  W.__tap = async (k) => { await __hold(k, 80); await __wait(450); };
  W.__sel = async (n) => { await __hold(String(n), 80); await __wait(250); };
  const G = () => W.__biscuitPaws && (W.__biscuitPaws.cafe || W.__biscuitPaws.world);
  W.__G = G;
  const S = () => G().session;
  const loc = () => S().state.location;

  // Relógio acelerado: __K multiplica o tempo do jogo (1 = normal). Não muda o código do jogo.
  W.__K = W.__K || 1;
  W.__patchClock = () => { const s = S(); if (!s.__origTick) { s.__origTick = s.tickClock.bind(s); s.tickClock = (dt) => s.__origTick(dt * (W.__K || 1)); } return true; };
  W.__mute = () => { const n = G().game.sound.masterMuteNode; if (n) { n.gain.cancelScheduledValues(0); n.gain.value = 0; } };

  W.__go = async (tx, ty, timeout = 9000) => {
    const p = () => G().player; const loc0 = loc(); const t0 = Date.now(); ev('keydown', 'r');
    try {
      for (const [axis, target, neg, pos] of [['x', tx, 'ArrowLeft', 'ArrowRight'], ['y', ty, 'ArrowUp', 'ArrowDown']]) {
        if (target == null) continue;
        const k = p()[axis] > target ? neg : pos; const sign = k === pos ? 1 : -1; ev('keydown', k);
        let last = p()[axis], still = 0;
        while ((target - p()[axis]) * sign > 2 && Date.now() - t0 < timeout && loc() === loc0) { await __wait(30); if (Math.abs(p()[axis] - last) < 0.2) { if (++still > 15) break; } else still = 0; last = p()[axis]; }
        ev('keyup', k); if (loc() !== loc0) break;
      }
    } finally { for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'r']) ev('keyup', k); }
    return [p().x | 0, p().y | 0, loc()];
  };
  W.__vis = () => { const ui = document.querySelector('#ui') || document.body; return [...ui.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.1).map((e) => e.textContent.trim()).join(' | ').slice(0, 2200); };
  W.__click = (txt) => { const e = [...document.querySelectorAll('#ui *')].find((e) => e.children.length === 0 && e.textContent.trim() === txt && e.getClientRects().length); if (!e) return false; (e.closest('button,[data-item],.card') || e).click(); return true; };
  W.__dlg = async (max = 25) => { const out = []; const open = () => document.querySelector('.dialogue-layer.open'); const txt = () => { const l = open(); return l ? l.querySelector('.panel').innerText.replace(/\s+/g, ' ').trim() : null; }; for (let i = 0; i < max; i++) { if (!open()) { await __wait(1200); if (!open()) break; } let prev = '', cur = txt(), n = 0; while (cur !== prev && n < 40) { prev = cur; await __wait(250); cur = txt(); n++; } if (cur) out.push(cur); await __hold(' ', 80); await __wait(500); } return out; };
  // Cena de tela cheia (ligação, abertura): avança lendo.
  W.__cut = async (max = 30) => { const out = []; let last = ''; for (let i = 0; i < max; i++) { let prev = 'x', cur = __vis(), k = 0; while (cur !== prev && k < 20) { prev = cur; await __wait(250); cur = __vis(); k++; } const t = cur.replace(/^.*Energia \| \d+ \| /, '').replace(/ \| Espaço: Continuar$/, ''); if (!/Continuar/.test(cur) && !document.querySelector('.dialogue-layer.open')) { out.push('[fim] ' + t.slice(0, 260)); break; } if (t !== last) out.push(t.slice(0, 260)); last = t; await __hold(' ', 80); await __wait(500); } return out; };
  W.__st = () => { const s = S().state; const p = G().player; return { day: s.day, time: Math.floor(s.time / 60) + ':' + String(Math.floor(s.time % 60)).padStart(2, '0'), money: s.money, energy: s.energy, loc: s.location, pos: [p.x | 0, p.y | 0] }; };
  W.__goals = () => S().goals().map((g) => g.title + ': ' + g.steps.map((x) => (x.done ? '[x] ' : '[ ] ') + x.text).join(' / '));
  W.__slot = (id) => S().state.hotbar.slots.indexOf(id) + 1;
  // A vassoura na barra (num espaço vazio, sem tirar o que já está lá).
  W.__broom = () => { const s = S(); if (__slot('item.broom') === 0) { const free = s.state.hotbar.slots.indexOf(null); if (free >= 0) s.state.hotbar.slots[free] = 'item.broom'; } return __slot('item.broom'); };
  W.__toBar = (id) => { const s = S(); if (__slot(id) === 0 && (s.state.inventory[id] || 0) > 0) { const free = s.state.hotbar.slots.indexOf(null); if (free >= 0) s.state.hotbar.slots[free] = id; } return __slot(id); };
  W.__cell = () => { const p = G().player; return [Math.floor(p.x / 32), Math.floor((p.y - 1) / 32)]; };
  W.__log = W.__log || [];
  W.__L = (m) => { const s = S().state; W.__log.push('d' + s.day + ' ' + Math.floor(s.time / 60) + ':' + String(Math.floor(s.time % 60)).padStart(2, '0') + ' ' + m); };

  // Caminhada com desvio (usa o findPath do próprio jogo).
  W.__walk = async (to, timeout = 30000) => {
    if (!W.__P) W.__P = await import('/src/core/path.ts');
    const g = G(); const P = W.__P; const loc0 = loc(); let prev = __cell(); const ctr = (c, r) => [c * 32 + 16, (r + 1) * 32 - 8];
    if (prev[0] === to[0] && prev[1] === to[1]) { const [tx, ty] = ctr(...to); if (Math.abs(g.player.x - tx) > 2) await __go(tx, null, 2000); if (Math.abs(g.player.y - ty) > 2) await __go(null, ty, 2000); return prev; }
    let grid; try { grid = g.solidWith([], to); } catch (e) { return 'grid err ' + e; }
    const path = P.findPath(grid, prev, to); if (!path) return 'no path ' + prev + '->' + to;
    const corners = P.pathCorners(path); const t0 = Date.now();
    for (const [c, r] of corners) {
      if (loc() !== loc0) return 'map ' + loc();
      const [tx, ty] = ctr(c, r); const [px, py] = ctr(...prev);
      if (c === prev[0]) { if (Math.abs(g.player.x - px) > 1) await __go(px, null, 1500); await __go(null, ty, 7000); }
      else if (r === prev[1]) { if (Math.abs(g.player.y - py) > 1) await __go(null, py, 1500); await __go(tx, null, 7000); }
      else { await __go(null, ty, 7000); await __go(tx, null, 7000); }
      prev = [c, r]; if (Date.now() - t0 > timeout) return 'timeout at ' + __cell();
    }
    if (loc() === loc0) { const [tx, ty] = ctr(...to); if (Math.abs(g.player.x - tx) > 3) await __go(tx, null, 2500); if (Math.abs(g.player.y - ty) > 3) await __go(null, ty, 2500); }
    return __cell();
  };
  const DIR = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  W.__face = async (d) => { await __hold(DIR[d], 110); await __wait(250); };
  W.__use = async (stand, dir) => { const r = await __walk(stand); await __face(dir); await __tap('e'); await __wait(1100); return r; };
  W.__adj = (at, prefer = [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) => { const grid = G().solidWith([], at); for (const [dx, dy, f] of prefer) { const c = [at[0] + dx, at[1] + dy]; if (grid[c[1]] && grid[c[1]][c[0]] === false) return { c, f }; } return null; };
  W.__useAt = async (at, prefer) => { const a = __adj(at, prefer); if (!a) return 'sem acesso'; await __walk(a.c); await __face(a.f); await __tap('e'); await __wait(700); return 'ok'; };

  // Mapas
  W.__leaveMarket = async () => { __click('fechar'); await __wait(300); await __arrive([10, 11]); await __go(null, 470, 4000); await __wait(2200); return __st(); };
  W.__leaveVet = async () => { await __walk([5, 10]); await __go(null, 11 * 32 + 30, 3000); await __wait(2300); return __st(); };
  W.__leaveCafe = async () => { await __walk([14, 10]); await __go(null, 400, 3000); await __wait(2300); if (/Encerrar o dia/.test(__vis())) { __click('Ainda não'); await __wait(600); await __walk([14, 10]); await __go(null, 400, 3000); await __wait(2300); } return __st(); };
  W.__enterDoor = async (col, row) => { await __walk([col, row + 1]); await __go(null, (row + 1) * 32 - 40, 3000); await __wait(2300); return __st(); };
  W.__goMap = async (target) => {
    if (loc() === target) return loc();
    if (loc() === 'map.market') await __leaveMarket(); else if (loc() === 'map.cafe_main') await __leaveCafe(); else if (loc() === 'map.vet_clinic') await __leaveVet(); else if (loc() !== 'map.street') return 'em ' + loc();
    if (loc() !== 'map.street') return 'preso em ' + loc();
    if (target === 'map.market') await __enterDoor(24, 8); else if (target === 'map.cafe_main') await __enterDoor(17, 8); else if (target === 'map.vet_clinic') await __enterDoor(33, 8);
    return loc();
  };

  // Compras no Mercado da Vila: {itemId: qtd}
  // Chega a uma célula de verdade: se o caminho falhar (alguém na frente), dá um passo para o lado e tenta de novo.
  W.__arrive = async (cell) => {
    let r;
    for (let i = 0; i < 4; i++) {
      r = await __walk(cell); const c = __cell();
      if (c[0] === cell[0] && c[1] === cell[1]) return 'ok';
      for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) ev('keyup', k);
      await __hold(['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight'][i], 350); await __wait(600);
    }
    return 'não cheguei em ' + cell + ' (parei em ' + __cell() + '; ' + r + ')';
  };
  const closePanel = async () => { for (let i = 0; i < 3 && document.querySelector('.catalog.open, .shop.open, .phone-ui.open'); i++) { if (!__click('fechar')) await __hold('Escape', 80); await __wait(350); } };
  W.__buy = async (list) => {
    const s = S(); const shelfOf = (id) => { const t = s.content.items[id].tags; if (t.includes('pet')) return [[9, 3], 'up']; if (t.includes('fruit')) return [[12, 3], 'down']; return [[4, 3], 'down']; };
    const log = []; const groups = {}; const row = (id) => document.querySelector('[data-row="' + id + '"] [data-act="add"]');
    for (const id of Object.keys(list)) { const k = JSON.stringify(shelfOf(id)); (groups[k] = groups[k] || []).push(id); }
    for (const k of Object.keys(groups)) {
      const [stand, dir] = JSON.parse(k); await closePanel();
      const got = await __arrive(stand); if (got !== 'ok') { log.push('prateleira: ' + got); continue; }
      await __face(dir); await __tap('e'); await __wait(1100);
      for (const id of groups[k]) { const b = row(id); if (!b) { log.push('sem ' + id); continue; } for (let i = 0; i < list[id]; i++) { b.click(); await __wait(150); } }
      await closePanel();
    }
    let cart = '';
    for (let t = 0; t < 3; t++) {
      await closePanel(); const got = await __arrive([15, 9]); if (got !== 'ok') { log.push('caixa: ' + got); continue; }
      await __face('left'); await __tap('e'); await __wait(1100);
      const v = __vis(); if (!/Caixa ·/.test(v)) { log.push('caixa não abriu: ' + v.slice(60, 160)); continue; }
      cart = v.slice(v.indexOf('No carrinho'), v.indexOf('No carrinho') + 40); await __hold('Enter', 80); await __wait(1000); break;
    }
    await closePanel();
    return { log, cart, money: s.state.money };
  };

  // Minijogos
  const mgScene = () => G().game.scene.getScenes(true).find((s) => /MiniGame/.test(s.sys.settings.key));
  // O vigia (clearScreens, a cada 3 s) pulava o mini game do remédio no meio da rotina: enquanto ela joga, ele espera.
  W.__pill = async () => { W.__mgOwner = true; try { return await pillPlay(); } finally { W.__mgOwner = false; } };
  const pillPlay = async () => {
    await __wait(1200); if (!mgScene()) return 'sem minijogo'; await __tap('e'); await __wait(700);
    const cv = document.querySelector('canvas'); const r = cv.getBoundingClientRect();
    const P = (t, x, y, b) => { const o = { clientX: r.left + (x / 800) * r.width, clientY: r.top + (y / 450) * r.height, bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: b }; cv.dispatchEvent(new PointerEvent('pointer' + t, o)); cv.dispatchEvent(new MouseEvent('mouse' + t, o)); };
    const pct = () => +(__vis().match(/coberto:? (\d+)%/) || [0, 0])[1]; const cx = 250, cy = 260;
    P('down', cx, cy, 1); let t0 = Date.now(), a = 0;
    while (pct() < 100 && Date.now() - t0 < 15000) { a += 0.5; P('move', cx + Math.cos(a) * (6 + (a % 12)), cy + Math.sin(a * 1.3) * (4 + (a % 7)), 1); await __wait(16); }
    P('up', cx, cy, 0); const covered = pct(); await __tap('e'); await __wait(600); t0 = Date.now();
    while (Date.now() - t0 < 15000) { const mm = mgScene(); if (!mm || mm.phase === 'result') break; if (mm.s && mm.s.mood === 'distracted') { await __tap('e'); await __wait(1200); if (/Perfeito|Conseguiu|Não deu/.test(__vis())) break; } await __wait(80); }
    await __wait(800); const res = __vis().slice(0, 200); await __tap('e'); await __wait(2200); return 'remedio ' + covered + '%: ' + res.replace(/^.*coberto \d+% \| /, '');
  };
  W.__mgHandle = async () => {
    await __wait(1500); const m = mgScene(); if (!m) return null; const key = m.sys.settings.key;
    if (/chase/.test(key)) {
      await __tap('e'); await __wait(600); const dirs = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false }; const set = (k, on) => { if (dirs[k] !== on) { ev(on ? 'keydown' : 'keyup', k); dirs[k] = on; } };
      const t0 = Date.now(); let last = null;
      while (Date.now() - t0 < 46000) { const mm = mgScene(); if (!mm || mm.phase === 'result') break; const c = mm.cat, p = mm.player; if (c && p) { const tgt = c.visible !== false ? (last = { x: c.x, y: c.y }) : last; if (tgt) { const dx = tgt.x - p.x, dy = tgt.y - p.y; set('ArrowLeft', dx < -6); set('ArrowRight', dx > 6); set('ArrowUp', dy < -6); set('ArrowDown', dy > 6); } } await __wait(40); }
      for (const k of Object.keys(dirs)) ev('keyup', k); await __wait(1200); const res = __vis().slice(0, 160); await __tap('e'); await __wait(2000); return key + ': ' + res;
    }
    const intro = __vis().slice(0, 300); const b = [...document.querySelectorAll('button')].find((b) => /Pular/.test(b.textContent) && b.getClientRects().length); if (b) b.click(); await __wait(1500); const res = __vis().slice(0, 160); await __tap('e'); await __wait(2000);
    return key + ' (pulei) ' + (W.__seenMg && W.__seenMg[key] ? '' : 'INTRO: ' + intro + ' ') + '=> ' + res + ((W.__seenMg = W.__seenMg || {})[key] = true, '');
  };

  // Pedidos da vila
  W.__doJob = async (id) => {
    const s = S(); const log = []; if (!s.state.jobs.active.includes(id)) { const r = s.acceptJob(id); if (!r.ok) return ['aceitar: ' + r.reason]; }
    const t0 = Date.now(); let hops = 0; const isJobPt = (p) => s.content.jobs[id].steps.some((st) => st.points.includes(p.id));
    while (s.state.jobs.active.includes(id) && Date.now() - t0 < 120000) {
      const p = s.pendingJobPoints().find((p) => p.map === loc() && isJobPt(p));
      if (!p) { if (hops++ > 3) { log.push('sem ponto'); break; } const to = loc() === 'map.street' ? 'map.market' : 'map.street'; const m = await __goMap(to); log.push('-> ' + m); continue; }
      const grid = G().solidWith([], p.at);
      const opts = [[0, 1, 'up'], [0, -1, 'down'], [-1, 0, 'right'], [1, 0, 'left'], [0, 2, 'up']].map(([dx, dy, f]) => ({ c: [p.at[0] + dx, p.at[1] + dy], f })).filter((o) => grid[o.c[1]] && grid[o.c[1]][o.c[0]] === false);
      if (!opts.length) { log.push('sem acesso ' + p.id); break; }
      await __sel(p.action === 'sweep' ? __broom() : 0); await __walk(opts[0].c); await __face(opts[0].f); await __tap('e'); await __wait(p.action === 'sweep' ? 1800 : 1000); __click('fechar');
      const mg = p.action === 'minigame' ? await __mgHandle() : null;
      log.push(p.id + (s.pendingJobPoints().some((q) => q.id === p.id) ? ' pend' : ' ok') + (mg ? ' [' + mg + ']' : ''));
    }
    return log.concat([s.state.jobs.active.includes(id) ? 'EM ANDAMENTO' : 'feito', 'moedas ' + s.state.money]);
  };

  // Café: tarefas do dia, gato doente, atendimento
  W.__choresWalk = async () => {
    const s = S(); const log = []; const bowl = s.state.placed.find((p) => p.item === 'item.food_bowl'); const boxes = s.state.placed.filter((p) => p.item === 'item.litter_box');
    const need = (k) => s.chores().some((c) => c.kind === k && !c.done);
    for (const id of ['item.food_recovery', 'item.cat_food_basic', 'item.cat_litter', 'item.vet_medicine']) __toBar(id);
    if (need('feed') && __slot('item.cat_food_basic') > 0 && (s.state.inventory['item.cat_food_basic'] || 0) > 0) { await __sel(__slot('item.cat_food_basic')); await __useAt(bowl.at); await __wait(900); log.push('racao'); }
    if (need('litter') && (s.state.inventory['item.cat_litter'] || 0) > 0) { for (const b of boxes) { await __sel(__slot('item.cat_litter')); await __useAt(b.at, [[1, 0, 'left'], [0, 1, 'up'], [-1, 0, 'right'], [0, -1, 'down']]); await __wait(900); } log.push('areia'); }
    await __sel(__broom()); for (const d of s.visibleDirt().filter((d) => !d.clearedBy && !d.heavy)) { await __useAt(d.at, [[0, 1, 'up'], [1, 0, 'left'], [-1, 0, 'right'], [0, -1, 'down']]); await __wait(1500); }
    await __sel(0); return log.concat(s.chores().filter((c) => !c.done).map((c) => 'falta ' + c.kind + (c.need ? ':' + c.need : '') + (c.clinic ? ':' + c.clinic : '')));
  };
  W.__sickCare = async () => {
    const s = S(); const log = []; const boxes = G().isoBoxes ? [...G().isoBoxes.entries()] : [];
    const cellOf = (spr) => [Math.floor(spr.x / 32), Math.floor((spr.y - 1) / 32)];
    // A latinha do cercadinho/caixinha (gatos isolados em recuperação).
    for (const [, spr] of boxes) {
      if (s.chores().some((c) => c.kind === 'clinic' && c.clinic === 'pen_food' && !c.done) && __slot('item.food_recovery') > 0) { await __sel(__slot('item.food_recovery')); await __useAt(cellOf(spr)); await __wait(1200); log.push('recovery'); }
    }
    const pens = s.clinic.pens(); const assign = s.clinic.penAssignments();
    if (pens.length && s.chores().some((c) => c.kind === 'clinic' && c.clinic === 'pen_food' && !c.done) && __slot('item.food_recovery') > 0) { await __sel(__slot('item.food_recovery')); await __useAt(pens[0].at); await __wait(1200); log.push('recovery no cercadinho'); }
    // Remédio de hoje para todo gato que precisa (doença ou pós-cirurgia), onde ele estiver: caixinha, cercadinho ou
    // solto no café. Antes só os da caixinha recebiam, e o mini game do remédio quase nunca era jogado.
    const due = s.shelteredCats().filter((id) => { const p = s.medicineProblem(id); return p === null || p === 'needs_medicine'; });
    for (const id of due) {
      if (__slot('item.vet_medicine') <= 0) { log.push('sem remédio na barra para ' + id); break; }
      const box = boxes.find(([cid]) => cid === id); const penUid = Object.keys(assign.pen).find((u) => assign.pen[u].includes(id));
      const pen = penUid && pens.find((p) => p.uid === penUid); const free = G().cats.find((c) => c.catId === id && c.visible);
      const at = box ? cellOf(box[1]) : pen ? pen.at : free ? free.cell() : null;
      if (!at) { log.push('remédio: não achei ' + id); continue; }
      await __sel(__slot('item.vet_medicine')); await __useAt(at, [[0, 1, 'up'], [1, 0, 'left'], [-1, 0, 'right'], [0, -1, 'down']]);
      log.push((box ? 'caixinha ' : pen ? 'cercadinho ' : 'solto ') + id + ': ' + (await __pill()));
    }
    await __sel(0); return log;
  };
  W.__serveOnce = async () => {
    const s = S(); const sv = s.service; const st = s.state; await __sel(0);
    const d = await __dlg(3); if (d.length) return 'fala: ' + d.join(' / ').slice(0, 300);
    if (/Oba!/.test(__vis())) { const v = __vis(); __click('Oba!'); return 'popup: ' + v.slice(v.search(/Novidade|Nova conquista/), v.search(/Novidade|Nova conquista/) + 300); }
    const hands = st.hands; const drink = hands.find((h) => h.kind === 'drink'); const dirty = hands.find((h) => h.kind === 'dirty');
    const waiting = st.service.customers.filter((c) => c.stage === 'waiting' && c.recipe).sort((a, b) => a.until - b.until);
    if (drink) { const c = waiting.find((c) => c.recipe === drink.recipe) || waiting[0]; if (!c) { const t = st.placed.find((p) => /table|counter/.test(p.item)); await __useAt(t ? t.at : [11, 7]); return 'sem cliente: deixei na mesa'; } const a = __adj(c.dishAt, [[-1, 0, 'right'], [1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']]) || __adj(c.spot); await __walk(a.c); await __face(a.f); await __tap('e'); await __wait(800); return 'servi ' + c.id + ' (' + c.recipe.replace('recipe.', '') + ') moedas ' + st.money; }
    if (dirty) { await __walk([0, 4]); await __face('up'); await __tap('e'); await __wait(700); await __tap('e'); await __wait(2600); return 'lavei'; }
    const stations = sv.allStations(); const ready = st.surfaces.find((x) => x.item.kind === 'drink' && stations.some((q) => q.at[0] === x.at[0] && q.at[1] === x.at[1]));
    if (ready) { await __useAt(ready.at); return 'peguei pronto'; }
    if (waiting.length) { const station = stations[0]; if (stations.some((q) => sv.prepProgress(q.uid) !== undefined)) { await __wait(1200); return 'preparando'; } await __useAt(station.at); await __wait(600); const v = __vis(); const m = v.match(/\| 1 \| 2( \| 3)?$/); if (m) { const want = waiting[0].recipe; const names = [...document.querySelectorAll('#ui button')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()); const rn = s.content.recipes[want]?.name; const i = names.findIndex((n) => rn && n.includes(rn)); if (i >= 0) [...document.querySelectorAll('#ui button')].filter((b) => b.getClientRects().length)[i].click(); else await __sel(1); } return 'comecei preparo'; }
    const dsurf = st.surfaces.find((x) => x.item.kind === 'dirty'); if (dsurf) { await __useAt(dsurf.at, [[-1, 0, 'right'], [1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']]); return 'peguei suja'; }
    await __wait(1500); return 'ocioso';
  };
  // Atende até `untilMin` (minutos do dia). Relógio: kIdle sem cliente esperando, kBusy com cliente.
  W.__serveLoop = async (untilMin, kIdle = 1, kBusy = 1) => {
    W.__serving = true; const s = S();
    while (W.__serving && s.state.time < untilMin && loc() === 'map.cafe_main') {
      const busy = s.state.service.customers.some((c) => c.stage === 'waiting' && c.recipe) || s.state.hands.length > 0 || s.state.surfaces.length > 0;
      W.__K = busy ? kBusy : kIdle;
      let r; try { r = await __serveOnce(); } catch (e) { r = 'erro ' + e; await __wait(1000); }
      if (r !== 'ocioso' && r !== 'preparando' && r !== 'peguei suja' && r !== 'lavei' && r !== 'comecei preparo' && r !== 'peguei pronto') __L(r);
    }
    W.__K = 1; W.__serving = false; __L('fim atendimento');
  };

  // Fim do dia: pela porta (depois das 17h) ou pelo ônibus. Espera os clientes saírem.
  W.__endDay = async () => {
    const g = G(); const day0 = g.session.state.day; W.__K = 1;
    for (let i = 0; i < 6 && g.session.state.day === day0; i++) {
      // Fora do café com cliente lá dentro: o ônibus não leva. Espera (relógio depressa) até o último sair.
      if (loc() !== 'map.cafe_main' && g.session.state.service.customers.length > 0) { W.__K = 10; for (let j = 0; j < 90 && g.session.state.service.customers.length > 0 && g.session.state.day === day0; j++) await __wait(1000); W.__K = 1; }
      if (loc() === 'map.market') await __leaveMarket(); if (loc() === 'map.vet_clinic') await __leaveVet();
      if (loc() === 'map.cafe_main') { await __walk([14, 10]); await __go(null, 400, 3000); await __wait(2300); if (/Encerrar o dia/.test(__vis())) { const b = [...document.querySelectorAll('#ui button')].find((b) => b.textContent.trim() === 'Ir para casa'); if (b) b.click(); await __wait(2500); } }
      else if (loc() === 'map.street') { await __walk([38, 9]); await __wait(300); await __tap('e'); await __wait(1200); if (/Para onde/.test(__vis())) { const b = [...document.querySelectorAll('#ui button')].find((b) => /Ir para casa/.test(b.textContent)); if (b) b.click(); else await __sel(1); await __wait(2500); } else await __dlg(3); }
      const v = __vis(); if (/Ainda tem cliente/.test(v)) { W.__K = 8; await __wait(5000); W.__K = 1; }
      await __wait(5000);
    }
    await __wait(2500);
    return { st: __st() };
  };
  // Manhã: fecha popups e falas, devolve o que apareceu.
  W.__morning = async () => {
    const out = []; for (let k = 0; k < 5; k++) { const v = __vis(); if (/Oba!/.test(v)) { const i = v.search(/Novidade|Nova conquista/); out.push('POPUP ' + v.slice(i, i + 500)); __click('Oba!'); await __wait(900); continue; } const d = await __dlg(12); if (d.length) { out.push(...d.map((x) => 'FALA ' + x)); continue; } break; }
    const s = S(); return { out, st: __st(), jobs: s.availableJobs().map((j) => j.id.replace('job.', '') + ':' + j.reward), news: s.news().map((n) => n.headline), goals: __goals().map((g) => g.slice(0, 500)), chores: s.chores().filter((c) => !c.done).map((c) => c.kind + (c.need ? ':' + c.need : '') + (c.clinic ? ':' + c.clinic : '')) };
  };
  // Dia inteiro: pedidos, compras do básico, tarefas, doente, atendimento.
  W.__runDay = async (serveUntil, opts = {}) => {
    W.__dayRunning = true; const s = S();
    try {
      if (!opts.noJobs) for (const j of s.availableJobs()) { if (opts.skipJobs && opts.skipJobs.includes(j.id)) continue; const r = await __doJob(j.id); __L(j.id.replace('job.', '') + ': ' + r.slice(-2).join(' ') + (r.some((x) => /\[/.test(x)) ? ' ' + r.filter((x) => /\[/.test(x)).join(' ').slice(0, 420) : '')); const d = await __dlg(6); if (d.length) __L('fala: ' + d.join(' / ').slice(0, 300)); }
      const cats = Object.values(s.state.cats).filter((c) => c.sheltered && !c.quarantine).length; const inv = s.state.inventory;
      const buy = Object.assign({}, opts.buy || {}); if (cats > 0 && s.state.placed.some((p) => p.item === 'item.litter_box') && (inv['item.cat_litter'] || 0) < 1) buy['item.cat_litter'] = 3; if (cats > 0 && (inv['item.cat_food_basic'] || 0) < 1) buy['item.cat_food_basic'] = 3;
      if (Object.keys(buy).length) { await __goMap('map.market'); const b = await __buy(buy); __L('compras: ' + JSON.stringify(buy) + ' -> ' + b.money + (b.log.length ? ' ' + b.log.join(',') : '')); }
      const m = await __goMap('map.cafe_main'); if (m !== 'map.cafe_main') { __L('nao entrei no cafe: ' + m + ' ' + __vis().slice(60, 300)); } else { __L('tarefas: ' + (await __choresWalk()).join(',')); const sc = await __sickCare(); if (sc.length) __L('doente: ' + sc.join(' | ').slice(0, 300)); if (serveUntil) await __serveLoop(serveUntil, opts.kIdle || 1, opts.kBusy || 1); }
    } catch (e) { __L('ERRO ' + e + ' ' + (e.stack || '').slice(0, 200)); }
    W.__K = 1; W.__dayRunning = false; __L('fim da rotina');
  };
  W.__stash = async () => { const s = S(); const sv = s.service; if (sv.ingredientsInBag() < 1) return 'despensa: nada a guardar'; const pc = sv.pantryCell(); await __sel(0); const a = __adj(pc, [[0, 1, 'up'], [1, 0, 'left'], [1, 1, 'left']]) || { c: [2, 4], f: 'left' }; await __walk(a.c); await __face(a.f); await __tap('e'); await __wait(900); const open = /Despensa/.test(__vis()); const r = sv.storeInPantry(); await __wait(300); __click('fechar'); await __wait(400); return 'despensa ' + (open ? 'aberta' : 'NAO abriu') + ' ' + JSON.stringify(r) + ' ' + JSON.stringify(s.state.pantry); };
  W.__fullDay = async (serveUntil, opts = {}) => { W.__dayRunning = true; try { await __runDay(0, opts); if (loc() === 'map.cafe_main') { __L(await __stash()); if (serveUntil) await __serveLoop(serveUntil, opts.kIdle || 8, opts.kBusy || 3); } } catch (e) { __L('ERRO ' + e); } W.__K = 1; W.__dayRunning = false; __L('FIM'); };
  W.__load = 'ok';
  W.__qaReady = true;
})();
