import { test } from 'vitest';
import assert from 'node:assert/strict';
import '../src/lib.js';
const F = globalThis.F;
const T = '2026-11-09';

function plan() {
  let d = F.emptyData(T);
  const s = d.settings;
  s.items = [
    { id: 'salaris', name: 'Salaris', kind: 'income', amount: 200000, dueDay: 25, active: true, aliases: ['salaris'] },
    { id: 'huur', name: 'Huur', kind: 'bill', amount: 80000, dueDay: 1, active: true, aliases: F.deriveAliases('Huur') },
    { id: 'tel', name: 'Telefoon', kind: 'bill', amount: 2000, dueDay: null, active: true, aliases: F.deriveAliases('Telefoon') },
    { id: 'bood', name: 'Boodschappen', kind: 'budget', amount: 30000, dueDay: null, active: true, aliases: F.deriveAliases('Boodschappen') },
    { id: 'brand', name: 'Brandstof', kind: 'budget', amount: 10000, dueDay: null, active: true, aliases: F.deriveAliases('Brandstof') },
    { id: 'sparen', name: 'Spaaroverboeking', kind: 'savings', amount: 30000, dueDay: 26, active: true, aliases: ['sparen'] },
    { id: 'autoreserve', name: 'Autoreserve', kind: 'reserve', amount: 5000, dueDay: null, active: true, aliases: ['autoreserve'] },
  ];
  s.goal = { target: 500000, stretch: 800000, targetDate: '2027-12-31' };
  s.setupDone = true;
  return d;
}

test('parseAmount: Nederlandse notatie', () => {
  const ok = { '1.250,50': 125050, '1250,5': 125050, '45': 4500, '45.50': 4550, '€ 45': 4500, '1 250': 125000, '1.250': 125000, '0,99': 99, '12,': 1200 };
  for (const [k, v] of Object.entries(ok)) assert.equal(F.parseAmount(k).cents, v, k);
  for (const k of ['-5', 'abc', '', '1,2,3', '12,345', '1.25.0', '€']) assert.equal(F.parseAmount(k).ok, false, k);
  assert.equal(F.validateAmount(0) !== null, true);
  assert.match(F.validateAmount(10000001), /Controleer/);
});

test('fmt', () => { assert.equal(F.fmt(125050).replace(/\s/g, ' '), '€ 1.250,50'); });

test('maandberekening', () => {
  let d = plan();
  let S = F.monthSummary(d, '2026-11', T);
  assert.equal(S.planned.available, 200000 - 80000 - 2000 - 30000 - 10000 - 30000 - 5000);
  assert.equal(S.remaining, 43000);
  assert.equal(S.daysLeft, 22);
  assert.equal(S.perDay, Math.floor(43000 / 22));
  assert.equal(S.open, 80000 + 2000 + 30000 + 5000);
  assert.equal(S.total, 5);
  // budget overschrijding + vrije uitgave + duurdere rekening
  d = F.addTx(d, { type: 'expense', amount: 35000, date: T, itemId: 'bood', month: '2026-11' }).data;
  d = F.addTx(d, { type: 'expense', amount: 1500, date: T }).data;
  d = F.check(d, '2026-11', 'tel', { amount: 2500 }, T).data;
  S = F.monthSummary(d, '2026-11', T);
  assert.equal(S.overrun, 5000 + 500);
  assert.equal(S.freeSpend, 1500);
  assert.equal(S.remaining, 43000 - 1500 - 5500);
  assert.equal(S.checked, 1);
  assert.equal(S.open, 80000 + 30000 + 5000);
});

test('afvinken: nooit dubbel, uitvinken naar prullenbak, herstel geblokkeerd', () => {
  let d = plan();
  const r = F.check(d, '2026-11', 'huur', {}, T); d = r.data;
  assert.ok(d.months['2026-11']);
  assert.ok(F.check(d, '2026-11', 'huur', {}, T).error);
  assert.ok(F.addTx(d, { type: 'expense', amount: 100, date: T, itemId: 'huur', month: '2026-11' }).error);
  d = F.uncheck(d, '2026-11', 'huur').data;
  assert.equal(F.monthSummary(d, '2026-11', T).rows.find((x) => x.item.id === 'huur').done, false);
  d = F.check(d, '2026-11', 'huur', {}, T).data;
  assert.match(F.restoreTx(d, r.tx.id).error, /dubbel/);
});

