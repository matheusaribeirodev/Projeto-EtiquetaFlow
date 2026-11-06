/* EtiquetaFlow: estado, renderização, simulação de impressão e agendamento. */
(() => {
  'use strict';

  /* ---------- Constantes ---------- */
  const CHANNELS = [
    { id: 'ml', name: 'Mercado Livre', latency: 142 },
    { id: 'shopee', name: 'Shopee', latency: 188 },
    { id: 'tiktok', name: 'TikTok Shop', latency: 231 }
  ];
  const OUTPUTS = { pdf: 'PDF único', spooler: 'spooler térmico' };
  const PRINTER = 'Zebra ZD220';
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const STORAGE_KEY = 'etiquetaflow.v1';
  const MINUTE = 60000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const $ = (id) => document.getElementById(id);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const plural = (n, one, many) => (n === 1 ? one : many);
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

  /* ---------- Estado ---------- */
  function seedHistory() {
    const now = Date.now();
    const row = (ago, channel, qty, origin) => ({ at: now - ago, channel, qty, origin });
    return [
      row(2 * DAY + 3 * HOUR, 'Shopee', 21, 'Agendado'),
      row(2 * DAY + 3 * HOUR + 40000, 'Mercado Livre', 34, 'Agendado'),
      row(3 * DAY + 5 * HOUR, 'TikTok Shop', 12, 'Manual'),
      row(5 * DAY + 2 * HOUR, 'Mercado Livre', 27, 'Agendado'),
      row(5 * DAY + 2 * HOUR + 40000, 'Shopee', 19, 'Agendado'),
      row(6 * DAY + 6 * HOUR, 'TikTok Shop', 8, 'Manual')
    ];
  }

  function defaults() {
    const now = Date.now();
    return {
      pending: { ml: 18, shopee: 15, tiktok: 9 },
      lastSync: { ml: now - 2 * MINUTE, shopee: now - 4 * MINUTE, tiktok: now - 6 * MINUTE },
      output: 'pdf',
      schedule: { enabled: true, days: [1], time: '07:00' },
      history: seedHistory()
    };
  }

  function loadState() {
    const base = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return base;
      return {
        ...base,
        ...saved,
        pending: { ...base.pending, ...saved.pending },
        lastSync: { ...base.lastSync, ...saved.lastSync },
        schedule: { ...base.schedule, ...saved.schedule },
        history: Array.isArray(saved.history) ? saved.history : base.history
      };
    } catch {
      return base;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Sem armazenamento disponível, a sessão segue apenas em memória. */
    }
  }

  let state = loadState();
  const latency = Object.fromEntries(CHANNELS.map((c) => [c.id, c.latency]));
  let nextRunAt = null;
  let activeRun = null;

  const totalPending = () => CHANNELS.reduce((sum, c) => sum + state.pending[c.id], 0);

  /* ---------- Formatação ---------- */
  const historyFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const nextRunFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < MINUTE) return 'agora há pouco';
    if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
    if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`;
    const days = Math.floor(diff / DAY);
    return `há ${days} ${plural(days, 'dia', 'dias')}`;
  }

  function describeSchedule({ days, time }) {
    const ordered = WEEK_ORDER.filter((d) => days.includes(d));
    const key = ordered.join('');
    if (!ordered.length) return 'Escolha ao menos um dia';
    if (ordered.length === 7) return `Todos os dias às ${time}`;
    if (key === '12345') return `De segunda a sexta às ${time}`;
    if (key === '60') return `Sábados e domingos às ${time}`;
    if (ordered.length === 1) {
      const d = ordered[0];
      const name = DAY_FULL[d].toLowerCase();
      return d === 0 || d === 6 ? `Todo ${name} às ${time}` : `Toda ${name}-feira às ${time}`;
    }
    const names = ordered.map((d) => DAY_FULL[d].toLowerCase());
    const last = names.pop();
    return `${capitalize(names.join(', '))} e ${last} às ${time}`;
  }

  function computeNextRun({ enabled, days, time }) {
    if (!enabled || !days.length) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hours, minutes, 0, 0);
      if (days.includes(candidate.getDay()) && candidate > now) return candidate.getTime();
    }
    return null;
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.dataset.visible = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.dataset.visible = 'false'; }, 4200);
  }

  /* ---------- Etiqueta ---------- */
  function barcode(seedText) {
    let seed = 7;
    for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    let x = 0;
    let bars = '';
    while (x < 196) {
      seed = (seed * 48271) % 2147483647;
      const width = 1 + (seed % 3);
      bars += `<rect x="${x}" y="0" width="${width}" height="60" />`;
      x += width + 1 + ((seed >> 4) % 3);
    }
    return `<svg class="label-bars" viewBox="0 0 200 60" preserveAspectRatio="none" fill="#0B251A">${bars}</svg>`;
  }

  function labelMarkup(batch) {
    const total = CHANNELS.reduce((sum, c) => sum + batch[c.id], 0);
    const today = new Date();
    const lot = `${pad(today.getDate())}${pad(today.getMonth() + 1)}-${String(total).padStart(3, '0')}`;
    const rows = CHANNELS.map((c) => `<div><span>${c.name}</span><span>${batch[c.id]}</span></div>`).join('');
    return `
      <div class="flex items-baseline justify-between"><span class="label-mark">EtiquetaFlow</span><span>Lote ${lot}</span></div>
      ${barcode(lot)}
      <div class="text-center">${lot.replace('-', ' ')} ${pad(today.getFullYear() % 100)}</div>
      <div class="label-rows">${rows}</div>
      <div class="label-total"><strong>${total}</strong><span>${plural(total, 'etiqueta', 'etiquetas')}</span></div>
    `;
  }

  /* ---------- Renderização ---------- */
  function renderHero() {
    const total = totalPending();
    $('heroCount').textContent = String(total);
    $('heroCount').dataset.long = String(total > 99);
    $('heroNoun').textContent = plural(total, 'etiqueta pendente', 'etiquetas pendentes');
    $('printLabel').textContent = total ? `Imprimir ${total} ${plural(total, 'etiqueta', 'etiquetas')}` : 'Nenhuma etiqueta pendente';
    $('printBtn').disabled = total === 0;
    $('heroLabel').innerHTML = labelMarkup(state.pending);
  }

  function renderApiStatus() {
    $('apiStatus').innerHTML = CHANNELS.map((c) => `
      <li class="flex items-center gap-2"><span class="light" aria-hidden="true"></span>${c.name}<span class="sr-only">: conectado</span></li>
    `).join('');
  }

  function renderChannels() {
    $('channels').innerHTML = CHANNELS.map((c) => `
      <article class="channel grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-6 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_5rem] md:px-1">
        <h3 class="text-2xl sm:text-3xl">${c.name}</h3>
        <p class="order-2 text-right text-4xl font-extralight tabular-nums md:order-5"><span data-pending="${c.id}">${state.pending[c.id]}</span><span class="sr-only"> ${plural(state.pending[c.id], 'etiqueta', 'etiquetas')}</span></p>
        <p class="channel-meta order-3 flex items-center gap-2 font-type text-sm md:order-2"><span class="light" aria-hidden="true"></span>Conectado</p>
        <p class="channel-meta order-4 text-right font-type text-sm md:order-3 md:text-left"><span class="sr-only">Latência de API: </span><span data-latency="${c.id}">${latency[c.id]} ms</span></p>
        <p class="channel-meta order-5 col-span-2 font-type text-sm md:order-4 md:col-span-1"><span class="md:sr-only">Última sincronização </span><span data-sync="${c.id}">${timeAgo(state.lastSync[c.id])}</span></p>
      </article>
    `).join('');
  }

  function renderHistory() {
    const known = CHANNELS.map((c) => c.name);
    $('historyRows').innerHTML = [...state.history]
      .sort((a, b) => b.at - a.at)
      .slice(0, 7)
      .map((row) => `
        <tr>
          <td class="whitespace-nowrap py-3 pr-4 text-ash">${historyFormat.format(row.at).replace(',', '')}</td>
          <td class="whitespace-nowrap py-3 pr-4">${known.includes(row.channel) ? row.channel : 'Canal'}</td>
          <td class="py-3 pr-8 text-right">${Number(row.qty) || 0}</td>
          <td class="whitespace-nowrap py-3">Concluído com Sucesso</td>
        </tr>
      `).join('');
  }

  function renderSchedule() {
    const { enabled, days, time } = state.schedule;
    $('scheduleSwitch').setAttribute('aria-checked', String(enabled));
    $('scheduleControls').classList.toggle('is-paused', !enabled);
    $('scheduleTime').disabled = !enabled;
    if (document.activeElement !== $('scheduleTime')) $('scheduleTime').value = time;
    $('scheduleSummary').textContent = enabled ? describeSchedule(state.schedule) : 'Automação pausada';
    $('days').innerHTML = WEEK_ORDER.map((d) => `
      <button type="button" class="day text-sm" data-day="${d}" aria-pressed="${days.includes(d)}" aria-label="${DAY_FULL[d]}" ${enabled ? '' : 'disabled'}>${DAY_SHORT[d]}</button>
    `).join('');
    nextRunAt = computeNextRun(state.schedule);
    renderCountdown();
  }

  function setText(id, text) {
    const el = $(id);
    if (el.textContent !== text) el.textContent = text;
  }

  function renderCountdown() {
    if (nextRunAt) {
      const left = Math.max(nextRunAt - Date.now(), 0);
      const days = Math.floor(left / DAY);
      setText('cdDays', `${days} ${plural(days, 'dia', 'dias')}`);
      setText('cdClock', `${pad(Math.floor(left / HOUR) % 24)}:${pad(Math.floor(left / MINUTE) % 60)}:${pad(Math.floor(left / 1000) % 60)}`);
    } else {
      setText('cdDays', 'Sem data');
      setText('cdClock', '--:--:--');
    }
    const { enabled, days, time } = state.schedule;
    let message = '';
    if (!enabled) message = 'Ative a automação para programar.';
    else if (!days.length) message = 'Escolha ao menos um dia.';
    else if (nextRunAt) message = `${capitalize(nextRunFormat.format(nextRunAt))}, às ${time}`;
    setText('nextRun', message);
  }

  /* ---------- Fluxo de impressão ----------
     As fases abaixo são simuladas. Para produção, troque cada passo por
     chamadas ao seu back-end (APIs dos marketplaces) e ao agente local (QZ Tray). */
  const CANCELLED = Symbol('cancelled');

  function wait(ms, run) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, reducedMotion ? Math.min(ms, 60) : ms);
      run.abort = () => { clearTimeout(timer); reject(CANCELLED); };
    });
  }

  function setStage(number, stageState, detail) {
    const stage = document.querySelector(`[data-stage="${number}"]`);
    if (stageState) stage.dataset.state = stageState;
    if (detail) stage.querySelector('[data-detail]').textContent = detail;
  }

  function setProgress(percent) {
    const value = Math.round(percent);
    $('meter').style.transform = `scaleX(${value / 100})`;
    $('progress').setAttribute('aria-valuenow', String(value));
    $('feedPaper').style.setProperty('--feed', String(value / 100));
  }

  function resetDialog(total, batch) {
    $('runView').classList.remove('hidden');
    $('doneView').classList.add('hidden');
    $('seal').dataset.on = 'false';
    $('feedLabel').innerHTML = labelMarkup(batch);
    $('dialogTitle').textContent = `Imprimindo ${total} ${plural(total, 'etiqueta', 'etiquetas')}`;
    setStage(1, 'pending', 'Mercado Livre, Shopee e TikTok Shop');
    setStage(2, 'pending', 'Formato padrão para impressão');
    setStage(3, 'pending', `${PRINTER} via QZ Tray`);
    setProgress(0);
  }

  async function countStep(run, total, from, to, stage, verb) {
    const steps = Math.min(total, 12);
    for (let i = 1; i <= steps; i += 1) {
      const done = Math.round((i / steps) * total);
      setStage(stage, null, `${verb} ${done} de ${total}`);
      setProgress(from + ((to - from) * i) / steps);
      await wait(125, run);
    }
  }

  async function startPrint(origin) {
    const total = totalPending();
    if (!total || activeRun) return;

    const batch = { ...state.pending };
    const output = state.output;
    const run = { abort: null };
    activeRun = run;
    resetDialog(total, batch);
    $('printDialog').showModal();
    $('dialogLive').textContent = `Impressão iniciada: ${total} ${plural(total, 'etiqueta', 'etiquetas')}.`;

    try {
      await wait(500, run);
      setStage(1, 'active', 'Abrindo conexões seguras');
      await wait(450, run);
      for (let i = 0; i < CHANNELS.length; i += 1) {
        const channel = CHANNELS[i];
        setStage(1, null, `${channel.name} respondeu em ${latency[channel.id]} ms`);
        setProgress(((i + 1) / CHANNELS.length) * 28);
        await wait(520, run);
      }
      setStage(1, 'done', 'Três canais conectados');

      setStage(2, 'active');
      await countStep(run, total, 28, 62, 2, 'Normalizando etiqueta');
      const stamp = new Date();
      const fileName = `etiquetaflow-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.pdf`;
      setStage(2, 'done', output === 'pdf' ? fileName : 'Fila térmica pronta no spooler');

      setStage(3, 'active', 'Conectando ao QZ Tray em wss://localhost:8181');
      await wait(650, run);
      await countStep(run, total, 62, 100, 3, 'Enviando etiqueta');
      setStage(3, 'done', `${PRINTER} recebeu todas as etiquetas`);
      await wait(420, run);

      finishPrint(batch, total, origin, output);
    } catch (error) {
      if (error !== CANCELLED) throw error;
      $('printDialog').close();
      toast(`Impressão cancelada. ${total} ${plural(total, 'etiqueta continua pendente', 'etiquetas continuam pendentes')}.`);
    } finally {
      activeRun = null;
    }
  }

  function finishPrint(batch, total, origin, output) {
    const now = Date.now();
    CHANNELS.forEach((channel, index) => {
      if (batch[channel.id] > 0) {
        state.history.push({ at: now + index, channel: channel.name, qty: batch[channel.id], origin });
      }
      state.pending[channel.id] = Math.max(state.pending[channel.id] - batch[channel.id], 0);
    });
    state.history = state.history.sort((a, b) => b.at - a.at).slice(0, 30);
    saveState();
    renderHero();
    renderChannels();
    renderHistory();

    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(now);
    $('doneTitle').textContent = `${total} ${plural(total, 'etiqueta impressa', 'etiquetas impressas')}`;
    $('doneDetail').textContent = `${PRINTER} concluiu o lote às ${time}, em ${OUTPUTS[output]}.`;
    $('runView').classList.add('hidden');
    $('doneView').classList.remove('hidden');
    $('seal').dataset.on = 'true';
    $('dialogLive').textContent = 'Impressão concluída com sucesso.';
    $('doneBtn').focus();
  }

  function cancelPrint() {
    if (activeRun && activeRun.abort) activeRun.abort();
  }

  /* ---------- Sincronização simulada ---------- */
  let syncing = false;
  function syncOrders() {
    if (syncing) return;
    syncing = true;
    $('syncBtn').disabled = true;
    $('syncIcon').classList.add('spin');

    setTimeout(() => {
      let added = 0;
      CHANNELS.forEach((channel) => {
        const orders = Math.floor(Math.random() * 6);
        state.pending[channel.id] += orders;
        state.lastSync[channel.id] = Date.now();
        added += orders;
      });
      saveState();
      renderHero();
      renderChannels();
      syncing = false;
      $('syncBtn').disabled = false;
      $('syncIcon').classList.remove('spin');
      toast(added
        ? `${added} ${plural(added, 'nova etiqueta adicionada', 'novas etiquetas adicionadas')} à fila.`
        : 'Nenhum pedido novo nos três canais.');
    }, reducedMotion ? 100 : 1100);
  }

  /* ---------- Rotina de 1 segundo ---------- */
  function fireSchedule() {
    if (activeRun) {
      toast('O horário agendado chegou durante outra impressão e foi ignorado.');
    } else if (totalPending() === 0) {
      toast('Impressão agendada concluída: nenhuma etiqueta pendente.');
    } else {
      startPrint('Agendado');
    }
    nextRunAt = computeNextRun(state.schedule);
  }

  let tickCount = 0;
  function tick() {
    tickCount += 1;
    if (nextRunAt && Date.now() >= nextRunAt) fireSchedule();
    renderCountdown();

    if (tickCount % 4 === 0) {
      CHANNELS.forEach((channel) => {
        latency[channel.id] = channel.latency + Math.round((Math.random() - 0.5) * 36);
        const el = document.querySelector(`[data-latency="${channel.id}"]`);
        if (el) el.textContent = `${latency[channel.id]} ms`;
      });
    }
    if (tickCount % 20 === 0) {
      CHANNELS.forEach((channel) => {
        const el = document.querySelector(`[data-sync="${channel.id}"]`);
        if (el) el.textContent = timeAgo(state.lastSync[channel.id]);
      });
    }
  }

  /* ---------- Movimento ligado ao scroll ---------- */
  function setupMotion() {
    const items = document.querySelectorAll('.reveal');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => observer.observe(el));

    const vault = $('vault');
    const texture = vault.querySelector('.vault-texture');
    const zone = $('scheduleZone');
    let queued = false;

    function update() {
      queued = false;
      const vh = innerHeight;
      const scrolled = Math.min(scrollY, vh);
      $('heroObject').style.transform = `translateY(${(scrolled * -0.07).toFixed(1)}px)`;
      $('heroCopy').style.transform = `translateY(${(scrolled * 0.04).toFixed(1)}px)`;

      const p = clamp((vh - zone.getBoundingClientRect().top) / (vh * 0.85), 0, 1);
      const eased = 1 - (1 - p) ** 3;
      vault.style.clipPath = `inset(${((1 - eased) * 7).toFixed(2)}% ${((1 - eased) * 9).toFixed(2)}%)`;
      texture.style.transform = eased < 1 ? `scale(${(1.2 - 0.2 * eased).toFixed(3)})` : 'none';
    }

    addEventListener('scroll', () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- Eventos ---------- */
  $('printBtn').addEventListener('click', () => startPrint('Manual'));
  $('cancelBtn').addEventListener('click', cancelPrint);
  $('doneBtn').addEventListener('click', () => $('printDialog').close());
  $('syncBtn').addEventListener('click', syncOrders);

  $('printDialog').addEventListener('cancel', (event) => {
    if (activeRun) {
      event.preventDefault();
      cancelPrint();
    }
  });

  document.querySelectorAll('input[name="output"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.output = input.value;
      saveState();
    });
  });

  $('scheduleSwitch').addEventListener('click', () => {
    state.schedule.enabled = !state.schedule.enabled;
    saveState();
    renderSchedule();
    toast(state.schedule.enabled ? 'Automação ativada.' : 'Automação pausada.');
  });

  $('days').addEventListener('click', (event) => {
    const button = event.target.closest('[data-day]');
    if (!button || button.disabled) return;
    const day = Number(button.dataset.day);
    const { days } = state.schedule;
    state.schedule.days = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    saveState();
    renderSchedule();
    document.querySelector(`[data-day="${day}"]`).focus();
  });

  $('scheduleTime').addEventListener('change', (event) => {
    if (!event.target.value) {
      event.target.value = state.schedule.time;
      return;
    }
    state.schedule.time = event.target.value;
    saveState();
    renderSchedule();
  });

  $('resetBtn').addEventListener('click', () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Sem armazenamento disponível. */ }
    state = defaults();
    renderAll();
    toast('Dados de demonstração restaurados.');
  });

  /* ---------- Início ---------- */
  function renderAll() {
    const radio = document.querySelector(`input[name="output"][value="${state.output}"]`);
    if (radio) radio.checked = true;
    renderHero();
    renderChannels();
    renderHistory();
    renderSchedule();
  }

  const clockNow = new Date();
  $('sweep').style.setProperty('--second', `-${clockNow.getSeconds() + clockNow.getMilliseconds() / 1000}s`);
  renderApiStatus();
  renderAll();
  setupMotion();
  setInterval(tick, 1000);
})();
