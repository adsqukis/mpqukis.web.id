#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Alat diagnosa: modul Shopee mana yang benar-benar terbuka untuk kredensial
// kita, khususnya apakah Affiliate Marketing Solution (AMS) bisa diakses.
//
// Jalankan dari mesin yang punya akses keluar (server backend / laptop), BUKAN
// dari browser. Skrip ini butuh partner key, dan partner key tidak boleh pernah
// sampai ke sisi klien.
//
//   export SHOPEE_PARTNER_ID=2045868
//   export SHOPEE_PARTNER_KEY=...          # jangan ditulis di file mana pun
//   node scripts/shopee-probe.mjs auth-url https://api.qukis.id/shopee/callback
//   node scripts/shopee-probe.mjs token <code> <shop_id>
//   SHOPEE_SHOP_ID=... SHOPEE_ACCESS_TOKEN=... node scripts/shopee-probe.mjs probe
//   node scripts/shopee-probe.mjs affiliate
//
// Tidak ada dependensi: Node 18+ saja (crypto + fetch bawaan).
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";

const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";
const PARTNER_ID = process.env.SHOPEE_PARTNER_ID || "";
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const SHOP_ID = process.env.SHOPEE_SHOP_ID || "";
const ACCESS_TOKEN = process.env.SHOPEE_ACCESS_TOKEN || "";

const mask = (s) => (!s ? "(kosong)" : s.slice(0, 4) + "…" + s.slice(-4) + ` [${s.length} char]`);
const now = () => Math.floor(Date.now() / 1000);

function requireCreds() {
  if (!PARTNER_ID || !PARTNER_KEY) {
    console.error("SHOPEE_PARTNER_ID dan SHOPEE_PARTNER_KEY wajib diisi lewat environment variable.");
    process.exit(2);
  }
}

