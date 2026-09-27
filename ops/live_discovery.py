#!/usr/bin/env python3
"""Diagnostic Live Shopee — READ-ONLY.

Jalankan di folder backend (~/shopee-backend):  python3 live_discovery.py

Yang dicek (hasil nyata dari Shopee, bukan tebakan dari spec):
  1. Akses API data Live/affiliate dengan app yang sekarang:
     - livestream.get_session_detail            (spec: kategori "Livestream Management", otorisasi akun streamer)
     - principal.get_shop_livestream_performance (spec: kategori "Brand Portal Service", otorisasi brand/principal)
     - ams.get_shop_performance                  (spec: kategori "Affiliate Marketing Solution Management")
  2. Jalur yang terbuka untuk app sekarang: voucher live (usecase 6 / tampil di live) dan diskon live
     (source 7) 60 hari terakhir, termasuk berapa kali voucher live dipakai.

- Tidak mengubah data/pengaturan apa pun di Shopee. Tidak pernah refresh token; kalau umurnya tinggal
  < 10 menit, skrip berhenti supaya tidak bentrok dengan refresh otomatis backend.
- Output ringkas di layar; data lengkap disimpan ke live_discovery_<waktu>.json.
"""
import importlib.util
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BASE, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # app.py: server & warm-loop hanya jalan di __main__
    return mod


sb = _load("sb", "app.py")
WIB = timezone(timedelta(hours=7))
TOK = sb.load_token()
LEFT = TOK.get("obtained_at", 0) + TOK.get("expire_in", 0) - int(time.time())
if LEFT < 600:
    print(f"STOP: umur access token tinggal {max(LEFT, 0) // 60} menit. Jalankan lagi 15 menit lagi.")
    sys.exit(1)
print(f"== token OK (sisa {LEFT // 60} menit) — skrip ini tidak refresh token")

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
        raw = e.read()[:400].decode("utf-8", "replace")
        try:
            j = json.loads(raw)
            return {"error": j.get("error") or f"http_{e.code}", "message": j.get("message") or raw, "http": e.code}
        except Exception:
            return {"error": f"http_{e.code}", "message": raw, "http": e.code}
    except Exception as e:  # noqa: BLE001 — diagnostic: tampilkan apa pun errornya
        return {"error": "exception", "message": str(e)[:200]}


def verdict(r):
    if not r.get("error"):
        return "ADA AKSES — Shopee membalas data"
    txt = f"{r.get('error')} {r.get('message')}".lower()
    if any(k in txt for k in ("permission", "not allowed", "no access", "app type", "category", "partner")):
        return "TIDAK ADA AKSES untuk app ini"
    return "tidak jelas — lihat pesan Shopee di bawah"


# ===== 1. Uji akses API Live / Brand Portal / AMS =====
today = datetime.now(WIB).date()
probes = {
    "Livestream (livestream.get_session_detail)":
        call("/api/v2/livestream/get_session_detail", {"session_id": 1}),
    "Brand Portal (principal.get_shop_livestream_performance)":
        call("/api/v2/principal/get_shop_livestream_performance", body={
            "start_date": f"{today - timedelta(days=7)}", "end_date": f"{today - timedelta(days=1)}",
            "timezone": "GMT+7", "granularity": "customize", "shop_list": []}),
    "AMS (ams.get_shop_performance)":
        call("/api/v2/ams/get_shop_performance", {
            "period_type": "Last7d", "start_date": f"{today - timedelta(days=7):%Y%m%d}",
            "end_date": f"{today - timedelta(days=1):%Y%m%d}", "order_type": "ConfirmedOrder", "channel": "AllChannel"}),
}

# ===== 2a. Voucher: live = usecase 6 atau tampil di channel live (4) =====
now = int(time.time())
since = now - 60 * 86400
vouchers, verr = [], None
for page in range(1, 21):
    r = call("/api/v2/voucher/get_voucher_list", {"page_no": page, "page_size": 100, "status": "all"})
    if r.get("error"):
        verr = f"{r.get('error')}: {str(r.get('message') or '')[:160]}"
        break
    resp = r.get("response") or {}
    lst = resp.get("voucher_list") or []
    vouchers += lst
    if not lst or not resp.get("more"):
        break