test('aanpassen bewaart geschiedenis', () => {
  let d = plan();
  const r = F.addTx(d, { type: 'expense', amount: 1000, date: T, note: 'a' });
  d = F.updateTx(r.data, r.tx.id, { amount: 1200 }).data;
  const t = d.transactions[0];
  assert.equal(t.amount, 1200); assert.equal(t.history[0].amount, 1000);
});

test('momentopname: instellingen herschrijven geschiedenis niet', () => {
  let d = plan();
  d = F.check(d, '2026-10', 'huur', {}, T).data;
  const s2 = JSON.parse(JSON.stringify(d.settings)); s2.items.find((i) => i.id === 'huur').amount = 90000;
  d = F.applySettings(d, s2, null).data;
  assert.equal(F.monthItems(d, '2026-10').find((i) => i.id === 'huur').amount, 80000);
  assert.equal(F.monthItems(d, '2026-12').find((i) => i.id === 'huur').amount, 90000);
  d = F.setMonthOverride(d, '2027-01', 'huur', { amount: 85000 }).data;
  assert.equal(F.monthItems(d, '2027-01').find((i) => i.id === 'huur').amount, 85000);
  assert.equal(F.monthItems(d, '2027-02').find((i) => i.id === 'huur').amount, 90000);
});

test('sparen', () => {
  let d = plan();
  d.settings.startMonth = '2026-09';
  d = F.addTx(d, { type: 'savings_opening', amount: 100000, date: '2026-09-01' }).data;
  d = F.check(d, '2026-09', 'sparen', {}, T).data;
  d = F.check(d, '2026-10', 'sparen', {}, T).data;
  d = F.addTx(d, { type: 'savings_withdrawal', amount: 10000, date: '2026-10-15' }).data;
  const s = F.savingsStats(d, T);
  assert.equal(s.balance, 100000 + 60000 - 10000);
  assert.equal(s.monthsToGo, 14);
  assert.equal(s.neededPerMonth, Math.ceil((500000 - 150000) / 14));
  assert.equal(s.forecast.avg, 25000);
  assert.equal(s.forecast.amount, 150000 + 25000 * 14);
  assert.equal(s.milestones.find((m) => m.amount === 100000).date, '2026-09-01');
  assert.equal(s.milestones.find((m) => m.amount === 150000).date, '2026-10-26');
  assert.equal(s.series.at(-1).balance, 150000);
  assert.equal(F.savingsStats(plan(), T).forecast, null);
});

test('reserve telt niet in vrij budget', () => {
  let d = plan();
  d = F.addTx(d, { type: 'reserve_expense', amount: 20000, date: T }).data;
  assert.equal(F.monthSummary(d, '2026-11', T).remaining, 43000);
  assert.equal(F.reserveStats(d).balance, -20000);
});

test('assistent: datums en bedragen', () => {
  assert.equal(F.extractDate('op 3 maart 12 euro', T).date, '2026-03-03');
  assert.equal(F.extractDate('gisteren', T).date, '2026-11-08');
  assert.equal(F.extractDate('eergisteren', T).date, '2026-11-07');
  assert.equal(F.extractDate('op 3-11', T).date, '2026-11-03');
  assert.equal(F.extractAmount(F.extractDate('op 3 nov 25 getankt', T).rest), 2500);
  assert.equal(F.extractAmount('€1.250,50 huur'), 125050);
  assert.equal(F.extractAmount('ik heb 45.50 euro'), 4550);
});

