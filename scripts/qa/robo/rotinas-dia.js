// Rotinas do robô de teste: o que fazer num dia inteiro e como sair de telas que pedem resposta.
// Carregado depois de rotinas.js (usa as funções window.__* de lá).
(() => {
  const W = window;
  const G = () => W.__G();
  const S = () => G().session;
  const loc = () => S().state.location;

  // ---- Registro: o que o jogo dispara (cenas, chegadas, festas, conquistas...) ----
  W.__events = W.__events || [];
  const BIG = /^(script\.requested|cutscene\.requested|festival\.|event\.|xmas\.|newyear\.|halloween\.|arrival\.|room\.|construction\.|clinic\.|ced\.|story\.beat_completed|milestone\.reached|cat\.(sick|sheltered|neglected|adopted|healed)|customers\.away|litter\.(pooped|missed)|delivery\.dropped|recipe\.unlocked|market\.stage_opened|day\.(ended|started)|business\.|adoption\.|friend\.|request\.)/;
  W.__hookEvents = () => {
    const s = S(); if (s.__qaHooked) return true; s.__qaHooked = true;
    s.bus.onAny((name, payload) => {
      if (!BIG.test(name)) return;
      const p = payload || {}; const id = p.scriptId ?? p.cutsceneId ?? p.festivalId ?? p.beatId ?? p.milestoneId ?? p.roomId ?? p.catId ?? p.recipeId ?? p.stageId ?? p.modelId ?? '';
      const st = s.state; W.__events.push({ day: st.day, min: Math.floor(st.time), name: name + (id ? ':' + id : '') });
    });
    return true;
  };

  // ---- O que está na frente do jogo agora (para o roteiro decidir e fotografar) ----
  const visible = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
  W.__peek = () => {
    const ui = G().ui; const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : '');
    const choose = visible('.confirm-layer .choose')[0];
    if (choose) return { kind: 'pergunta', text: txt(choose).slice(0, 300), options: [...choose.querySelectorAll('button')].map((b) => b.textContent.replace(/^\d+\s*/, '').trim()) };
    const naming = visible('input[name="catName"]')[0];
    if (naming) return { kind: 'nome', text: 'caixa de nome: ' + naming.value };
    const unlock = visible('.item-reveal.unlocks')[0];
    if (unlock) return { kind: 'novidade', text: txt(unlock).slice(0, 700) };
    const reveal = visible('.item-reveal')[0];
    if (reveal) return { kind: 'presente', text: txt(reveal).slice(0, 200) };
    const cut = visible('.cutscene.open')[0];
    if (cut) return { kind: 'cena', text: txt(cut).slice(0, 400) };
    const dlg = visible('.dialogue-layer.open .dialogue')[0];
    if (dlg) return { kind: 'fala', text: txt(dlg).slice(0, 400) };
    const mg = G().game.scene.getScenes(true).find((s) => /MiniGame/.test(s.sys.settings.key));
    if (mg) return { kind: 'minijogo', text: mg.sys.settings.key + ' ' + W.__vis().slice(0, 200) };
    const confirm = visible('.confirm-layer .panel')[0];
    if (confirm) return { kind: 'confirma', text: txt(confirm).slice(0, 300), options: [...confirm.querySelectorAll('button')].map((b) => b.textContent.trim()) };
    const panel = visible('.phone-ui.open, .catalog.open, .panel.shop.open, .catalog.shop.open')[0];
    if (panel) return { kind: 'painel', text: txt(panel).slice(0, 300) };
    if (ui.paused) return { kind: 'pausa', text: 'menu de pausa' };
    return { kind: ui.isBusy() ? 'ocupado' : 'livre', text: ui.isBusy() ? W.__vis().slice(60, 300) : '' };
  };
  // Resposta padrão para perguntas: a que segue o jogo sem encerrar o dia nem gastar o que não é do plano.
  const pickOption = (text, options) => {
    const find = (re) => options.findIndex((o) => re.test(o));
    // No fim do dia (W.__ending) a resposta é ir para casa; antes disso, ficar.
    if (/Encerrar o dia/.test(text)) return find(W.__ending ? /Ir para casa/ : /Ainda n/);
    if (/Ponto de ônibus/.test(text)) return find(W.__ending ? /Ir para casa/ : /Ficar/);
    if (/^Dar .* para /.test(text)) return find(/conversar/);
    let i = find(/caixinha|cercadinho/); if (i >= 0) return i;
    i = find(/^(Fechado!|Sim|Aceitar|Abrir|Posicionar agora|Fazer|Quero|Claro|Vamos|Pode)/); if (i >= 0) return i;
    return 0;
  };
  // Tira da frente o que estiver pedindo resposta. Devolve o que fez (ou null se não havia nada).
  W.__unblock = async () => {
    const p = W.__peek();
    if (p.kind === 'livre') return null;
    if (p.kind === 'pergunta' || p.kind === 'confirma') {
      const i = Math.max(0, pickOption(p.text, p.options)); const btns = visible('.confirm-layer button'); if (btns[i]) btns[i].click(); await W.__wait(900);
      return { ...p, did: 'escolhi: ' + p.options[i] };
    }
    if (p.kind === 'nome') { const b = visible('.naming-buttons .confirm')[0]; if (b) b.click(); await W.__wait(900); return { ...p, did: 'aceitei o nome sugerido' }; }
    if (p.kind === 'novidade') { W.__click('Oba!'); await W.__wait(900); return { ...p, did: 'fechei' }; }
    if (p.kind === 'presente' || p.kind === 'cena' || p.kind === 'fala') { await W.__hold(' ', 80); await W.__wait(600); return { ...p, did: 'avancei' }; }
    if (p.kind === 'minijogo') { const r = await W.__mgHandle(); return { ...p, did: 'minijogo: ' + r }; }
    // Painel (prateleira, caixa, quadro): quem abriu foi uma rotina, que ainda está usando. Só fecha se ficar esquecido (25 s).
    if (p.kind === 'painel') {
      const key = p.text.slice(0, 60); const now = Date.now();
      if (!W.__panelSeen || W.__panelSeen.key !== key) W.__panelSeen = { key, at: now };
      if (now - W.__panelSeen.at < 25000) return { ...p, did: 'esperei' };
      W.__panelSeen = null;
    }
    if (p.kind === 'painel') { if (!W.__click('fechar') && !W.__click('sair') && !W.__click('✕')) await W.__hold('Escape', 80); await W.__wait(600); return { ...p, did: 'fechei o painel' }; }
    if (p.kind === 'pausa') { await W.__hold('Escape', 80); await W.__wait(600); return { ...p, did: 'saí da pausa' }; }
    return { ...p, did: 'nada' };
  };
  // Travou (sem tela nenhuma pedindo resposta): solta as teclas e dá um passo para o lado.
  W.__unstick = async () => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'r']) W.__ev('keyup', k);
    const before = [G().player.x | 0, G().player.y | 0];
    for (const k of ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) { await W.__hold(k, 450); await W.__wait(150); if (Math.abs(G().player.x - before[0]) + Math.abs(G().player.y - before[1]) > 12) break; }
    return { from: before, to: [G().player.x | 0, G().player.y | 0] };
  };

  // ---- Pontos soltos do mapa (pista de gato chegando, cartaz da inauguração): vai lá e aperta E ----
  W.__loosePoints = async () => {
    const s = S(); const log = []; const inJob = (p) => Object.values(s.content.jobs).some((j) => j.steps.some((st) => st.points.includes(p.id)));
    for (let n = 0; n < 4; n++) {
      const p = s.pendingJobPoints().find((p) => p.map === loc() && !inJob(p) && !(W.__skipPts || {})[p.id]);
      if (!p) break;
      const a = W.__adj(p.at, [[0, 1, 'up'], [0, -1, 'down'], [-1, 0, 'right'], [1, 0, 'left'], [0, 2, 'up']]);
      if (!a) { (W.__skipPts = W.__skipPts || {})[p.id] = true; log.push('sem acesso ' + p.id); continue; }
      await W.__sel(0); await W.__walk(a.c); await W.__face(a.f); await W.__tap('e'); await W.__wait(1200);
      for (let k = 0; k < 12; k++) { const u = await W.__unblock(); if (!u) break; log.push(u.kind + ': ' + u.text.slice(0, 160) + ' -> ' + u.did); }
      if (s.pendingJobPoints().some((q) => q.id === p.id)) (W.__skipPts = W.__skipPts || {})[p.id] = true;
      log.push('ponto ' + p.id + (s.pendingJobPoints().some((q) => q.id === p.id) ? ' (continua pendente)' : ' ok'));
    }
    return log;
  };

  // ---- Gato doente sem consulta: leva no colo até a clínica (aberta de segunda a sábado, das 9h às 18h) ----
  W.__clinicVisit = async () => {
    const s = S(); const log = []; const ch = s.chores().find((c) => c.kind === 'clinic' && c.clinic === 'sick' && !c.done);
    if (!ch) return log;
    const hour = s.state.time / 60; if (hour < 9.2 || hour > 17) return ['clínica: fora do horário'];
    if (s.state.money < 70) return ['clínica: sem dinheiro para a consulta (' + s.state.money + ')'];
    if (s.service.carriedCat() !== ch.catId) {
      await W.__goMap('map.cafe_main'); await W.__sel(0);
      const cat = G().cats.find((c) => c.catId === ch.catId && c.visible); if (!cat) return ['clínica: não achei o gato ' + ch.catId];
      await W.__useAt(cat.cell(), [[0, 1, 'up'], [1, 0, 'left'], [-1, 0, 'right'], [0, -1, 'down']]); await W.__wait(900);
    }
    if (s.service.carriedCat() !== ch.catId) return ['clínica: não consegui pegar o gato no colo'];
    const m = await W.__goMap('map.vet_clinic'); if (m !== 'map.vet_clinic') return ['clínica: não entrei (' + m + ')'];
    for (let k = 0; k < 15; k++) { const u = await W.__unblock(); if (!u) break; log.push(u.kind + ': ' + u.text.slice(0, 200)); }
    const f = [...G().npcs.entries()].find(([id]) => /fernanda/.test(id)); if (!f) return log.concat(['clínica: Fernanda não está']);
    await W.__useAt([Math.floor(f[1].x / 32), Math.floor((f[1].y - 1) / 32)], [[0, 1, 'up'], [1, 0, 'left'], [-1, 0, 'right']]); await W.__wait(1200);
    log.push('ficha: ' + W.__vis().replace(/^.*Clínica da Fernanda \| sair \| /, '').slice(0, 300));
    if (W.__onClinic) await W.__onClinic('ficha');
    const b = visible('#ui button').find((b) => /Fazer a consulta/.test(b.textContent)); if (b) b.click(); await W.__wait(2500);
    for (let k = 0; k < 10; k++) { const d = await W.__dlg(6); if (!d.length) break; log.push(...d.map((x) => 'fala: ' + x.slice(0, 220))); }
    if (W.__onClinic) await W.__onClinic('resultado');
    log.push('resultado: ' + W.__vis().replace(/^.*Clínica da Fernanda \| sair \| /, '').slice(0, 400));
    const b2 = visible('#ui button').find((b) => /Levar para o caf|sair/.test(b.textContent)); if (b2) b2.click(); await W.__wait(1500);
    for (let k = 0; k < 10; k++) { const u = await W.__unblock(); if (!u) break; log.push(u.kind + ': ' + u.text.slice(0, 200) + ' -> ' + u.did); }
    await W.__goMap('map.cafe_main'); await W.__walk([9, 7]); await W.__tap('e'); await W.__wait(1200);
    for (let k = 0; k < 6; k++) { const u = await W.__unblock(); if (!u) break; log.push(u.kind + ': ' + u.text.slice(0, 200) + ' -> ' + u.did); }
    return log;
  };

  // ---- Plano simples da manhã: a obra da fachada quando sobra dinheiro ----
  W.__planner = async () => {
    const s = S(); const c = s.state.construction; const log = [];
    try {
      const price = s.content.construction.repairs.outside.price;
      if (s.painterUnlocked() && !c.job && !c.quote && c.repaired.includes('inside') && !c.repaired.includes('outside') && s.state.money >= price + 60) {
        const fin = Object.values(s.content.finishes).find((f) => f.kind === 'facade'); const r = s.quoteRepair('outside', fin.id); log.push('pedi a fachada (' + fin.id + '): ' + JSON.stringify(r)); await W.__wait(1500);
        for (let k = 0; k < 14; k++) { const u = await W.__unblock(); if (!u) break; log.push(u.kind + ': ' + u.text.slice(0, 200) + ' -> ' + u.did); }
      }
    } catch (e) { log.push('plano: erro ' + e); }
    return log;
  };

  // ---- O dia inteiro ----
  W.__L2 = (m) => W.__L(m);
  W.__playDay = async (opts = {}) => {
    W.__dayRunning = true; W.__dayError = null; const s = S(); const L = W.__L;
    try {
      for (const x of await W.__planner()) L(x);
      if (loc() === 'map.street') for (const x of await W.__loosePoints()) L(x);
      // Pedidos da vila (o mercado fecha às 20h: os de lá vão primeiro, de manhã).
      for (const j of s.availableJobs()) {
        if (s.state.time > 19 * 60) break;
        const r = await W.__doJob(j.id);
        L(j.id.replace('job.', '') + ': ' + r.slice(-2).join(' ') + (r.some((x) => /\[/.test(x)) ? ' ' + r.filter((x) => /\[/.test(x)).join(' ').slice(0, 420) : ''));
        if (s.state.jobs.active.includes(j.id)) L('PEDIDO NÃO CONCLUÍDO: ' + j.id);
      }
      // Compras do básico (ração e areia para os gatos soltos; pó e filtro quando o café está acabando).
      const cats = Object.values(s.state.cats).filter((c) => c.sheltered && !c.quarantine).length; const inv = s.state.inventory; const buy = {};
      const boxes = s.state.placed.filter((p) => p.item === 'item.litter_box').length;
      if (cats > 0 && (inv['item.cat_food_basic'] || 0) < 2) buy['item.cat_food_basic'] = 4;
      if (cats > 0 && boxes > 0 && (inv['item.cat_litter'] || 0) < boxes) buy['item.cat_litter'] = boxes * 3;
      let coffee = 99; try { coffee = s.service.servingsFromPantry('recipe.black_coffee').servings; } catch (e) { /* sem a receita */ }
      if (s.state.menu.includes('recipe.black_coffee') && coffee < 6) { buy['item.coffee_ground'] = 2; buy['item.paper_filter'] = 2; }
      const cost = Object.entries(buy).reduce((n, [id, q]) => n + (s.content.items[id].price || 0) * q, 0);
      if (Object.keys(buy).length && s.state.money >= cost && s.state.time < 19.5 * 60) { await W.__goMap('map.market'); if (loc() === 'map.market') { const b = await W.__buy(buy); L('compras ' + JSON.stringify(buy) + ' -> ' + b.money + (b.log.length ? ' ' + b.log.join(',') : '')); } else L('não entrei no mercado'); }
      else if (Object.keys(buy).length) L('SEM DINHEIRO para o básico: ' + JSON.stringify(buy) + ' custa ' + cost + ', tenho ' + s.state.money);
      for (const x of await W.__clinicVisit()) L(x);
      const m = await W.__goMap('map.cafe_main');
      if (m !== 'map.cafe_main') L('não entrei no café: ' + m);
      else {
        L(await W.__stash()); L('tarefas: ' + (await W.__choresWalk()).join(', '));
        const sc = await W.__sickCare(); if (sc.length) L('doente: ' + sc.join(' | ').slice(0, 300));
        if (s.state.time < 18 * 60) await W.__serveLoop(opts.serveUntil || 18 * 60, opts.kIdle || 8, opts.kBusy || 3);
      }
    } catch (e) { W.__dayError = String(e) + ' ' + (e && e.stack ? e.stack.slice(0, 300) : ''); L('ERRO ' + W.__dayError); }
    W.__K = 1; W.__dayRunning = false; L('fim da rotina do dia');
  };

  // Resumo do estado para o registro do dia.
  W.__summary = () => {
    const s = S(); const st = s.state; const cats = Object.entries(st.cats).filter(([, c]) => c.sheltered);
    let rating = null; try { rating = +s.reputation().toFixed ? Math.round(s.reputation() * 10) / 10 : null; } catch (e) { /* sem nota ainda */ }
    return {
      day: st.day, time: Math.floor(st.time), money: st.money, energy: st.energy, location: st.location, rating,
      cats: cats.map(([id, c]) => ({ id, name: c.name, health: c.health, sick: c.sickness ? c.sickness.disease : null, quarantine: !!c.quarantine })),
      goals: W.__goals(), chores: s.chores().filter((c) => !c.done).map((c) => c.kind + (c.need ? ':' + c.need : '') + (c.clinic ? ':' + c.clinic : '')),
      jobs: s.availableJobs().map((j) => j.id), menu: st.menu, served: st.stats && st.stats.today ? st.stats.today.served : null, gaveUp: st.stats && st.stats.today ? st.stats.today.gaveUp : null,
      construction: st.construction.job ? st.construction.job.kind + ' até o dia ' + st.construction.job.endDay : 'feito: ' + st.construction.repaired.join(','),
      news: s.news().map((n) => n.headline), placed: st.placed.length,
    };
  };
  W.__qaDayReady = true;
})();
