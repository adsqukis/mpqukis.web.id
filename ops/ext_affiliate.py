# ext_affiliate.py — data affiliate dari rincian escrow per pesanan (tanpa akses API AMS).
#
# Dimuat app.py lewat blok "EXT MODULES" (dipasang ops/install_ext.py): dijalankan dengan exec()
# di namespace app.py, jadi helper app.py (shopee_get, _load_raw_recs, _merge_live_recs,
# _orders_get, _load_side_module, ...) langsung kepakai. Route didaftarkan ke EXT_ROUTES, jadi
# otomatis kena cek X-MP-Key seperti route lain.
#
# Sumber: payment.get_escrow_detail_batch → order_ams_commission_fee & items[].ams_commission_fee.
# Komisi affiliate baru diisi Shopee di escrow SETELAH pesanan selesai (data 26/09: semua pesanan
# berkomisi berstatus COMPLETED, porsi affiliate turun ke 0% untuk pesanan yang belum selesai). Jadi:
# status terkini semua pesanan dicek lewat order.get_order_detail, escrow hanya ditarik untuk pesanan
# selesai (hasilnya final), dan semua metrik dihitung dari pesanan selesai. Pesanan yang belum selesai
# dilaporkan terpisah sebagai "belum final". Yang TIDAK ada tanpa AMS: nama kreator, klik, ROI per kreator.

AFF_VERSION = '2026-09-26.2'
_AFF_OTHER = 'Lainnya'
_AFF_CACHE_FILE = os.path.join(BASE_DIR, 'aff_cache.json')
_AFF_STALE = 6 * 3600          # status pesanan yang belum selesai/batal dicek ulang tiap 6 jam
_AFF_FINAL_DAYS = 30           # pesanan lebih tua dari ini tidak dicek ulang statusnya
_AFF_RECHECK = 24 * 3600       # escrow tanpa komisi yang ditarik < 24 jam setelah selesai dicek sekali lagi
_AFF_KEEP_DAYS = 120           # entri cache lebih tua dari ini dibuang
_AFF_MAX_DAYS = 31
_AFF_SKIP = {'Batal'}                          # status saat ditarik (label export) yang pasti tidak dihitung
_AFF_DONE = 'COMPLETED'
_AFF_CANCEL = {'CANCELLED', 'IN_CANCEL'}
_AFF_UNPAID = {'UNPAID'}
_AFF_WALLET_TYPES = {'AFFILIATE_ADS_SELLER_FEE', 'AFFILIATE_ADS_SELLER_FEE_REFUND', 'AFFILIATE_FEE_DEDUCT',
                     '455', '456', '460'}
_AFF_BATCH = '/api/v2/payment/get_escrow_detail_batch'
_aff_lock = threading.Lock()
_AFF_METHOD = {'batch': None}   # 'GET' / 'POST', diingat setelah pertama kali berhasil
_AFF_WIB = datetime.timezone(datetime.timedelta(hours=7))


def _aff_master():
    """(sku_upper -> grup, urutan grup) dari master SKU parse_export.py."""
    pe = _load_side_module('parse_export.py', 'pe')
    groups, order = {}, []
    for sku, info in pe.SKU_INFO.items():
        g = info.get('group')
        groups[str(sku).strip().upper()] = g
        if g not in order:
            order.append(g)
    return groups, order


