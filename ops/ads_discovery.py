#!/usr/bin/env python3
"""Diagnostic iklan Shopee — READ-ONLY.

Jalankan di folder backend (~/shopee-backend):  python3 ads_discovery.py

- Tidak mengubah data/pengaturan apa pun di Shopee.
- Tidak pernah refresh token (hanya pakai access_token yang sedang aktif). Kalau
  umurnya tinggal < 10 menit, skrip berhenti supaya tidak bentrok dengan refresh
  otomatis milik backend.
- Output ringkas di layar; data lengkap disimpan ke ads_discovery_<waktu>.json.
"""
import importlib.util
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))


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
        return {"error": f"http_{e.code}", "message": e.read()[:300].decode("utf-8", "replace")}
    except Exception as e:  # noqa: BLE001 — diagnostic: tampilkan apa pun errornya
        return {"error": "exception", "message": str(e)[:200]}


def err(r):
    return f"{r.get('error')}: {str(r.get('message') or '')[:160]}"


def rp(x):
    return f"{round(x):,}".replace(",", ".")


def roas(g, e):
    return f"{g / e:.2f}x" if e > 0 else "—"


MASTER = {k.strip().upper(): v for k, v in pe.SKU_INFO.items()}

# 1) Semua campaign
cams, offset = [], 0
while True:
    r = call("/api/v2/ads/get_product_level_campaign_id_list", {"ad_type": "all", "offset": offset, "limit": 100})
    if r.get("error"):
        print("ERR campaign_id_list", err(r))
        break
    resp = r.get("response") or {}
    lst = resp.get("campaign_list") or []
    cams += lst
    if not resp.get("has_next_page") or not lst or offset > 2000:
        break
    offset += len(lst)
ids = [c["campaign_id"] for c in cams if c.get("campaign_id")]

# 2) Setting semua info type (1 common, 2 manual bidding, 3 auto bidding, 4 auto product ads)
settings = {}
for i in range(0, len(ids), 50):
    r = call("/api/v2/ads/get_product_level_campaign_setting_info",
             {"campaign_id_list": ",".join(map(str, ids[i:i + 50])), "info_type_list": "1,2,3,4"})
    if r.get("error"):
        print("ERR setting_info", err(r))
        continue
    for c in (r.get("response") or {}).get("campaign_list") or []:
        settings[c.get("campaign_id")] = c


def cam_items(c):
    ci = c.get("common_info") or {}
    out = list(ci.get("item_id_list") or [])
    out += [a.get("item_id") for a in (c.get("auto_product_ads_info") or []) if a.get("item_id")]
    return list(dict.fromkeys(out))


# 3) Item → SKU → grup produk (master SKU parse_export.py)
item_ids = sorted({x for c in settings.values() for x in cam_items(c)})
items = {}
for i in range(0, len(item_ids), 50):
    r = call("/api/v2/product/get_item_base_info", {"item_id_list": ",".join(map(str, item_ids[i:i + 50]))})
    if r.get("error"):
        print("ERR item_base_info", err(r))
        continue
    for it in (r.get("response") or {}).get("item_list") or []:
        items[it["item_id"]] = {
            "name": it.get("item_name") or "", "item_sku": (it.get("item_sku") or "").strip(),
            "has_model": bool(it.get("has_model")), "status": it.get("item_status"), "model_skus": [],
        }
for iid, it in items.items():
    if not it["has_model"]:
        continue
    r = call("/api/v2/product/get_model_list", {"item_id": iid})
    if r.get("error"):
        it["model_err"] = err(r)
        continue
    for m in (r.get("response") or {}).get("model") or []:
        if (m.get("model_sku") or "").strip():
            it["model_skus"].append(m["model_sku"].strip())
for it in items.values():
    skus = [s for s in [it["item_sku"]] + it["model_skus"] if s]
    it["groups"] = sorted({MASTER[s.upper()]["group"] for s in skus if s.upper() in MASTER})
    it["unknown_skus"] = sorted({s for s in skus if s.upper() not in MASTER})


