/* Finance Sophie — interface */
(function () {
  'use strict';
  const { useState, useEffect, useMemo, useRef } = React;
  const html = htm.bind(React.createElement);
  const KEY = 'finance-sophie:v1';
  const BK = 'finance-sophie:backup:';

  /* ---------- opslag ---------- */
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  const Store = {
    local: (() => { try { localStorage.setItem('__fs', '1'); localStorage.removeItem('__fs'); return true; } catch (e) { return false; } })(),
    ref: null, base: null, db: null, chain: Promise.resolve(),
    readLocal() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    writeLocal(data, savedAt) { try { localStorage.setItem(KEY, JSON.stringify({ savedAt, data })); return true; } catch (e) { return false; } },
    async connect() {
      if (!window.claude || !window.claude.use) return false;
      try {
        const db = await withTimeout(window.claude.use('db'), 12000);
        if (!db) return false;
        const user = await withTimeout(window.claude.use('user'), 8000);
        const id = user ? await user.id() : null;
        if (!id) return false;
        this.db = db; this.base = 'data/users/' + id; this.ref = db.doc(this.base + '/app');
        return true;
      } catch (e) { return false; }
    },
    async readRemote() {
      const s = await this.ref.get();
      if (!s.exists) return null;
      const v = s.data();
      try { return { data: JSON.parse(v.json), savedAt: v.savedAt || '' }; } catch (e) { return null; }
    },
    writeRemote(data, savedAt) {
      const p = this.chain.then(() => this.ref.set({ json: JSON.stringify(data), savedAt }));
      this.chain = p.catch(() => {});
      return p;
    },
    async saveBackup(date, data) {
      const json = JSON.stringify(data);
      if (this.local) {
        try {
          localStorage.setItem(BK + date, json);
          const keys = Object.keys(localStorage).filter((k) => k.startsWith(BK)).sort();
          keys.slice(0, Math.max(0, keys.length - 14)).forEach((k) => localStorage.removeItem(k));
        } catch (e) {}
      }
      if (this.db) {
        try {
          await this.db.doc(this.base + '/backups/' + date).set({ json, date });
          const snap = await this.db.collection(this.base + '/backups').get();
          const ids = snap.docs.map((d) => d.id).sort();
          for (const id of ids.slice(0, Math.max(0, ids.length - 14))) await this.db.doc(this.base + '/backups/' + id).delete();
        } catch (e) {}
      }
    },
    async listBackups() {
      const out = {};
      if (this.local) { try { Object.keys(localStorage).filter((k) => k.startsWith(BK)).forEach((k) => { out[k.slice(BK.length)] = () => localStorage.getItem(k); }); } catch (e) {} }
      if (this.db) {
        try { const snap = await this.db.collection(this.base + '/backups').get(); snap.docs.forEach((d) => { const v = d.data(); out[d.id] = () => v.json; }); } catch (e) {}
      }
      return Object.keys(out).sort().reverse().slice(0, 14).map((date) => ({ date, read: out[date] }));
    },
  };
  let downloadsP = null;
  function getDownloads() { if (!downloadsP) downloadsP = window.claude && window.claude.use ? withTimeout(window.claude.use('downloads'), 4000).catch(() => null) : Promise.resolve(null); return downloadsP; }
  async function offerFile(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    try { const dl = await getDownloads(); if (dl) { await dl.save({ filename, data: blob }); return 'ok'; } } catch (e) { if (e && e.code === 'declined') return 'declined'; }
    try { const file = new File([blob], filename, { type: mime }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return 'ok'; } } catch (e) { if (e && e.name === 'AbortError') return 'declined'; }
    try { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return 'maybe'; } catch (e) { return 'fail'; }
  }

  /* ---------- kleine bouwstenen ---------- */
  const cx = (...a) => a.filter(Boolean).join(' ');
  const M = ({ c, className }) => html`<span className=${cx('num', className)}>${F.fmt(c)}</span>`;
  const ICONS = {
    dashboard: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    maand: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
    sparen: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    transacties: 'M5 7h14M5 12h14M5 17h9',
    instellingen: 'M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1M16 4v4M10 10v4M18 16v4',
    plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', check: 'M5 12.5l4.5 4.5L19 7.5', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  };
  const Icon = ({ n, s = 22 }) => html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d=${ICONS[n]} /></svg>`;
  const Label = ({ children, right }) => html`<div className="label-row"><span className="label">${children}</span>${right || null}</div>`;
  const Card = ({ children, className, onClick }) => html`<section className=${cx('card', className)} onClick=${onClick}>${children}</section>`;
  function Bar({ value, warn, thin }) {
    const v = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
    return html`<div className=${cx('bar', thin && 'thin')}><div className=${cx('bar-fill', warn && 'warn')} style=${{ width: v * 100 + '%' }}></div></div>`;
  }
  function Seg({ options, value, onChange, id }) {
    return html`<div className="seg" role="tablist" id=${id}>${options.map(([v, l]) => html`<button key=${v} role="tab" aria-selected=${value === v} className=${cx('seg-btn', value === v && 'on')} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;
  }
  function CheckCircle({ done, onClick, label, disabled }) {
    return html`<button className=${cx('circle', done && 'done')} aria-pressed=${done} aria-label=${label} disabled=${disabled} onClick=${(e) => { e.stopPropagation(); onClick(); }}>${done ? html`<${Icon} n="check" s=${15} />` : null}</button>`;
  }
  function Field({ id, label, hint, error, children }) {
    return html`<label className="field" htmlFor=${id}><span className="field-label">${label}</span>${children}${error ? html`<span className="field-error">${error}</span>` : hint ? html`<span className="field-hint">${hint}</span>` : null}</label>`;
  }
  function AmountInput({ id, value, onChange, placeholder = '0' }) {
    return html`<div className="money-input"><span>€</span><input id=${id} inputMode="decimal" autoComplete="off" placeholder=${placeholder} value=${value} onChange=${(e) => onChange(e.target.value)} /></div>`;
  }
  function Toggle({ id, on, onChange, label }) {
    return html`<button id=${id} role="switch" aria-checked=${on} aria-label=${label} className=${cx('switch', on && 'on')} onClick=${() => onChange(!on)}><span></span></button>`;
  }
  function Sheet({ open, onClose, title, children }) {
    useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
    if (!open) return null;
    return html`<div className="sheet-wrap" onClick=${onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>${title}</h2><button className="icon-btn" aria-label="Sluiten" onClick=${onClose}><${Icon} n="x" /></button></div>
        <div className="sheet-body">${children}</div>
      </div></div>`;
  }
  const parseOr = (str, fallback) => { if (!String(str).trim()) return { ok: true, cents: fallback }; return F.parseAmount(str); };
  const dayStr = (n) => (n ? String(n) : '');
  const parseDay = (s) => { const t = String(s).trim(); if (!t) return { ok: true, day: null }; const n = Number(t); return Number.isInteger(n) && n >= 1 && n <= 31 ? { ok: true, day: n } : { ok: false, error: 'Kies een dag tussen 1 en 31, of laat het leeg.' }; };
  const KIND_LABEL = { income: 'Inkomen', bill: 'Vaste rekening', budget: 'Budget', savings: 'Sparen', reserve: 'Reserve' };

  /* ---------- grafieken ---------- */
  function AreaChart({ series, goal }) {
    const W = 320, H = 150, P = { l: 8, r: 8, t: 14, b: 22 };
    if (!series.length) return null;
    const max = Math.max(1, goal || 0, ...series.map((s) => s.balance)) * 1.08;
    const min = Math.min(0, ...series.map((s) => s.balance));
    const x = (i) => P.l + (series.length === 1 ? (W - P.l - P.r) / 2 : (i / (series.length - 1)) * (W - P.l - P.r));
    const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
    const pts = series.map((s, i) => [x(i), y(s.balance)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + y(min) + ' L' + pts[0][0].toFixed(1) + ' ' + y(min) + ' Z';
    const last = pts[pts.length - 1];
    return html`<svg className="chart" viewBox=${'0 0 ' + W + ' ' + H} role="img" aria-label="Verloop van je spaarsaldo">
      <line x1=${P.l} x2=${W - P.r} y1=${y(min)} y2=${y(min)} className="axis" />
      ${goal > 0 ? html`<line x1=${P.l} x2=${W - P.r} y1=${y(goal)} y2=${y(goal)} className="goal-line" /><text x=${W - P.r} y=${y(goal) - 4} textAnchor="end" className="chart-txt">Doel ${F.fmtRound(goal)}</text>` : null}
      <path d=${area} className="area" />
      <path d=${line} className="area-line" />
      <circle cx=${last[0]} cy=${last[1]} r="3.5" className="dot" />
      <text x=${P.l} y=${H - 6} className="chart-txt">${F.monthShort(series[0].month)}</text>
      ${series.length > 1 ? html`<text x=${W - P.r} y=${H - 6} textAnchor="end" className="chart-txt">${F.monthShort(series[series.length - 1].month)}</text>` : null}
    </svg>`;
  }
  function Columns({ items }) {
    const W = 320, H = 130, P = { t: 10, b: 22 };
    if (!items.length) return null;
    const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
    const hasNeg = items.some((i) => i.value < 0);
    const zero = hasNeg ? P.t + (H - P.t - P.b) / 2 : H - P.b;
    const span = hasNeg ? (H - P.t - P.b) / 2 : H - P.t - P.b;
    const bw = Math.min(28, (W / items.length) * 0.55);
    return html`<svg className="chart" viewBox=${'0 0 ' + W + ' ' + H} role="img" aria-label="Staafjes per maand">
      <line x1="0" x2=${W} y1=${zero} y2=${zero} className="axis" />
      ${items.map((it, i) => { const cxp = (i + 0.5) * (W / items.length); const h = (Math.abs(it.value) / max) * span; return html`<g key=${i}><rect x=${cxp - bw / 2} y=${it.value >= 0 ? zero - h : zero} width=${bw} height=${Math.max(it.value ? 1.5 : 0, h)} rx="3" className=${it.value < 0 ? 'col neg' : it.current ? 'col cur' : 'col'} /><text x=${cxp} y=${H - 6} textAnchor="middle" className="chart-txt">${it.label}</text></g>`; })}
    </svg>`;
  }

  /* ---------- instelscherm ---------- */
  function Setup({ data, onSave, onRestore }) {
    const items = data.settings.items;
    const inc = items.find((i) => i.kind === 'income'), sav = items.find((i) => i.kind === 'savings'), res = items.find((i) => i.kind === 'reserve');
    const [f, setF] = useState(() => ({
      income: F.centsToInput(inc ? inc.amount : 0), salaryDay: dayStr(inc && inc.dueDay),
      rows: items.filter((i) => i.kind === 'bill' || i.kind === 'budget').map((i) => ({ key: i.id, name: i.name, amount: F.centsToInput(i.amount), kind: i.kind })).concat(items.some((i) => i.kind === 'bill' || i.kind === 'budget') ? [] : [{ key: F.uid(), name: '', amount: '', kind: 'bill' }, { key: F.uid(), name: '', amount: '', kind: 'budget' }]),
      pots: items.filter((i) => i.kind === 'savings' && i !== sav).map((i) => ({ key: i.id, name: i.name, amount: F.centsToInput(i.amount) })),
      savings: F.centsToInput(sav ? sav.amount : 0), reserve: F.centsToInput(res ? res.amount : 0),
      target: F.centsToInput(data.settings.goal.target), stretch: F.centsToInput(data.settings.goal.stretch), targetDate: data.settings.goal.targetDate,
    }));
    const [errors, setErrors] = useState({});
    const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
    const setRow = (key, patch) => setF((o) => ({ ...o, rows: o.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    const c = (s) => { const p = parseOr(s, 0); return p.ok ? p.cents : 0; };
    const fixed = f.rows.reduce((a, r) => a + c(r.amount), 0);
    const potsTotal = f.pots.reduce((a, r) => a + c(r.amount), 0);
    const free = c(f.income) - fixed - c(f.savings) - potsTotal - c(f.reserve);
    const setPot = (key, patch) => setF((o) => ({ ...o, pots: o.pots.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    const fileRef = useRef(null);
    function save() {
      const e = {};
      const p = (k, s) => { const r = parseOr(s, 0); if (!r.ok) e[k] = r.error; else if (r.cents > F.MAX_CENTS) e[k] = 'Controleer het nog even: dit is hoger dan € 100.000.'; return r.ok ? r.cents : 0; };
      const income = p('income', f.income);
      const sd = parseDay(f.salaryDay); if (!sd.ok) e.salaryDay = sd.error;
      const rows = f.rows.filter((r) => r.name.trim() || r.amount.trim()).map((r) => { const a = p('row' + r.key, r.amount); if (!r.name.trim()) e['row' + r.key] = 'Geef deze post een naam.'; return { ...r, cents: a }; });
      const pots = f.pots.filter((r) => r.name.trim() || r.amount.trim()).map((r) => { const a = p('pot' + r.key, r.amount); if (!r.name.trim()) e['pot' + r.key] = 'Geef dit potje een naam.'; return { ...r, cents: a }; });
      const savings = p('savings', f.savings), reserve = p('reserve', f.reserve), target = p('target', f.target), stretch = p('stretch', f.stretch);
      if (stretch > 0 && stretch <= target) e.stretch = 'Het stretchdoel moet hoger zijn dan je doel.';
      if (!F.isValidDate(f.targetDate)) e.targetDate = 'Kies een geldige datum.';
      setErrors(e);
      if (Object.keys(e).length) return;
      const s = JSON.parse(JSON.stringify(data.settings));
      const keep = (id, kind, name, amount, dueDay) => { const old = s.items.find((i) => i.id === id); return { id, name: old ? old.name : name, kind, amount, dueDay: dueDay !== undefined ? dueDay : old ? old.dueDay : null, active: true, aliases: old ? old.aliases : F.deriveAliases(name) }; };
      s.items = [
        keep(inc ? inc.id : 'salaris', 'income', 'Salaris', income, sd.day),
        ...rows.map((r) => { const old = data.settings.items.find((i) => i.id === r.key); return { id: r.key, name: r.name.trim(), kind: r.kind, amount: r.cents, dueDay: old ? old.dueDay : null, active: true, aliases: old && old.name === r.name.trim() ? old.aliases : F.deriveAliases(r.name) }; }),
        { ...keep(sav ? sav.id : 'sparen', 'savings', 'Spaaroverboeking', savings), inGoal: sav ? sav.inGoal !== false : true, goal: sav ? sav.goal || 0 : 0 },
        ...pots.map((r) => { const old = data.settings.items.find((i) => i.id === r.key); return { id: r.key, name: r.name.trim(), kind: 'savings', amount: r.cents, dueDay: old ? old.dueDay : null, active: true, inGoal: old ? !!old.inGoal : false, goal: old ? old.goal || 0 : 0, aliases: old && old.name === r.name.trim() ? old.aliases : F.deriveAliases(r.name) }; }),
        keep(res ? res.id : 'autoreserve', 'reserve', 'Autoreserve', reserve),
      ];
      s.goal = { target, stretch, targetDate: f.targetDate };
      s.setupDone = true;
      onSave(s);
    }
    return html`<main className="page setup">
      <header className="hero"><p className="eyebrow">Welkom, Sophie</p><h1>Stel je maandplan in</h1><p className="muted">Dit doe je één keer. Je kunt alles later aanpassen in Instellingen. Je bedragen blijven alleen in jouw eigen account en op dit toestel.</p></header>
      <${Card}><${Label}>Inkomen<//>
        <div className="grid2">
          <${Field} id="s-income" label="Netto per maand" error=${errors.income}><${AmountInput} id="s-income" value=${f.income} onChange=${(v) => set('income', v)} /><//>
          <${Field} id="s-day" label="Salarisdag" hint="Leeg = onbekend" error=${errors.salaryDay}><input id="s-day" className="input" inputMode="numeric" placeholder="bijv. 25" value=${f.salaryDay} onChange=${(e) => set('salaryDay', e.target.value)} /><//>
        </div><//>
      <${Card}><${Label}>Vaste lasten en budgetten<//>
        <p className="muted small">Een <b>vaste rekening</b> betaal je één keer per maand en vink je af (huur, verzekering). Een <b>budget</b> is een bedrag waarop je de hele maand uitgaven boekt (boodschappen, tanken).</p>
        <div className="rows">${f.rows.map((r) => html`<div className="setup-row" key=${r.key}>
          <div className="setup-row-top">
            <input className="input grow" aria-label="Naam" placeholder=${r.kind === 'bill' ? 'Naam, bijv. Huur' : 'Naam, bijv. Boodschappen'} value=${r.name} onChange=${(e) => setRow(r.key, { name: e.target.value })} />
            <div className="w-amount"><${AmountInput} id=${'amt-' + r.key} value=${r.amount} onChange=${(v) => setRow(r.key, { amount: v })} /></div>
            <button className="icon-btn" aria-label="Regel verwijderen" onClick=${() => setF((o) => ({ ...o, rows: o.rows.filter((x) => x.key !== r.key) }))}><${Icon} n="x" s=${18} /></button>
          </div>
          <${Seg} options=${[['bill', 'Vaste rekening'], ['budget', 'Budget']]} value=${r.kind} onChange=${(v) => setRow(r.key, { kind: v })} />
          ${errors['row' + r.key] ? html`<span className="field-error">${errors['row' + r.key]}</span>` : null}
        </div>`)}</div>
        <div className="btn-row">
          <button className="btn ghost" onClick=${() => setF((o) => ({ ...o, rows: [...o.rows, { key: F.uid(), name: '', amount: '', kind: 'bill' }] }))}>+ Vaste rekening</button>
          <button className="btn ghost" onClick=${() => setF((o) => ({ ...o, rows: [...o.rows, { key: F.uid(), name: '', amount: '', kind: 'budget' }] }))}>+ Budget</button>
        </div><//>
      <${Card}><${Label}>Sparen en reserveren per maand<//>
        <div className="grid2">
          <${Field} id="s-sav" label="Naar spaarrekening" error=${errors.savings}><${AmountInput} id="s-sav" value=${f.savings} onChange=${(v) => set('savings', v)} /><//>
          <${Field} id="s-res" label="Naar autoreserve" hint="0 = niet gebruiken" error=${errors.reserve}><${AmountInput} id="s-res" value=${f.reserve} onChange=${(v) => set('reserve', v)} /><//>
        </div>
        ${f.pots.length ? html`<div className="rows">${f.pots.map((r) => html`<div className="setup-row" key=${r.key}><div className="setup-row-top">
          <input className="input grow" aria-label="Naam potje" placeholder="Naam, bijv. Vakantie" value=${r.name} onChange=${(e) => setPot(r.key, { name: e.target.value })} />
          <div className="w-amount"><${AmountInput} id=${'pot-' + r.key} value=${r.amount} onChange=${(v) => setPot(r.key, { amount: v })} /></div>
          <button className="icon-btn" aria-label="Potje verwijderen" onClick=${() => setF((o) => ({ ...o, pots: o.pots.filter((x) => x.key !== r.key) }))}><${Icon} n="x" s=${18} /></button></div>
          ${errors['pot' + r.key] ? html`<span className="field-error">${errors['pot' + r.key]}</span>` : null}</div>`)}</div>` : null}
        <button className="btn ghost" onClick=${() => setF((o) => ({ ...o, pots: [...o.pots, { key: F.uid(), name: '', amount: '' }] }))}>+ Spaarpotje</button><//>
      <${Card}><${Label}>Spaardoel<//>
        <div className="grid2">
          <${Field} id="s-target" label="Doel" error=${errors.target}><${AmountInput} id="s-target" value=${f.target} onChange=${(v) => set('target', v)} /><//>
          <${Field} id="s-stretch" label="Stretchdoel" hint="Optioneel, hoger dan je doel" error=${errors.stretch}><${AmountInput} id="s-stretch" value=${f.stretch} onChange=${(v) => set('stretch', v)} /><//>
        </div>
        <${Field} id="s-date" label="Streefdatum" error=${errors.targetDate}><input id="s-date" type="date" className="input" value=${f.targetDate} onChange=${(e) => set('targetDate', e.target.value)} /><//><//>
      <${Card} className="summary">
        <div className="sum-line"><span>Inkomen</span><${M} c=${c(f.income)} /></div>
        <div className="sum-line"><span>Vaste lasten en budgetten</span><span className="num">− ${F.fmt(fixed)}</span></div>
        <div className="sum-line"><span>Sparen en reserveren</span><span className="num">− ${F.fmt(c(f.savings) + potsTotal + c(f.reserve))}</span></div>
        <div className="sum-line total"><span>Vrij te besteden per maand</span><span className=${cx('num', free < 0 && 'warn-text')}>${F.fmt(free)}</span></div><//>
      <button className="btn primary big" onClick=${save}>Plan opslaan en beginnen</button>
      <button className="link" onClick=${() => fileRef.current && fileRef.current.click()}>Ik heb een back-up: terugzetten</button>
      <input ref=${fileRef} type="file" accept="application/json,.json" hidden onChange=${(e) => { const file = e.target.files[0]; e.target.value = ''; if (file) file.text().then(onRestore); }} />
    </main>`;
  }

  /* ---------- dashboard ---------- */
  function Dashboard({ data, today, go, openItem, dismiss }) {
    const cur = F.monthOf(today);
    const S = useMemo(() => F.monthSummary(data, cur, today), [data, today]);
    const sv = useMemo(() => F.savingsStats(data, today), [data, today]);
    const rs = useMemo(() => F.reserveStats(data), [data]);
    const up = useMemo(() => F.upcoming(data, today), [data, today]);
    const rem = useMemo(() => F.remindersToday(data, today), [data, today]);
    const ratio = S.planned.available > 0 ? S.remaining / S.planned.available : 0;
    const budgets = S.rows.filter((r) => r.kind === 'budget');
    const row = (k) => S.rows.find((r) => r.kind === k);
    const inc = row('income'), savRow = row('savings'), resRow = row('reserve');
    return html`<main className="page">
      ${rem.map((r) => html`<div className="reminder" key=${r.key}><div><b>${r.title}</b><p>${r.text}</p></div><button className="btn small light" onClick=${() => dismiss(r.key)}>Gezien</button></div>`)}
      <section className="hero-num">
        <span className="label">Nog vrij te besteden · ${F.monthLabel(cur, false)}</span>
        <div className=${cx('big-num num', S.remaining < 0 && 'warn-text')}>${F.fmt(S.remaining)}</div>
        <p className="muted">van ${F.fmt(S.planned.available)} beschikbaar budget${S.perDay != null ? html` · ongeveer <b className="num">${F.fmt(Math.max(0, S.perDay))}</b> per dag voor de resterende ${S.daysLeft} ${S.daysLeft === 1 ? 'dag' : 'dagen'}` : ''}</p>
        <${Bar} value=${ratio} warn=${ratio < 0.15} />
      </section>
      ${budgets.length ? html`<div className="budget-grid">${budgets.map((b) => html`<button key=${b.item.id} className="card budget-card" onClick=${() => openItem(cur, b.item.id)}>
          <span className="bc-name">${b.item.name}</span>
          <span className=${cx('bc-left num', b.over && 'warn-text')}>${b.over ? F.fmt(b.over) + ' over' : F.fmt(b.left) + ' over'}</span>
          <${Bar} thin value=${b.item.amount ? b.spent / b.item.amount : 0} warn=${b.over > 0} />
          <span className="muted tiny num">${F.fmt(b.spent)} van ${F.fmt(b.item.amount)}${b.closed ? ' · afgesloten' : ''}</span></button>`)}</div>` : null}
      <${Card}><${Label}>Maandplan<//>
        <div className="sum-line"><span>Maandinkomen <span className="muted small">${inc ? (inc.done ? 'ontvangen' : inc.item.dueDay ? 'verwacht op de ' + inc.item.dueDay + 'e' : 'datum onbekend') : ''}</span></span><${M} c=${S.planned.income} /></div>
        <div className="sum-line"><span>Vaste lasten</span><span className="num">− ${F.fmt(S.planned.fixed)}</span></div>
        <div className="sum-line"><span>Maandelijks sparen <span className="muted small">${savRow && savRow.done ? 'gestort' : ''}</span></span><span className="num">− ${F.fmt(S.planned.savings)}</span></div>
        ${S.planned.reserve ? html`<div className="sum-line"><span>${resRow ? resRow.item.name : 'Autoreserve'} <span className="muted small">${resRow && resRow.done ? 'gestort' : ''}</span></span><span className="num">− ${F.fmt(S.planned.reserve)}</span></div>` : null}
        <div className="sum-line total"><span>Beschikbaar budget</span><${M} c=${S.planned.available} /></div><//>
      <${Card}><${Label} right=${html`<button className="link small" onClick=${() => go('maand')}>Naar checklist</button>`}>Voortgang<//>
        <div className="stat-grid">
          <div><span className="muted small">Afgevinkt</span><b className="num">${S.checked} van ${S.total}</b></div>
          <div><span className="muted small">Nog open</span><b className="num">${F.fmt(S.open)}</b></div>
          <div><span className="muted small">Inkomen</span><b className="num">${F.fmt(S.actualIncome)}</b></div>
          <div><span className="muted small">Uitgegeven</span><b className="num">${F.fmt(S.totalExpenses)}</b></div>
          <div><span className="muted small">Gespaard</span><b className="num">${F.fmt(S.netSaved)}</b></div>
        </div>
        <${Bar} thin value=${S.total ? S.checked / S.total : 0} /><//>
      <${Card} onClick=${() => go('sparen')} className="tap"><${Label}>Spaardoel<//>
        <div className="row-between"><div><div className="mid-num num">${F.fmt(sv.balance)}</div>
          <p className="muted small">${sv.target ? 'van ' + F.fmt(sv.target) + ' vóór ' + F.fmtDateLong(data.settings.goal.targetDate) : 'Nog geen doel ingesteld'}</p></div>
          ${sv.target ? html`<div className="pct num">${Math.floor(sv.pct)}%</div>` : null}</div>
        <${Bar} value=${sv.pct / 100} />
        <div className="sum-line small"><span className="muted">${rs.name}</span><${M} c=${rs.balance} /></div>
        ${sv.neededPerMonth != null ? html`<div className="sum-line small"><span className="muted">Nog nodig p/m</span><${M} c=${sv.neededPerMonth} /></div>` : null}<//>
      <${Card}><${Label}>Komende en openstaande betalingen<//>
        ${up.length ? html`<ul className="list">${up.map((u) => html`<li key=${u.month + u.item.id}><button className="list-btn" onClick=${() => openItem(u.month, u.item.id)}>
            <span><span className="li-title">${u.item.name}</span><span className=${cx('small', u.late ? 'warn-text' : 'muted')}>${u.label}${u.date ? ' · ' + F.fmtDay(u.date) : ''}</span></span><${M} c=${u.item.amount} /></button></li>`)}</ul>` : html`<p className="muted small">Niets meer open. Alles van deze maand is afgevinkt.</p>`}<//>
    </main>`;
  }

  /* ---------- maand ---------- */
  function MonthPage({ data, today, month, setMonth, commit, openItem, openTx }) {
    const cur = F.monthOf(today);
    const [view, setView] = useState('checklist');
    const first = F.monthDiff(data.settings.startMonth, cur) >= 0 ? data.settings.startMonth : cur;
    const months = F.monthRange(F.monthDiff(first, F.addMonths(cur, -12)) > 0 ? F.addMonths(cur, -12) : first, F.addMonths(cur, 3));
    const pillRef = useRef(null);
    useEffect(() => { const el = pillRef.current && pillRef.current.querySelector('.on'); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [month]);
    const S = useMemo(() => F.monthSummary(data, month, today), [data, month, today]);
    const toggle = (r) => {
      if (r.kind === 'budget') return commit((d) => F.toggleBudgetClosed(d, month, r.item.id), r.closed ? r.item.name + ' weer geopend' : r.item.name + ' afgesloten');
      if (r.done) commit((d) => F.uncheck(d, month, r.item.id), r.item.name + ' uitgevinkt');
      else commit((d) => F.check(d, month, r.item.id, {}, today), r.item.name + ' afgevinkt');
    };
    const groups = [['Inkomen', ['income']], ['Vaste lasten', ['bill']], ['Budgetten', ['budget']], ['Sparen en reserveren', ['savings', 'reserve']]];
    const sub = (r) => {
      if (r.kind === 'budget') return (r.closed ? 'Afgesloten · ' : '') + 'Besteed ' + F.fmt(r.spent) + ' van ' + F.fmt(r.item.amount) + (r.over ? ' · ' + F.fmt(r.over) + ' over' : '');
      if (r.done) return (r.kind === 'income' ? 'Ontvangen op ' : r.kind === 'bill' ? 'Betaald op ' : 'Gestort op ') + F.fmtDay(r.tx.date) + (r.tx.amount !== r.item.amount ? ' · ' + F.fmt(r.tx.amount) : '');
      return (r.item.month ? 'Eén keer per jaar · ' : '') + (r.item.dueDay ? (r.kind === 'income' ? 'Verwacht op de ' : 'Op de ') + r.item.dueDay + 'e' : 'Datum onbekend');
    };
    const ratio = S.planned.available > 0 ? S.remaining / S.planned.available : 0;
    return html`<main className="page">
      <div className="pills" ref=${pillRef}>${months.map((m) => html`<button key=${m} className=${cx('pill', m === month && 'on', m === cur && 'now')} onClick=${() => setMonth(m)}>${F.monthShort(m)}</button>`)}</div>
      <div className="title-row"><h1>${F.monthLabel(month)}</h1><${Seg} options=${[['checklist', 'Checklist'], ['kalender', 'Kalender']]} value=${view} onChange=${setView} /></div>
      ${view === 'checklist' ? html`
        <${Card}><div className="stat-grid three">
          <div><span className="muted small">Afgevinkt</span><b className="num">${S.checked}/${S.total}</b></div>
          <div><span className="muted small">Nog open</span><b className="num">${F.fmt(S.open)}</b></div>
          <div><span className="muted small">Vrij over</span><b className=${cx('num', S.remaining < 0 && 'warn-text')}>${F.fmt(S.remaining)}</b></div></div>
          <${Bar} value=${S.total ? S.checked / S.total : 0} /><//>
        ${S.rows.length === 0 ? html`<p className="muted empty">Er staat nog niets in het plan voor deze maand. Vul je posten in bij Instellingen.</p>` : null}
        ${groups.map(([title, kinds]) => { const rows = S.rows.filter((r) => kinds.includes(r.kind)); if (!rows.length) return null; return html`<${Card} key=${title}><${Label}>${title}<//>
          <ul className="list">${rows.map((r) => html`<li key=${r.item.id} className="check-row">
            <${CheckCircle} done=${r.done} label=${(r.done ? 'Uitvinken: ' : 'Afvinken: ') + r.item.name} onClick=${() => toggle(r)} />
            <button className="list-btn" onClick=${() => openItem(month, r.item.id)}><span><span className=${cx('li-title', r.done && r.kind !== 'budget' && 'done-text')}>${r.item.name}</span><span className=${cx('small', r.over ? 'warn-text' : 'muted')}>${sub(r)}</span></span><${M} c=${r.item.amount} /></button></li>`)}</ul><//>`; })}
        <${Card}><${Label} right=${html`<button className="link small" onClick=${() => openTx(null, { type: 'expense', date: month === cur ? today : month + '-01' })}>+ Uitgave</button>`}>Overige uitgaven deze maand<//>
          ${S.freeTxs.length ? html`<ul className="list">${S.freeTxs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => html`<li key=${t.id}><button className="list-btn" onClick=${() => openTx(t.id)}><span><span className="li-title">${t.note || t.category || 'Uitgave'}</span><span className="muted small">${F.fmtDay(t.date)} · ${t.category || 'Overig'}</span></span><${M} c=${t.amount} /></button></li>`)}</ul>
            <div className="sum-line total small"><span>Totaal</span><${M} c=${S.freeSpend} /></div>` : html`<p className="muted small">Nog geen vrije uitgaven.</p>`}<//>`
      : html`<${Calendar} data=${data} S=${S} month=${month} today=${today} openItem=${openItem} />`}
    </main>`;
  }
  function Calendar({ data, S, month, today, openItem }) {
    const [sel, setSel] = useState(null);
    const dim = F.daysInMonth(month);
    const startDow = (F.parseYmd(month + '-01').getDay() + 6) % 7;
    const rev = data.settings.reminders.find((r) => r.id === 'review');
    const byDay = {};
    const add = (d, e) => { (byDay[d] = byDay[d] || []).push(e); };
    const noDate = [];
    for (const r of S.rows) {
      if (r.kind === 'budget') continue;
      if (r.item.dueDay) add(Math.min(r.item.dueDay, dim), { r, tone: r.done ? 'ok' : 'plan' });
      else if (r.done && r.tx.month === month && F.monthOf(r.tx.date) === month) add(Number(r.tx.date.slice(8)), { r, tone: 'ok' });
      else noDate.push(r);
    }
    const reviewDay = Math.min(rev && rev.day ? rev.day : 28, dim);
    add(reviewDay, { review: true, tone: 'rev' });
    const cells = [...Array(startDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
    const isToday = (d) => month + '-' + F.pad(d) === today;
    const list = sel ? byDay[sel] || [] : [];
    return html`<${Card}>
      <div className="cal-head">${['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => html`<span key=${d}>${d}</span>`)}</div>
      <div className="cal">${cells.map((d, i) => d ? html`<button key=${i} className=${cx('cal-day', sel === d && 'sel', isToday(d) && 'today')} onClick=${() => setSel(d)} aria-label=${d + ' ' + F.monthLabel(month)}>
          <span>${d}</span><span className="dots">${(byDay[d] || []).slice(0, 3).map((e, j) => html`<i key=${j} className=${'dot-' + e.tone}></i>`)}</span></button>` : html`<span key=${i}></span>`)}</div>
      <div className="legend small muted"><span><i className="dot-ok"></i>voldaan</span><span><i className="dot-plan"></i>gepland</span><span><i className="dot-rev"></i>review</span></div>
      ${sel ? html`<div className="cal-list"><${Label}>${sel} ${F.monthLabel(month, false)}<//>${list.length ? html`<ul className="list">${list.map((e, j) => e.review ? html`<li key=${j} className="muted small pad-y">Maandreview: terugkijken en volgende maand plannen</li>` : html`<li key=${e.r.item.id}><button className="list-btn" onClick=${() => openItem(month, e.r.item.id)}><span><span className="li-title">${e.r.item.name}</span><span className="muted small">${e.r.done ? 'Voldaan' : 'Gepland'}</span></span><${M} c=${e.r.item.amount} /></button></li>`)}</ul>` : html`<p className="muted small">Niets op deze dag.</p>`}</div>` : null}
      ${noDate.length ? html`<div className="cal-list"><${Label}>Zonder vaste datum<//><ul className="list">${noDate.map((r) => html`<li key=${r.item.id}><button className="list-btn" onClick=${() => openItem(month, r.item.id)}><span><span className="li-title">${r.item.name}</span><span className="muted small">${r.done ? 'Voldaan' : 'Open'}</span></span><${M} c=${r.item.amount} /></button></li>`)}</ul></div>` : null}
    <//>`;
  }

  /* ---------- onderblad: post ---------- */
  function ItemSheet({ data, today, month, itemId, commit, close, openTx }) {
    const S = F.monthSummary(data, month, today);
    const row = S.rows.find((r) => r.item.id === itemId);
    const raw = F.monthItemsAll(data, month).find((i) => i.id === itemId);
    const [amt, setAmt] = useState(() => F.centsToInput(row && row.tx ? row.tx.amount : raw ? raw.amount : 0));
    const [date, setDate] = useState(() => (row && row.tx ? row.tx.date : month === F.monthOf(today) ? today : raw && raw.dueDay ? F.dateInMonth(month, raw.dueDay) : month + '-01'));
    const [plan, setPlan] = useState(() => F.centsToInput(raw ? raw.amount : 0));
    const [day, setDay] = useState(() => dayStr(raw && raw.dueDay));
    const [err, setErr] = useState(null);
    if (!raw) return html`<p className="muted">Deze post bestaat niet meer.</p>`;
    const doCheck = () => { const p = F.parseAmount(amt); if (!p.ok) return setErr(p.error); const fn = row && row.done ? (d) => F.updateTx(d, row.tx.id, { amount: p.cents, date }) : (d) => F.check(d, month, itemId, { amount: p.cents, date }, today); if (commit(fn, row && row.done ? 'Betaling aangepast' : raw.name + ' afgevinkt')) close(); };
    const doOverride = () => { const p = parseOr(plan, 0); if (!p.ok) return setErr(p.error); const dd = parseDay(day); if (!dd.ok) return setErr(dd.error); if (commit((d) => F.setMonthOverride(d, month, itemId, { amount: p.cents, dueDay: dd.day }), 'Aangepast voor ' + F.monthLabel(month, false))) close(); };
    const override = html`<div className="sheet-section"><${Label}>Alleen voor ${F.monthLabel(month, false)}<//>
      <div className="grid2"><${Field} id="ov-amt" label="Gepland bedrag"><${AmountInput} id="ov-amt" value=${plan} onChange=${setPlan} /><//>
      <${Field} id="ov-day" label="Dag van de maand" hint="Leeg = onbekend"><input id="ov-day" className="input" inputMode="numeric" value=${day} onChange=${(e) => setDay(e.target.value)} /><//></div>
      <button className="btn ghost" onClick=${doOverride}>Alleen deze maand aanpassen</button></div>`;
    if (raw.kind === 'budget') {
      const b = row || { spent: 0, left: raw.amount, over: 0, txs: [], closed: false };
      return html`<div className="stack">
        <div className="row-between"><div><div className="mid-num num">${F.fmt(b.over ? -b.over : b.left)}</div><p className="muted small">${b.over ? 'over budget' : 'over'} · besteed ${F.fmt(b.spent)} van ${F.fmt(raw.amount)}</p></div></div>
        <${Bar} value=${raw.amount ? b.spent / raw.amount : 0} warn=${b.over > 0} />
        <div className="btn-row"><button className="btn primary" onClick=${() => openTx(null, { type: 'expense', itemId, month, category: raw.name, date: month === F.monthOf(today) ? today : month + '-01' })}>+ Uitgave boeken</button>
        <button className="btn ghost" onClick=${() => commit((d) => F.toggleBudgetClosed(d, month, itemId), b.closed ? 'Budget weer geopend' : 'Budget afgesloten')}>${b.closed ? 'Weer openen' : 'Budget afsluiten'}</button></div>
        ${b.txs.length ? html`<ul className="list">${b.txs.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).map((t) => html`<li key=${t.id}><button className="list-btn" onClick=${() => openTx(t.id)}><span><span className="li-title">${t.note || raw.name}</span><span className="muted small">${F.fmtDay(t.date)}</span></span><${M} c=${t.amount} /></button></li>`)}</ul>` : html`<p className="muted small">Nog geen uitgaven op dit budget.</p>`}
        ${override}${err ? html`<p className="field-error">${err}</p>` : null}</div>`;
    }
    const done = row && row.done;
    return html`<div className="stack">
      <p className="muted small">${KIND_LABEL[raw.kind]} · gepland ${F.fmt(raw.amount)}${raw.dueDay ? ' op de ' + raw.dueDay + 'e' : ' · datum onbekend'}</p>
      <div className="grid2"><${Field} id="it-amt" label=${done ? 'Betaald bedrag' : 'Werkelijk bedrag'}><${AmountInput} id="it-amt" value=${amt} onChange=${setAmt} /><//>
      <${Field} id="it-date" label="Datum"><input id="it-date" type="date" className="input" value=${date} onChange=${(e) => setDate(e.target.value)} /><//></div>
      <div className="btn-row"><button className="btn primary" onClick=${doCheck}>${done ? 'Betaling opslaan' : 'Afvinken'}</button>
      ${done ? html`<button className="btn ghost" onClick=${() => { if (commit((d) => F.uncheck(d, month, itemId), raw.name + ' uitgevinkt')) close(); }}>Uitvinken</button>` : null}</div>
      ${err ? html`<p className="field-error">${err}</p>` : null}
      ${row ? override : html`<p className="muted small">Deze post staat op € 0 of is uitgezet voor deze maand.</p>${override}`}</div>`;
  }

  /* ---------- onderblad: boeking ---------- */
  const TYPE_OPTS = [['expense', 'Uitgave'], ['income', 'Inkomen'], ['savings_deposit', 'Spaarstorting'], ['savings_withdrawal', 'Spaaropname'], ['reserve_deposit', 'Storting reserve'], ['reserve_expense', 'Onderhoud uit reserve'], ['savings_opening', 'Beginsaldo sparen'], ['reserve_opening', 'Beginsaldo reserve']];
  function TxSheet({ data, today, id, preset, commit, close }) {
    const t = id ? data.transactions.find((x) => x.id === id) : null;
    const init = t || { type: 'expense', amount: 0, date: today, note: '', category: '', ...(preset || {}) };
    const [type, setType] = useState(init.type);
    const [amt, setAmt] = useState(F.centsToInput(init.amount));
    const [date, setDate] = useState(init.date);
    const [note, setNote] = useState(init.note || '');
    const [cat, setCat] = useState(init.category || '');
    const [itemId, setItemId] = useState(init.itemId || '');
    const [potId, setPotId] = useState(init.potId || '');
    const potList = data.settings.items.filter((i) => i.kind === 'savings');
    const [err, setErr] = useState(null);
    const [confirm, setConfirm] = useState(false);
    const month = t && t.itemId && itemId === t.itemId ? t.month : preset && preset.month && itemId ? preset.month : F.isValidDate(date) ? F.monthOf(date) : F.monthOf(today);
    const linkable = F.monthItemsAll(data, month).filter((i) => i.active && F.inMonth(i, month) && F.KIND_TX[i.kind] === type);
    const save = () => {
      const p = F.parseAmount(amt); if (!p.ok) return setErr(p.error);
      const input = { type, amount: p.cents, date, note: note.trim(), category: cat.trim() || (itemId ? (linkable.find((i) => i.id === itemId) || {}).name || '' : ''), itemId: itemId && linkable.some((i) => i.id === itemId) ? itemId : undefined, potId: !itemId && type.startsWith('savings') && potId ? potId : undefined, month: itemId ? month : undefined };
      const ok = t ? commit((d) => F.updateTx(d, t.id, input), 'Boeking aangepast') : commit((d) => F.addTx(d, { ...input, source: 'handmatig' }), 'Boeking opgeslagen');
      if (ok) close();
    };
    if (t && t.deletedAt) return html`<div className="stack"><p>Deze boeking staat in de prullenbak en telt nergens mee.</p>
      <div className="tx-summary"><b>${F.TYPE_LABEL[t.type]}</b> · <${M} c=${t.amount} /> · ${F.fmtDay(t.date)}${t.note ? ' · ' + t.note : ''}</div>
      <div className="btn-row"><button className="btn primary" onClick=${() => { if (commit((d) => F.restoreTx(d, t.id), 'Boeking hersteld')) close(); }}>Herstellen</button>
      <button className=${cx('btn', confirm ? 'danger' : 'ghost')} onClick=${() => { if (!confirm) return setConfirm(true); if (commit((d) => F.purgeTx(d, t.id), 'Definitief verwijderd', false)) close(); }}>${confirm ? 'Zeker weten? Tik nogmaals' : 'Definitief verwijderen'}</button></div></div>`;
    return html`<div className="stack">
      <${Field} id="tx-type" label="Soort"><select id="tx-type" className="input" value=${type} onChange=${(e) => { setType(e.target.value); setItemId(''); }}>${TYPE_OPTS.map(([v, l]) => html`<option key=${v} value=${v}>${l}</option>`)}</select><//>
      <div className="grid2"><${Field} id="tx-amt" label="Bedrag"><${AmountInput} id="tx-amt" value=${amt} onChange=${setAmt} /><//>
      <${Field} id="tx-date" label="Datum"><input id="tx-date" type="date" className="input" value=${date} onChange=${(e) => setDate(e.target.value)} /><//></div>
      <${Field} id="tx-note" label="Omschrijving"><input id="tx-note" className="input" value=${note} placeholder="bijv. Tanken" onChange=${(e) => setNote(e.target.value)} /><//>
      ${linkable.length ? html`<${Field} id="tx-item" label="Hoort bij" hint=${'Posten van ' + F.monthLabel(month)}><select id="tx-item" className="input" value=${itemId} onChange=${(e) => setItemId(e.target.value)}><option value="">Niets (losse boeking)</option>${linkable.map((i) => html`<option key=${i.id} value=${i.id}>${i.name}</option>`)}</select><//>` : null}
      ${!itemId && type.startsWith('savings') && potList.length > 1 ? html`<${Field} id="tx-pot" label="Potje"><select id="tx-pot" className="input" value=${potId || potList[0].id} onChange=${(e) => setPotId(e.target.value)}>${potList.map((i) => html`<option key=${i.id} value=${i.id}>${i.name}</option>`)}</select><//>` : null}
      ${!itemId ? html`<${Field} id="tx-cat" label="Categorie"><input id="tx-cat" className="input" list="cats" value=${cat} placeholder="bijv. Boodschappen" onChange=${(e) => setCat(e.target.value)} /><datalist id="cats">${['Boodschappen', 'Uit eten', 'Kleding', 'Cadeaus', 'Sport', 'Vervoer', 'Uitgaan', 'Overig'].map((c) => html`<option key=${c} value=${c} />`)}</datalist><//>` : null}
      ${err ? html`<p className="field-error">${err}</p>` : null}
      <div className="btn-row"><button className="btn primary" onClick=${save}>Opslaan</button>
      ${t ? html`<button className=${cx('btn', confirm ? 'danger' : 'ghost')} onClick=${() => { if (!confirm) return setConfirm(true); if (commit((d) => F.deleteTx(d, t.id), 'Naar de prullenbak')) close(); }}>${confirm ? 'Zeker weten? Tik nogmaals' : 'Verwijderen'}</button>` : null}</div>
      ${t && t.history && t.history.length ? html`<div className="sheet-section"><${Label}>Eerdere versies<//><ul className="list">${t.history.slice().reverse().map((h, i) => html`<li key=${i} className="hist"><span className="num">${F.fmt(h.amount)} · ${F.fmtDay(h.date)}${h.note ? ' · ' + h.note : ''}</span><span className="muted tiny">gewijzigd ${F.fmtDay(h.at.slice(0, 10))}</span></li>`)}</ul></div>` : null}
      ${t ? html`<p className="muted tiny">Bron: ${t.source} · boekmaand ${F.monthLabel(t.month)}</p>` : null}
    </div>`;
  }

  /* ---------- sparen ---------- */
  function SavingsPage({ data, today, commit, openTx, openPot }) {
    const [view, setView] = useState('doel');
    const sv = useMemo(() => F.savingsStats(data, today), [data, today]);
    const rs = useMemo(() => F.reserveStats(data), [data]);
    const cur = F.monthOf(today);
    const savItem = data.settings.items.find((i) => i.kind === 'savings');
    const pots = useMemo(() => F.potStats(data), [data]);
    const resItem = data.settings.items.find((i) => i.kind === 'reserve');
    return html`<main className="page">
      <div className="title-row"><h1>Sparen</h1><${Seg} options=${[['doel', 'Spaardoel'], ['reserve', resItem ? resItem.name : 'Autoreserve']]} value=${view} onChange=${setView} /></div>
      ${view === 'doel' ? html`
        <${Card}><span className="label">Spaarsaldo</span>
          <div className="row-between"><div className="big-num small-big num">${F.fmt(sv.balance)}</div>${sv.target ? html`<div className="pct num">${Math.floor(sv.pct)}%</div>` : null}</div>
          <${Bar} value=${sv.pct / 100} />
          ${sv.stretch ? html`<div className="sum-line small"><span className="muted">Stretchdoel ${F.fmt(sv.stretch)}</span><span className="num">${Math.floor(sv.pctStretch)}%</span></div><${Bar} thin value=${sv.pctStretch / 100} />` : null}
          <div className="stat-grid">
            <div><span className="muted small">Doel</span><b className="num">${sv.target ? F.fmt(sv.target) : 'Niet ingesteld'}</b></div>
            <div><span className="muted small">Vóór</span><b>${F.fmtDateLong(data.settings.goal.targetDate)}</b></div>
            <div><span className="muted small">Totaal gestort</span><b className="num">${F.fmt(sv.deposits)}</b></div>
            <div><span className="muted small">Opgenomen</span><b className="num">${F.fmt(sv.withdrawals)}</b></div>
            <div><span className="muted small">Netto dit jaar</span><b className="num">${F.fmt(sv.netYear)}</b></div>
            <div><span className="muted small">Maanden te gaan</span><b className="num">${sv.monthsToGo}</b></div>
            <div><span className="muted small">Nog nodig p/m</span><b className="num">${sv.neededPerMonth != null ? F.fmt(sv.neededPerMonth) : '–'}</b></div>
            <div><span className="muted small">Voorspelling</span><b className="num">${sv.forecast ? F.fmt(sv.forecast.amount) : 'Nog geen voorspelling'}</b></div>
          </div>
          ${sv.forecast ? html`<p className="muted small">Op basis van gemiddeld ${F.fmt(sv.forecast.avg)} per maand over ${sv.forecast.months} afgesloten ${sv.forecast.months === 1 ? 'maand' : 'maanden'}.${sv.target ? (sv.forecast.amount >= sv.target ? ' Daarmee haal je je doel.' : ' Daarmee kom je ' + F.fmt(sv.target - sv.forecast.amount) + ' tekort.') : ''}</p>` : null}<//>
        <${Card}><${Label} right=${html`<span className="muted small num">${F.fmt(pots.reduce((a, p) => a + p.balance, 0))} totaal</span>`}>Spaarpotjes<//>
          <ul className="list">${pots.map((p) => html`<li key=${p.item.id}><button className="list-btn pot-row" onClick=${() => openPot(p.item.id)}>
            <span className="grow"><span className="li-title">${p.item.name}${p.item.active ? '' : ' (uit)'}</span><span className="muted small">${F.fmt(p.item.amount)} per maand${p.item.inGoal ? ' · telt mee voor spaardoel' : ''}</span>
              ${p.item.goal ? html`<span className="pot-goal"><${Bar} thin value=${p.balance / p.item.goal} /><span className="muted tiny num">${Math.floor(p.pct)}% van ${F.fmtRound(p.item.goal)}</span></span>` : null}</span>
            <${M} c=${p.balance} className="li-amount" /></button></li>`)}</ul>
          <p className="muted tiny">Een potje toevoegen of hernoemen doe je in Instellingen → Spaarpotjes.</p><//>
        ${sv.goalPots.length ? html`<p className="muted small pad-x">Het spaardoel hierboven telt: ${sv.goalPots.map((p) => p.name).join(', ')}.</p>` : null}
        <${Card}><${Label}>Saldoverloop<//><${AreaChart} series=${sv.series} goal=${sv.target} /><//>
        <${Card}><${Label}>Prestatie per maand<//><${Columns} items=${sv.series.slice(-8).map((s) => ({ label: F.MON_SHORT[Number(s.month.slice(5)) - 1], value: s.net, current: s.month === cur }))} /><//>
        <${Card}><${Label}>Mijlpalen<//><ul className="list">${sv.milestones.map((m) => html`<li key=${m.amount} className="check-row static">
          <span className=${cx('circle small', m.reached && 'done')}>${m.reached ? html`<${Icon} n="check" s=${12} />` : null}</span>
          <span className="li-title grow num">${F.fmtRound(m.amount)}</span><span className="muted small">${m.reached ? F.fmtDay(m.date) + ' ' + m.date.slice(0, 4) : 'nog ' + F.fmt(Math.max(0, m.amount - sv.balance))}</span></li>`)}</ul><//>
        <${AmountEditor} title=${'Maandelijkse inleg ' + (savItem ? savItem.name : '')} hint="Geldt vanaf deze maand" value=${savItem ? savItem.amount : 0} onSave=${(c) => commit((d) => { const s = JSON.parse(JSON.stringify(d.settings)); const it = s.items.find((i) => i.kind === 'savings'); if (!it) return { error: 'Geen spaarpost gevonden.' }; it.amount = c; return F.applySettings(d, s, cur); }, 'Maandelijkse inleg aangepast')} />
        <${OpeningEditor} data=${data} type="savings_opening" title="Beginsaldo spaarrekening" commit=${commit} today=${today} />
      ` : html`
        <${Card}><span className="label">Saldo ${rs.name.toLowerCase()}</span>
          <div className=${cx('big-num small-big num', rs.balance < 0 && 'warn-text')}>${F.fmt(rs.balance)}</div>
          <div className="stat-grid three">
            <div><span className="muted small">Ingelegd</span><b className="num">${F.fmt(rs.deposits)}</b></div>
            <div><span className="muted small">Uitgegeven</span><b className="num">${F.fmt(rs.expenses)}</b></div>
            <div><span className="muted small">Per maand</span><b className="num">${F.fmt(rs.perMonth)}</b></div></div>
          <p className="muted small">Onderhoud dat je uit deze reserve betaalt, telt niet mee in je vrije budget.</p>
          <button className="btn ghost" onClick=${() => openTx(null, { type: 'reserve_expense', date: today, category: 'Auto-onderhoud' })}>+ Onderhoud boeken</button><//>
        <${Card}><${Label}>Geschiedenis<//>${rs.history.length ? html`<ul className="list">${rs.history.map((t) => html`<li key=${t.id}><button className="list-btn" onClick=${() => openTx(t.id)}><span><span className="li-title">${t.type === 'reserve_expense' ? t.note || 'Onderhoud' : t.type === 'reserve_opening' ? 'Beginsaldo' : 'Storting'}</span><span className="muted small">${F.fmtDay(t.date)} ${t.date.slice(0, 4)}</span></span><span className="num">${t.type === 'reserve_expense' ? '− ' : '+ '}${F.fmt(t.amount)}</span></button></li>`)}</ul>` : html`<p className="muted small">Nog geen stortingen of onderhoud.</p>`}<//>
        <${AmountEditor} title="Inleg per maand" hint="Geldt vanaf deze maand. 0 = niet gebruiken" value=${resItem ? resItem.amount : 0} onSave=${(c) => commit((d) => { const s = JSON.parse(JSON.stringify(d.settings)); const it = s.items.find((i) => i.kind === 'reserve'); if (!it) return { error: 'Geen reservepost gevonden.' }; it.amount = c; return F.applySettings(d, s, cur); }, 'Inleg aangepast')} allowZero />
        <${OpeningEditor} data=${data} type="reserve_opening" title="Beginsaldo reserve" commit=${commit} today=${today} />
      `}
    </main>`;
  }
  function AmountEditor({ title, hint, value, onSave, allowZero }) {
    const [v, setV] = useState(F.centsToInput(value));
    const [err, setErr] = useState(null);
    useEffect(() => setV(F.centsToInput(value)), [value]);
    const id = 'ae-' + title.replace(/\W/g, '');
    return html`<${Card}><${Label}>${title}<//><div className="inline-form"><${AmountInput} id=${id} value=${v} onChange=${setV} /><button className="btn primary" onClick=${() => { const p = parseOr(v, 0); if (!p.ok) return setErr(p.error); if (!allowZero && p.cents === 0) return setErr('Vul een bedrag hoger dan € 0 in.'); if (p.cents > F.MAX_CENTS) return setErr('Controleer het nog even: dit is hoger dan € 100.000.'); setErr(null); onSave(p.cents); }}>Opslaan</button></div>
      ${err ? html`<p className="field-error">${err}</p>` : html`<p className="muted tiny">${hint}</p>`}<//>`;
  }
  function OpeningEditor({ data, type, title, commit, today }) {
    const existing = data.transactions.find((t) => F.alive(t) && t.type === type);
    const [v, setV] = useState(F.centsToInput(existing ? existing.amount : 0));
    const [date, setDate] = useState(existing ? existing.date : data.settings.startMonth + '-01');
    const [err, setErr] = useState(null);
    const save = () => {
      const p = F.parseAmount(v); if (!p.ok) return setErr(p.error);
      setErr(null);
      commit((d) => (existing ? F.updateTx(d, existing.id, { amount: p.cents, date }) : F.addTx(d, { type, amount: p.cents, date, category: 'Beginsaldo', note: 'Beginsaldo', source: 'handmatig' })), 'Beginsaldo vastgelegd');
    };
    const id = 'op-' + type;
    return html`<${Card}><${Label}>${title}<//><p className="muted small">Wat er al op stond toen je met deze app begon.</p>
      <div className="grid2"><${Field} id=${id} label="Bedrag"><${AmountInput} id=${id} value=${v} onChange=${setV} /><//><${Field} id=${id + '-d'} label="Per datum"><input id=${id + '-d'} type="date" className="input" value=${date} onChange=${(e) => setDate(e.target.value)} /><//></div>
      ${err ? html`<p className="field-error">${err}</p>` : null}<button className="btn ghost" onClick=${save}>Beginsaldo opslaan</button><//>`;
  }

  function PotSheet({ data, today, potId, openTx }) {
    const p = F.potStats(data).find((x) => x.item.id === potId);
    if (!p) return html`<p className="muted">Dit potje bestaat niet meer.</p>`;
    const LBL = { savings_deposit: 'Storting', savings_withdrawal: 'Opname', savings_opening: 'Beginsaldo' };
    return html`<div className="stack">
      <div><div className="mid-num num">${F.fmt(p.balance)}</div><p className="muted small">${F.fmt(p.item.amount)} per maand · gestort ${F.fmt(p.deposits)} · opgenomen ${F.fmt(p.withdrawals)}</p></div>
      ${p.item.goal ? html`<${Bar} value=${p.balance / p.item.goal} /><p className="muted small">${Math.floor(p.pct)}% van je doel van ${F.fmt(p.item.goal)}</p>` : null}
      <div className="btn-row">
        <button className="btn primary" onClick=${() => openTx(null, { type: 'savings_deposit', potId, date: today, category: p.item.name })}>+ Storting</button>
        <button className="btn ghost" onClick=${() => openTx(null, { type: 'savings_withdrawal', potId, date: today, category: p.item.name })}>Opname</button>
        <button className="btn ghost" onClick=${() => openTx(null, { type: 'savings_opening', potId, date: data.settings.startMonth + '-01', category: 'Beginsaldo', note: 'Beginsaldo' })}>Beginsaldo</button></div>
      <p className="muted tiny">De vaste inleg van elke maand vink je af in Maand.</p>
      ${p.history.length ? html`<ul className="list">${p.history.map((t) => html`<li key=${t.id}><button className="list-btn" onClick=${() => openTx(t.id)}><span><span className="li-title">${t.note || LBL[t.type]}</span><span className="muted small">${LBL[t.type]} · ${F.fmtDay(t.date)} ${t.date.slice(0, 4)}</span></span><span className="num">${t.type === 'savings_withdrawal' ? '− ' : '+ '}${F.fmt(t.amount)}</span></button></li>`)}</ul>` : html`<p className="muted small">Nog niets in dit potje.</p>`}
    </div>`;
  }

  /* ---------- transacties ---------- */
  function TxPage({ data, today, openTx }) {
    const [view, setView] = useState('lijst');
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('alles');
    const [am, setAm] = useState(F.monthOf(today));
    const nameOf = (t) => { const id = t.itemId || t.potId; const i = F.monthItemsAll(data, t.month).find((x) => x.id === id) || data.settings.items.find((x) => x.id === id); return i ? i.name : ''; };
    const FILTERS = [['alles', 'Alles'], ['uitgaven', 'Uitgaven'], ['inkomen', 'Inkomen'], ['sparen', 'Sparen'], ['reserve', 'Reserve'], ['prullenbak', 'Prullenbak']];
    const match = (t) => {
      if (filter === 'prullenbak') { if (!t.deletedAt) return false; } else if (t.deletedAt) return false;
      if (filter === 'uitgaven' && t.type !== 'expense') return false;
      if (filter === 'inkomen' && t.type !== 'income') return false;
      if (filter === 'sparen' && !t.type.startsWith('savings')) return false;
      if (filter === 'reserve' && !t.type.startsWith('reserve')) return false;
      if (q.trim()) { const n = F.normalize(q); const hay = F.normalize([t.note, t.category, nameOf(t), F.TYPE_LABEL[t.type], F.centsToInput(t.amount)].join(' ')); if (!hay.includes(n)) return false; }
      return true;
    };
    const list = data.transactions.filter(match).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
    const groups = [];
    for (const t of list) { const g = groups[groups.length - 1]; if (g && g.month === t.month) g.items.push(t); else groups.push({ month: t.month, items: [t] }); }
    const sign = (t) => (['income', 'savings_withdrawal', 'savings_opening', 'reserve_opening'].includes(t.type) ? '+ ' : t.type === 'expense' ? '− ' : '');
    return html`<main className="page">
      <div className="title-row"><h1>Transacties</h1><${Seg} options=${[['lijst', 'Lijst'], ['analyse', 'Analyse']]} value=${view} onChange=${setView} /></div>
      ${view === 'lijst' ? html`
        <div className="search"><${Icon} n="search" s=${18} /><input id="tx-search" type="search" placeholder="Zoeken" value=${q} onChange=${(e) => setQ(e.target.value)} aria-label="Zoeken in transacties" /></div>
        <div className="chips">${FILTERS.map(([v, l]) => html`<button key=${v} className=${cx('chip', filter === v && 'on')} onClick=${() => setFilter(v)}>${l}</button>`)}</div>
        <button className="btn primary" onClick=${() => openTx(null, { type: 'expense', date: today })}>+ Nieuw</button>
        ${groups.length ? groups.map((g) => html`<${Card} key=${g.month}><${Label}>${F.monthLabel(g.month)}<//><ul className="list">${g.items.map((t) => html`<li key=${t.id}><button className="list-btn" onClick=${() => openTx(t.id)}>
            <span><span className="li-title">${t.note || nameOf(t) || t.category || F.TYPE_LABEL[t.type]}</span><span className="muted small">${F.fmtDay(t.date)} · ${t.itemId ? nameOf(t) : t.category || F.TYPE_LABEL[t.type]}${t.history ? ' · gewijzigd' : ''}</span></span>
            <span className=${cx('num', t.type === 'income' && 'pos-text')}>${sign(t)}${F.fmt(t.amount)}</span></button></li>`)}</ul><//>`)
        : html`<p className="muted empty">${filter === 'prullenbak' ? 'De prullenbak is leeg.' : q ? 'Niets gevonden.' : 'Nog geen transacties. Tik op "+ Meld iets" of "+ Nieuw" om te beginnen.'}</p>`}`
      : html`<${Analysis} data=${data} today=${today} month=${am} setMonth=${setAm} nameOf=${nameOf} />`}
    </main>`;
  }
  function Analysis({ data, today, month, setMonth, nameOf }) {
    const S = F.monthSummary(data, month, today);
    const exp = S.txs.filter((t) => t.type === 'expense');
    const cats = {};
    exp.forEach((t) => { const c = t.itemId ? nameOf(t) || t.category : t.category || 'Overig'; cats[c] = (cats[c] || 0) + t.amount; });
    const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const max = catList.length ? catList[0][1] : 1;
    const quote = S.actualIncome > 0 ? Math.round((S.netSaved / S.actualIncome) * 100) : null;
    const months = F.monthRange(F.addMonths(month, -5), month);
    const cols = months.map((m) => ({ label: F.MON_SHORT[Number(m.slice(5)) - 1], value: data.transactions.filter((t) => F.alive(t) && t.month === m && t.type === 'expense').reduce((a, t) => a + t.amount, 0), current: m === month }));
    return html`
      <div className="month-nav"><button className="icon-btn" aria-label="Vorige maand" onClick=${() => setMonth(F.addMonths(month, -1))}><${Icon} n="left" /></button><b>${F.monthLabel(month)}</b><button className="icon-btn" aria-label="Volgende maand" onClick=${() => setMonth(F.addMonths(month, 1))}><${Icon} n="right" /></button></div>
      <${Card}><div className="stat-grid">
        <div><span className="muted small">Inkomen</span><b className="num">${F.fmt(S.actualIncome)}</b></div>
        <div><span className="muted small">Uitgaven</span><b className="num">${F.fmt(S.totalExpenses)}</b></div>
        <div><span className="muted small">Netto gespaard</span><b className="num">${F.fmt(S.netSaved)}</b></div>
        <div><span className="muted small">Spaarquote</span><b className="num">${quote == null ? '–' : quote + '%'}</b></div></div><//>
      <${Card}><${Label}>Uitgaven per categorie<//>${catList.length ? html`<div className="hbars">${catList.map(([c, v]) => html`<div key=${c} className="hbar"><div className="row-between small"><span>${c}</span><span className="num">${F.fmt(v)}</span></div><${Bar} thin value=${v / max} /></div>`)}</div>` : html`<p className="muted small">Geen uitgaven in deze maand.</p>`}<//>
      <${Card}><${Label}>Uitgaven per maand<//><${Columns} items=${cols} /><//>
      ${catList.length ? html`<${Card}><${Label}>Tabel<//><div className="table-wrap"><table><thead><tr><th>Categorie</th><th className="r">Bedrag</th><th className="r">Aandeel</th></tr></thead><tbody>${catList.map(([c, v]) => html`<tr key=${c}><td>${c}</td><td className="r num">${F.fmt(v)}</td><td className="r num">${Math.round((v / S.totalExpenses) * 100)}%</td></tr>`)}<tr className="tot"><td>Totaal</td><td className="r num">${F.fmt(S.totalExpenses)}</td><td className="r num">100%</td></tr></tbody></table></div><//>` : null}`;
  }

  /* ---------- instellingen ---------- */
  function SettingsPage({ data, today, commit, toast, mode, replaceData }) {
    const cur = F.monthOf(today);
    const [s, setS] = useState(() => JSON.parse(JSON.stringify(data.settings)));
    const [inputs, setInputs] = useState(() => Object.fromEntries(data.settings.items.map((i) => [i.id, { amount: F.centsToInput(i.amount), day: dayStr(i.dueDay), goal: F.centsToInput(i.goal || 0) }])));
    const [goal, setGoal] = useState(() => ({ target: F.centsToInput(data.settings.goal.target), stretch: F.centsToInput(data.settings.goal.stretch), date: data.settings.goal.targetDate }));
    const [fromNow, setFromNow] = useState(true);
    const [err, setErr] = useState(null);
    const [backups, setBackups] = useState(null);
    const [pending, setPending] = useState(null);
    const fileRef = useRef(null);
    useEffect(() => { setS(JSON.parse(JSON.stringify(data.settings))); setInputs(Object.fromEntries(data.settings.items.map((i) => [i.id, { amount: F.centsToInput(i.amount), day: dayStr(i.dueDay), goal: F.centsToInput(i.goal || 0) }]))); setGoal({ target: F.centsToInput(data.settings.goal.target), stretch: F.centsToInput(data.settings.goal.stretch), date: data.settings.goal.targetDate }); }, [data.settings.updatedAt]);
    useEffect(() => { Store.listBackups().then(setBackups); }, []);
    const setItem = (id, patch) => setS((o) => ({ ...o, items: o.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    const setInp = (id, k, v) => setInputs((o) => ({ ...o, [id]: { ...o[id], [k]: v } }));
    const c = (str) => { const p = parseOr(str, 0); return p.ok ? p.cents : 0; };
    const liveAvail = s.items.filter((i) => i.active && !i.month).reduce((a, i) => a + (i.kind === 'income' ? 1 : -1) * c(inputs[i.id] ? inputs[i.id].amount : ''), 0);
    const ORDER = { income: 0, bill: 1, budget: 1, savings: 2, reserve: 3 };
    const addItem = (kind, name = '') => { const id = F.uid(); setS((o) => ({ ...o, items: [...o.items, { id, name, kind, amount: 0, dueDay: null, active: true, aliases: [], ...(kind === 'savings' ? { inGoal: false, goal: 0 } : {}) }].map((x, n) => [x, n]).sort((a, b) => ORDER[a[0].kind] - ORDER[b[0].kind] || a[1] - b[1]).map((x) => x[0]) })); setInputs((o) => ({ ...o, [id]: { amount: '', day: '', goal: '' } })); };
    const firstPotId = (s.items.find((i) => i.kind === 'savings') || {}).id;
    const firstIncomeId = (s.items.find((i) => i.kind === 'income') || {}).id;
    function savePlan() {
      const out = JSON.parse(JSON.stringify(s));
      for (const i of out.items) {
        const inp = inputs[i.id] || { amount: '', day: '' };
        const p = parseOr(inp.amount, 0); if (!p.ok) return setErr((i.name || 'Post') + ': ' + p.error);
        if (p.cents > F.MAX_CENTS) return setErr((i.name || 'Post') + ': controleer het bedrag nog even.');
        const d = parseDay(inp.day); if (!d.ok) return setErr((i.name || 'Post') + ': ' + d.error);
        if (!i.name.trim()) return setErr('Geef elke post een naam.');
        const old = data.settings.items.find((x) => x.id === i.id);
        i.name = i.name.trim(); i.amount = p.cents; i.dueDay = d.day;
        if (!i.month || i.kind === 'budget') delete i.month;
        if (!old || old.name !== i.name) i.aliases = F.deriveAliases(i.name);
        if (i.kind === 'savings') { const g = parseOr(inp.goal || '', 0); if (!g.ok) return setErr(i.name + ', doel: ' + g.error); i.goal = g.cents; i.inGoal = !!i.inGoal; }
      }
      const t = parseOr(goal.target, 0), st = parseOr(goal.stretch, 0);
      if (!t.ok) return setErr('Doel: ' + t.error); if (!st.ok) return setErr('Stretchdoel: ' + st.error);
      if (st.cents > 0 && st.cents <= t.cents) return setErr('Het stretchdoel moet hoger zijn dan je doel.');
      if (!F.isValidDate(goal.date)) return setErr('Kies een geldige streefdatum.');
      out.goal = { target: t.cents, stretch: st.cents, targetDate: goal.date };
      setErr(null);
      commit((d) => F.applySettings(d, { ...out, reminders: d.settings.reminders, startMonth: d.settings.startMonth, notificationsEnabled: d.settings.notificationsEnabled, setupDone: true }, fromNow ? cur : null), 'Instellingen opgeslagen');
    }
    const saveRem = (id, patch) => commit((d) => { const st = JSON.parse(JSON.stringify(d.settings)); st.reminders = st.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)); return { data: { ...d, settings: st } }; }, 'Herinnering bijgewerkt', false);
    async function askNotify() {
      try {
        if (!('Notification' in window)) throw new Error('none');
        const r = await Notification.requestPermission();
        if (r === 'granted') { commit((d) => ({ data: { ...d, settings: { ...d.settings, notificationsEnabled: true } } }), 'Meldingen staan aan', false); return; }
        toast('Meldingen zijn niet toegestaan. Gebruik "Zet in iPhone Agenda" voor echte herinneringen.', 'error');
      } catch (e) { toast('Meldingen werken hier niet. Gebruik "Zet in iPhone Agenda" voor echte herinneringen op je iPhone.', 'error'); }
    }
    async function exportIcs() {
      const r = F.buildIcs(data, today);
      if (!r.count) return toast(r.skipped.length ? 'Geen afspraken gemaakt. Overgeslagen: ' + r.skipped.join(', ') + '.' : 'Zet eerst een of meer herinneringen aan.', 'error');
      const res = await offerFile('finance-herinneringen.ics', r.ics, 'text/calendar');
      toast(res === 'declined' ? 'Niet opgeslagen.' : r.count + ' terugkerende afspraken klaargezet.' + (r.skipped.length ? ' Overgeslagen (dag onbekend): ' + r.skipped.join(', ') + '.' : ' Open het bestand en kies "Voeg alles toe".'));
    }
    async function backup() { const res = await offerFile('finance-back-up-' + today + '.json', F.exportBackup(data), 'application/json'); toast(res === 'declined' ? 'Back-up niet opgeslagen.' : 'Back-up klaargezet. Bewaar hem in iCloud Drive.'); }
    async function csv() { const res = await offerFile('finance-transacties-' + today + '.csv', F.toCsv(data), 'text/csv'); toast(res === 'declined' ? 'Export niet opgeslagen.' : 'CSV klaargezet.'); }
    const loadText = (text, label) => { const r = F.importBackup(text, today); if (!r.ok) return toast(r.error, 'error'); setPending({ data: r.data, label }); };
    const groups = [['Inkomen', 'income'], ['Vaste rekeningen', 'bill'], ['Budgetten', 'budget'], ['Spaarpotjes', 'savings'], ['Reserve', 'reserve']];
    const WEEK = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const monthsOpts = F.monthRange(F.addMonths(cur, -24), cur);
    return html`<main className="page">
      <h1>Instellingen</h1>
      <${Card}><${Label}>Inkomen en vaste lasten<//>
        ${groups.map(([title, k]) => { const items = s.items.filter((i) => i.kind === k); return html`<div key=${k} className="set-group"><span className="field-label">${title}</span>
          ${items.map((i) => html`<div key=${i.id} className=${cx('set-item', !i.active && 'inactive')}>
            <div className="setup-row-top"><input className="input grow" aria-label="Naam" value=${i.name} placeholder="Naam" onChange=${(e) => setItem(i.id, { name: e.target.value })} />
              <div className="w-amount"><${AmountInput} id=${'set-' + i.id} value=${inputs[i.id] ? inputs[i.id].amount : ''} onChange=${(v) => setInp(i.id, 'amount', v)} /></div></div>
            <div className="set-item-bottom">
              <label className="day-field" htmlFor=${'day-' + i.id}><span className="muted small">Dag</span><input id=${'day-' + i.id} className="input day" inputMode="numeric" placeholder="?" value=${inputs[i.id] ? inputs[i.id].day : ''} onChange=${(e) => setInp(i.id, 'day', e.target.value)} /></label>
              ${i.kind === 'bill' || i.kind === 'budget' ? html`<${Seg} options=${[['bill', 'Rekening'], ['budget', 'Budget']]} value=${i.kind} onChange=${(v) => setItem(i.id, { kind: v, ...(v === 'budget' ? { month: undefined } : {}) })} />` : html`<span className="grow"></span>`}
              <${Toggle} id=${'act-' + i.id} on=${i.active} label=${'Actief: ' + (i.name || 'post')} onChange=${(v) => setItem(i.id, { active: v })} />
              ${i.kind === 'bill' || i.kind === 'budget' || (i.kind === 'savings' && i.id !== firstPotId) || (i.kind === 'income' && i.id !== firstIncomeId) ? html`<button className="icon-btn" aria-label=${'Verwijder ' + i.name} onClick=${() => setS((o) => ({ ...o, items: o.items.filter((x) => x.id !== i.id) }))}><${Icon} n="x" s=${18} /></button>` : null}
            </div>
            ${i.kind === 'income' || i.kind === 'bill' ? html`<label className="freq" htmlFor=${'fq-' + i.id}><span className="muted small">Hoe vaak</span><select id=${'fq-' + i.id} className="input" value=${i.month || ''} onChange=${(e) => setItem(i.id, { month: e.target.value ? Number(e.target.value) : undefined })}><option value="">Elke maand</option>${F.MONTHS.map((m, n) => html`<option key=${n} value=${n + 1}>Eén keer per jaar, in ${m}</option>`)}</select></label>` : null}
            ${i.kind === 'savings' ? html`<div className="set-item-bottom pot-opts">
              <label className="day-field grow" htmlFor=${'pg-' + i.id}><span className="muted small">Eigen doel</span><div className="w-amount"><${AmountInput} id=${'pg-' + i.id} placeholder="geen" value=${inputs[i.id] ? inputs[i.id].goal || '' : ''} onChange=${(v) => setInp(i.id, 'goal', v)} /></div></label>
              <span className="muted small">Telt mee voor spaardoel</span><${Toggle} id=${'ig-' + i.id} on=${!!i.inGoal} label=${'Telt mee voor spaardoel: ' + (i.name || 'potje')} onChange=${(v) => setItem(i.id, { inGoal: v })} />
            </div>` : null}</div>`)}
          ${k === 'income' ? html`<button className="link small" onClick=${() => addItem('income')}>+ Inkomen</button><p className="muted tiny">Bijvoorbeeld Eindejaarsuitkering (november) of Vakantiegeld (mei): kies bij "Hoe vaak" de maand.</p>` : k === 'bill' ? html`<button className="link small" onClick=${() => addItem('bill')}>+ Vaste rekening</button>` : k === 'budget' ? html`<button className="link small" onClick=${() => addItem('budget')}>+ Budget</button>` : k === 'savings' ? html`<button className="link small" onClick=${() => addItem('savings')}>+ Spaarpotje</button><p className="muted tiny">Geef elk potje een naam en een bedrag per maand. Vergeet niet op "Plan en doel opslaan" te tikken.</p>` : null}</div>`; })}
        <div className="sum-line total"><span>Beschikbaar budget <span className="muted small">in een gewone maand</span></span><span className=${cx('num', liveAvail < 0 && 'warn-text')}>${F.fmt(liveAvail)}</span></div><//>
      <${Card}><${Label}>Spaardoel<//>
        <div className="grid2"><${Field} id="g-t" label="Doel"><${AmountInput} id="g-t" value=${goal.target} onChange=${(v) => setGoal((g) => ({ ...g, target: v }))} /><//>
        <${Field} id="g-s" label="Stretchdoel" hint="Optioneel"><${AmountInput} id="g-s" value=${goal.stretch} onChange=${(v) => setGoal((g) => ({ ...g, stretch: v }))} /><//></div>
        <${Field} id="g-d" label="Streefdatum"><input id="g-d" type="date" className="input" value=${goal.date} onChange=${(e) => setGoal((g) => ({ ...g, date: e.target.value }))} /><//><//>
      <div className="save-bar card">
        <label className="check-label" htmlFor="from-now"><input id="from-now" type="checkbox" checked=${fromNow} onChange=${(e) => setFromNow(e.target.checked)} /> Ook toepassen op ${F.monthLabel(cur, false)} en later (al betaalde posten blijven staan)</label>
        ${err ? html`<p className="field-error">${err}</p>` : null}
        <button className="btn primary" onClick=${savePlan}>Plan en doel opslaan</button></div>
      <${Card}><${Label}>Herinneringen<//>
        <p className="muted small">Herinneringen verschijnen bovenaan je dashboard. Voor echte meldingen op je iPhone zet je ze in je Agenda.</p>
        <ul className="list">${data.settings.reminders.map((r) => html`<li key=${r.id} className="rem-row">
          <div className="row-between"><span className="li-title">${r.label}</span><${Toggle} id=${'rem-' + r.id} on=${r.enabled} label=${r.label} onChange=${(v) => saveRem(r.id, { enabled: v })} /></div>
          ${r.enabled ? html`<div className="rem-opts">
            <label htmlFor=${'rt-' + r.id}><span className="muted small">Tijd</span><input id=${'rt-' + r.id} type="time" className="input" value=${r.time} onChange=${(e) => e.target.value && saveRem(r.id, { time: e.target.value })} /></label>
            ${r.id === 'billDue' ? html`<label htmlFor="rd-bill"><span className="muted small">Dagen vooraf</span><select id="rd-bill" className="input" value=${r.daysBefore} onChange=${(e) => saveRem(r.id, { daysBefore: Number(e.target.value) })}>${[0, 1, 2, 3, 5, 7].map((n) => html`<option key=${n} value=${n}>${n}</option>`)}</select></label>` : null}
            ${r.id === 'savings' || r.id === 'openItems' || r.id === 'review' ? html`<label htmlFor=${'rdd-' + r.id}><span className="muted small">Dag</span><select id=${'rdd-' + r.id} className="input" value=${r.day == null ? '' : r.day} onChange=${(e) => saveRem(r.id, { day: e.target.value === '' ? null : Number(e.target.value) })}>${r.id === 'savings' ? html`<option value="">Zelfde als spaarpost</option>` : null}${Array.from({ length: 31 }, (_, i) => i + 1).map((n) => html`<option key=${n} value=${n}>${n}e</option>`)}</select></label>` : null}
            ${r.id === 'weekly' ? html`<label htmlFor="rw"><span className="muted small">Dag</span><select id="rw" className="input" value=${r.weekday} onChange=${(e) => saveRem(r.id, { weekday: Number(e.target.value) })}>${WEEK.map((w, i) => html`<option key=${i} value=${i}>${w}</option>`)}</select></label>` : null}
            ${r.id === 'salary' ? html`<span className="muted small">Volgt je salarisdag</span>` : null}
          </div>` : null}</li>`)}</ul>
        <div className="btn-row"><button className="btn primary" onClick=${exportIcs}>Zet in iPhone Agenda (.ics)</button><button className="btn ghost" onClick=${askNotify}>Meldingen toestaan</button></div><//>
      <${Card}><${Label}>Gegevens en back-up<//>
        <p className="muted small">${mode === 'cloud' ? 'Je gegevens staan privé in je eigen Claude-account, met een kopie op dit toestel.' : mode === 'local' ? 'Je gegevens staan alleen op dit toestel.' : 'Opslag is hier niet beschikbaar. Wijzigingen worden niet bewaard.'}</p>
        <div className="btn-col">
          <button className="btn ghost" onClick=${backup}>Back-up downloaden (JSON)</button>
          <button className="btn ghost" onClick=${() => fileRef.current && fileRef.current.click()}>Back-up terugzetten</button>
          <button className="btn ghost" onClick=${csv}>Exporteren als CSV</button></div>
        <input ref=${fileRef} type="file" accept="application/json,.json" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) f.text().then((t) => loadText(t, 'het bestand ' + f.name)); }} />
        ${pending ? html`<div className="confirm"><p>Weet je het zeker? Alles in de app wordt vervangen door ${pending.label}.</p><div className="btn-row"><button className="btn danger" onClick=${() => { replaceData(pending.data); setPending(null); }}>Ja, terugzetten</button><button className="btn ghost" onClick=${() => setPending(null)}>Annuleren</button></div></div>` : null}
        <span className="field-label top-gap">Automatische back-ups (laatste 14 dagen)</span>
        ${backups == null ? html`<p className="muted small">Laden…</p>` : backups.length ? html`<ul className="list">${backups.map((b) => html`<li key=${b.date}><button className="list-btn" onClick=${() => loadText(b.read(), 'de back-up van ' + F.fmtDateLong(b.date))}><span className="li-title">${F.fmtDateLong(b.date)}</span><span className="muted small">Terugzetten</span></button></li>`)}</ul>` : html`<p className="muted small">Nog geen automatische back-ups. Er wordt er elke dag één gemaakt.</p>`}
        <${Field} id="start-m" label="Startmaand van het overzicht"><select id="start-m" className="input" value=${data.settings.startMonth} onChange=${(e) => commit((d) => ({ data: { ...d, settings: { ...d.settings, startMonth: e.target.value } } }), 'Startmaand aangepast')}>${monthsOpts.map((m) => html`<option key=${m} value=${m}>${F.monthLabel(m)}</option>`)}</select><//><//>
      <${Card}><${Label}>Op je iPhone zetten<//>
        <ol className="steps small"><li>Open deze pagina in <b>Safari</b> (niet in Chrome).</li><li>Tik op de deelknop (vierkantje met pijl omhoog).</li><li>Kies <b>Zet op beginscherm</b> en tik op Voeg toe.</li></ol>
        <p className="muted small">${mode === 'cloud' ? 'Je opent de app daarna met één tik. Log in Safari in op je Claude-account, dan zie je overal dezelfde gegevens.' : 'Je opent de app daarna met één tik. Let op: Safari en de app op je beginscherm bewaren hun gegevens apart. Vul je plan dus in vanuit de app op je beginscherm en maak regelmatig een back-up.'}</p><//>
    </main>`;
  }

  /* ---------- assistent ---------- */
  function Assistant({ data, today, commit, close }) {
    const [text, setText] = useState('');
    const [res, setRes] = useState(null);
    const [amt, setAmt] = useState('');
    const [date, setDate] = useState(today);
    const [car, setCar] = useState('reserve');
    const [err, setErr] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => { setTimeout(() => inputRef.current && inputRef.current.focus(), 250); }, []);
    const run = (t) => {
      const r = F.parseMessage(t, data, today); setRes(r); setErr(null);
      if (r.kind === 'proposal') { setAmt(F.centsToInput(r.amount || 0)); setDate(r.date); setCar(r.txType === 'expense' && r.carChoice ? 'budget' : 'reserve'); }
    };
    const save = () => {
      const p = F.parseAmount(amt); if (!p.ok) return setErr(p.error);
      if (!F.isValidDate(date)) return setErr('Deze datum klopt niet.');
      const r = res;
      let fn;
      if (r.op === 'check') fn = (d) => F.check(d, F.monthOf(date), r.itemId, { amount: p.cents, date, source: 'assistent' }, today);
      else {
        const type = r.carChoice ? (car === 'reserve' ? 'reserve_expense' : 'expense') : r.txType;
        fn = (d) => F.addTx(d, { type, amount: p.cents, date, itemId: r.itemId, month: r.itemId ? F.monthOf(date) : undefined, category: r.category, note: r.note, source: 'assistent' });
      }
      if (commit(fn, 'Opgeslagen: ' + r.title)) { setRes(null); setText(''); close(); }
    };
    const examples = ['Ik heb € 45 getankt', 'Salaris is binnen', 'Hoeveel kan ik nog uitgeven?', 'Wat staat er nog open?', '€ 32,50 boodschappen gisteren', 'APK € 65'];
    return html`<div className="stack">
      <form className="ask" onSubmit=${(e) => { e.preventDefault(); if (text.trim()) run(text); }}>
        <input ref=${inputRef} id="ask-input" className="input" placeholder="Bijv. Ik heb €45 getankt" value=${text} onChange=${(e) => setText(e.target.value)} autoComplete="off" />
        <button className="btn primary" type="submit">Stuur</button></form>
      ${!res ? html`<div className="chips">${examples.map((x) => html`<button key=${x} className="chip" onClick=${() => { setText(x); run(x); }}>${x}</button>`)}</div>` : null}
      ${res && res.kind === 'answer' ? html`<div className="answer"><b>${res.title}</b>${res.lines.map((l, i) => html`<p key=${i}>${l}</p>`)}</div>` : null}
      ${res && res.kind === 'unknown' ? html`<div className="answer"><b>Dat begreep ik niet helemaal</b><p>Probeer het bijvoorbeeld zo:</p><div className="chips">${res.examples.map((x) => html`<button key=${x} className="chip" onClick=${() => { setText(x); run(x); }}>${x}</button>`)}</div></div>` : null}
      ${res && res.kind === 'proposal' ? html`<div className="proposal">
        <span className="label">Voorstel · nog niet opgeslagen</span>
        <b className="prop-title">${res.title}</b><p className="muted small">${res.explain}</p>
        ${res.carChoice ? html`<${Seg} options=${[['reserve', 'Uit autoreserve'], ['budget', 'Uit lopend budget']]} value=${car} onChange=${setCar} />` : null}
        <div className="grid2"><${Field} id="p-amt" label="Bedrag"><${AmountInput} id="p-amt" value=${amt} onChange=${setAmt} /><//>
        <${Field} id="p-date" label="Datum"><input id="p-date" type="date" className="input" value=${date} onChange=${(e) => setDate(e.target.value)} /><//></div>
        ${err ? html`<p className="field-error">${err}</p>` : null}
        <div className="btn-row"><button className="btn primary" onClick=${save}>Opslaan</button><button className="btn ghost" onClick=${() => { setRes(null); setErr(null); }}>Annuleren</button></div></div>` : null}
    </div>`;
  }

  /* ---------- app ---------- */
  const PAGES = [['dashboard', 'Dashboard'], ['maand', 'Maand'], ['sparen', 'Sparen'], ['transacties', 'Transacties'], ['instellingen', 'Instellingen']];
  const pageFromHash = () => { const h = (location.hash || '').slice(1); return PAGES.some((p) => p[0] === h) ? h : 'dashboard'; };
  function App() {
    const [today, setToday] = useState(F.todayStr());
    const [data, setData] = useState(() => { const l = Store.readLocal(); return (l && F.migrate(l.data, F.todayStr())) || F.emptyData(F.todayStr()); });
    const [mode, setMode] = useState(Store.local ? 'local' : 'none');
    const [ready, setReady] = useState(false);
    const [page, setPage] = useState(pageFromHash());
    const [month, setMonth] = useState(F.monthOf(F.todayStr()));
    const [sheet, setSheet] = useState(null);
    const [toast, setToast] = useState(null);
    const dataRef = useRef(data); dataRef.current = data;
    const hadLocal = useRef(!!(Store.readLocal() || {}).data);
    const toastTimer = useRef(null);
    const showToast = (t) => { clearTimeout(toastTimer.current); setToast({ ...t, k: Date.now() }); toastTimer.current = setTimeout(() => setToast(null), t.undo ? 6000 : 3500); };
    const plainToast = (text, kind) => showToast({ text, kind });

    useEffect(() => { const h = () => setPage(pageFromHash()); window.addEventListener('hashchange', h); const i = setInterval(() => setToday(F.todayStr()), 60000); const v = () => document.visibilityState === 'visible' && setToday(F.todayStr()); document.addEventListener('visibilitychange', v); return () => { window.removeEventListener('hashchange', h); clearInterval(i); document.removeEventListener('visibilitychange', v); }; }, []);
    const go = (p) => { location.hash = p; setPage(p); window.scrollTo({ top: 0 }); };

    function persist(next) {
      const savedAt = new Date().toISOString();
      Store.writeLocal(next, savedAt);
      if (Store.ref) return Store.writeRemote(next, savedAt);
      return Promise.resolve();
    }
    function setAndSave(next, prev, msg, undo) {
      setData(next); dataRef.current = next;
      if (msg) showToast({ text: msg, undo: undo ? () => setAndSave(prev, null, 'Ongedaan gemaakt', false) : null });
      persist(next).catch(() => {
        if (!prev) return;
        setData(prev); dataRef.current = prev; Store.writeLocal(prev, new Date().toISOString());
        showToast({ text: 'Opslaan lukte niet. Ik heb de wijziging teruggedraaid. Probeer het zo nog eens.', kind: 'error' });
      });
    }
    function commit(fn, msg, undo = true) {
      const prev = dataRef.current;
      let r; try { r = fn(prev); } catch (e) { r = { error: 'Er ging iets mis. Probeer het nog eens.' }; }
      if (!r || r.error) { showToast({ text: (r && r.error) || 'Dat lukte niet.', kind: 'error' }); return false; }
      setAndSave(r.data, prev, msg, undo);
      return true;
    }

    // opstarten: Claude-opslag koppelen
    useEffect(() => {
      let alive = true;
      (async () => {
        const ok = await Store.connect();
        if (!alive) return;
        if (ok) {
          try {
            const remote = await Store.readRemote();
            const local = Store.readLocal();
            if (remote && (!local || (remote.savedAt || '') >= (local.savedAt || ''))) { const m = F.migrate(remote.data, F.todayStr()); if (m) { setData(m); dataRef.current = m; Store.writeLocal(m, remote.savedAt); } }
            else if (local && local.data && F.migrate(local.data, F.todayStr())) { await Store.writeRemote(dataRef.current, local.savedAt || new Date().toISOString()); }
            setMode('cloud');
          } catch (e) { setMode(Store.local ? 'local' : 'none'); }
        }
        setReady(true);
      })();
      return () => { alive = false; };
    }, []);
    // lopende maand vastleggen + dagelijkse back-up + meldingen
    useEffect(() => {
      if (!ready || !data.settings.setupDone) return;
      const cur = F.monthOf(today);
      if (!data.months[cur]) commit((d) => ({ data: F.ensureMonth(d, cur) }), null, false);
      Store.listBackups().then((list) => { if (!list.some((b) => b.date === today)) Store.saveBackup(today, dataRef.current); });
      if (data.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try { const seen = JSON.parse(sessionStorage.getItem('fs-notified') || '[]'); const show = (r) => (navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.ready.then((reg) => reg.showNotification(r.title, { body: r.text, tag: r.key, icon: './icon-192.png' })) : new Notification(r.title, { body: r.text, tag: r.key }));
          F.remindersToday(data, today).filter((r) => !seen.includes(r.key)).forEach((r) => { try { show(r); } catch (e) {} seen.push(r.key); }); sessionStorage.setItem('fs-notified', JSON.stringify(seen)); } catch (e) {}
      }
    }, [ready, today, data.settings.setupDone]);

    const openItem = (m, id) => setSheet({ type: 'item', month: m, itemId: id, k: Date.now() });
    const openTx = (id, preset) => setSheet({ type: 'tx', id, preset, k: Date.now() });
    const openPot = (potId) => setSheet({ type: 'pot', potId, k: Date.now() });
    const close = () => setSheet(null);
    const dismiss = (key) => commit((d) => ({ data: { ...d, dismissed: [...d.dismissed, key].slice(-300) } }), null, false);
    const replaceData = (next) => { setAndSave(next, dataRef.current, 'Back-up teruggezet', true); };

    if (!ready && !hadLocal.current) return html`<div className="app"><p className="boot">Finance laden…</p></div>`;
    const banner = mode === 'none' ? html`<div className="banner">Opslag is hier niet beschikbaar. Wijzigingen worden niet bewaard.</div>` : null;
    if (!data.settings.setupDone) {
      return html`<div className="app">${banner}<${Setup} data=${data} onSave=${(s) => commit((d) => { const r = F.applySettings(d, s, null); return { data: F.ensureMonth(r.data, F.monthOf(today)) }; }, 'Je plan staat klaar', false) && go('dashboard')} onRestore=${(text) => { const r = F.importBackup(text, today); if (!r.ok) return plainToast(r.error, 'error'); replaceData(r.data); }} />
        ${toast ? html`<${Toast} t=${toast} close=${() => setToast(null)} />` : null}</div>`;
    }
    const sheetTitle = sheet ? (sheet.type === 'assistant' ? 'Meld iets' : sheet.type === 'pot' ? (data.settings.items.find((i) => i.id === sheet.potId) || { name: 'Potje' }).name : sheet.type === 'item' ? (F.monthItemsAll(data, sheet.month).find((i) => i.id === sheet.itemId) || { name: 'Post' }).name + ' · ' + F.monthLabel(sheet.month, false) : sheet.id ? 'Boeking' : 'Nieuwe boeking') : '';
    return html`<div className="app">
      ${banner}
      <div key=${page} className="page-anim">
        ${page === 'dashboard' ? html`<${Dashboard} data=${data} today=${today} go=${go} openItem=${openItem} dismiss=${dismiss} />` : null}
        ${page === 'maand' ? html`<${MonthPage} data=${data} today=${today} month=${month} setMonth=${setMonth} commit=${commit} openItem=${openItem} openTx=${openTx} />` : null}
        ${page === 'sparen' ? html`<${SavingsPage} data=${data} today=${today} commit=${commit} openTx=${openTx} openPot=${openPot} />` : null}
        ${page === 'transacties' ? html`<${TxPage} data=${data} today=${today} openTx=${openTx} />` : null}
        ${page === 'instellingen' ? html`<${SettingsPage} data=${data} today=${today} commit=${commit} toast=${plainToast} mode=${mode} replaceData=${replaceData} />` : null}
      </div>
      <button className="fab" onClick=${() => setSheet({ type: 'assistant', k: Date.now() })}><${Icon} n="plus" s=${18} /> Meld iets</button>
      <nav className="nav" aria-label="Hoofdmenu">${PAGES.map(([p, l]) => html`<a key=${p} href=${'#' + p} className=${cx('nav-item', page === p && 'on')} aria-current=${page === p ? 'page' : undefined} onClick=${(e) => { e.preventDefault(); go(p); }}><${Icon} n=${p} /><span>${l}</span></a>`)}</nav>
      <${Sheet} open=${!!sheet} onClose=${close} title=${sheetTitle}>
        ${sheet && sheet.type === 'assistant' ? html`<${Assistant} key=${sheet.k} data=${data} today=${today} commit=${commit} close=${close} />` : null}
        ${sheet && sheet.type === 'item' ? html`<${ItemSheet} key=${sheet.k} data=${data} today=${today} month=${sheet.month} itemId=${sheet.itemId} commit=${commit} close=${close} openTx=${openTx} />` : null}
        ${sheet && sheet.type === 'pot' ? html`<${PotSheet} key=${sheet.k} data=${data} today=${today} potId=${sheet.potId} openTx=${openTx} />` : null}
        ${sheet && sheet.type === 'tx' ? html`<${TxSheet} key=${sheet.k} data=${data} today=${today} id=${sheet.id} preset=${sheet.preset} commit=${commit} close=${close} />` : null}
      <//>
      ${toast ? html`<${Toast} t=${toast} close=${() => setToast(null)} />` : null}
    </div>`;
  }
  function Toast({ t, close }) {
    return html`<div key=${t.k} className=${cx('toast', t.kind === 'error' && 'error')} role="status"><span>${t.text}</span>${t.undo ? html`<button className="toast-btn" onClick=${() => { close(); t.undo(); }}>Ongedaan maken</button>` : null}</div>`;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})();
