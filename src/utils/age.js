const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function todayUtc() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

function calculateAge(birthDate, onDate = todayUtc()) {
  let age = onDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = onDate.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

module.exports = { parseDateOnly, todayUtc, calculateAge, formatDateOnly };