def cam_group(c):
    iids = cam_items(c)
    if not iids:
        return "(tanpa item)"
    gs, unknown = set(), False
    for x in iids:
        g = (items.get(x) or {}).get("groups") or []
        gs.update(g)
        unknown = unknown or not g
    if len(gs) > 1:
        return "(campuran >1 produk)"
    if len(gs) == 1:
        return next(iter(gs)) + (" +tak terpetakan" if unknown else "")
    return "(tak terpetakan)"


# 4) Performa 7 hari (sama dgn preset dashboard) — broad vs direct
today = datetime.now(WIB).date()
d_from = today - timedelta(days=6)
dmy = lambda d: d.strftime("%d-%m-%Y")  # noqa: E731
perf, metric_keys = {}, set()


def fetch(batch, depth=0):
    r = call("/api/v2/ads/get_product_campaign_daily_performance",
             {"start_date": dmy(d_from), "end_date": dmy(today), "campaign_id_list": ",".join(map(str, batch))})
    if not r.get("error"):
        for c in (r.get("response") or {}).get("campaign_list") or []:
            ml = c.get("metrics_list") or []
            perf[c.get("campaign_id")] = ml
            for m in ml:
                metric_keys.update(m.keys())
        return
    if len(batch) > 1 and depth < 6:
        mid = len(batch) // 2
        fetch(batch[:mid], depth + 1)
        fetch(batch[mid:], depth + 1)


for i in range(0, len(ids), 100):
    fetch(ids[i:i + 100])

REGEX_LAMA = [("Generos 1 Botol", r"1\s*botol"), ("Generos Milk", r"milk"), ("Generos 1 Box", r"1\s*box")]
K = ("exp", "dg", "bg", "do", "bo")
lama, baru = defaultdict(lambda: Counter()), defaultdict(lambda: Counter())
for cid, ml in perf.items():
    s = Counter()
    for m in ml:
        s["exp"] += float(m.get("expense") or 0)
        s["dg"] += float(m.get("direct_gmv") or 0)
        s["bg"] += float(m.get("broad_gmv") or 0)
        s["do"] += int(m.get("direct_order") or 0)
        s["bo"] += int(m.get("broad_order") or 0)
    if not any(s[k] for k in K):
        continue
    c = settings.get(cid) or {}
    name = (c.get("common_info") or {}).get("ad_name") or ""
    g_old = next((lbl for lbl, rx in REGEX_LAMA if re.search(rx, name, re.I)), "Lainnya")
    for tgt, g in ((lama, g_old), (baru, cam_group(c))):
        tgt[g]["n"] += 1
        for k in K:
            tgt[g][k] += s[k]

# 5) GMS (butuh toko di-whitelist "Product GMS")
gms_elig = call("/api/v2/ads/check_create_gms_product_campaign_eligibility")
gms_cam = call("/api/v2/ads/get_gms_campaign_performance", body={"start_date": dmy(d_from), "end_date": dmy(today)})
gms_item = call("/api/v2/ads/get_gms_item_performance",
                body={"start_date": dmy(d_from), "end_date": dmy(today), "offset": 0, "limit": 100})

# ===== OUTPUT =====
ci_all = [s.get("common_info") or {} for s in settings.values()]
print(f"\n== CAMPAIGN: {len(ids)} id, setting kebaca {len(settings)}")
print("   ad_type:", dict(Counter(c.get("ad_type") for c in ci_all)))
print("   status :", dict(Counter(c.get("campaign_status") for c in ci_all)))
print("   bidding:", dict(Counter(c.get("bidding_method") for c in ci_all)),
      "| placement:", dict(Counter(c.get("campaign_placement") for c in ci_all)))
print("   item_id_list terisi:", sum(1 for c in ci_all if c.get("item_id_list")),
      "| auto_product_ads_info terisi:", sum(1 for s in settings.values() if s.get("auto_product_ads_info")),
      "| punya keyword:", sum(1 for s in settings.values() if (s.get("manual_bidding_info") or {}).get("selected_keywords")),
      "| punya roas_target:", sum(1 for s in settings.values() if (s.get("auto_bidding_info") or {}).get("roas_target")))

