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
  // Affiliate Open API adalah platform TERPISAH dari Open Platform Seller:
  // GraphQL, kredensial sendiri (App ID + App Secret), dan tanda tangannya
  // SHA256 biasa atas gabungan string — bukan HMAC seperti Seller API.
  //
  // Karena kredensial ini sering datang tanpa dokumentasi, perintah ini:
  //   1. mencoba beberapa kombinasi endpoint x skema tanda tangan,
  //   2. begitu ada yang lolos autentikasi, menjalankan introspeksi GraphQL
  //      supaya API-nya sendiri yang menyebutkan data apa saja yang tersedia.
  const APP_ID = process.env.SHOPEE_AFFILIATE_APP_ID || PARTNER_ID;
  const SECRET = process.env.SHOPEE_AFFILIATE_SECRET || PARTNER_KEY;
  if (!APP_ID || !SECRET) {
    console.error("Butuh SHOPEE_AFFILIATE_APP_ID dan SHOPEE_AFFILIATE_SECRET.");
    process.exit(2);
  }

  const ENDPOINTS = process.env.SHOPEE_AFFILIATE_ENDPOINT
    ? [process.env.SHOPEE_AFFILIATE_ENDPOINT]
    : [
        "https://open-api.affiliate.shopee.co.id/graphql",
        "https://open-api.affiliate.shopee.com/graphql",
      ];

  // Dua skema yang lazim dipakai. Tanpa dokumentasi, dicoba dua-duanya.
  const SCHEMES = [
    {
      name: "SHA256(appId+ts+payload+secret)",
      sig: (ts, payload) => crypto.createHash("sha256")
        .update(`${APP_ID}${ts}${payload}${SECRET}`).digest("hex"),
    },
    {
      name: "HMAC-SHA256(secret, appId+ts+payload)",
      sig: (ts, payload) => crypto.createHmac("sha256", SECRET)
        .update(`${APP_ID}${ts}${payload}`).digest("hex"),
    },
  ];

  async function gql(endpoint, scheme, query) {
    const payload = JSON.stringify({ query });
    const ts = now();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${scheme.sig(ts, payload)}`,
        },
        body: payload,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* bukan JSON */ }
      return { http: res.status, json, text };
    } catch (e) {
      return { http: 0, json: null, text: e.message };
    }
  }

  // Autentikasi gagal punya ciri berbeda dari query yang salah: yang pertama
  // ditolak sebelum schema disentuh, yang kedua tetap mengembalikan struktur
  // GraphQL. Bedanya dipakai untuk memilih kombinasi yang benar.
  const authFailed = (r) => {
    if (!r.json) return true;
    const blob = JSON.stringify(r.json).toLowerCase();
    return /invalid.?(signature|credential|app)|unauthor|forbidden|auth.?fail|error.?auth/.test(blob);
  };

  console.log(`\nApp ID     : ${APP_ID}`);
  console.log(`App Secret : ${mask(SECRET)}\n`);
  console.log("Mencari kombinasi endpoint x tanda tangan yang diterima...\n");

  let working = null;
  for (const endpoint of ENDPOINTS) {
    for (const scheme of SCHEMES) {
      const r = await gql(endpoint, scheme, "{ __typename }");
      const label = `${endpoint.replace("https://", "")}  ${scheme.name}`;
      if (r.http === 0) { console.log(`  ✗ ${label}\n      gagal jaringan: ${r.text.slice(0, 80)}`); continue; }
      if (!r.json) { console.log(`  ? ${label}\n      HTTP ${r.http}, balasan bukan JSON (proxy/firewall) — tidak konklusif`); continue; }
      if (authFailed(r)) { console.log(`  ✗ ${label}\n      ditolak: ${JSON.stringify(r.json).slice(0, 120)}`); continue; }
      console.log(`  ✓ ${label}  ← DITERIMA`);
      working = { endpoint, scheme };
      break;
    }
    if (working) break;
  }

  if (!working) {
    console.log("\nTidak ada kombinasi yang diterima.");
    console.log("Kalau semua baris di atas 'tidak konklusif', jaringan yang memblokir —");
    console.log("ulangi dari koneksi terbuka. Kalau semuanya 'ditolak', kredensial ini");
    console.log("kemungkinan bukan untuk Affiliate Open API, atau appnya belum aktif.\n");
    process.exit(0);
  }

  // Introspeksi: biar API-nya sendiri yang menyebutkan query apa yang tersedia.
  console.log("\nMenanyakan daftar data yang tersedia (introspeksi GraphQL)...\n");
  const INTROSPECT = `{ __schema { queryType { name fields {
      name description
      args { name }
      type { kind name ofType { kind name ofType { kind name } } }
  } } } }`;
  const r = await gql(working.endpoint, working.scheme, INTROSPECT);
  const fields = r.json?.data?.__schema?.queryType?.fields;

  if (!fields) {
    console.log("Introspeksi ditolak atau kosong — balasan mentah:");
    console.log(r.text.slice(0, 800));
    console.log("\nKalau introspeksi dimatikan, minta dokumentasi ke pemberi kredensial:");
    console.log("yang dibutuhkan hanya daftar nama query dan parameternya.\n");
    process.exit(0);
  }

  const typeName = (t) => (!t ? "?" : t.name || typeName(t.ofType));
  console.log(`Tersedia ${fields.length} query:\n`);
  for (const f of fields) {
    const args = f.args?.length ? `(${f.args.map((a) => a.name).join(", ")})` : "";
    console.log(`  ${f.name}${args}`.padEnd(58) + `→ ${typeName(f.type)}`);
    if (f.description) console.log(`      ${f.description.slice(0, 96)}`);
  }

  // Layar Metrik Utama butuh data sisi PENJUAL. Ditandai kalau ada query yang
  // namanya menyiratkan itu, supaya tidak perlu dibaca satu-satu.
  const SELLER_HINT = /(shop|seller|merchant|store)/i;
  const hits = fields.filter((f) => SELLER_HINT.test(f.name));
  console.log("\n── Penilaian untuk layar Metrik Utama ──");
  if (hits.length) {
    console.log("Ada query yang menyinggung sisi toko/penjual:");
    for (const h of hits) console.log(`  • ${h.name}`);
    console.log("Cek apakah isinya metrik toko, atau sekadar identitas toko pada konversi.");
  } else {
    console.log("Tidak ada query bernuansa toko/penjual — daftar di atas kemungkinan");
    console.log("seluruhnya laporan konversi milik akun affiliate itu sendiri, bukan");
    console.log("performa toko dari semua affiliate. Kalau begitu, jalur export tetap dipakai.");
  }
  console.log("");

} else {
  console.log(`
Diagnosa akses Shopee API.

  auth-url <redirect_url>     URL otorisasi toko (langkah pertama)
  token <code> <shop_id>      tukar code jadi access_token
  probe                       uji modul mana yang terbuka (termasuk kandidat AMS)
  affiliate                   uji kredensial Affiliate Open API + daftar data
                              yang tersedia (introspeksi GraphQL)

Environment variable:
  SHOPEE_PARTNER_ID   SHOPEE_PARTNER_KEY
  SHOPEE_SHOP_ID      SHOPEE_ACCESS_TOKEN     (untuk 'probe')
  SHOPEE_HOST         (default live; isi host sandbox untuk uji coba)

Untuk 'affiliate' (platform terpisah, kredensial sendiri):
  SHOPEE_AFFILIATE_APP_ID   SHOPEE_AFFILIATE_SECRET
  SHOPEE_AFFILIATE_ENDPOINT (opsional; default coba .co.id lalu .com)
`);
}
