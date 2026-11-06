// applied_on is a plain YYYY-MM-DD date, so build it in local time (new Date('2026-11-06') would be UTC midnight).
function parse(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const formatDate = (ymd) =>
  parse(ymd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function daysAgo(ymd, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - parse(ymd)) / 86400000);
  if (days <= 0) return days === 0 ? 'today' : 'upcoming';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