print(f"\n== ITEM YANG DIIKLANKAN: {len(item_ids)} item unik, kebaca {len(items)}")
per_group = defaultdict(list)
for iid, it in items.items():
    key = " + ".join(it["groups"]) if it["groups"] else "(SKU tidak ada di master)"
    per_group[key].append((iid, it))
for g, lst in sorted(per_group.items()):
    print(f" [{g}] {len(lst)} item")
    for iid, it in lst[:12]:
        skus = ",".join(s for s in [it["item_sku"]] + it["model_skus"] if s) or "-"
        print(f"   {iid} | {it['name'][:48]} | SKU: {skus[:70]}")
    if len(lst) > 12:
        print(f"   ... +{len(lst) - 12} item lagi")

autos = [(cid, s) for cid, s in settings.items() if s.get("auto_product_ads_info")]
if autos:
    print(f"\n== IKLAN PRODUK OTOMATIS: {len(autos)} campaign")
    for cid, s in autos[:5]:
        ap = s["auto_product_ads_info"]
        st = (s.get("common_info") or {}).get("campaign_status")
        print(f"   campaign {cid} ({st}): {len(ap)} produk ->",
              "; ".join(f"{a.get('product_name', '')[:28]} [{a.get('status')}]" for a in ap[:6]))

print(f"\n== PERFORMA {d_from:%d/%m}-{today:%d/%m} (field metrik: {len(metric_keys)} — direct_gmv ada: {'direct_gmv' in metric_keys})")
print(" CARA SEKARANG (tebak nama campaign + broad):")
for g, a in sorted(lama.items(), key=lambda kv: -kv[1]["exp"]):
    print(f"   {g[:26]:26} | {a['n']:3} cmp | spend {rp(a['exp']):>12} | GMV {rp(a['bg']):>13} | ROAS {roas(a['bg'], a['exp'])}")
print(" CARA BARU (item_id -> SKU master; GMV langsung = produk itu sendiri):")
for g, a in sorted(baru.items(), key=lambda kv: -kv[1]["exp"]):
    print(f"   {g[:26]:26} | {a['n']:3} cmp | spend {rp(a['exp']):>12} | GMV langsung {rp(a['dg']):>12} "
          f"ROAS {roas(a['dg'], a['exp'])} | GMV broad {rp(a['bg']):>12} ROAS {roas(a['bg'], a['exp'])}")

print("\n== GMS")
print("   eligibility :", err(gms_elig) if gms_elig.get("error") else json.dumps(gms_elig.get("response"))[:200])
print("   campaign    :", err(gms_cam) if gms_cam.get("error") else json.dumps(gms_cam.get("response"))[:200])
if gms_item.get("error"):
    print("   item        :", err(gms_item))
else:
    gi = gms_item.get("response") or {}
    print(f"   item        : {gi.get('total')} item punya performa, campaign {gi.get('campaign_id')}")
    for row in (gi.get("result_list") or [])[:8]:
        rep = row.get("report") or {}
        nm = (items.get(row.get("item_id")) or {}).get("name", "?")
        print(f"     {row.get('item_id')} {nm[:34]} | spend {rp(rep.get('expense') or 0)} "
              f"| GMV langsung {rp(rep.get('direct_gmv') or 0)} | ROAS langsung {rep.get('direct_roi')}")

out = os.path.join(BASE, f"ads_discovery_{datetime.now(WIB):%Y%m%d_%H%M%S}.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump({"campaign_ids": ids, "settings": settings, "items": items, "perf": perf,
               "gms": {"eligibility": gms_elig, "campaign": gms_cam, "item": gms_item}},
              f, ensure_ascii=False, default=str)
print(f"\n== {sum(CALLS.values())} panggilan API. Data lengkap: {out}")