def _aff_post(path, body):
    """POST ke Shopee dengan signature & refresh token yang sama seperti shopee_get."""
    if not _token_fresh():
        _refresh_access_token()

    def do():
        tok = load_token()
        ts = int(time.time())
        q = {'partner_id': PARTNER_ID, 'timestamp': ts, 'access_token': tok['access_token'],
             'shop_id': tok['shop_id'], 'sign': _sign_get(path, ts, tok['access_token'], tok['shop_id'])}
        req = urllib.request.Request(f"{API_HOST}{path}?{urllib.parse.urlencode(q)}", data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        return json.loads(urllib.request.urlopen(req, timeout=40).read())

    try:
        return do()
    except urllib.error.HTTPError as e:
        if e.code == 403 and _refresh_access_token():
            return do()
        if e.code == 429:
            time.sleep(15)
            return do()
        raise


def _aff_rows(r):
    resp = r.get('response')
    rows = resp if isinstance(resp, list) else ((resp or {}).get('escrow_detail_list') or (resp or {}).get('escrow_detail') or [])
    if isinstance(rows, dict):
        rows = [rows]
    return [(x.get('escrow_detail') if 'escrow_detail' in x else x) for x in rows if isinstance(x, dict)]


def _aff_escrow_call(batch):
    """Rincian escrow untuk <=50 order_sn. Metode (spec: GET, catatan backend: POST) dideteksi
    sekali: yang pertama kali mengembalikan data diingat."""
    methods = [_AFF_METHOD['batch']] if _AFF_METHOD['batch'] else ['GET', 'POST']
    last = None
    for m in methods:
        try:
            r = (shopee_get(_AFF_BATCH, {'order_sn_list': ','.join(batch)}) if m == 'GET'
                 else _aff_post(_AFF_BATCH, {'order_sn_list': list(batch)}))
        except Exception as e:  # noqa: BLE001 — metode salah biasanya berupa HTTPError
            last = f'{m}: {type(e).__name__} {str(e)[:120]}'
            continue
        if r.get('error'):
            last = f"{m}: {r.get('error')} {str(r.get('message') or '')[:120]}"
            continue
        rows = _aff_rows(r)
        if rows or _AFF_METHOD['batch']:
            _AFF_METHOD['batch'] = m
            return rows
        last = f'{m}: respons kosong'
    raise RuntimeError(f'get_escrow_detail_batch gagal ({last})')


def _aff_parse(ed):
    """Escrow → ringkas: komisi order + item [item_sku, model_sku, qty, harga setelah diskon, komisi]."""
    oi = ed.get('order_income') or {}
    items = [[(it.get('item_sku') or '').strip(), (it.get('model_sku') or '').strip(),
              int(it.get('quantity_purchased') or 0), float(it.get('discounted_price') or 0),
              float(it.get('ams_commission_fee') or 0)] for it in oi.get('items') or []]
    return {'ams': float(oi.get('order_ams_commission_fee') or 0), 'items': items}


def _aff_items(e, master):
    """Item dengan grup produk. Kalau komisi hanya ada di level order, dibagi proporsional harga item."""
    items = [[master.get(i.upper()) or master.get(m.upper()) or _AFF_OTHER, i or m, q, p, a]
             for i, m, q, p, a in e.get('items') or []]
    if e.get('ams', 0) > 0 and not any(x[4] > 0 for x in items) and items:
        tp = sum(x[3] for x in items)
        for x in items:
            x[4] = e['ams'] * (x[3] / tp if tp else 1 / len(items))
    return items


def _aff_fetch_escrow(batch, cache, now, errors, depth=0):
    try:
        rows = _aff_escrow_call(batch)
    except Exception as e:  # noqa: BLE001
        if len(batch) > 1 and depth < 2:
            mid = len(batch) // 2
            _aff_fetch_escrow(batch[:mid], cache, now, errors, depth + 1)
            _aff_fetch_escrow(batch[mid:], cache, now, errors, depth + 1)
        else:
            errors.append(str(e)[:200])
        return
    for ed in rows:
        sn = (ed or {}).get('order_sn')
        if sn:
            cache.setdefault(sn, {}).update({'e': _aff_parse(ed), 'ets': now, 'ec': now})


def _aff_has_ams(ent):
    e = (ent or {}).get('e') or {}
    return e.get('ams', 0) > 0 or any(x[4] > 0 for x in e.get('items') or [])


def _aff_refresh(eligible, orders):
    """Status terkini semua pesanan + escrow pesanan yang sudah selesai. Return (cache, errors)."""
    with _aff_lock:
        try:
            with open(_AFF_CACHE_FILE, encoding='utf-8') as f:
                cache = json.load(f)
        except Exception:
            cache = {}
        now = int(time.time())
        today = datetime.datetime.now(_AFF_WIB).date()
        final_before = (today - datetime.timedelta(days=_AFF_FINAL_DAYS)).isoformat()
        recheck_after = (today - datetime.timedelta(days=14)).isoformat()
        errors = []

        # Migrasi cache versi pertama: escrow yang sudah berkomisi pasti ditarik setelah pesanan selesai.
        for sn in eligible:
            ent = cache.get(sn)
            if ent and 'e' in ent and 'ec' not in ent and _aff_has_ams(ent):
                ent['ec'] = ent.get('ets', now)
                ent.setdefault('cs', ent['ec'])

        # 1) Status terkini (selesai & batal = final; yang lain dicek ulang tiap 6 jam, maks 30 hari).
        def need_status(sn):
            ent = cache.get(sn) or {}
            if 'st' not in ent:
                return True
            if ent['st'] == _AFF_DONE or ent['st'] in _AFF_CANCEL:
                return False
            return orders[sn]['date'] >= final_before and now - ent.get('sts', 0) > _AFF_STALE

        todo = [sn for sn in eligible if need_status(sn)]
        for i in range(0, len(todo), 50):
            batch = todo[i:i + 50]
            try:
                r = shopee_get('/api/v2/order/get_order_detail', {'order_sn_list': ','.join(batch)})
            except Exception as e:  # noqa: BLE001
                errors.append(f'get_order_detail: {type(e).__name__} {str(e)[:120]}')
                continue
            if r.get('error'):
                errors.append(f"get_order_detail: {r.get('error')} {str(r.get('message') or '')[:120]}")
                continue
            for o in ((r.get('response') or {}).get('order_list')) or []:
                sn = o.get('order_sn')
                if not sn:
                    continue
                ent = cache.setdefault(sn, {})
                ent.update({'st': o.get('order_status') or '', 'sts': now})
                if ent['st'] == _AFF_DONE and 'cs' not in ent:
                    ent['cs'] = now
            time.sleep(0.15)

        # 2) Escrow hanya untuk pesanan selesai. Escrow tanpa komisi yang ditarik < 24 jam setelah
        #    pesanan terlihat selesai dicek sekali lagi (jaga-jaga kalau pencatatan komisi telat).
        def need_escrow(sn):
            ent = cache.get(sn) or {}
            if ent.get('st') != _AFF_DONE:
                return False
            if 'ec' not in ent or 'e' not in ent:
                return True
            return (not _aff_has_ams(ent) and orders[sn]['date'] >= recheck_after
                    and ent['ec'] - ent.get('cs', 0) < _AFF_RECHECK and now - ent.get('cs', 0) >= _AFF_RECHECK)

        todo = [sn for sn in eligible if need_escrow(sn)]
        for i in range(0, len(todo), 50):
            _aff_fetch_escrow(todo[i:i + 50], cache, now, errors)
            time.sleep(0.15)

        for sn in eligible:
            if sn in cache:
                cache[sn]['d'] = orders[sn]['date']
        keep_after = (today - datetime.timedelta(days=_AFF_KEEP_DAYS)).isoformat()
        cache = {sn: v for sn, v in cache.items() if (v.get('d') or '9999') >= keep_after}
        try:
            with open(_AFF_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(cache, f, ensure_ascii=False)
        except Exception:
            pass
        return cache, errors


def _aff_wallet(from_iso, to_iso):
    """Potongan biaya affiliate lewat saldo penjual (di luar escrow). Cuma transaksi MONEY_OUT yang
    ditarik: transaksi masuk didominasi escrow per pesanan, jadi terlalu banyak halaman."""
    start = datetime.datetime.fromisoformat(from_iso).replace(tzinfo=_AFF_WIB)
    end = datetime.datetime.fromisoformat(to_iso).replace(tzinfo=_AFF_WIB) + datetime.timedelta(days=1)
    seen, rows, by_type = set(), [], Counter()
    cur = start
    while cur < end:
        nxt = min(end, cur + datetime.timedelta(days=14))   # API: maks 15 hari per request
        page_no, offset_mode = 0, None
        for _ in range(40):
            r = shopee_get('/api/v2/payment/get_wallet_transaction_list', {
                'page_no': page_no, 'page_size': 100, 'money_flow': 'MONEY_OUT',
                'create_time_from': int(cur.timestamp()), 'create_time_to': int(nxt.timestamp()) - 1,
            })
            if r.get('error'):
                return {'available': False, 'note': f"Transaksi saldo gagal ditarik ({r.get('error')})."}
            resp = r.get('response') or {}
            tl = resp.get('transaction_list') or []
            fresh = 0
            for t in tl:
                key = (t.get('create_time'), str(t.get('transaction_type')), t.get('amount'), t.get('order_sn'), t.get('status'))
                if key in seen:
                    continue
                seen.add(key)
                fresh += 1
                tt = key[1]
                if tt in _AFF_WALLET_TYPES or 'AFFILIATE' in tt.upper():
                    by_type[tt] += float(t.get('amount') or 0)
                    rows.append({'type': tt, 'title': t.get('txn_title') or '', 'amount': float(t.get('amount') or 0),
                                 'time': t.get('create_time'), 'order_sn': t.get('order_sn') or '', 'status': t.get('status')})
            if not resp.get('more') or not tl or not fresh:
                break
            # Spec menyebut page_no sebagai "starting entry": kalau halaman ke-2 kebanyakan duplikat,
            # berarti page_no = offset, bukan nomor halaman.
            if page_no == 1 and offset_mode is None:
                offset_mode = fresh < len(tl) / 2
            page_no += len(tl) if offset_mode else 1
        cur = nxt
    rows.sort(key=lambda x: -(x['time'] or 0))
    return {'available': True, 'total': round(sum(x['amount'] for x in rows)), 'count': len(rows),
            'by_type': {k: round(v) for k, v in by_type.items()}, 'items': rows[:50]}


def _aff_blank():
    return {'orders': 0, 'gmv': 0.0, 'aff_orders': 0, 'aff_qty': 0, 'aff_gmv': 0.0, 'commission': 0.0}


def _aff_ratios(m):
    m['rate'] = round(m['commission'] / m['aff_gmv'] * 100, 2) if m['aff_gmv'] else None
    m['share_gmv'] = round(m['aff_gmv'] / m['gmv'] * 100, 2) if m['gmv'] else None
    m['share_orders'] = round(m['aff_orders'] / m['orders'] * 100, 2) if m['orders'] else None
    for k in ('gmv', 'aff_gmv', 'commission'):
        m[k] = round(m[k])
    return m


def _aff_builder(from_iso, to_iso):
    recs, _ = _load_raw_recs(from_iso, to_iso)
    recs, live_days = _merge_live_recs(recs, from_iso, to_iso)
    orders = {}
    for r in recs or []:
        sn = str(r.get('order') or '').strip()
        if sn and sn not in orders:
            orders[sn] = {'date': r.get('tanggal') or '', 'status': r.get('status') or ''}
    eligible = sorted(sn for sn, o in orders.items() if o['status'] not in _AFF_SKIP)
    cache, errors = _aff_refresh(eligible, orders) if eligible else ({}, [])
    master, group_order = _aff_master()

    total, by, daily, recent = _aff_blank(), {g: _aff_blank() for g in group_order + [_AFF_OTHER]}, {}, []
    cnt = Counter()
    for sn in eligible:
        ent = cache.get(sn) or {}
        st, d = ent.get('st'), orders[sn]['date']
        day = daily.setdefault(d, dict(_aff_blank(), date=d, pending=0))
        if st in _AFF_CANCEL:
            cnt['cancelled'] += 1
            continue
        if st in _AFF_UNPAID:
            cnt['unpaid'] += 1
            continue
        if st != _AFF_DONE or 'e' not in ent:
            # belum selesai, status gagal dicek, atau selesai tapi escrow gagal ditarik → belum final
            if st == _AFF_DONE:
                cnt['escrow_missing'] += 1
            elif st:
                cnt['pending'] += 1
            else:
                cnt['unknown'] += 1
            day['pending'] += 1
            continue
        cnt['completed'] += 1
        items = _aff_items(ent['e'], master)
        is_aff = any(x[4] > 0 for x in items)
        in_order, aff_groups = set(), set()
        for g, sku, qty, price, ams in items:
            b = by.setdefault(g, _aff_blank())
            for acc in (b, total, day):
                acc['gmv'] += price
            in_order.add(g)
            if ams > 0:
                aff_groups.add(g)
                for acc in (b, total, day):
                    acc['aff_qty'] += qty
                    acc['aff_gmv'] += price
                    acc['commission'] += ams
        for g in in_order:
            by[g]['orders'] += 1
        for g in aff_groups:
            by[g]['aff_orders'] += 1
        total['orders'] += 1
        day['orders'] += 1
        if is_aff:
            total['aff_orders'] += 1
            day['aff_orders'] += 1
            recent.append({
                'order_sn': sn, 'date': d,
                'items': [{'group': g, 'sku': sku, 'qty': q, 'gmv': round(p), 'commission': round(a)}
                          for g, sku, q, p, a in items if a > 0],
                'gmv': round(sum(x[3] for x in items if x[4] > 0)), 'commission': round(sum(x[4] for x in items)),
            })
    recent.sort(key=lambda x: (x['date'], x['order_sn']), reverse=True)
    not_final = cnt['pending'] + cnt['unknown'] + cnt['escrow_missing']

    try:
        wallet = _orders_get('affiliate_wallet', f'affw1_{from_iso}_{to_iso}',
                             lambda: _aff_wallet(from_iso, to_iso), ttl=3600)
    except Exception as e:  # noqa: BLE001
        wallet = {'available': False, 'note': f'Transaksi saldo gagal ditarik ({type(e).__name__}).'}

    return {
        'from': from_iso, 'to': to_iso, 'version': AFF_VERSION,
        'coverage': {
            'orders_in_range': len(orders), 'checked': len(eligible),
            'completed': cnt['completed'], 'not_final': not_final, 'pending': cnt['pending'],
            'unknown': cnt['unknown'], 'escrow_missing': cnt['escrow_missing'],
            'cancelled': cnt['cancelled'], 'unpaid': cnt['unpaid'],
            'completion': round(cnt['completed'] / (cnt['completed'] + not_final) * 100, 1)
                          if cnt['completed'] + not_final else None,
            'live_days': live_days, 'method': _AFF_METHOD['batch'], 'errors': errors[:5],
        },
        'total': _aff_ratios(total),
        'groups': group_order + [_AFF_OTHER],
        'by_product': {g: _aff_ratios(b) for g, b in by.items()},
        'daily': [_aff_ratios(daily[k]) for k in sorted(daily)],
        'recent': recent[:50],
        'wallet': wallet,
        'ams': {'available': False,
                'note': 'Nama kreator, klik, dan ROI per kreator hanya ada di API AMS (butuh app kategori '
                        '"Affiliate Marketing Solution Management").'},
        'generated_at': int(time.time()),
        'source': 'order.get_order_detail (status terkini) + payment.get_escrow_detail_batch (komisi per '
                  'pesanan/item, hanya pesanan selesai) + payment.get_wallet_transaction_list (biaya affiliate lewat saldo)',
    }


def _aff_range(qs):
    today = datetime.datetime.now(_AFF_WIB).date()
    try:
        to_d = datetime.date.fromisoformat(qs.get('to', [''])[0])
    except ValueError:
        to_d = today
    try:
        from_d = datetime.date.fromisoformat(qs.get('from', [''])[0])
    except ValueError:
        from_d = to_d - datetime.timedelta(days=6)
    to_d = min(to_d, today)
    if from_d > to_d:
        from_d = to_d
    if (to_d - from_d).days + 1 > _AFF_MAX_DAYS:
        from_d = to_d - datetime.timedelta(days=_AFF_MAX_DAYS - 1)
    return from_d.isoformat(), to_d.isoformat()


def affiliate_summary(from_iso, to_iso):
    key = f'aff2_{from_iso}_{to_iso}'
    return _orders_get('affiliate', key, lambda: _aff_builder(from_iso, to_iso), ttl=900)


EXT_ROUTES['/api/affiliate/summary'] = lambda qs: affiliate_summary(*_aff_range(qs))
