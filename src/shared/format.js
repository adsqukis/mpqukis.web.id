// ─────────────────────────────────────────────────────────────────────────────
// Formatter angka & helper tanggal yang dipakai lintas tab.
// Dipisah dari komponen supaya bisa dites/dipakai ulang tanpa React.
// ─────────────────────────────────────────────────────────────────────────────

export const fmtRp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

export const fmtRpShort = (n) => {
  if (Math.abs(n) >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (Math.abs(n) >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return fmtRp(n);
};

// Desimal gaya Indonesia (koma), jumlah digit tetap.
const dec = (n, d) =>
  Number(n).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

// Buang ",0" di belakang — Seller Centre nulis "Rp1JT", bukan "Rp1,0JT".
const trimZero = (s) => s.replace(/,0$/, "");

// Ringkas ala Shopee Seller Centre: 24.900.000 → "Rp24,9JT", 1.041 → "1RB".
export const fmtCompactId = (n, { currency = false } = {}) => {
  const v = Number(n) || 0;
  const p = currency ? "Rp" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return p + trimZero(dec(v / 1_000_000_000, 1)) + "M";
  if (a >= 1_000_000) return p + trimZero(dec(v / 1_000_000, 1)) + "JT";
  if (a >= 1_000) return p + trimZero(dec(v / 1_000, 1)) + "RB";
  return p + dec(v, 0);
};

// Angka utuh dengan pemisah ribuan lokal.
export const fmtNum = (n) => (Number(n) || 0).toLocaleString("id-ID");

// Rasio → persen 2 desimal, tanpa tanda (+/-) — tandanya dirender terpisah
// sebagai panah naik/turun, persis seperti di Seller Centre.
export const fmtPct = (ratio) => dec(Math.abs(Number(ratio) || 0) * 100, 2) + "%";

// Angka rasio seperti ROI: 23,897 → "23,9".
export const fmtRatio = (n) => dec(Number(n) || 0, 1);

// Terang-kan hex (buat gradient card colored-box ala template Fusion)
export const lightenHex = (hex, f = 0.32) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * f);
  g = Math.round(g + (255 - g) * f);
  b = Math.round(b + (255 - b) * f);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Helper tanggal lokal (bukan UTC, biar gak geser 1 hari pas malam)
export const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Geser tanggal ISO sebanyak n hari (negatif = mundur).
export const isoShift = (iso, n) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
};

// Preset rentang tanggal — dipakai row filter & side panel kalender.
export const RANGE_PRESETS = {
  today: () => ({ from: isoDaysAgo(0), to: isoDaysAgo(0) }),
  yesterday: () => ({ from: isoDaysAgo(1), to: isoDaysAgo(1) }),
  "7d": () => ({ from: isoDaysAgo(6), to: isoDaysAgo(0) }),
  month: () => ({ from: isoDaysAgo(29), to: isoDaysAgo(0) }),
  year: () => ({ from: isoDaysAgo(364), to: isoDaysAgo(0) }),
};

export const RANGE_FILTERS = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 hari terakhir" },
  { key: "month", label: "Bulan" },
  { key: "year", label: "Tahun" },
];

export const _BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const _HR = ["M", "S", "S", "R", "K", "J", "S"]; // Senin pertama (kalender ala Shopee)

export const fmtDmy = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// "21-09-2026" gaya header Seller Centre.
export const fmtDmyDash = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export const parseDmy = (s) => {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (!(d >= 1 && d <= 31 && mo >= 1 && mo <= 12)) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

// Trigger download CSV client-side.
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
