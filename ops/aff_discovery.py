#!/usr/bin/env python3
"""Diagnostic affiliate Shopee — READ-ONLY.

Jalankan di folder backend (~/shopee-backend):  python3 aff_discovery.py [hari]   (default 7, maks 15)

Yang dicek:
  1. Komisi affiliate per pesanan dari rincian escrow (get_escrow_detail_batch):
     order_ams_commission_fee dan items[].ams_commission_fee, dipecah per produk lewat master SKU.
  2. Pesanan sampel kreator (affiliate_sample_type di get_order_detail).
  3. Potongan affiliate lewat saldo penjual (wallet: AFFILIATE_ADS_SELLER_FEE, AFFILIATE_FEE_DEDUCT).
  4. Akses API AMS (butuh kategori app "Affiliate Marketing Solution Management").

- Tidak mengubah data/pengaturan apa pun di Shopee.
- Tidak pernah refresh token. Kalau umurnya tinggal < 10 menit, skrip berhenti supaya
  tidak bentrok dengan refresh otomatis milik backend.
- Nama pembeli tidak ditampilkan dan tidak disimpan.
- Output ringkas di layar; data lengkap disimpan ke aff_discovery_<waktu>.json.
"""
import importlib.util
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
DAYS = max(1, min(15, int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 7))
MAX_ORDERS = 1500
SAMPLE_DETAIL = 500
SKIP_STATUS = {"UNPAID", "CANCELLED"}
WALLET_AFF = {"AFFILIATE_ADS_SELLER_FEE", "AFFILIATE_ADS_SELLER_FEE_REFUND", "AFFILIATE_FEE_DEDUCT", "455", "456", "460"}


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BASE, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # app.py: server & warm-loop hanya jalan di __main__
    return mod


sb = _load("sb", "app.py")
pe = _load("pe", "parse_export.py")

WIB = timezone(timedelta(hours=7))
TOK = sb.load_token()
LEFT = TOK.get("obtained_at", 0) + TOK.get("expire_in", 0) - int(time.time())
if LEFT < 600:
    print(f"STOP: umur access token tinggal {max(LEFT, 0) // 60} menit. Jalankan lagi 15 menit lagi.")
    sys.exit(1)
print(f"== token OK (sisa {LEFT // 60} menit) — skrip ini tidak refresh token | rentang {DAYS} hari")

CALLS = Counter()


def call(path, params=None, body=None):
    CALLS[path] += 1
    time.sleep(0.35)
    ts = int(time.time())
    q = {
        "partner_id": sb.PARTNER_ID, "timestamp": ts,
        "access_token": TOK["access_token"], "shop_id": TOK["shop_id"],
        "sign": sb._sign_get(path, ts, TOK["access_token"], TOK["shop_id"]),
    }
    if params:
        q.update(params)
    url = f"{sb.API_HOST}{path}?{urllib.parse.urlencode(q)}"
    req = urllib.request.Request(url)
    if body is not None:
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=45).read())
    except urllib.error.HTTPError as e:
        return {"error": f"http_{e.code}", "message": e.read()[:300].decode("utf-8", "replace")}
    except Exception as e:  # noqa: BLE001 — diagnostic: tampilkan apa pun errornya
        return {"error": "exception", "message": str(e)[:200]}


def err(r):
    return f"{r.get('error')}: {str(r.get('message') or '')[:160]}"


def rp(x):
    return f"{round(x):,}".replace(",", ".")


def pct(a, b):
    return f"{a / b * 100:.1f}%" if b else "—"


MASTER = {str(k).strip().upper(): v.get("group") for k, v in pe.SKU_INFO.items()}


def group_of(item):
    for s in (item.get("model_sku"), item.get("item_sku")):
        g = MASTER.get((s or "").strip().upper())
        if g:
            return g
    return "Lainnya"


