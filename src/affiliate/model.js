// ─────────────────────────────────────────────────────────────────────────────
// Model data "Metrik Utama" Affiliate.
//
// PENTING soal sumber data:
// Angka di layar ini berasal dari Affiliate Marketing Solution (AMS) di Seller
// Centre. Sampai catatan ini ditulis, AMS TIDAK punya endpoint publik di Shopee
// Open Platform v2 — partner key toko (shpk…) membuka modul shop/order/item/ads,
// bukan AMS. Karena itu modul ini sengaja punya tiga sumber, dipakai berurutan:
//
//   1. "live"  → backend sendiri (api.qukis.id) kalau/ketika endpoint AMS ada.
//   2. "csv"   → hasil export dari Seller Centre AMS, di-import dari browser.
//                Ini satu-satunya jalur yang jalan HARI INI tanpa API baru.
//   3. "demo"  → contoh angka untuk melihat tata letak. Selalu diberi label.
//
// Tidak ada jalur yang mengarang angka: kalau tak ada data, nilai = null dan UI
// menampilkan "—", bukan 0.
// ─────────────────────────────────────────────────────────────────────────────

import { fmtCompactId, fmtNum, fmtRatio, isoShift } from "../shared/format.js";

export const API_BASE = "https://api.qukis.id";

export const AFFILIATE_CHANNELS = [
  { key: "all", label: "Semua" },
  { key: "live", label: "Shopee Live" },
  { key: "video", label: "Shopee Video" },
  { key: "social", label: "Media Sosial" },
];

export const ORDER_TYPES = [
  { key: "confirmed", label: "Pesanan Dikonfirmasi" },
  { key: "created", label: "Pesanan Dibuat" },
];

export const PERIODS = [
  { key: "day", label: "Per Hari", compare: "vs Kemarin", step: 1 },
  { key: "week", label: "Per Minggu", compare: "vs Minggu Lalu", step: 7 },
  { key: "month", label: "Per Bulan", compare: "vs Bulan Lalu", step: 30 },
];

// Delapan metrik, urutan sama persis dengan Seller Centre.
export const METRICS = [
  { key: "sales", label: "Penjualan", kind: "currency",
    hint: "Total nilai pesanan yang berasal dari affiliate pada periode terpilih." },
  { key: "items_sold", label: "Produk Terjual", kind: "int",
    hint: "Jumlah unit produk terjual dari pesanan affiliate." },
  { key: "orders", label: "Pesanan", kind: "int",
    hint: "Jumlah pesanan yang diatribusikan ke affiliate." },
  { key: "clicks", label: "Klik", kind: "compact",
    hint: "Jumlah klik pada link/konten affiliate." },
  { key: "est_commission", label: "Estimasi Komisi", kind: "currency",
    hint: "Perkiraan komisi yang dibayarkan ke affiliate. Belum final sampai pesanan selesai." },
  { key: "roi", label: "ROI", kind: "ratio",
    hint: "Penjualan dibagi estimasi komisi. Makin tinggi makin efisien." },
  { key: "buyers", label: "Total Pembeli", kind: "int",
    hint: "Jumlah pembeli unik dari pesanan affiliate." },
  { key: "new_buyers", label: "Pembeli Baru", kind: "int",
    hint: "Pembeli yang baru pertama kali belanja di toko pada periode ini." },
];

export const METRIC_KEYS = METRICS.map((m) => m.key);

// Format nilai sesuai jenis metriknya. null/undefined → "—" (bukan 0).
export function formatMetric(kind, v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  if (kind === "currency") return fmtCompactId(n, { currency: true });
  if (kind === "compact") return fmtCompactId(n);
  if (kind === "ratio") return fmtRatio(n);
  return fmtNum(Math.round(n));
}

// Selisih relatif current vs previous. null kalau tak bisa dihitung
// (pembanding hilang, atau basis nol → persentase jadi tak bermakna).
export function computeDelta(cur, prev) {
  const c = Number(cur), p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return (c - p) / Math.abs(p);
}

// ── Parsing angka & tanggal dari export ──────────────────────────────────────

