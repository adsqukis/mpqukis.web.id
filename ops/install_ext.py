#!/usr/bin/env python3
"""Pasang / verifikasi / nonaktifkan modul tambahan backend (ext_*.py) di folder backend (~/shopee-backend).

  python3 install_ext.py                   pasang titik sambung di app.py (sekali saja), cek compile & import
  python3 install_ext.py --verify          panggil /api/affiliate/summary (7 hari) di backend yang sedang jalan
  python3 install_ext.py --verify ROUTE    panggil ROUTE lain (mis. /api/xxx?from=2026-09-01&to=2026-09-07)
  python3 install_ext.py --off NAMA        nonaktifkan ext_NAMA.py (di-rename); app.py tidak diubah

Titik sambung: setiap file ext_*.py di folder backend dimuat saat backend start dan boleh mendaftarkan
route ke EXT_ROUTES (otomatis kena cek X-MP-Key). Modul baru cukup taruh file-nya lalu restart:
    sudo systemctl restart mpqukis-backend
"""
import datetime
import json
import os
import py_compile
import re
import shutil
import subprocess
import sys
import time
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BASE, "app.py")
MARK_LOAD = "# === EXT MODULES ==="
MARK_ROUTE = "elif path in EXT_ROUTES:"
ANCHOR_LOAD = "class Handler(BaseHTTPRequestHandler):\n"
ANCHOR_ROUTE = ("            else:\n"
                "                return self._send_json({'error': 'not found', 'path': path}, 404)\n")
BLOCK_LOAD = (
    f"{MARK_LOAD} modul tambahan ext_*.py (lihat install_ext.py); route-nya didaftarkan ke EXT_ROUTES\n"
    "EXT_ROUTES = {}\n"
    "EXT_LOADED = {}\n"
    "for _ext_name in sorted(f for f in os.listdir(BASE_DIR) if f.startswith('ext_') and f.endswith('.py')):\n"
    "    _ext_path = os.path.join(BASE_DIR, _ext_name)\n"
    "    try:\n"
    "        exec(compile(open(_ext_path, encoding='utf-8').read(), _ext_path, 'exec'), globals())\n"
    "        EXT_LOADED[_ext_name] = 'ok'\n"
    "    except Exception as _ext_err:  # modul rusak tidak boleh menjatuhkan backend\n"
    "        EXT_LOADED[_ext_name] = f'{type(_ext_err).__name__}: {_ext_err}'\n"
    "        print(f'[ext] {_ext_name} gagal dimuat: {EXT_LOADED[_ext_name]}', flush=True)\n"
    "\n\n"
)
BLOCK_ROUTE = (
    f"            {MARK_ROUTE}\n"
    "                return self._send_json(EXT_ROUTES[path](qs))\n"
)
IMPORT_TEST = (
    "import importlib.util as u, json;"
    "s=u.spec_from_file_location('t', 'app.py');m=u.module_from_spec(s);s.loader.exec_module(m);"
    "print(json.dumps({'routes': sorted(getattr(m, 'EXT_ROUTES', {})), 'loaded': getattr(m, 'EXT_LOADED', None),"
    "'ads_v2': getattr(m, 'ADS_V2_VERSION', None)}))"
)


def fail(msg, backup=None):
    if backup:
        shutil.copy2(backup, APP)
        msg += f" — app.py dikembalikan dari {os.path.basename(backup)}"
    print("GAGAL:", msg)
    sys.exit(1)


def install():
    if not os.path.exists(APP):
        fail(f"app.py tidak ada di {BASE}")
    mods = sorted(f for f in os.listdir(BASE) if f.startswith("ext_") and f.endswith(".py"))
    for f in mods:
        try:
            py_compile.compile(os.path.join(BASE, f), doraise=True)
        except py_compile.PyCompileError as e:
            fail(f"{f} tidak valid: {e.msg}")
    src = open(APP, encoding="utf-8").read()
    new = src
    if MARK_LOAD not in new:
        if new.count(ANCHOR_LOAD) != 1:
            fail(f"anchor 'class Handler' ditemukan {new.count(ANCHOR_LOAD)}x (harus 1). Tidak ada perubahan.")
        new = new.replace(ANCHOR_LOAD, BLOCK_LOAD + ANCHOR_LOAD, 1)
    if MARK_ROUTE not in new:
        if new.count(ANCHOR_ROUTE) != 1:
            fail(f"anchor route 404 ditemukan {new.count(ANCHOR_ROUTE)}x (harus 1). Tidak ada perubahan.")
        new = new.replace(ANCHOR_ROUTE, BLOCK_ROUTE + ANCHOR_ROUTE, 1)
    backup = None
    if new == src:
        print("app.py sudah punya titik sambung ext_*.py — tidak diubah.")
    else:
        backup = os.path.join(BASE, f"app.py.bak_preext_{time.strftime('%Y%m%d_%H%M%S')}")
        shutil.copy2(APP, backup)
        with open(APP, "w", encoding="utf-8") as f:
            f.write(new)
        print("Backup:", os.path.basename(backup))
    try:
        py_compile.compile(APP, doraise=True)
    except py_compile.PyCompileError as e:
        fail(f"app.py tidak valid setelah disisipi: {e.msg}", backup)
    r = subprocess.run([sys.executable, "-c", IMPORT_TEST], cwd=BASE, capture_output=True, text=True, timeout=90)
    try:
        info = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        fail("tes import gagal: " + (r.stderr or r.stdout).strip()[-400:], backup)
    bad = {k: v for k, v in (info.get("loaded") or {}).items() if v != "ok"}
    if bad:
        fail(f"modul gagal dimuat: {bad}", backup)
    if mods and not info.get("routes"):
        fail("modul termuat tapi tidak ada route terdaftar", backup)
    print("modul:", ", ".join(info.get("loaded") or {}) or "(belum ada ext_*.py)")
    print("route:", ", ".join(info.get("routes") or []) or "-")
    if info.get("ads_v2"):
        print("iklan v2 tetap aktif:", info["ads_v2"])
    print("INSTALL_OK — lanjut restart: sudo systemctl restart mpqukis-backend")