test('assistent: herkenning', () => {
  let d = plan();
  let r = F.parseMessage('Ik heb €45 getankt', d, T);
  assert.equal(r.kind, 'proposal'); assert.equal(r.itemId, 'brand'); assert.equal(r.amount, 4500);
  r = F.parseMessage('Salaris is binnen', d, T);
  assert.equal(r.op, 'check'); assert.equal(r.itemId, 'salaris'); assert.equal(r.amount, 200000);
  d = F.check(d, '2026-11', 'salaris', {}, T).data;
  r = F.parseMessage('salaris 50 euro extra', d, T);
  assert.equal(r.txType, 'income'); assert.equal(r.op, 'add');
  r = F.parseMessage('€ 30 boodschappen bij de supermarkt gisteren', d, T);
  assert.equal(r.itemId, 'bood'); assert.equal(r.date, '2026-11-08');
  r = F.parseMessage('apk 80 euro', d, T);
  assert.equal(r.txType, 'reserve_expense'); assert.equal(r.carChoice, true);
  r = F.parseMessage('100 euro van spaarrekening opgenomen', d, T);
  assert.equal(r.txType, 'savings_withdrawal');
  r = F.parseMessage('huur betaald', d, T);
  assert.equal(r.op, 'check'); assert.equal(r.itemId, 'huur');
  d = F.check(d, '2026-11', 'huur', {}, T).data;
  assert.equal(F.parseMessage('huur betaald', d, T).kind, 'answer');
  r = F.parseMessage('20 euro pizza', d, T);
  assert.equal(r.category, 'Uit eten'); assert.equal(r.itemId, undefined);
  r = F.parseMessage('cadeau voor mama 25', d, T);
  assert.equal(r.category, 'Cadeaus');
  assert.equal(F.parseMessage('blabla', d, T).kind, 'unknown');
  assert.equal(F.parseMessage('Hoeveel kan ik nog uitgeven?', d, T).title, 'Vrij te besteden');
  assert.equal(F.parseMessage('Wat staat er nog open?', d, T).title, 'Openstaand');
  assert.equal(F.parseMessage('Hoeveel heb ik gespaard?', d, T).title, 'Spaardoel');
  assert.equal(F.parseMessage('hoeveel heb ik nog voor boodschappen', d, T).title, 'Boodschappen');
});

test('opslag: back-up en migratie', () => {
  let d = plan();
  d = F.addTx(d, { type: 'expense', amount: 999, date: T, note: 'x;y' }).data;
  const r = F.importBackup(F.exportBackup(d), T);
  assert.ok(r.ok); assert.deepEqual(r.data.transactions, d.transactions);
  const old = F.importBackup(JSON.stringify({ settings: { items: [{ name: 'Huur', kind: 'bill', amount: 100 }] }, transactions: [{ type: 'expense', amount: 5, date: T }, { type: 'bad', amount: 5, date: T }] }), T);
  assert.ok(old.ok); assert.equal(old.data.transactions.length, 1); assert.equal(old.data.transactions[0].month, '2026-11');
  assert.equal(old.data.settings.reminders.length, 6); assert.ok(old.data.settings.items[0].aliases.includes('woonlasten'));
  assert.equal(F.importBackup('niet json', T).ok, false);
  assert.equal(F.importBackup('{"a":1}', T).ok, false);
});

test('csv en ics', () => {
  let d = plan();
  d = F.addTx(d, { type: 'expense', amount: 125050, date: T, note: 'a;b' }).data;
  const csv = F.toCsv(d);
  assert.ok(csv.startsWith('﻿Datum;'));
  assert.ok(csv.includes('-1250,50'));
  assert.ok(csv.includes('"a;b"'));
  d.settings.reminders.forEach((r) => (r.enabled = true));
  const ics = F.buildIcs(d, T);
  assert.ok(ics.ics.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=25'));
  assert.ok(ics.ics.includes('BEGIN:VALARM'));
  assert.ok(ics.skipped.some((s) => s.startsWith('Telefoon')));
});

test('herinneringen en komende betalingen', () => {
  let d = plan();
  d.settings.reminders.forEach((r) => (r.enabled = true));
  const rem = F.remindersToday(d, '2026-11-25');
  assert.ok(rem.some((r) => r.title === 'Salarisdag'));
  assert.ok(rem.some((r) => r.title === 'Nog openstaand'));
  const up = F.upcoming(d, T);
  assert.equal(up[0].item.id, 'huur'); assert.equal(up[0].label, '8 dagen te laat');
  assert.equal(up.at(-1).label, 'Vervaldatum onbekend');
});