# ===== 1. Daftar pesanan (create_time, rentang DAYS hari) =====
now = int(time.time())
orders, cursor = {}, ""
for _ in range(100):
    r = call("/api/v2/order/get_order_list", {
        "time_range_field": "create_time", "time_from": now - DAYS * 86400, "time_to": now,
        "page_size": 100, "cursor": cursor, "response_optional_fields": "order_status",
    })
    if r.get("error"):
        print("GAGAL get_order_list:", err(r))
        sys.exit(1)
    resp = r.get("response") or {}
    for o in resp.get("order_list") or []:
        if o.get("order_sn"):
            orders[o["order_sn"]] = o.get("order_status") or "?"
    if not resp.get("more") or len(orders) >= MAX_ORDERS or not resp.get("next_cursor"):
        break
    cursor = resp["next_cursor"]
capped = len(orders) >= MAX_ORDERS
sns = list(orders)[:MAX_ORDERS]
status_all = Counter(orders[s] for s in sns)
want = [s for s in sns if orders[s] not in SKIP_STATUS]

# ===== 2. Rincian escrow (batch 50; cek GET vs POST di batch pertama) =====
BATCH_PATH = "/api/v2/payment/get_escrow_detail_batch"
method_log = []


def _batch_rows(r):
    resp = r.get("response")
    rows = resp if isinstance(resp, list) else ((resp or {}).get("escrow_detail_list") or (resp or {}).get("escrow_detail") or [])
    if isinstance(rows, dict):
        rows = [rows]
    return [(x.get("escrow_detail") if isinstance(x, dict) and "escrow_detail" in x else x) for x in rows if isinstance(x, dict)]


def escrow_batch(batch, method):
    if method == "GET":
        return call(BATCH_PATH, {"order_sn_list": ",".join(batch)})
    return call(BATCH_PATH, body={"order_sn_list": batch})


METHOD = None
if want:
    first = want[:50]
    for m in ("GET", "POST"):
        r = escrow_batch(first, m)
        ok = not r.get("error") and _batch_rows(r)
        method_log.append({"method": m, "ok": bool(ok), "error": None if ok else err(r)})
        if ok:
            METHOD = m
            break

escrow, failed = {}, []


def parse_escrow(ed):
    oi = ed.get("order_income") or {}
    items = []
    for it in oi.get("items") or []:
        items.append({
            "item_id": it.get("item_id"), "model_id": it.get("model_id"),
            "item_sku": it.get("item_sku"), "model_sku": it.get("model_sku"),
            "qty": int(it.get("quantity_purchased") or 0),
            "discounted_price": float(it.get("discounted_price") or 0),
            "ams": float(it.get("ams_commission_fee") or 0),
            "activity_type": it.get("activity_type") or "",
        })
    return {
        "order_sn": ed.get("order_sn"),
        "has_ams_field": "order_ams_commission_fee" in oi,
        "ams": float(oi.get("order_ams_commission_fee") or 0),
        "order_discounted_price": float(oi.get("order_discounted_price") or 0),
        "escrow_amount": float(oi.get("escrow_amount") or 0),
        "items": items,
    }


def fetch(batch, depth=0):
    r = escrow_batch(batch, METHOD)
    rows = _batch_rows(r) if not r.get("error") else []
    if r.get("error") and len(batch) > 1 and depth < 3:
        mid = len(batch) // 2
        fetch(batch[:mid], depth + 1)
        fetch(batch[mid:], depth + 1)
        return
    got = set()
    for ed in rows:
        if ed and ed.get("order_sn"):
            escrow[ed["order_sn"]] = parse_escrow(ed)
            got.add(ed["order_sn"])
    failed.extend((s, err(r) if r.get("error") else "tidak kembali") for s in batch if s not in got)


if METHOD:
    for i in range(0, len(want), 50):
        fetch(want[i:i + 50])