def _get(route, timeout):
    key = re.search(r"MP_API_KEY\s*=\s*'([^']+)'", open(APP, encoding="utf-8").read())
    headers = {"X-MP-Key": key.group(1)} if key else {}
    for _ in range(20):
        try:
            urllib.request.urlopen("http://127.0.0.1:5010/health", timeout=3)
            break
        except Exception:
            time.sleep(1)
    req = urllib.request.Request(f"http://127.0.0.1:5010{route}", headers=headers)
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def rp(x):
    return f"{round(x or 0):,}".replace(",", ".")


def verify(route=None):
    if not route:
        to = datetime.date.today()
        route = f"/api/affiliate/summary?from={to - datetime.timedelta(days=6)}&to={to}"
    print(f"Memanggil {route} (tarikan pertama bisa beberapa menit: rincian escrow tiap pesanan dibaca)...")
    try:
        d = _get(route, timeout=600)
    except Exception as e:
        fail(f"request gagal: {e}")
    if d.get("error"):
        fail(f"backend balas error: {d.get('error')}")
    if not route.startswith("/api/affiliate/summary"):
        print(json.dumps(d, ensure_ascii=False)[:1500])
        print("\nVERIFY_OK")
        return
    c, t, w = d.get("coverage") or {}, d.get("total") or {}, d.get("wallet") or {}
    print(f"\nversi {d.get('version')} | {d.get('from')} s.d. {d.get('to')} | metode escrow {c.get('method')}")
    print(f"pesanan {c.get('orders_in_range')} | dicek escrow {c.get('escrow_read')}/{c.get('eligible')} "
          f"(belum terbaca {c.get('missing')})" + (f" | error: {c.get('errors')}" if c.get("errors") else ""))
    print(f"AFFILIATE: {t.get('aff_orders')} pesanan ({t.get('share_orders')}%) | penjualan {rp(t.get('aff_gmv'))} "
          f"({t.get('share_gmv')}% dari penjualan) | komisi {rp(t.get('commission'))} (rate {t.get('rate')}%)")
    cx = d.get("cancelled") or {}
    if cx.get("orders"):
        print(f"   dikeluarkan karena batal: {cx['orders']} pesanan, komisi {rp(cx.get('commission'))}")
    for g, b in (d.get("by_product") or {}).items():
        if b.get("aff_orders") or b.get("gmv"):
            print(f"   {g[:18]:18} | {b['aff_orders']:4} pesanan affiliate | penjualan {rp(b['aff_gmv']):>12} "
                  f"({b.get('share_gmv')}%) | komisi {rp(b['commission']):>10} | rate {b.get('rate')}%")
    print("saldo (di luar escrow): " + (f"{w.get('count')} transaksi affiliate, total {rp(w.get('total'))}"
                                        if w.get("available") else f"tidak tersedia — {w.get('note')}"))
    if not c.get("escrow_read") and c.get("eligible"):
        fail("escrow belum terbaca sama sekali — cek error di atas")
    # Hangatkan cache rentang "Bulan" (30 hari, sama dengan filter dashboard) supaya tab langsung cepat.
    to = datetime.date.today()
    warm = f"/api/affiliate/summary?from={to - datetime.timedelta(days=29)}&to={to}"
    print(f"\nMenghangatkan cache 30 hari ({warm}) ...")
    try:
        m = _get(warm, timeout=900)
        mt = m.get("total") or {}
        print(f"   30 hari: {mt.get('aff_orders')} pesanan affiliate | penjualan {rp(mt.get('aff_gmv'))} "
              f"| komisi {rp(mt.get('commission'))} | escrow {(m.get('coverage') or {}).get('escrow_read')} pesanan")
    except Exception as e:
        print(f"   (lewati: {e}) — cache 30 hari akan dibangun saat tab dibuka")
    print("\nVERIFY_OK")


def off(name):
    name = name[4:] if name.startswith("ext_") else name
    name = name[:-3] if name.endswith(".py") else name
    path = os.path.join(BASE, f"ext_{name}.py")
    if not os.path.exists(path):
        fail(f"ext_{name}.py tidak ada — modul memang sudah nonaktif")
    os.rename(path, f"{path}.off_{time.strftime('%Y%m%d_%H%M%S')}")
    print(f"ext_{name}.py dinonaktifkan — lanjut: sudo systemctl restart mpqukis-backend")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--verify"]:
        verify(args[1] if len(args) > 1 else None)
    elif args[:1] == ["--off"] and len(args) > 1:
        off(args[1])
    else:
        install()
