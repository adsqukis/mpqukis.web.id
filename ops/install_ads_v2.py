#!/usr/bin/env python3
"""Pasang / verifikasi / rollback logic iklan v2 di folder backend (~/shopee-backend).

  python3 install_ads_v2.py             backup app.py, sisipkan pemanggil ads_v2.py, cek compile & import
  python3 install_ads_v2.py --verify    panggil /api/ads/campaigns di backend yang sedang jalan
  python3 install_ads_v2.py --rollback  nonaktifkan ads_v2.py (logic iklan lama aktif lagi); app.py tidak diubah

Setelah install: sudo systemctl restart mpqukis-backend
Update logic iklan berikutnya cukup ganti ads_v2.py lalu restart (app.py tidak perlu disentuh lagi).
"""
import json
import os
import py_compile
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from datetime import date, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BASE, "app.py")
V2 = os.path.join(BASE, "ads_v2.py")
MARK = "# === ADS V2 ==="
ANCHOR = "class Handler(BaseHTTPRequestHandler):\n"
BLOCK = (
    f"{MARK} logic iklan ada di ads_v2.py (menimpa fungsi iklan lama di atas)\n"
    "_ADS_V2 = os.path.join(BASE_DIR, 'ads_v2.py')\n"
    "if os.path.exists(_ADS_V2):\n"
    "    exec(compile(open(_ADS_V2, encoding='utf-8').read(), _ADS_V2, 'exec'), globals())\n"
    "\n\n"
)
IMPORT_TEST = (
    "import importlib.util as u;"
    "s=u.spec_from_file_location('t', 'app.py');m=u.module_from_spec(s);s.loader.exec_module(m);"
    "print(m.ADS_V2_VERSION, m._ads_campaigns_builder.__code__.co_filename)"
)


def fail(msg, backup=None):
    if backup:
        shutil.copy2(backup, APP)
        msg += f" — app.py dikembalikan dari {os.path.basename(backup)}"
    print("GAGAL:", msg)
    sys.exit(1)


def install():
    for f in (APP, V2):
        if not os.path.exists(f):
            fail(f"{os.path.basename(f)} tidak ada di {BASE}")
    try:
        py_compile.compile(V2, doraise=True)
    except py_compile.PyCompileError as e:
        fail(f"ads_v2.py tidak valid: {e.msg}")
    src = open(APP, encoding="utf-8").read()
    backup = None
    if MARK in src:
        print("app.py sudah punya pemanggil ads_v2.py — tidak diubah.")
    else:
        if src.count(ANCHOR) != 1:
            fail(f"anchor 'class Handler' ditemukan {src.count(ANCHOR)}x (harus 1). Tidak ada perubahan.")
        backup = os.path.join(BASE, f"app.py.bak_preadsv2_{time.strftime('%Y%m%d_%H%M%S')}")
        shutil.copy2(APP, backup)
        with open(APP, "w", encoding="utf-8") as f:
            f.write(src.replace(ANCHOR, BLOCK + ANCHOR, 1))
        print("Backup:", os.path.basename(backup))
    try:
        py_compile.compile(APP, doraise=True)
    except py_compile.PyCompileError as e:
        fail(f"app.py tidak valid setelah disisipi: {e.msg}", backup)
    r = subprocess.run([sys.executable, "-c", IMPORT_TEST], cwd=BASE, capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or "ads_v2.py" not in r.stdout:
        fail("tes import gagal: " + (r.stderr or r.stdout).strip()[-400:], backup)
    print("versi aktif:", r.stdout.split()[0])
    print("INSTALL_OK — lanjut restart: sudo systemctl restart mpqukis-backend")


def verify():
    key = re.search(r"MP_API_KEY\s*=\s*'([^']+)'", open(APP, encoding="utf-8").read())
    headers = {"X-MP-Key": key.group(1)} if key else {}
    for _ in range(20):
        try:
            urllib.request.urlopen("http://127.0.0.1:5010/health", timeout=3)
            break
        except Exception:
            time.sleep(1)
    to = date.today()
    fr = to - timedelta(days=6)
    url = f"http://127.0.0.1:5010/api/ads/campaigns?from={fr}&to={to}"
    print(f"Memanggil {url} (tarikan pertama bisa ~30-60 detik karena katalog item dibangun)...")
    try:
        d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=180).read())
    except Exception as e:
        fail(f"request gagal: {e}")
    if d.get("error"):
        fail(f"backend balas error: {d.get('error')}")
    if not d.get("version"):
        fail("backend masih pakai logic lama (tidak ada field version). Sudah restart?")
    g = d.get("gms") or {}
    rep = g.get("report") or {}
    print(f"\nversi {d['version']} | {d['count']} campaign iklan produk (di luar GMS) | {fr:%d/%m}-{to:%d/%m}")
    print(f"GMS: {'aktif' if g.get('available') else 'tidak ada'} campaign {g.get('campaign_id')} | "
          f"biaya {rep.get('expense')} | GMV langsung {rep.get('direct_gmv')} | ROAS langsung {rep.get('direct_roas')} | "
          f"{len(g.get('items') or [])} item" + (f" | catatan: {g.get('note')}" if g.get("note") else ""))
    print("\nPer produk (total = manual + GMS):")
    for name, b in (d.get("by_product") or {}).items():
        t, m, s = b["total"], b["manual"], b["gms"]
        if not t["expense"] and not t["broad_gmv"]:
            continue
        print(f"  {name[:18]:18} biaya {t['expense']:>11,} | GMV langsung {t['direct_gmv']:>12,} ROAS {t['direct_roas']} "
              f"| broad ROAS {t['broad_roas']} | manual {m['expense']:,} / GMS {s['expense']:,}".replace(",", "."))
    print("\nVERIFY_OK")


def rollback():
    # Cukup singkirkan ads_v2.py: pemanggil di app.py cuma jalan kalau file-nya ada, jadi fungsi
    # iklan lama otomatis aktif lagi. app.py tidak disentuh, perubahan lain di app.py tetap aman.
    if not os.path.exists(V2):
        fail("ads_v2.py tidak ada — logic iklan v2 memang sudah nonaktif")
    off = f"{V2}.off_{time.strftime('%Y%m%d_%H%M%S')}"
    os.rename(V2, off)
    r = subprocess.run([sys.executable, "-c", IMPORT_TEST.replace("m.ADS_V2_VERSION", "getattr(m, 'ADS_V2_VERSION', 'lama')")],
                       cwd=BASE, capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or "ads_v2.py" in r.stdout:
        os.rename(off, V2)
        fail("tes import setelah rollback gagal, ads_v2.py dikembalikan: " + (r.stderr or r.stdout).strip()[-400:])
    print(f"ads_v2.py dinonaktifkan ({os.path.basename(off)}) — lanjut: sudo systemctl restart mpqukis-backend")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    {"--verify": verify, "--rollback": rollback}.get(arg, install)()