# Cadangan: batch gagal di dua metode → coba endpoint satuan (catatan backend: get_escrow_detail = POST).
SINGLE_PATH, SINGLE_MAX, SINGLE = "/api/v2/payment/get_escrow_detail", 150, None
if not METHOD and want:
    for m in ("GET", "POST"):
        r = call(SINGLE_PATH, {"order_sn": want[0]}) if m == "GET" else call(SINGLE_PATH, body={"order_sn": want[0]})
        ok = not r.get("error") and isinstance(r.get("response"), dict) and r["response"].get("order_sn")
        method_log.append({"method": f"satuan {m}", "ok": bool(ok), "error": None if ok else err(r)})
        if ok:
            SINGLE = m
            break
if SINGLE:
    for sn in want[:SINGLE_MAX]:
        r = call(SINGLE_PATH, {"order_sn": sn}) if SINGLE == "GET" else call(SINGLE_PATH, body={"order_sn": sn})
        if not r.get("error") and isinstance(r.get("response"), dict):
            escrow[sn] = parse_escrow(r["response"])
        else:
            failed.append((sn, err(r)))
    METHOD = f"satuan {SINGLE} (dibatasi {SINGLE_MAX} pesanan)"

# ===== 3. Pesanan sampel kreator (affiliate_sample_type) =====
sample_type = Counter()
sample_orders = []
for i in range(0, min(len(sns), SAMPLE_DETAIL), 50):
    r = call("/api/v2/order/get_order_detail", {
        "order_sn_list": ",".join(sns[i:i + 50]), "response_optional_fields": "total_amount",
    })
    for o in ((r.get("response") or {}).get("order_list")) or []:
        v = o.get("affiliate_sample_type", "(field tidak ada)")
        sample_type[str(v)] += 1
        if v == 1:
            sample_orders.append({"order_sn": o.get("order_sn"), "status": o.get("order_status"),
                                  "total_amount": o.get("total_amount")})

# ===== 4. Wallet: potongan affiliate lewat saldo =====
wallet_types, wallet_aff, wallet_err = Counter(), [], None
for page in range(0, 30):
    r = call("/api/v2/payment/get_wallet_transaction_list", {
        "page_no": page, "page_size": 100, "create_time_from": now - DAYS * 86400, "create_time_to": now,
    })
    if r.get("error"):
        wallet_err = err(r)
        break
    resp = r.get("response") or {}
    for t in resp.get("transaction_list") or []:
        tt = str(t.get("transaction_type"))
        wallet_types[tt] += 1
        if tt in WALLET_AFF or "AFFILIATE" in tt.upper():
            wallet_aff.append({k: t.get(k) for k in ("transaction_type", "txn_title", "amount", "create_time",
                                                      "order_sn", "status", "description")})
    if not resp.get("more"):
        break

# ===== 5. Akses API AMS =====
today = datetime.now(WIB).date()
ams = call("/api/v2/ams/get_shop_performance", {
    "period_type": "Last7d", "start_date": f"{today - timedelta(days=7):%Y%m%d}",
    "end_date": f"{today - timedelta(days=1):%Y%m%d}", "order_type": "ConfirmedOrder", "channel": "AllChannel",
})

# ===== OUTPUT =====
aff = {sn: e for sn, e in escrow.items() if e["ams"] > 0 or any(it["ams"] > 0 for it in e["items"])}
mismatch = [sn for sn, e in aff.items() if abs(e["ams"] - sum(it["ams"] for it in e["items"])) > 1]
per_group = defaultdict(lambda: {"orders": set(), "qty": 0, "gmv": 0.0, "ams": 0.0})
for sn, e in aff.items():
    for it in e["items"]:
        if it["ams"] > 0:
            g = per_group[group_of(it)]
            g["orders"].add(sn)
            g["qty"] += it["qty"]
            g["gmv"] += it["discounted_price"]
            g["ams"] += it["ams"]
