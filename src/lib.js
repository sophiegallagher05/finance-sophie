/* Finance Sophie — rekenlogica. Alle bedragen in hele centen. Geen persoonlijke bedragen. */
(function (root) {
  'use strict';

  /* ---------- dates ---------- */
  const MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const MON_SHORT = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayStr = () => ymd(new Date());
  const monthOf = (s) => s.slice(0, 7);
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysInMonth = (month) => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  function addMonths(month, n) {
    let [y, m] = month.split('-').map(Number);
    m += n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
    return y + '-' + pad(m);
  }
  function monthDiff(a, b) { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); }
  const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  const dateInMonth = (month, day) => month + '-' + pad(Math.min(day, daysInMonth(month)));
  function isValidDate(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; return ymd(parseYmd(s)) === s; }
  const isValidMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const fmtDay = (s) => { const d = parseYmd(s); return d.getDate() + ' ' + MON_SHORT[d.getMonth()]; };
  const fmtDateLong = (s) => { const d = parseYmd(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  function monthLabel(month, withYear = true) { const [y, m] = month.split('-').map(Number); return MONTHS[m - 1] + (withYear ? ' ' + y : ''); }
  function monthShort(month) { const [y, m] = month.split('-').map(Number); return MON_SHORT[m - 1] + ' ' + String(y).slice(2); }
  function monthRange(a, b) { const out = []; if (monthDiff(a, b) < 0) return out; for (let m = a; monthDiff(m, b) >= 0; m = addMonths(m, 1)) out.push(m); return out; }

  /* ---------- money ---------- */
  const NF = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
  const NF0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmt = (c) => NF.format((c || 0) / 100);
  const fmtRound = (c) => (c % 100 === 0 ? NF0.format(c / 100) : NF.format(c / 100));
  const MAX_CENTS = 10000000; // € 100.000
  const err = (error) => ({ ok: false, error });
  const BAD = 'Dit is geen geldig bedrag. Probeer bijvoorbeeld 45 of 12,50.';
  function parseAmount(input) {
    if (input == null) return err('Vul een bedrag in.');
    let s = String(input).trim();
    if (!s) return err('Vul een bedrag in.');
    if (/[-−]/.test(s)) return err('Een bedrag kan niet negatief zijn.');
    s = s.replace(/€|euro|eur/gi, '').replace(/[\s\u00a0\u202f]/g, '');
    if (!/^\d[\d.,]*$/.test(s)) return err(BAD);
    let intPart, dec = '';
    if (s.includes(',')) {
      const parts = s.split(',');
      if (parts.length !== 2 || parts[1].length > 2 || !/^\d*$/.test(parts[1])) return err(BAD);
      intPart = parts[0]; dec = parts[1];
      if (intPart.includes('.')) { if (!/^\d{1,3}(\.\d{3})+$/.test(intPart)) return err(BAD); intPart = intPart.replace(/\./g, ''); }
    } else if (s.includes('.')) {
      const parts = s.split('.');
      if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) { intPart = parts[0]; dec = parts[1]; }
      else { if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return err(BAD); intPart = s.replace(/\./g, ''); }
    } else intPart = s;
    if (!/^\d+$/.test(intPart)) return err(BAD);
    if (intPart.length > 9) return err('Dit bedrag is te groot.');
    return { ok: true, cents: parseInt(intPart, 10) * 100 + parseInt((dec + '00').slice(0, 2), 10) };
  }
  function validateAmount(c) {
    if (!Number.isInteger(c) || c <= 0) return 'Het bedrag moet hoger zijn dan € 0.';
    if (c > MAX_CENTS) return 'Controleer het nog even: dit bedrag is hoger dan € 100.000.';
    return null;
  }
  const centsToInput = (c) => (!c ? '' : c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ','));
  const sum = (arr) => arr.reduce((a, t) => a + t.amount, 0);

  /* ---------- text ---------- */
  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasTerm = (t, term) => new RegExp('(^|[^a-z0-9])' + esc(term) + '($|[^a-z0-9])').test(t);

  /* ---------- defaults ---------- */
  const ALIAS_MAP = [
    [/boodschap/, ['boodschappen', 'supermarkt', 'albert heijn', 'jumbo', 'lidl', 'aldi']],
    [/zorgverzekering|\bzorg/, ['zorg', 'zorgverzekering', 'ziektekosten']],
    [/telefoon|mobiel|\bgsm/, ['telefoon', 'mobiel', 'gsm']],
    [/huur/, ['huur', 'woonlasten']],
    [/hypotheek/, ['hypotheek', 'woonlasten']],
    [/brandstof|tank|benzine|diesel/, ['brandstof', 'tanken', 'getankt', 'benzine', 'diesel']],
    [/energie|stroom|\bgas\b/, ['energie', 'stroom', 'gas']],
    [/internet|wifi/, ['internet', 'wifi']],
    [/streaming|netflix|spotify|videoland|disney/, ['streaming', 'netflix', 'spotify']],
    [/sport|\bgym|fitness/, ['sport', 'sportschool', 'gym', 'fitness']],
    [/kleding|kleren/, ['kleding', 'kleren']],
    [/uit eten|restaurant/, ['uit eten', 'restaurant']],
    [/studie|college|school/, ['studie', 'collegegeld', 'studiekosten']],
    [/\bov\b|trein|\bns\b/, ['ov', 'trein', 'ns']],
    [/wegenbelasting|motorrijtuig/, ['wegenbelasting', 'motorrijtuigenbelasting']],
    [/autoverzekering/, ['autoverzekering']],
    [/beleg|invest/, ['beleggen', 'beleggingen', 'beleggingsrekening', 'belegd', 'investeren', 'geinvesteerd']],
    [/vakantiegeld/, ['vakantiegeld']],
    [/vakantie(?!geld)|reis/, ['vakantie', 'vakantiepot', 'reis']],
    [/eindejaar|13e maand|dertiende/, ['eindejaarsuitkering', 'eindejaars', 'eju', '13e maand', 'dertiende maand']],
    [/buffer|nood/, ['buffer', 'noodfonds', 'noodpot']],
    [/salaris|loon/, ['salaris', 'loon']],
    [/sparen|spaar/, ['sparen', 'spaarrekening']],
    [/reserve/, ['reserve', 'autoreserve']],
  ];
  function deriveAliases(name) {
    const n = normalize(name);
    const out = new Set(n ? [n] : []);
    for (const [re, words] of ALIAS_MAP) if (re.test(n)) words.forEach((w) => out.add(w));
    return [...out];
  }
  const MILESTONES = [500, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 12500, 15000].map((e) => e * 100);
  function defaultReminders() {
    return [
      { id: 'salary', label: 'Salarisdag', enabled: false, time: '09:00' },
      { id: 'savings', label: 'Spaaroverboeking', enabled: false, time: '09:00', day: null },
      { id: 'billDue', label: 'Rekening vervalt binnenkort', enabled: false, time: '09:00', daysBefore: 2 },
      { id: 'openItems', label: 'Nog openstaande posten', enabled: false, time: '19:00', day: 25 },
      { id: 'weekly', label: 'Wekelijkse budgetcheck', enabled: false, time: '19:00', weekday: 0 },
      { id: 'review', label: 'Maandelijkse review', enabled: false, time: '19:00', day: 28 },
    ];
  }
  function defaultSettings(today) {
    const y = Number(today.slice(0, 4));
    return {
      version: 1, startMonth: monthOf(today),
      items: [
        { id: 'salaris', name: 'Salaris', kind: 'income', amount: 0, dueDay: null, active: true, aliases: ['salaris', 'loon'] },
        { id: 'sparen', name: 'Spaaroverboeking', kind: 'savings', amount: 0, dueDay: null, active: true, inGoal: true, goal: 0, aliases: ['spaaroverboeking', 'sparen', 'spaarrekening'] },
        { id: 'autoreserve', name: 'Autoreserve', kind: 'reserve', amount: 0, dueDay: null, active: true, aliases: ['autoreserve', 'reserve'] },
      ],
      goal: { target: 0, stretch: 0, targetDate: (y + 1) + '-12-31' },
      milestones: MILESTONES.slice(),
      reminders: defaultReminders(), notificationsEnabled: false, setupDone: false, updatedAt: new Date().toISOString(),
    };
  }
  const emptyData = (today) => ({ settings: defaultSettings(today), months: {}, transactions: [], dismissed: [] });

  /* ---------- storage / migration ---------- */
  const KINDS = ['income', 'bill', 'budget', 'savings', 'reserve'];
  const TX_TYPES = ['income', 'expense', 'savings_deposit', 'savings_withdrawal', 'savings_opening', 'reserve_deposit', 'reserve_expense', 'reserve_opening'];
  const SOURCES = ['checklist', 'handmatig', 'assistent', 'import'];
  const isInt = (n) => Number.isInteger(n);
  function cleanItem(i) {
    if (!i || typeof i !== 'object' || !KINDS.includes(i.kind)) return null;
    const name = String(i.name || '').trim() || 'Naamloos';
    const dueDay = isInt(i.dueDay) && i.dueDay >= 1 && i.dueDay <= 31 ? i.dueDay : null;
    const out = {
      id: String(i.id || uid()), name, kind: i.kind, amount: isInt(i.amount) && i.amount >= 0 ? i.amount : 0,
      dueDay, active: i.active !== false, aliases: Array.isArray(i.aliases) && i.aliases.length ? i.aliases.map(normalize).filter(Boolean) : deriveAliases(name),
    };
    if (isInt(i.month) && i.month >= 1 && i.month <= 12) out.month = i.month;
    if (i.kind === 'savings') { out.inGoal = i.inGoal != null ? !!i.inGoal : out.id === 'sparen'; out.goal = isInt(i.goal) && i.goal > 0 ? i.goal : 0; }
    return out;
  }
  function migrate(obj, today) {
    if (!obj || typeof obj !== 'object' || !obj.settings || typeof obj.settings !== 'object') return null;
    const base = emptyData(today);
    const s = obj.settings;
    const items = Array.isArray(s.items) ? s.items.map(cleanItem).filter(Boolean) : base.settings.items;
    const remById = Object.fromEntries((Array.isArray(s.reminders) ? s.reminders : []).filter((r) => r && r.id).map((r) => [r.id, r]));
    const settings = {
      ...base.settings,
      startMonth: isValidMonth(s.startMonth) ? s.startMonth : base.settings.startMonth,
      items,
      goal: {
        target: isInt(s.goal?.target) && s.goal.target >= 0 ? s.goal.target : 0,
        stretch: isInt(s.goal?.stretch) && s.goal.stretch >= 0 ? s.goal.stretch : 0,
        targetDate: isValidDate(s.goal?.targetDate) ? s.goal.targetDate : base.settings.goal.targetDate,
      },
      milestones: Array.isArray(s.milestones) && s.milestones.every(isInt) ? s.milestones.slice().sort((a, b) => a - b) : MILESTONES.slice(),
      reminders: defaultReminders().map((d) => ({ ...d, ...(remById[d.id] || {}), label: d.label, id: d.id })),
      notificationsEnabled: !!s.notificationsEnabled,
      setupDone: !!s.setupDone,
      updatedAt: s.updatedAt || new Date().toISOString(),
    };
    const months = {};
    if (obj.months && typeof obj.months === 'object') {
      for (const [k, mp] of Object.entries(obj.months)) {
        if (!isValidMonth(k) || !mp || !Array.isArray(mp.items)) continue;
        months[k] = { month: k, createdAt: mp.createdAt || new Date().toISOString(), items: mp.items.map(cleanItem).filter(Boolean), closedBudgets: Array.isArray(mp.closedBudgets) ? mp.closedBudgets.map(String) : [] };
      }
    }
    const transactions = (Array.isArray(obj.transactions) ? obj.transactions : []).filter((t) => t && TX_TYPES.includes(t.type) && isInt(t.amount) && t.amount > 0 && isValidDate(t.date)).map((t) => {
      const out = {
        id: String(t.id || uid()), type: t.type, amount: t.amount, date: t.date,
        month: isValidMonth(t.month) ? t.month : monthOf(t.date),
        category: String(t.category || ''), note: String(t.note || ''),
        source: SOURCES.includes(t.source) ? t.source : 'import', createdAt: t.createdAt || new Date().toISOString(),
      };
      if (t.itemId) out.itemId = String(t.itemId);
      if (t.potId) out.potId = String(t.potId);
      if (t.updatedAt) out.updatedAt = t.updatedAt;
      if (t.deletedAt) out.deletedAt = t.deletedAt;
      if (Array.isArray(t.history) && t.history.length) out.history = t.history.filter((h) => h && isInt(h.amount));
      return out;
    });
    return { settings, months, transactions, dismissed: Array.isArray(obj.dismissed) ? obj.dismissed.map(String).slice(-300) : [] };
  }
  function exportBackup(data) { return JSON.stringify({ app: 'finance-sophie', version: 1, exportedAt: new Date().toISOString(), data }, null, 2); }
  function importBackup(text, today) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'Dit bestand kan ik niet lezen. Kies een back-up (.json) van deze app.' }; }
    const raw = obj && obj.data ? obj.data : obj;
    const data = migrate(raw, today);
    if (!data) return { ok: false, error: 'Dit lijkt geen back-up van Finance Sophie te zijn.' };
    return { ok: true, data };
  }

  /* ---------- month plans ---------- */
  const alive = (t) => !t.deletedAt;
  const KIND_TX = { income: 'income', bill: 'expense', budget: 'expense', savings: 'savings_deposit', reserve: 'reserve_deposit' };
  let _uidN = 0;
  function uid() { _uidN = (_uidN + 1) % 1e6; return Date.now().toString(36) + _uidN.toString(36) + Math.random().toString(36).slice(2, 7); }
  const snapshotItems = (settings) => settings.items.map((i) => ({ ...i, aliases: [...i.aliases] }));
  const monthItemsAll = (data, month) => (data.months[month] ? data.months[month].items : data.settings.items);
  const inMonth = (i, month) => !i.month || i.month === Number(month.slice(5));
  const monthItems = (data, month) => monthItemsAll(data, month).filter((i) => i.active && i.amount > 0 && inMonth(i, month));
  function ensureMonth(data, month) {
    if (data.months[month]) return data;
    return { ...data, months: { ...data.months, [month]: { month, createdAt: new Date().toISOString(), items: snapshotItems(data.settings), closedBudgets: [] } } };
  }

  /* ---------- calc ---------- */
  function monthSummary(data, month, today) {
    const items = monthItems(data, month);
    const ids = new Set(items.map((i) => i.id));
    const txs = data.transactions.filter((t) => alive(t) && t.month === month);
    const closed = (data.months[month] && data.months[month].closedBudgets) || [];
    const rows = items.map((item) => {
      const linked = txs.filter((t) => t.itemId === item.id && t.type === KIND_TX[item.kind]);
      if (item.kind === 'budget') {
        const spent = sum(linked);
        const isClosed = closed.includes(item.id);
        return { item, kind: 'budget', spent, left: Math.max(0, item.amount - spent), over: Math.max(0, spent - item.amount), txs: linked, closed: isClosed, done: isClosed };
      }
      const tx = linked[0] || null;
      return { item, kind: item.kind, tx, done: !!tx, over: item.kind === 'bill' && tx ? Math.max(0, tx.amount - item.amount) : 0 };
    });
    const plannedOf = (k) => items.filter((i) => i.kind === k).reduce((a, i) => a + i.amount, 0);
    const income = plannedOf('income'), bills = plannedOf('bill'), budgets = plannedOf('budget'), savings = plannedOf('savings'), reserve = plannedOf('reserve');
    const fixed = bills + budgets;
    const available = income - fixed - savings - reserve;
    const freeTxs = txs.filter((t) => t.type === 'expense' && !(t.itemId && ids.has(t.itemId)));
    const freeSpend = sum(freeTxs);
    const overrun = rows.reduce((a, r) => a + r.over, 0);
    const remaining = available - freeSpend - overrun;
    const cur = monthOf(today), dim = daysInMonth(month);
    const daysLeft = month === cur ? dim - Number(today.slice(8)) + 1 : monthDiff(cur, month) > 0 ? dim : 0;
    const perDay = daysLeft > 0 ? Math.floor(remaining / daysLeft) : null;
    const checkable = rows.filter((r) => r.kind !== 'budget');
    const open = rows.filter((r) => !r.done && ['bill', 'savings', 'reserve'].includes(r.kind)).reduce((a, r) => a + r.item.amount, 0);
    const of = (type) => sum(txs.filter((t) => t.type === type));
    return {
      month, rows, txs, freeTxs,
      planned: { income, bills, budgets, fixed, savings, reserve, available },
      freeSpend, overrun, remaining, daysLeft, perDay, open,
      checked: checkable.filter((r) => r.done).length, total: checkable.length,
      actualIncome: of('income'), totalExpenses: of('expense'),
      netSaved: of('savings_deposit') - of('savings_withdrawal'),
      reserveSpent: of('reserve_expense'),
    };
  }

  const SAV_TYPES = ['savings_opening', 'savings_deposit', 'savings_withdrawal'];
  const potItems = (data) => data.settings.items.filter((i) => i.kind === 'savings');
  function potIdOf(data, t) {
    const pots = potItems(data);
    const id = t.itemId || t.potId;
    if (id && pots.some((p) => p.id === id)) return id;
    return pots.length ? pots[0].id : null;
  }
  function goalPotIds(data) {
    const pots = potItems(data);
    const ids = pots.filter((p) => p.inGoal !== false && p.inGoal != null ? p.inGoal : false).map((p) => p.id);
    return new Set(ids.length ? ids : pots.slice(0, 1).map((p) => p.id));
  }
  function potStats(data) {
    const pots = potItems(data);
    const t = data.transactions.filter((x) => alive(x) && SAV_TYPES.includes(x.type));
    return pots.map((item) => {
      const mine = t.filter((x) => potIdOf(data, x) === item.id);
      const opening = sum(mine.filter((x) => x.type === 'savings_opening'));
      const deposits = sum(mine.filter((x) => x.type === 'savings_deposit'));
      const withdrawals = sum(mine.filter((x) => x.type === 'savings_withdrawal'));
      const balance = opening + deposits - withdrawals;
      return { item, opening, deposits, withdrawals, balance, pct: item.goal > 0 ? Math.min(100, (balance / item.goal) * 100) : null, history: mine.slice().sort((a, b) => (a.date < b.date ? 1 : -1)) };
    });
  }
  function savingsStats(data, today) {
    const s = data.settings, cur = monthOf(today);
    const t = data.transactions.filter(alive);
    const SAV = SAV_TYPES;
    const inGoal = goalPotIds(data);
    const st = t.filter((x) => SAV.includes(x.type) && inGoal.has(potIdOf(data, x)));
    const opening = sum(st.filter((x) => x.type === 'savings_opening'));
    const deposits = sum(st.filter((x) => x.type === 'savings_deposit'));
    const withdrawals = sum(st.filter((x) => x.type === 'savings_withdrawal'));
    const balance = opening + deposits - withdrawals;
    const year = today.slice(0, 4);
    const netYear = sum(st.filter((x) => x.type === 'savings_deposit' && x.date.startsWith(year))) - sum(st.filter((x) => x.type === 'savings_withdrawal' && x.date.startsWith(year)));
    const target = s.goal.target, stretch = s.goal.stretch;
    const pct = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
    const pctStretch = stretch > 0 ? Math.min(100, (balance / stretch) * 100) : 0;
    const targetMonth = monthOf(s.goal.targetDate);
    const depositedThisMonth = st.some((x) => x.type === 'savings_deposit' && x.month === cur);
    const diff = monthDiff(cur, targetMonth);
    const monthsToGo = diff < 0 ? 0 : diff + (depositedThisMonth ? 0 : 1);
    const remainingToGoal = Math.max(0, target - balance);
    const neededPerMonth = target > 0 && monthsToGo > 0 ? Math.ceil(remainingToGoal / monthsToGo) : null;
    const netOf = (m) => sum(st.filter((x) => x.month === m && x.type === 'savings_deposit')) - sum(st.filter((x) => x.month === m && x.type === 'savings_withdrawal'));
    const closedMonths = monthRange(s.startMonth, addMonths(cur, -1));
    let forecast = null;
    if (closedMonths.length > 0 && closedMonths.some((m) => st.some((x) => x.month === m && x.type !== 'savings_opening'))) {
      const avg = closedMonths.reduce((a, m) => a + netOf(m), 0) / closedMonths.length;
      forecast = { avg: Math.round(avg), amount: balance + Math.round(avg * monthsToGo), months: closedMonths.length };
    }
    // milestones
    const sorted = st.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || '') < (b.createdAt || '') ? -1 : 1));
    let run = 0; const reached = {};
    for (const x of sorted) {
      run += x.type === 'savings_withdrawal' ? -x.amount : x.amount;
      for (const m of s.milestones) if (run >= m && !reached[m]) reached[m] = x.date;
    }
    const milestones = s.milestones.map((m) => ({ amount: m, date: balance >= m || reached[m] ? reached[m] || null : null, reached: !!reached[m] }));
    // series
    const firstTx = sorted.length ? sorted[0].month : cur;
    const startM = monthDiff(firstTx, s.startMonth) < 0 ? s.startMonth : firstTx;
    const months = monthRange(monthDiff(startM, cur) >= 0 ? startM : cur, cur).slice(-24);
    let bal = sum(st.filter((x) => monthDiff(x.month, months[0]) > 0).map((x) => ({ amount: x.type === 'savings_withdrawal' ? -x.amount : x.amount })));
    const series = months.map((m) => {
      const inM = st.filter((x) => x.month === m);
      bal += inM.reduce((a, x) => a + (x.type === 'savings_withdrawal' ? -x.amount : x.amount), 0);
      return { month: m, balance: bal, net: netOf(m) };
    });
    return { goalPots: potItems(data).filter((p) => inGoal.has(p.id)), opening, deposits, withdrawals, balance, netYear, target, stretch, pct, pctStretch, targetMonth, monthsToGo, neededPerMonth, remainingToGoal, forecast, milestones, series, depositedThisMonth };
  }

  function reserveStats(data) {
    const t = data.transactions.filter((x) => alive(x) && ['reserve_opening', 'reserve_deposit', 'reserve_expense'].includes(x.type));
    const opening = sum(t.filter((x) => x.type === 'reserve_opening'));
    const deposits = sum(t.filter((x) => x.type === 'reserve_deposit'));
    const expenses = sum(t.filter((x) => x.type === 'reserve_expense'));
    const item = data.settings.items.find((i) => i.kind === 'reserve');
    return { opening, deposits, expenses, balance: opening + deposits - expenses, perMonth: item && item.active ? item.amount : 0, name: item ? item.name : 'Autoreserve', history: t.slice().sort((a, b) => (a.date < b.date ? 1 : -1)) };
  }

  function dueLabel(today, date) {
    if (!date) return 'Vervaldatum onbekend';
    const d = dayDiff(today, date);
    if (d === 0) return 'Vandaag';
    if (d === 1) return 'Morgen';
    if (d > 0) return 'over ' + d + ' dagen';
    return -d === 1 ? '1 dag te laat' : -d + ' dagen te laat';
  }
  function upcoming(data, today) {
    const cur = monthOf(today), next = addMonths(cur, 1), out = [];
    for (const r of monthSummary(data, cur, today).rows) {
      if (r.kind === 'budget' || r.done) continue;
      const date = r.item.dueDay ? dateInMonth(cur, r.item.dueDay) : null;
      out.push({ month: cur, item: r.item, date, label: dueLabel(today, date), late: date ? dayDiff(today, date) < 0 : false });
    }
    for (const r of monthSummary(data, next, today).rows) {
      if (r.kind === 'budget' || r.done || !r.item.dueDay) continue;
      const date = dateInMonth(next, r.item.dueDay);
      if (dayDiff(today, date) <= 14) out.push({ month: next, item: r.item, date, label: dueLabel(today, date), late: false });
    }
    return out.sort((a, b) => (a.date === b.date ? 0 : !a.date ? 1 : !b.date ? -1 : a.date < b.date ? -1 : 1));
  }

  /* ---------- actions ---------- */
  const nowIso = () => new Date().toISOString();
  function defaultDate(month, dueDay, today) {
    if (monthOf(today) === month) return today;
    return dueDay ? dateInMonth(month, dueDay) : month + '-01';
  }
  function hasLinked(data, month, itemId, type, exceptId) {
    return data.transactions.some((t) => alive(t) && t.id !== exceptId && t.month === month && t.itemId === itemId && t.type === type);
  }
  function check(data, month, itemId, opts, today) {
    opts = opts || {};
    data = ensureMonth(data, month);
    const item = monthItemsAll(data, month).find((i) => i.id === itemId);
    if (!item) return { error: 'Deze post staat niet in het plan van deze maand.' };
    if (item.kind === 'budget') return { error: 'Een budget vink je niet af. Boek er uitgaven op.' };
    if (!inMonth(item, month)) return { error: item.name + ' valt alleen in ' + MONTHS[item.month - 1] + '.' };
    const type = KIND_TX[item.kind];
    if (hasLinked(data, month, itemId, type)) return { error: item.name + ' is deze maand al afgevinkt.' };
    const amount = opts.amount != null ? opts.amount : item.amount;
    const e = validateAmount(amount); if (e) return { error: e };
    const date = opts.date || defaultDate(month, item.dueDay, today);
    if (!isValidDate(date)) return { error: 'Deze datum klopt niet.' };
    const tx = { id: uid(), type, amount, date, month, itemId, category: item.name, note: opts.note || '', source: opts.source || 'checklist', createdAt: nowIso() };
    return { data: { ...data, transactions: [...data.transactions, tx] }, tx };
  }
  function uncheck(data, month, itemId) {
    const item = monthItemsAll(data, month).find((i) => i.id === itemId);
    if (!item) return { error: 'Deze post staat niet in het plan van deze maand.' };
    const type = KIND_TX[item.kind];
    const tx = data.transactions.find((t) => alive(t) && t.month === month && t.itemId === itemId && t.type === type);
    if (!tx) return { error: 'Deze post was nog niet afgevinkt.' };
    return { data: { ...data, transactions: data.transactions.map((t) => (t.id === tx.id ? { ...t, deletedAt: nowIso() } : t)) }, tx };
  }
  function validateTxInput(data, input, exceptId) {
    if (!TX_TYPES.includes(input.type)) return 'Kies wat voor soort boeking dit is.';
    const e = validateAmount(input.amount); if (e) return e;
    if (!isValidDate(input.date)) return 'Deze datum klopt niet.';
    if (input.itemId) {
      const item = monthItemsAll(data, input.month).find((i) => i.id === input.itemId);
      if (!item) return 'Deze post bestaat niet in ' + monthLabel(input.month) + '.';
      if (KIND_TX[item.kind] !== input.type) return 'Dit soort boeking past niet bij ' + item.name + '.';
      if (item.kind !== 'budget' && hasLinked(data, input.month, input.itemId, input.type, exceptId)) return item.name + ' is in ' + monthLabel(input.month) + ' al betaald. Pas die betaling aan in plaats van een nieuwe toe te voegen.';
    }
    return null;
  }
  function addTx(data, input) {
    const month = input.month || (isValidDate(input.date) ? monthOf(input.date) : null);
    const tx = { id: uid(), type: input.type, amount: input.amount, date: input.date, month, category: input.category || '', note: input.note || '', source: input.source || 'handmatig', createdAt: nowIso() };
    if (input.itemId) tx.itemId = input.itemId;
    else if (input.potId && SAV_TYPES.includes(input.type)) tx.potId = input.potId;
    if (month) data = ensureMonth(data, month);
    const e = validateTxInput(data, tx); if (e) return { error: e };
    return { data: { ...data, transactions: [...data.transactions, tx] }, tx };
  }
  function updateTx(data, id, patch) {
    const old = data.transactions.find((t) => t.id === id);
    if (!old) return { error: 'Deze boeking bestaat niet meer.' };
    const next = { ...old, ...patch };
    if (patch.date && !patch.month) next.month = old.itemId && next.itemId === old.itemId ? old.month : monthOf(patch.date);
    if (!next.itemId) delete next.itemId;
    if (next.itemId || !next.potId || !SAV_TYPES.includes(next.type)) delete next.potId;
    data = ensureMonth(data, next.month);
    const e = validateTxInput(data, next, id); if (e) return { error: e };
    next.updatedAt = nowIso();
    next.history = [...(old.history || []), { at: nowIso(), amount: old.amount, date: old.date, note: old.note }];
    return { data: { ...data, transactions: data.transactions.map((t) => (t.id === id ? next : t)) }, tx: next };
  }
  function deleteTx(data, id) {
    if (!data.transactions.some((t) => t.id === id && alive(t))) return { error: 'Deze boeking bestaat niet meer.' };
    return { data: { ...data, transactions: data.transactions.map((t) => (t.id === id ? { ...t, deletedAt: nowIso() } : t)) } };
  }
  function restoreTx(data, id) {
    const t = data.transactions.find((x) => x.id === id);
    if (!t || alive(t)) return { error: 'Deze boeking staat niet in de prullenbak.' };
    if (t.itemId) {
      const item = monthItemsAll(data, t.month).find((i) => i.id === t.itemId);
      if (item && item.kind !== 'budget' && hasLinked(data, t.month, t.itemId, t.type)) return { error: 'Herstellen kan niet: ' + item.name + ' is in ' + monthLabel(t.month) + ' al opnieuw afgevinkt. Dan zou het dubbel tellen.' };
    }
    const n = { ...t }; delete n.deletedAt;
    return { data: { ...data, transactions: data.transactions.map((x) => (x.id === id ? n : x)) } };
  }
  function purgeTx(data, id) { return { data: { ...data, transactions: data.transactions.filter((t) => t.id !== id) } }; }
  function setMonthOverride(data, month, itemId, patch) {
    if (patch.amount != null) { if (!Number.isInteger(patch.amount) || patch.amount < 0) return { error: 'Het bedrag klopt niet.' }; if (patch.amount > MAX_CENTS) return { error: 'Controleer het nog even: dit bedrag is hoger dan € 100.000.' }; }
    if (patch.dueDay != null && !(patch.dueDay >= 1 && patch.dueDay <= 31)) return { error: 'Kies een dag tussen 1 en 31.' };
    data = ensureMonth(data, month);
    const mp = data.months[month];
    if (!mp.items.some((i) => i.id === itemId)) return { error: 'Deze post staat niet in het plan van deze maand.' };
    const items = mp.items.map((i) => (i.id === itemId ? { ...i, ...('amount' in patch ? { amount: patch.amount } : {}), ...('dueDay' in patch ? { dueDay: patch.dueDay } : {}) } : i));
    return { data: { ...data, months: { ...data.months, [month]: { ...mp, items } } } };
  }
  function toggleBudgetClosed(data, month, itemId) {
    data = ensureMonth(data, month);
    const mp = data.months[month];
    const closed = mp.closedBudgets.includes(itemId) ? mp.closedBudgets.filter((x) => x !== itemId) : [...mp.closedBudgets, itemId];
    return { data: { ...data, months: { ...data.months, [month]: { ...mp, closedBudgets: closed } } } };
  }
  function applySettings(data, settings, fromMonth) {
    const s = { ...settings, items: settings.items.map((i) => ({ ...i, aliases: i.aliases && i.aliases.length ? i.aliases : deriveAliases(i.name) })), updatedAt: nowIso() };
    const months = { ...data.months };
    if (fromMonth) {
      for (const m of Object.keys(months)) {
        if (monthDiff(fromMonth, m) < 0) continue;
        const fresh = snapshotItems(s);
        const paidIds = new Set(data.transactions.filter((t) => alive(t) && t.month === m && t.itemId).map((t) => t.itemId));
        for (const old of months[m].items) {
          const nw = fresh.find((i) => i.id === old.id);
          if (paidIds.has(old.id) && (!nw || !nw.active)) { if (nw) Object.assign(nw, { active: true, amount: nw.amount || old.amount }); else fresh.push({ ...old, active: true }); }
        }
        months[m] = { ...months[m], items: fresh };
      }
    }
    return { data: { ...data, settings: s, months } };
  }

  /* ---------- assistant parser ---------- */
  const MONTH_IDX = { januari: 1, jan: 1, februari: 2, feb: 2, maart: 3, mrt: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, augustus: 8, aug: 8, september: 9, sept: 9, sep: 9, oktober: 10, okt: 10, november: 11, nov: 11, december: 12, dec: 12 };
  const MONTH_RE = new RegExp('(?:\\bop\\s+)?\\b(\\d{1,2})\\s+(' + Object.keys(MONTH_IDX).join('|') + ')\\b(?:\\s+(\\d{4}))?');
  function inferYear(today, m, d) {
    const y = Number(today.slice(0, 4));
    const cand = y + '-' + pad(m) + '-' + pad(d);
    return isValidDate(cand) && dayDiff(today, cand) > 60 ? y - 1 : y;
  }
  function extractDate(t, today) {
    let m;
    if ((m = t.match(/\beergisteren\b/))) return { date: addDays(today, -2), rest: t.replace(m[0], ' ') };
    if ((m = t.match(/\bgisteren\b/))) return { date: addDays(today, -1), rest: t.replace(m[0], ' ') };
    if ((m = t.match(/\bvandaag\b/))) return { date: today, rest: t.replace(m[0], ' ') };
    if ((m = t.match(MONTH_RE))) {
      const d = Number(m[1]), mo = MONTH_IDX[m[2]], y = m[3] ? Number(m[3]) : inferYear(today, mo, d);
      const date = y + '-' + pad(mo) + '-' + pad(d);
      if (isValidDate(date)) return { date, rest: t.replace(m[0], ' ') };
    }
    if ((m = t.match(/(?:\bop\s+)?(?<![\d.,€])\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}|\d{2}))?\b/))) {
      const d = Number(m[1]), mo = Number(m[2]);
      let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : inferYear(today, mo, d);
      const date = y + '-' + pad(mo) + '-' + pad(d);
      if (isValidDate(date)) return { date, rest: t.replace(m[0], ' ') };
    }
    return { date: null, rest: t };
  }
  const NUM = '\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
  function extractAmount(rest) {
    const m = rest.match(new RegExp('€\\s*(' + NUM + ')')) || rest.match(new RegExp('(?:^|[^\\d])(' + NUM + ')\\s*(?:euro|eur)\\b')) || rest.match(new RegExp('(?:^|[^\\d.,])(' + NUM + ')(?![\\d])'));
    if (!m) return null;
    const p = parseAmount(m[1].replace(/\s/g, m[1].match(/\s\d{3}/) ? '' : ' '));
    return p.ok && p.cents > 0 ? p.cents : null;
  }
  const CATS = [
    ['Boodschappen', ['boodschappen', 'supermarkt', 'albert heijn', 'jumbo', 'lidl', 'aldi', 'bakker', 'markt', 'dirk', 'plus supermarkt']],
    ['Uit eten', ['uit eten', 'restaurant', 'lunch', 'lunchen', 'diner', 'pizza', 'sushi', 'koffie', 'terras', 'mcdonalds', 'thuisbezorgd', 'snackbar', 'friet', 'gegeten', 'eten besteld']],
    ['Kleding', ['kleding', 'kleren', 'schoenen', 'broek', 'jas', 'trui', 'jurk', 'zara', 'primark', 'shirt']],
    ['Cadeaus', ['cadeau', 'cadeaus', 'cadeautje', 'kado', 'verjaardag', 'sinterklaas', 'kerstcadeau', 'surprise']],
    ['Sport', ['sport', 'gym', 'fitness', 'sportschool', 'zwemmen', 'hardlopen', 'yoga']],
    ['Vervoer', ['tanken', 'getankt', 'benzine', 'diesel', 'trein', 'ns', 'ov', 'parkeren', 'geparkeerd', 'bus', 'uber', 'taxi']],
    ['Uitgaan', ['uitgaan', 'bioscoop', 'film', 'concert', 'festival', 'kroeg', 'bar', 'drankjes', 'feest', 'club', 'stappen']],
  ];
  const guessCategory = (t) => { for (const [c, w] of CATS) if (w.some((x) => hasTerm(t, x))) return c; return 'Overig'; };
  const CAR = ['apk', 'garage', 'banden', 'band', 'winterbanden', 'zomerbanden', 'onderhoud auto', 'auto onderhoud', 'grote beurt', 'kleine beurt', 'olie verversen', 'remmen', 'accu', 'ruitenwisser', 'autoreparatie', 'reparatie auto', 'ruit', 'uitlaat', 'koppeling', 'autowas', 'onderhoudsbeurt'];
  const DEPOSIT = /(gestort|storten|stort|overgemaakt|overmaken|apart gezet|apartgezet|opzij gezet|weggezet|gezet|ingelegd|inleggen)/;
  const QSTART = ['hoeveel', 'wat', 'hoe', 'wanneer', 'waar', 'welke', 'welk', 'kan ik', 'heb ik', 'is er', 'is mijn', 'ben ik', 'staat', 'zijn er', 'moet ik', 'hoelang', 'mag ik', 'krijg ik', 'wordt'];
  const isQuestion = (t) => t.endsWith('?') || QSTART.some((q) => t === q || t.startsWith(q + ' '));
  function bestMatch(items, t) {
    let best = null, len = 0;
    for (const i of items) for (const term of [normalize(i.name), ...(i.aliases || [])]) if (term && term.length > len && hasTerm(t, term)) { best = i; len = term.length; }
    return best;
  }
  const EXAMPLES = ['Ik heb € 45 getankt', 'Salaris is binnen', 'Hoeveel kan ik nog uitgeven?'];

  function answer(t, data, today) {
    const cur = monthOf(today), S = monthSummary(data, cur, today);
    const sv = savingsStats(data, today), rs = reserveStats(data);
    const freeLines = () => [
      'Je kunt in ' + monthLabel(cur, false) + ' nog ' + fmt(S.remaining) + ' vrij uitgeven.',
      S.perDay != null ? 'Dat is ongeveer ' + fmt(S.perDay) + ' per dag voor de resterende ' + S.daysLeft + (S.daysLeft === 1 ? ' dag.' : ' dagen.') : null,
      'Beschikbaar budget: ' + fmt(S.planned.available) + '. Vrije uitgaven tot nu toe: ' + fmt(S.freeSpend) + (S.overrun ? '. Overschrijdingen: ' + fmt(S.overrun) + '.' : '.'),
    ].filter(Boolean);
    const potQ = bestMatch(potItems(data), t);
    if (potQ && !/spaardoel|\bdoel\b/.test(t)) {
      const p = potStats(data).find((x) => x.item.id === potQ.id);
      return { kind: 'answer', title: potQ.name, lines: ['In ' + potQ.name + ' zit ' + fmt(p.balance) + '.', 'Je zet er ' + fmt(potQ.amount) + ' per maand in.', ...(potQ.goal ? ['Dat is ' + Math.floor(p.pct) + '% van je doel van ' + fmt(potQ.goal) + '.'] : [])] };
    }
    if (/spaar|spaardoel|gespaard|\bdoel\b|sparen/.test(t)) {
      const l = ['Je spaarsaldo is ' + fmt(sv.balance) + '.'];
      if (sv.target > 0) l.push('Dat is ' + Math.floor(sv.pct) + '% van je doel van ' + fmt(sv.target) + ' vóór ' + fmtDateLong(data.settings.goal.targetDate) + '.');
      if (sv.neededPerMonth != null) l.push('Je hebt nog ongeveer ' + fmt(sv.neededPerMonth) + ' per maand nodig.');
      const ps = potStats(data);
      if (ps.length > 1) l.push('Per potje: ' + ps.map((p) => p.item.name + ' ' + fmt(p.balance)).join(', ') + '.');
      l.push(sv.forecast ? 'Als je zo doorgaat, heb je rond de streefdatum ongeveer ' + fmt(sv.forecast.amount) + '.' : 'Nog geen voorspelling: daarvoor heb ik minstens één afgesloten maand nodig.');
      return { kind: 'answer', title: 'Spaardoel', lines: l };
    }
    if (/reserve|onderhoud/.test(t)) return { kind: 'answer', title: rs.name, lines: ['In je ' + rs.name.toLowerCase() + ' zit ' + fmt(rs.balance) + '.', 'Ingelegd ' + fmt(rs.deposits) + ', uitgegeven aan onderhoud ' + fmt(rs.expenses) + '.'] };
    if (/salaris|\bloon\b|inkomen/.test(t)) {
      const r = S.rows.find((x) => x.kind === 'income' && !x.item.month) || S.rows.find((x) => x.kind === 'income');
      if (!r) return { kind: 'answer', title: 'Salaris', lines: ['Er staat nog geen inkomen in je plan. Vul het in bij Instellingen.'] };
      if (r.done) return { kind: 'answer', title: 'Salaris', lines: ['Je ' + r.item.name.toLowerCase() + ' van ' + fmt(r.tx.amount) + ' is ontvangen op ' + fmtDay(r.tx.date) + '.'] };
      return { kind: 'answer', title: 'Salaris', lines: [r.item.dueDay ? 'Je ' + r.item.name.toLowerCase() + ' van ' + fmt(r.item.amount) + ' wordt verwacht op de ' + r.item.dueDay + 'e.' : 'Je ' + r.item.name.toLowerCase() + ' van ' + fmt(r.item.amount) + ' is nog niet afgevinkt. De salarisdag is nog onbekend.', 'Zeg "Salaris is binnen" zodra het er is.'] };
    }
    const b = bestMatch(S.rows.filter((r) => r.kind === 'budget').map((r) => r.item), t);
    if (b) {
      const r = S.rows.find((x) => x.item.id === b.id);
      return { kind: 'answer', title: b.name, lines: [r.over ? 'Je bent ' + fmt(r.over) + ' over je budget voor ' + b.name.toLowerCase() + ' heen.' : 'Voor ' + b.name.toLowerCase() + ' heb je nog ' + fmt(r.left) + ' over.', 'Besteed: ' + fmt(r.spent) + ' van ' + fmt(b.amount) + '.'] };
    }
    if (/\bopen|betalen|nog te|rekening|vaste last|afvinken|openstaand/.test(t)) {
      const open = S.rows.filter((r) => !r.done && r.kind !== 'budget');
      if (!open.length) return { kind: 'answer', title: 'Openstaand', lines: ['Alles van ' + monthLabel(cur, false) + ' is afgevinkt.'] };
      return { kind: 'answer', title: 'Openstaand', lines: ['Nog open: ' + fmt(S.open) + ' (' + S.checked + ' van ' + S.total + ' afgevinkt).', ...open.slice(0, 6).map((r) => r.item.name + ': ' + fmt(r.item.amount) + (r.item.dueDay ? ' op de ' + r.item.dueDay + 'e' : ', datum onbekend'))] };
    }
    if (/vrij|uitgeven|besteden|\bover\b|budget|uitgave|geld|per dag/.test(t)) return { kind: 'answer', title: 'Vrij te besteden', lines: freeLines() };
    return { kind: 'answer', title: 'Stand van zaken', lines: [...freeLines().slice(0, 1), 'Nog open: ' + fmt(S.open) + ' (' + S.checked + ' van ' + S.total + ' afgevinkt).', 'Spaarsaldo: ' + fmt(sv.balance) + '.'] };
  }

  function propose(t, data, today) {
    const { date, rest } = extractDate(t, today);
    const d = date || today, month = monthOf(d);
    const amount = extractAmount(rest);
    const S = monthSummary(data, month, today);
    const rowOfKind = (k) => S.rows.find((r) => r.kind === k);
    const P = (o) => ({ kind: 'proposal', date: d, amount, ...o });
    const checkOrExtra = (row, extra) => {
      if (row && !row.done) return P({ op: 'check', itemId: row.item.id, month, title: row.item.name + ' afvinken', explain: 'Ik vink ' + row.item.name + ' af voor ' + monthLabel(month) + '.', amount: amount != null ? amount : row.item.amount });
      return P({ op: 'add', ...extra });
    };
    const incNamed = bestMatch(S.rows.filter((r) => r.kind === 'income').map((r) => r.item), t);
    if (incNamed) {
      const r = S.rows.find((x) => x.item.id === incNamed.id);
      return checkOrExtra(r, { txType: 'income', category: 'Extra inkomen', note: incNamed.name, title: 'Extra inkomen', explain: incNamed.name + ' van ' + monthLabel(month, false) + ' is al afgevinkt. Ik boek dit als extra inkomen.' });
    }
    if (/\b(salaris|loon)\b/.test(t)) {
      const r = S.rows.find((x) => x.kind === 'income' && !x.item.month) || rowOfKind('income');
      return checkOrExtra(r, { txType: 'income', category: 'Extra inkomen', note: 'Salaris', title: 'Extra inkomen', explain: r ? 'Je salaris van ' + monthLabel(month, false) + ' is al afgevinkt. Ik boek dit als extra inkomen.' : 'Ik boek dit als inkomen.' });
    }
    const pots = potItems(data).filter((p) => p.active);
    const pot = bestMatch(pots, t);
    const WITHDRAW = /(opgenomen|opname|opnemen|gehaald|halen|haal|afgehaald|teruggezet|terug gezet|verkocht)/;
    if ((/spaar/.test(t) || pot) && WITHDRAW.test(t)) {
      const pp = pot || pots[0];
      return P({ op: 'add', txType: 'savings_withdrawal', potId: pp ? pp.id : undefined, category: pp ? pp.name : 'Spaarrekening', title: 'Opname uit ' + (pp ? pp.name : 'spaarrekening'), explain: 'Ik boek een opname uit ' + (pp ? pp.name : 'je spaarrekening') + '. Dat saldo gaat omlaag.' });
    }
    if (/reserve/.test(t) && DEPOSIT.test(t)) {
      const r = rowOfKind('reserve');
      return checkOrExtra(r, { txType: 'reserve_deposit', category: 'Autoreserve', title: 'Storting reservepotje', explain: r ? 'De vaste inleg van deze maand is al afgevinkt. Ik boek dit als extra storting.' : 'Ik boek een storting in je reservepotje.' });
    }
    if ((/spaar/.test(t) && DEPOSIT.test(t)) || /\bgespaard\b/.test(t) || (pot && (DEPOSIT.test(t) || /(belegd|geinvesteerd|apart)/.test(t)))) {
      const pp = pot || pots[0];
      const r = pp ? S.rows.find((x) => x.item.id === pp.id) : rowOfKind('savings');
      const name = pp ? pp.name : 'je spaarrekening';
      return checkOrExtra(r, { txType: 'savings_deposit', potId: pp ? pp.id : undefined, category: pp ? pp.name : 'Spaarrekening', title: 'Storting ' + name, explain: r ? name + ' is deze maand al afgevinkt. Ik boek dit als extra storting.' : 'Ik boek een storting op ' + name + '.' });
    }
    const budget = bestMatch(S.rows.filter((r) => r.kind === 'budget').map((r) => r.item), t);
    if (budget) {
      const r = S.rows.find((x) => x.item.id === budget.id);
      const after = amount != null ? budget.amount - r.spent - amount : null;
      return P({ op: 'add', txType: 'expense', itemId: budget.id, month, category: budget.name, title: 'Uitgave ' + budget.name.toLowerCase(), explain: 'Ik boek dit op je budget ' + budget.name + '.' + (after != null ? (after >= 0 ? ' Daarna heb je nog ' + fmt(after) + ' over.' : ' Je gaat dan ' + fmt(-after) + ' over je budget.') : '') });
    }
    if (CAR.some((w) => hasTerm(t, w))) {
      const rs = reserveStats(data);
      const useReserve = rs.perMonth > 0 || rs.balance > 0;
      return P({ op: 'add', txType: useReserve ? 'reserve_expense' : 'expense', category: 'Auto-onderhoud', title: 'Auto-onderhoud', carChoice: true, explain: 'Auto-onderhoud kan uit je reservepotje (telt niet mee in je vrije budget) of uit je lopende budget.' });
    }
    const bill = bestMatch(S.rows.filter((r) => r.kind === 'bill').map((r) => r.item), t);
    if (bill) {
      const r = S.rows.find((x) => x.item.id === bill.id);
      if (r.done) return { kind: 'answer', title: 'Al betaald', lines: [bill.name + ' is in ' + monthLabel(month, false) + ' al afgevinkt (' + fmt(r.tx.amount) + ' op ' + fmtDay(r.tx.date) + ').', 'Klopt het bedrag niet? Open de post in Maand om de betaling te wijzigen.'] };
      return P({ op: 'check', itemId: bill.id, month, title: bill.name + ' afvinken', explain: 'Ik vink ' + bill.name + ' af voor ' + monthLabel(month) + '.', amount: amount != null ? amount : bill.amount });
    }
    if (/(ontvangen|gekregen|terugbetaald|teruggave|terug gekregen|teruggekregen|verkocht|bonus|binnengekomen|tikkie|toeslag)/.test(t))
      return P({ op: 'add', txType: 'income', category: 'Overig inkomen', title: 'Inkomen', explain: 'Ik boek dit als overig inkomen.' });
    if (amount != null) {
      const cat = guessCategory(t);
      return P({ op: 'add', txType: 'expense', category: cat, title: 'Uitgave ' + cat.toLowerCase(), explain: 'Ik boek dit als vrije uitgave in de categorie ' + cat + '. Dat gaat van je vrij te besteden bedrag af.' });
    }
    return { kind: 'unknown', examples: EXAMPLES };
  }
  function parseMessage(input, data, today) {
    const t = normalize(input);
    if (!t) return { kind: 'unknown', examples: EXAMPLES };
    const res = isQuestion(t) ? answer(t, data, today) : propose(t, data, today);
    if (res.kind === 'proposal') res.note = String(input).trim().slice(0, 120);
    return res;
  }

  /* ---------- reminders ---------- */
  function remindersToday(data, today) {
    const r = Object.fromEntries(data.settings.reminders.map((x) => [x.id, x]));
    const cur = monthOf(today), day = Number(today.slice(8)), dim = daysInMonth(cur);
    const S = monthSummary(data, cur, today), out = [];
    const isDay = (dd) => dd != null && day === Math.min(dd, dim);
    const inc = S.rows.find((x) => x.kind === 'income' && !x.item.month) || S.rows.find((x) => x.kind === 'income');
    if (r.salary && r.salary.enabled && inc && !inc.done && isDay(inc.item.dueDay)) out.push({ key: 'salary:' + today, title: 'Salarisdag', text: 'Is je salaris binnen? Vink het af, dan klopt je overzicht.' });
    const sav = S.rows.find((x) => x.kind === 'savings');
    const savDay = r.savings && r.savings.day != null ? r.savings.day : sav && sav.item.dueDay;
    if (r.savings && r.savings.enabled && sav && !sav.done && isDay(savDay)) out.push({ key: 'savings:' + today, title: 'Sparen', text: 'Tijd voor je spaaroverboeking van ' + fmt(sav.item.amount) + '.' });
    if (r.billDue && r.billDue.enabled) {
      for (const u of upcoming(data, today)) {
        if (u.item.kind !== 'bill' || !u.date) continue;
        const dd = dayDiff(today, u.date);
        if (dd >= 0 && dd <= (r.billDue.daysBefore || 0)) out.push({ key: 'bill:' + u.item.id + ':' + u.month, title: u.item.name, text: fmt(u.item.amount) + ' vervalt ' + u.label.toLowerCase() + '.' });
      }
    }
    if (r.openItems && r.openItems.enabled && day >= (r.openItems.day || 25) && S.open > 0) out.push({ key: 'open:' + today, title: 'Nog openstaand', text: 'Er staat nog ' + fmt(S.open) + ' open deze maand (' + S.checked + ' van ' + S.total + ' afgevinkt).' });
    if (r.weekly && r.weekly.enabled && parseYmd(today).getDay() === r.weekly.weekday) out.push({ key: 'weekly:' + today, title: 'Budgetcheck', text: 'Je hebt nog ' + fmt(S.remaining) + ' vrij te besteden. Even je budgetten nalopen?' });
    if (r.review && r.review.enabled && isDay(r.review.day)) out.push({ key: 'review:' + cur, title: 'Maandreview', text: 'Kijk even terug op ' + monthLabel(cur, false) + ' en bekijk het plan voor volgende maand.' });
    return out.filter((x) => !data.dismissed.includes(x.key));
  }
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function buildIcs(data, today) {
    const r = Object.fromEntries(data.settings.reminders.map((x) => [x.id, x]));
    const items = data.settings.items.filter((i) => i.active && i.amount > 0);
    const events = [], skipped = [];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const nextMonthly = (day) => { let m = monthOf(today); let d = dateInMonth(m, day); if (dayDiff(today, d) < 0) { m = addMonths(m, 1); d = dateInMonth(m, day); } return d; };
    const dt = (date, time) => date.replace(/-/g, '') + 'T' + (time || '09:00').replace(':', '') + '00';
    const add = (uidKey, title, desc, date, time, rrule, alarm) => events.push(['BEGIN:VEVENT', 'UID:' + uidKey + '@finance-sophie', 'DTSTAMP:' + stamp, 'DTSTART:' + dt(date, time), 'DURATION:PT15M', 'RRULE:' + rrule, 'SUMMARY:' + icsEscape(title), 'DESCRIPTION:' + icsEscape(desc), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(title), 'TRIGGER:' + (alarm || 'PT0M'), 'END:VALARM', 'END:VEVENT'].join('\r\n'));
    const monthly = (day) => 'FREQ=MONTHLY;BYMONTHDAY=' + (day >= 31 ? -1 : day);
    const inc = items.find((i) => i.kind === 'income' && !i.month) || items.find((i) => i.kind === 'income'), sav = items.find((i) => i.kind === 'savings' && !i.month);
    if (r.salary.enabled) { if (inc && inc.dueDay) add('salary', 'Salarisdag', 'Salaris binnen? Vink het af in Finance.', nextMonthly(inc.dueDay), r.salary.time, monthly(inc.dueDay)); else skipped.push('Salarisdag (salarisdag onbekend)'); }
    if (r.savings.enabled) { const d = r.savings.day != null ? r.savings.day : sav && sav.dueDay; if (d) add('savings', 'Spaaroverboeking', 'Tijd om te sparen.', nextMonthly(d), r.savings.time, monthly(d)); else skipped.push('Spaaroverboeking (dag onbekend)'); }
    if (r.billDue.enabled) {
      for (const b of items.filter((i) => i.kind === 'bill')) {
        if (!b.dueDay) { skipped.push(b.name + ' (vervaldag onbekend)'); continue; }
        const n = r.billDue.daysBefore || 0;
        if (b.month) { let y = Number(today.slice(0, 4)); let d = dateInMonth(y + '-' + pad(b.month), b.dueDay); if (dayDiff(today, d) < 0) d = dateInMonth((y + 1) + '-' + pad(b.month), b.dueDay); add('bill-' + b.id, b.name + ' vervalt', b.name + ' vervalt op ' + b.dueDay + ' ' + MONTHS[b.month - 1] + '.', d, r.billDue.time, 'FREQ=YEARLY;BYMONTH=' + b.month + ';BYMONTHDAY=' + Math.min(b.dueDay, 28 < b.dueDay && b.month === 2 ? 28 : b.dueDay), n > 0 ? '-P' + n + 'D' : 'PT0M'); continue; }
        add('bill-' + b.id, b.name + ' vervalt', b.name + ' vervalt op de ' + b.dueDay + 'e.', nextMonthly(b.dueDay), r.billDue.time, monthly(b.dueDay), n > 0 ? '-P' + n + 'D' : 'PT0M');
      }
    }
    if (r.openItems.enabled) add('open', 'Nog openstaande posten', 'Kijk in Finance wat er nog open staat.', nextMonthly(r.openItems.day), r.openItems.time, monthly(r.openItems.day));
    if (r.weekly.enabled) { const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; let d = today; while (parseYmd(d).getDay() !== r.weekly.weekday) d = addDays(d, 1); add('weekly', 'Budgetcheck', 'Even je budgetten nalopen.', d, r.weekly.time, 'FREQ=WEEKLY;BYDAY=' + days[r.weekly.weekday]); }
    if (r.review.enabled) add('review', 'Maandreview', 'Terugkijken en volgende maand plannen.', nextMonthly(r.review.day), r.review.time, monthly(r.review.day));
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Finance Sophie//NL', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Finance', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
    return { ics, count: events.length, skipped };
  }

  /* ---------- exporters ---------- */
  const TYPE_LABEL = { income: 'Inkomen', expense: 'Uitgave', savings_deposit: 'Spaarstorting', savings_withdrawal: 'Spaaropname', savings_opening: 'Beginsaldo sparen', reserve_deposit: 'Storting reserve', reserve_expense: 'Onderhoud uit reserve', reserve_opening: 'Beginsaldo reserve' };
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csvAmount = (c) => (c / 100).toFixed(2).replace('.', ',');
  function toCsv(data) {
    const nameOf = (t) => { const id = t.itemId || t.potId; const it = monthItemsAll(data, t.month).find((i) => i.id === id) || data.settings.items.find((i) => i.id === id); return it ? it.name : ''; };
    const rows = [['Datum', 'Boekmaand', 'Soort', 'Bedrag', 'Categorie', 'Omschrijving', 'Hoort bij', 'Bron']];
    for (const t of data.transactions.filter(alive).slice().sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const sign = ['expense', 'savings_deposit', 'reserve_deposit', 'reserve_expense'].includes(t.type) ? -1 : 1;
      rows.push([t.date, t.month, TYPE_LABEL[t.type], csvAmount(sign * t.amount), t.category, t.note, t.itemId || t.potId ? nameOf(t) : '', t.source]);
    }
    return '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  }

  const F = {
    MONTHS, MON_SHORT, pad, ymd, todayStr, monthOf, parseYmd, daysInMonth, addMonths, monthDiff, dayDiff, addDays, dateInMonth, isValidDate, fmtDay, fmtDateLong, monthLabel, monthShort, monthRange,
    fmt, fmtRound, parseAmount, validateAmount, centsToInput, MAX_CENTS, normalize, deriveAliases,
    defaultSettings, emptyData, migrate, exportBackup, importBackup, uid, alive, KIND_TX, TYPE_LABEL, TX_TYPES,
    monthItems, monthItemsAll, inMonth, ensureMonth, monthSummary, savingsStats, potStats, potIdOf, reserveStats, upcoming, dueLabel,
    check, uncheck, addTx, updateTx, deleteTx, restoreTx, purgeTx, setMonthOverride, toggleBudgetClosed, applySettings,
    extractDate, extractAmount, parseMessage, guessCategory, isQuestion,
    remindersToday, buildIcs, toCsv,
  };
  root.F = F;
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : globalThis);