// Open Platform v2 menandatangani base string yang berbeda per jenis API:
//   public : partner_id + path + timestamp
//   shop   : partner_id + path + timestamp + access_token + shop_id
function sign(path, ts, { shop = false } = {}) {
  let base = `${PARTNER_ID}${path}${ts}`;
  if (shop) base += `${ACCESS_TOKEN}${SHOP_ID}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

function buildUrl(path, { shop = false, extra = {} } = {}) {
  const ts = now();
  const qs = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    sign: sign(path, ts, { shop }),
    ...extra,
  });
  if (shop) {
    qs.set("access_token", ACCESS_TOKEN);
    qs.set("shop_id", SHOP_ID);
  }
  return `${HOST}${path}?${qs}`;
}

async function call(path, { shop = false, method = "GET", body = null, extra = {} } = {}) {
  const url = buildUrl(path, { shop, extra });
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* bukan JSON */ }
    return { http: res.status, error: json?.error ?? null, message: json?.message ?? text.slice(0, 200), json };
  } catch (e) {
    return { http: 0, error: "NETWORK", message: e.message };
  }
}

// Shopee membalas error_not_found / error_param untuk path yang tidak ada.
// Itulah bukti yang dicari: jalur mana yang benar-benar terdaftar.
//
// Penting: Shopee membalas HTTP 200 dengan field "error" di body, bahkan saat
// gagal. Jadi respons non-JSON atau status non-2xx berarti request TIDAK sampai
// ke Shopee (proxy perusahaan, firewall, WAF) — itu harus dilaporkan sebagai
// tidak konklusif, bukan sebagai bukti endpoint ada. Salah baca di sini bikin
// kesimpulannya terbalik.
function verdict(r) {
  if (r.http === 0) return "GAGAL JARINGAN — tidak konklusif";
  if (!r.json) return `TIDAK KONKLUSIF (HTTP ${r.http}, balasan bukan JSON — kemungkinan diblokir proxy/firewall)`;
  if (r.http < 200 || r.http >= 300) {
    if (!r.error) return `TIDAK KONKLUSIF (HTTP ${r.http} tanpa field error Shopee)`;
  }
  const e = String(r.error || "");
  if (!e) return "ADA — respons sukses";
  if (/not_found|invalid_path|error_404/i.test(e)) return "TIDAK ADA (path tak dikenal)";
  if (/sign|signature/i.test(e)) return "TANDA TANGAN SALAH";
  if (/auth|token|permission|no_shop|access/i.test(e)) return "ADA, tapi belum terotorisasi";
  if (/param/i.test(e)) return "ADA (parameter kurang)";
  return `lain-lain: ${e}`;
}

const CMD = process.argv[2] || "help";

if (CMD === "auth-url") {
  requireCreds();
  const redirect = process.argv[3];
  if (!redirect) { console.error("Pakai: auth-url <redirect_url>"); process.exit(2); }
  const path = "/api/v2/shop/auth_partner";
  const ts = now();
  const qs = new URLSearchParams({
    partner_id: PARTNER_ID, timestamp: String(ts), sign: sign(path, ts), redirect,
  });
  console.log("\nBuka URL ini sambil login sebagai pemilik toko, lalu setujui:\n");
  console.log(`${HOST}${path}?${qs}\n`);
  console.log("Setelah setuju, Shopee mengarahkan balik ke redirect dengan ?code=...&shop_id=...");
  console.log("Lanjutkan dengan:  node scripts/shopee-probe.mjs token <code> <shop_id>\n");

} else if (CMD === "token") {
  requireCreds();
  const [, , , code, shopId] = process.argv;
  if (!code || !shopId) { console.error("Pakai: token <code> <shop_id>"); process.exit(2); }
  const r = await call("/api/v2/auth/token/get", {
    method: "POST",
    body: { code, shop_id: Number(shopId), partner_id: Number(PARTNER_ID) },
  });
  console.log(JSON.stringify(r.json ?? r, null, 2));
  if (r.json?.access_token) {
    console.log("\nSimpan sebagai environment variable di backend (JANGAN di repo frontend):");
    console.log(`  SHOPEE_SHOP_ID=${shopId}`);
    console.log("  SHOPEE_ACCESS_TOKEN=<access_token di atas>");
    console.log("  SHOPEE_REFRESH_TOKEN=<refresh_token di atas>   # access token berumur 4 jam\n");
  }

} else if (CMD === "probe") {
  requireCreds();
  console.log(`\nHost        : ${HOST}`);
  console.log(`Partner ID  : ${PARTNER_ID}`);
  console.log(`Partner key : ${mask(PARTNER_KEY)}`);
  console.log(`Shop ID     : ${SHOP_ID || "(kosong — panggilan shop akan gagal otorisasi)"}`);
  console.log(`Access token: ${mask(ACCESS_TOKEN)}\n`);

  // Dua kelompok. Kelompok kontrol membuktikan kredensial & tanda tangan benar;
  // kalau kontrol hijau tapi kandidat AMS semuanya "tidak ada", kesimpulannya
  // bukan soal salah kredensial — modulnya memang tidak ada.
  const CONTROL = [
    ["/api/v2/shop/get_shop_info", true],
    ["/api/v2/ads/get_total_balance", true],
  ];
  // Kandidat AMS — ini HIPOTESIS yang sedang diuji, bukan endpoint terdokumentasi.
  const CANDIDATES = [
    ["/api/v2/affiliate/get_metrics", true],
    ["/api/v2/affiliate/get_performance", true],
    ["/api/v2/affiliate/get_order_list", true],
    ["/api/v2/ams/get_metrics", true],
    ["/api/v2/ams/get_performance", true],
    ["/api/v2/marketing/get_affiliate_performance", true],
    ["/api/v2/seller_affiliate/get_metrics", true],
  ];

  const run = async (label, list) => {
    console.log(`── ${label} ${"─".repeat(Math.max(0, 52 - label.length))}`);
    const out = [];
    for (const [path, shop] of list) {
      const r = await call(path, { shop });
      out.push(r);
      console.log(`  ${path.padEnd(44)} ${String(r.http).padStart(3)}  ${verdict(r)}`);
      if (r.error) console.log(`  ${" ".repeat(44)}      ${String(r.message).slice(0, 90)}`);
    }
    console.log("");
    return out;
  };

  const ctl = await run("KONTROL (harus hijau kalau kredensial benar)", CONTROL);
  const cand = await run("KANDIDAT AMS (hipotesis yang diuji)", CANDIDATES);

  const reached = (rs) => rs.some((r) => r.json);
  if (!reached(ctl)) {
    console.log("KESIMPULAN: tidak ada satu pun request yang sampai ke Shopee.");
    console.log("Jalankan ulang dari mesin yang punya akses keluar langsung — hasil di");
    console.log("atas tidak bisa dipakai menyimpulkan apa pun soal ketersediaan modul.\n");
  } else if (ctl.every((r) => r.json && !r.error) && cand.every((r) => /not_found|invalid_path/i.test(String(r.error || "")))) {
    console.log("KESIMPULAN: kredensial valid (kontrol hijau) tapi seluruh kandidat AMS");
    console.log("tidak dikenal — AMS memang tidak terbuka lewat Open Platform untuk");
    console.log("aplikasi ini. Tempuh jalur export CSV atau minta akses lewat BD Shopee.\n");
  } else {
    console.log("KESIMPULAN: hasil campuran — baca baris per baris di atas.");
    console.log("Kontrol yang merah berarti kredensial/otorisasi dulu yang harus dibereskan,");
    console.log("sebelum hasil kandidat bisa dipercaya.\n");
  }

} else if (CMD === "affiliate") {
  requireCreds();
  // Affiliate Open API adalah platform TERPISAH: GraphQL, kredensial sendiri,
  // dan tanda tangannya SHA256 biasa atas gabungan string — bukan HMAC.
  const endpoint = process.env.SHOPEE_AFFILIATE_ENDPOINT
    || "https://open-api.affiliate.shopee.co.id/graphql";
  const payload = JSON.stringify({ query: "{ __typename }" });
  const ts = now();
  const sig = crypto.createHash("sha256")
    .update(`${PARTNER_ID}${ts}${payload}${PARTNER_KEY}`).digest("hex");

  console.log(`\nEndpoint: ${endpoint}`);
  console.log(`Menguji apakah partner_id ${PARTNER_ID} dikenali Affiliate Open API...\n`);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${PARTNER_ID}, Timestamp=${ts}, Signature=${sig}`,
      },
      body: payload,
    });
    const text = await res.text();
    console.log(`HTTP ${res.status}`);
    console.log(text.slice(0, 600));
    // Sama seperti 'probe': balasan non-JSON berarti request tidak sampai,
    // jadi jangan tawarkan interpretasi apa pun atas hasil yang tidak ada.
    let reached = false;
    try { JSON.parse(text); reached = true; } catch { /* bukan dari GraphQL */ }
    console.log(reached
      ? "\nBaca: error kredensial/app tidak dikenal = kredensial ini memang\nmilik Open Platform Seller, bukan Affiliate Open API.\n"
      : "\nTIDAK KONKLUSIF: balasan bukan JSON, jadi request tidak sampai ke\nAffiliate Open API (proxy/firewall). Ulangi dari jaringan yang terbuka.\n");
  } catch (e) {
    console.log(`GAGAL JARINGAN: ${e.message}`);
  }

} else {
  console.log(`
Diagnosa akses Shopee API.

  auth-url <redirect_url>     URL otorisasi toko (langkah pertama)
  token <code> <shop_id>      tukar code jadi access_token
  probe                       uji modul mana yang terbuka (termasuk kandidat AMS)
  affiliate                   uji kredensial terhadap Affiliate Open API (GraphQL)

Environment variable:
  SHOPEE_PARTNER_ID   SHOPEE_PARTNER_KEY
  SHOPEE_SHOP_ID      SHOPEE_ACCESS_TOKEN     (untuk 'probe')
  SHOPEE_HOST         (default live; isi host sandbox untuk uji coba)
`);
}