// Angka dari CSV bisa datang sebagai "Rp 24.900.000", "24,9", "1,234.56", "12%".
// Pemisah ribuan/desimal ditebak dari posisi & pola, bukan diasumsikan.
export function parseIdNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;
  const isPct = s.includes("%");
  const neg = /^\(.*\)$/.test(s) || s.trimStart().startsWith("-");
  s = s.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  s = s.replace(/-/g, "");

  const hasDot = s.includes("."), hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // Pemisah desimal = yang muncul paling akhir.
    const decSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    s = s.replace(decSep, ".");
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.split(",").join("") : s.replace(",", ".");
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  }

  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (neg) n = -n;
  return isPct ? n / 100 : n;
}

// "21-09-2026", "21/09/2026", "2026-09-21", "2026/09/21" → "2026-09-21".
export function parseAnyDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 10);
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  return null;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

// Pemisah ditebak dari baris header: yang paling banyak muncul menang.
function detectDelimiter(headerLine) {
  const cands = [",", ";", "\t", "|"];
  let best = ",", bestN = -1;
  for (const c of cands) {
    const n = headerLine.split(c).length - 1;
    if (n > bestN) { bestN = n; best = c; }
  }
  return best;
}

// Parser CSV kecil tapi benar: menghormati tanda kutip, escape "" dan newline
// di dalam sel.
export function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? clean.length : clean.indexOf("\n"));
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === delim) { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// Alias header. Export AMS berganti nama kolom antar versi & antar bahasa,
// jadi pencocokan dibuat longgar: sama persis dulu, baru "mengandung".
const HEADER_ALIASES = {
  date: ["tanggal", "date", "periode", "period", "hari", "waktu", "tgl"],
  channel: ["channel", "kanal", "saluran", "sumber", "source", "platform", "trafficsource", "tipetrafik"],
  sales: ["penjualan", "totalpenjualan", "gmv", "sales", "salesamount", "penjualanrp", "nilaipenjualan"],
  items_sold: ["produkterjual", "itemsold", "itemssold", "productssold", "unitterjual", "jumlahprodukterjual"],
  orders: ["pesanan", "totalpesanan", "jumlahpesanan", "orders", "ordercount", "order"],
  clicks: ["klik", "totalklik", "jumlahklik", "clicks", "click", "clickcount"],
  est_commission: ["estimasikomisi", "estkomisi", "komisi", "komisiaffiliate", "estimatedcommission", "commission"],
  roi: ["roi", "returnoninvestment"],
  buyers: ["totalpembeli", "pembeli", "jumlahpembeli", "buyers", "buyer", "totalbuyers"],
  new_buyers: ["pembelibaru", "newbuyers", "newbuyer", "pembelibarubaru"],
};

// Urutan penting: yang lebih spesifik dicoba lebih dulu supaya "Pembeli Baru"
// tidak keburu tertangkap oleh alias "pembeli" milik Total Pembeli.
const FIELD_ORDER = [
  "date", "channel", "new_buyers", "buyers", "est_commission",
  "items_sold", "orders", "clicks", "roi", "sales",
];

export function mapHeaders(headerRow) {
  const cols = headerRow.map(norm);
  const taken = new Set();
  const map = {};
  for (const field of FIELD_ORDER) {
    const aliases = HEADER_ALIASES[field];
    let idx = cols.findIndex((c, i) => !taken.has(i) && aliases.includes(c));
    if (idx === -1) {
      idx = cols.findIndex((c, i) => !taken.has(i) && c && aliases.some((a) => c.includes(a)));
    }
    if (idx !== -1) { map[field] = idx; taken.add(idx); }
  }
  return map;
}

function channelKeyOf(raw) {
  const v = norm(raw);
  if (!v) return "all";
  if (v.includes("live")) return "live";
  if (v.includes("video")) return "video";
  if (v.includes("sosial") || v.includes("social")) return "social";
  if (v.includes("semua") || v.includes("all") || v.includes("total")) return "all";
  return "other";
}

// CSV → baris ternormalisasi {date, channel, ...metrik}.
// Hanya kolom yang benar-benar ketemu yang diisi; sisanya null.
export function parseAffiliateCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { rows: [], matched: {}, warnings: ["File tidak punya baris data."] };
  }

  // Header belum tentu di baris pertama — export sering diawali judul laporan.
  let headerIdx = 0, map = mapHeaders(rows[0]), score = Object.keys(map).length;
  for (let i = 1; i < Math.min(rows.length, 8); i++) {
    const m = mapHeaders(rows[i]);
    if (Object.keys(m).length > score) { headerIdx = i; map = m; score = Object.keys(m).length; }
  }

  const warnings = [];
  const foundMetrics = METRIC_KEYS.filter((k) => map[k] !== undefined);
  if (!foundMetrics.length) {
    return {
      rows: [], matched: {},
      warnings: ["Tidak ada kolom metrik yang dikenali. Pastikan file hasil export dari Metrik Utama AMS."],
    };
  }
  if (map.date === undefined) warnings.push("Kolom tanggal tidak ketemu — semua baris dianggap satu periode.");

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const rec = {
      date: map.date !== undefined ? parseAnyDate(r[map.date]) : null,
      channel: map.channel !== undefined ? channelKeyOf(r[map.channel]) : "all",
    };
    let anyValue = false;
    for (const k of METRIC_KEYS) {
      const v = map[k] !== undefined ? parseIdNumber(r[map[k]]) : null;
      rec[k] = v;
      if (v !== null) anyValue = true;
    }
    // ROI tidak selalu ada di export — turunkan dari penjualan/komisi.
    if (rec.roi === null && rec.sales !== null && rec.est_commission) {
      rec.roi = rec.sales / rec.est_commission;
    }
    if (anyValue) out.push(rec);
  }

  if (!out.length) warnings.push("Header terbaca tapi tidak ada baris berisi angka.");

  const matched = {};
  for (const f of Object.keys(map)) matched[f] = rows[headerIdx][map[f]];
  return { rows: out, matched, warnings };
}