recent = [v for v in vouchers if (v.get("end_time") or 0) >= since]
recent.sort(key=lambda v: -(v.get("end_time") or 0))
live_v, detail_err = [], None
for v in recent[:80]:
    r = call("/api/v2/voucher/get_voucher", {"voucher_id": v.get("voucher_id")})
    if r.get("error"):
        detail_err = f"{r.get('error')}: {str(r.get('message') or '')[:160]}"
        continue
    d = r.get("response") or {}
    ch = d.get("display_channel_list") or []
    if d.get("usecase") == 6 or 4 in ch:
        live_v.append({"voucher_id": v.get("voucher_id"), "code": v.get("voucher_code"), "name": v.get("voucher_name"),
                       "usecase": d.get("usecase"), "channels": ch, "used": v.get("current_usage"),
                       "quota": v.get("usage_quantity"), "start": v.get("start_time"), "end": v.get("end_time")})

# ===== 2b. Diskon: live = source 7 (maks 30 hari per request, jadi 2 jendela) =====
disc, derr = {}, None   # discount_id -> diskon (2 jendela bisa beririsan)
for w in range(2):
    t_to = now - w * 30 * 86400
    t_from = t_to - 30 * 86400 + 1
    for page in range(1, 11):
        r = call("/api/v2/discount/get_discount_list", {
            "discount_status": "all", "page_no": page, "page_size": 100,
            "update_time_from": t_from, "update_time_to": t_to})
        if r.get("error"):
            derr = f"{r.get('error')}: {str(r.get('message') or '')[:160]}"
            break
        resp = r.get("response") or {}
        lst = resp.get("discount_list") or []
        for d in lst:
            disc[d.get("discount_id")] = d
        if not lst or not resp.get("more"):
            break

all_d = len(disc)
live_d = [d for d in disc.values() if str(d.get("source")) == "7"]

# ===== OUTPUT =====
print("\n== 1. AKSES API (app yang sekarang)")
for name, r in probes.items():
    print(f"   {name}: {verdict(r)}")
    print(f"      Shopee: {r.get('error') or 'OK'} — {str(r.get('message') or '')[:200]}")


def fmt_t(ts):
    return datetime.fromtimestamp(ts, WIB).strftime("%d/%m") if ts else "?"


print(f"\n== 2a. VOUCHER: {len(vouchers)} voucher total, {len(recent)} aktif/berakhir 60 hari terakhir"
      + (f" | GAGAL list: {verr}" if verr else "") + (f" | error detail: {detail_err}" if detail_err else ""))
print(f"   voucher live: {len(live_v)} | total dipakai {sum(int(v.get('used') or 0) for v in live_v)} kali")
for v in sorted(live_v, key=lambda x: -int(x.get("used") or 0))[:8]:
    print(f"   {v['code']:14} {str(v['name'])[:30]:30} dipakai {v['used']}/{v['quota']} | {fmt_t(v['start'])}–{fmt_t(v['end'])}")

print(f"\n== 2b. DISKON 60 hari: {all_d} diskon diupdate" + (f" | GAGAL: {derr}" if derr else ""))
print(f"   diskon khusus live (source 7): {len(live_d)}")
for d in live_d[:8]:
    print(f"   {d.get('discount_id')} {str(d.get('discount_name'))[:40]:40} {d.get('status')} | {fmt_t(d.get('start_time'))}–{fmt_t(d.get('end_time'))}")

out = os.path.join(BASE, f"live_discovery_{datetime.now(WIB):%Y%m%d_%H%M%S}.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump({"probes": probes, "vouchers_total": len(vouchers), "vouchers_recent": len(recent), "live_vouchers": live_v,
               "voucher_error": verr, "voucher_detail_error": detail_err, "discounts_total": all_d,
               "live_discounts": live_d, "discount_error": derr}, f, ensure_ascii=False, default=str)
print(f"\n== {sum(CALLS.values())} panggilan API. Data lengkap: {out}")
