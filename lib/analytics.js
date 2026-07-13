export function moneyAmount(moneyBag) {
  const value = moneyBag?.shopMoney?.amount;
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysAgo(days) {
  const date = startOfDay();
  date.setDate(date.getDate() - days);
  return date;
}

export function percentChange(current, previous) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (!b) return a ? 100 : 0;
  return ((a - b) / Math.abs(b)) * 100;
}