// Ambil snapshot dari kumpulan baris CSV: baris untuk tanggal & channel terpilih,
// plus pembanding periode sebelumnya, plus deret waktu untuk grafik.
export function snapshotFromCsvRows(rows, { date, channel, step = 1 }) {
  const inChannel = rows.filter((r) => r.channel === channel || (channel === "all" && r.channel === "all"));
  const pool = inChannel.length ? inChannel : rows.filter((r) => r.channel === channel);

  const dated = pool.filter((r) => r.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const series = dated.map((r) => ({ ...r }));

  let current = null, previous = null, effectiveDate = date;

  if (!dated.length) {
    // Tanpa kolom tanggal: pakai baris terakhir apa adanya, tanpa pembanding.
    current = pool[pool.length - 1] || null;
    effectiveDate = null;
  } else {
    current = dated.find((r) => r.date === date) || null;
    if (!current) {
      // Tanggal diminta tidak ada di file → pakai tanggal terbaru yang ada.
      current = dated[dated.length - 1];
      effectiveDate = current.date;
    }
    const prevDate = isoShift(effectiveDate, -step);
    previous = dated.find((r) => r.date === prevDate)
      || [...dated].reverse().find((r) => r.date < effectiveDate)
      || null;
  }

  return { current, previous, series, effectiveDate };
}

// ── Live API ─────────────────────────────────────────────────────────────────

// Respons backend dinormalkan longgar supaya perubahan nama field di sisi
// backend tidak langsung memecahkan UI.
function pickMetric(obj, key) {
  if (!obj) return null;
  const aliases = [key, ...(HEADER_ALIASES[key] || [])];
  for (const a of aliases) {
    for (const objKey of Object.keys(obj)) {
      if (norm(objKey) === norm(a)) {
        const v = parseIdNumber(obj[objKey]);
        if (v !== null) return v;
      }
    }
  }
  return null;
}

export function normalizeApiPayload(json) {
  if (!json || typeof json !== "object") return null;
  const body = json.data && typeof json.data === "object" ? json.data : json;
  const curRaw = body.current || body.metrics || body.today || body;
  const prevRaw = body.previous || body.compare || body.yesterday || null;

  const toMetrics = (src) => {
    if (!src) return null;
    const m = {};
    let any = false;
    for (const k of METRIC_KEYS) {
      m[k] = pickMetric(src, k);
      if (m[k] !== null) any = true;
    }
    if (m.roi === null && m.sales !== null && m.est_commission) m.roi = m.sales / m.est_commission;
    return any ? m : null;
  };

  const current = toMetrics(curRaw);
  if (!current) return null;

  const seriesRaw = Array.isArray(body.series) ? body.series : Array.isArray(body.daily) ? body.daily : null;
  const series = seriesRaw
    ? seriesRaw.map((r) => ({ date: parseAnyDate(r.date || r.tanggal || r.day), ...toMetrics(r) })).filter((r) => r.date)
    : null;

  return {
    current,
    previous: toMetrics(prevRaw),
    series,
    updatedAt: body.updated_at || body.updatedAt || json.updated_at || null,
  };
}

export async function fetchAffiliateMetrics({ orderType, period, date, channel, signal }) {
  const qs = new URLSearchParams({
    order_type: orderType, period, date, channel, timezone: "Asia/Jakarta",
  });
  const res = await fetch(`${API_BASE}/api/affiliate/metrics?${qs}`, { signal });
  if (!res.ok) {
    const err = new Error(`HTTP_${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const shaped = normalizeApiPayload(json);
  if (!shaped) throw new Error("PAYLOAD_KOSONG");
  return shaped;
}

// ── Data contoh ──────────────────────────────────────────────────────────────

// Angka ini MENIRU tangkapan layar Seller Centre (21-09-2026) supaya tata letak
// bisa dinilai apa adanya. Nilai pembanding dipilih agar persentasenya konsisten
// satu sama lain (mis. ROI = penjualan / komisi, di periode ini maupun sebelumnya).
// Selalu tampil dengan label CONTOH. Jangan pernah dipakai untuk mengambil
// keputusan bisnis.
const DEMO_ALL_CURRENT = {
  sales: 24_900_000, items_sold: 73, orders: 72, clicks: 1041,
  est_commission: 1_042_000, roi: 24_900_000 / 1_042_000, buyers: 72, new_buyers: 48,
};
const DEMO_ALL_PREVIOUS = {
  sales: 27_314_612, items_sold: 83, orders: 79, clicks: 793,
  est_commission: 1_264_103, roi: 27_314_612 / 1_264_103, buyers: 77, new_buyers: 55,
};

// Porsi per kanal (jumlahnya 1). Murni ilustrasi pembagian trafik.
const DEMO_CHANNEL_SHARE = { all: 1, live: 0.42, video: 0.33, social: 0.25 };

function scaleMetrics(base, f) {
  if (f === 1) return { ...base };
  const m = {};
  for (const k of METRIC_KEYS) {
    if (k === "roi") continue;
    m[k] = k === "sales" || k === "est_commission"
      ? Math.round(base[k] * f)
      : Math.max(0, Math.round(base[k] * f));
  }
  m.roi = m.est_commission ? m.sales / m.est_commission : null;
  return m;
}

export function demoSnapshot({ date, channel, step = 1 }) {
  const f = DEMO_CHANNEL_SHARE[channel] ?? 1;
  const current = scaleMetrics(DEMO_ALL_CURRENT, f);
  const previous = scaleMetrics(DEMO_ALL_PREVIOUS, f);

  // Deret 14 hari mundur dari tanggal terpilih, digoyang deterministik supaya
  // grafik tidak berubah tiap render.
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = isoShift(date, -i);
    const wave = 1 + 0.18 * Math.sin(i * 1.1) + 0.07 * Math.cos(i * 2.3);
    const row = scaleMetrics(DEMO_ALL_CURRENT, f * wave);
    series.push({ date: d, ...row });
  }
  series[series.length - 1] = { date, ...current };
  if (series.length > 1) series[series.length - 2] = { date: isoShift(date, -step), ...previous };

  return { current, previous, series, updatedAt: null };
}