tot_ams = sum(e["ams"] for e in aff.values())
tot_gmv = sum(g["gmv"] for g in per_group.values())
all_gmv = sum(e["order_discounted_price"] for e in escrow.values())

print(f"\n== PESANAN: {len(sns)} pesanan dibuat {DAYS} hari terakhir" + (f" (DIBATASI {MAX_ORDERS})" if capped else ""))
print("   status:", dict(status_all.most_common()))
print(f"\n== ESCROW: metode {METHOD or 'GAGAL'} | dibaca {len(escrow)}/{len(want)} (tanpa UNPAID/CANCELLED) | gagal {len(failed)}")
for m in method_log:
    print(f"   coba {m['method']}: {'OK' if m['ok'] else m['error']}")
if failed:
    print("   contoh gagal:", failed[:3])
print(f"   field order_ams_commission_fee ada di {sum(e['has_ams_field'] for e in escrow.values())}/{len(escrow)} pesanan")

print(f"\n== AFFILIATE (dari escrow): {len(aff)} pesanan = {pct(len(aff), len(escrow))} dari pesanan yang dibaca")
print(f"   komisi {rp(tot_ams)} | GMV item affiliate {rp(tot_gmv)} | rate efektif {pct(tot_ams, tot_gmv)} "
      f"| porsi GMV toko {pct(tot_gmv, all_gmv)}")
print(f"   status pesanan affiliate: {dict(Counter(orders.get(sn, '?') for sn in aff).most_common())}")
if mismatch:
    print(f"   PERHATIAN: {len(mismatch)} pesanan komisi order ≠ jumlah komisi item (contoh {mismatch[:3]})")
for g, a in sorted(per_group.items(), key=lambda kv: -kv[1]["ams"]):
    print(f"   {g[:18]:18} | {len(a['orders']):4} pesanan | {a['qty']:4} pcs | GMV {rp(a['gmv']):>12} "
          f"| komisi {rp(a['ams']):>10} | rate {pct(a['ams'], a['gmv'])}")
for sn, e in list(aff.items())[:5]:
    its = "; ".join(f"{it['model_sku'] or it['item_sku']} x{it['qty']} komisi {rp(it['ams'])}" for it in e["items"])
    print(f"   contoh {sn} [{orders.get(sn)}] komisi {rp(e['ams'])} | {its[:120]}")

print(f"\n== SAMPEL KREATOR (get_order_detail {min(len(sns), SAMPLE_DETAIL)} pesanan): affiliate_sample_type {dict(sample_type)}")
for s in sample_orders[:5]:
    print(f"   {s['order_sn']} [{s['status']}] total {s['total_amount']}")

print(f"\n== WALLET {DAYS} hari: " + (f"GAGAL {wallet_err}" if wallet_err else f"{sum(wallet_types.values())} transaksi"))
if not wallet_err:
    print("   tipe:", dict(wallet_types.most_common(12)))
    print(f"   transaksi affiliate: {len(wallet_aff)} | total {rp(sum(float(t.get('amount') or 0) for t in wallet_aff))}")
    for t in wallet_aff[:5]:
        print(f"   {t['transaction_type']} {t.get('txn_title')} {t.get('amount')} order {t.get('order_sn')}")

print("\n== AMS get_shop_performance:", err(ams) if ams.get("error") else json.dumps(ams.get("response"))[:300])

out = os.path.join(BASE, f"aff_discovery_{datetime.now(WIB):%Y%m%d_%H%M%S}.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump({"days": DAYS, "orders": orders, "escrow_method": METHOD, "method_log": method_log,
               "escrow": escrow, "failed": failed, "sample_type": sample_type, "sample_orders": sample_orders,
               "wallet_types": wallet_types, "wallet_affiliate": wallet_aff, "wallet_error": wallet_err, "ams": ams},
              f, ensure_ascii=False, default=str)
print(f"\n== {sum(CALLS.values())} panggilan API. Data lengkap: {out}")
