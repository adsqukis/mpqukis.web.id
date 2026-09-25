# ads_v2.py — logic iklan v2 untuk backend mpqukis (~/shopee-backend).
#
# Dijalankan lewat exec() di namespace app.py (lihat baris "ADS V2" di app.py),
# jadi semua helper app.py (shopee_get, _orders_get, _load_side_module, ...)
# langsung kepakai, dan fungsi di bawah MENIMPA versi lama:
#   _ads_campaign_settings, _ads_campaigns_builder, ads_campaigns
#
# Perubahan dibanding v1:
# - Grup produk dari item_id_list campaign -> SKU listing -> master SKU
#   (parse_export.py), bukan tebakan dari nama campaign.
# - Iklan otomatis GMS ikut dihitung (datanya cuma ada di endpoint GMS,
#   tidak muncul di get_product_campaign_daily_performance).
# - Angka langsung (produk yang diiklankan) dan broad (produk apa pun di toko
#   dalam 7 hari setelah klik) dikirim terpisah.

ADS_V2_VERSION = '2026-09-25'
_ADS_OTHER = 'Lainnya'
_ADS_MIXED = 'Campuran'
_ADS_SUM_KEYS = ('expense', 'impressions', 'clicks', 'direct_orders', 'direct_gmv', 'broad_orders', 'broad_gmv')
_ADS_ITEM_CATALOG_FILE = os.path.join(BASE_DIR, 'ads_item_catalog.json')
_ADS_ITEM_CATALOG_TTL = 12 * 3600
_ads_item_catalog_lock = threading.Lock()


def _ads_sku_master():
    """(sku_upper -> grup, urutan grup) dari master SKU parse_export.py."""
    pe = _load_side_module('parse_export.py', 'pe')
    groups, order = {}, []
    for sku, info in pe.SKU_INFO.items():
        g = info.get('group')
        groups[str(sku).strip().upper()] = g
        if g not in order:
            order.append(g)
    return groups, order


def _ads_campaign_settings(campaign_ids):
    """Setting campaign (info 1 common, 2 manual bidding, 3 auto bidding). Batch 50."""
    out = []
    for i in range(0, len(campaign_ids), 50):
        batch = campaign_ids[i:i + 50]
        r = shopee_get('/api/v2/ads/get_product_level_campaign_setting_info', {
            'campaign_id_list': ','.join(str(x) for x in batch),
            'info_type_list': '1,2,3',
        })
        for c in ((r.get('response') or {}).get('campaign_list')) or []:
            ci = c.get('common_info') or {}
            kws = (c.get('manual_bidding_info') or {}).get('selected_keywords') or []
            out.append({
                'campaign_id': c.get('campaign_id'),
                'name': ci.get('ad_name'),
                'placement': ci.get('campaign_placement'),
                'status': ci.get('campaign_status'),
                'budget': ci.get('campaign_budget'),
                'ad_type': ci.get('ad_type'),
                'bidding_method': ci.get('bidding_method'),
                'item_id_list': ci.get('item_id_list') or [],
                'roas_target': (c.get('auto_bidding_info') or {}).get('roas_target'),
                'keyword_count': sum(1 for k in kws if (k.get('status') or 'normal') == 'normal'),
            })
    return out


def _ads_item_catalog(item_ids):
    """item_id -> {name, skus, group}. Disimpan di ads_item_catalog.json, di-refresh tiap 12 jam."""
    want = sorted({int(x) for x in item_ids if x})
    now = int(time.time())
    with _ads_item_catalog_lock:
        try:
            with open(_ADS_ITEM_CATALOG_FILE, encoding='utf-8') as f:
                cat = json.load(f)
        except Exception:
            cat = {}
        stale = [x for x in want if now - (cat.get(str(x)) or {}).get('ts', 0) > _ADS_ITEM_CATALOG_TTL]
        if stale:
            sku_group, _ = _ads_sku_master()
            for i in range(0, len(stale), 50):
                batch = stale[i:i + 50]
                try:
                    r = shopee_get('/api/v2/product/get_item_base_info',
                                   {'item_id_list': ','.join(str(x) for x in batch)})
                except Exception:
                    continue
                if r.get('error'):
                    continue
                seen = set()
                for it in ((r.get('response') or {}).get('item_list')) or []:
                    iid = it.get('item_id')
                    seen.add(iid)
                    skus = [(it.get('item_sku') or '').strip()]
                    models_ok = True
                    if it.get('has_model'):
                        try:
                            rm = shopee_get('/api/v2/product/get_model_list', {'item_id': iid})
                            models_ok = not rm.get('error')
                            skus += [(m.get('model_sku') or '').strip()
                                     for m in ((rm.get('response') or {}).get('model')) or []]
                        except Exception:
                            models_ok = False
                    skus = [s for s in skus if s]
                    gs = sorted({sku_group[s.upper()] for s in skus if s.upper() in sku_group})
                    cat[str(iid)] = {
                        'name': it.get('item_name') or '', 'skus': skus, 'status': it.get('item_status'),
                        'group': gs[0] if len(gs) == 1 else (_ADS_MIXED if gs else _ADS_OTHER),
                        # SKU varian gagal ditarik -> grup bisa salah; coba lagi 10 menit lagi, bukan 12 jam
                        'ts': now if models_ok else now - _ADS_ITEM_CATALOG_TTL + 600,
                    }
                for iid in batch:
                    if iid not in seen:
                        cat[str(iid)] = {'name': '(item tidak ditemukan)', 'skus': [], 'group': _ADS_OTHER, 'ts': now}
            try:
                with open(_ADS_ITEM_CATALOG_FILE, 'w', encoding='utf-8') as f:
                    json.dump(cat, f, ensure_ascii=False)
            except Exception:
                pass
        return {x: cat.get(str(x)) or {'name': '', 'skus': [], 'group': _ADS_OTHER} for x in want}


def _ads_post(path, body):
    """POST ke Shopee dengan signature & refresh token yang sama seperti shopee_get."""
    if not _token_fresh():
        _refresh_access_token()

    def do():
        tok = load_token()
        ts = int(time.time())
        q = {'partner_id': PARTNER_ID, 'timestamp': ts, 'access_token': tok['access_token'],
             'shop_id': tok['shop_id'], 'sign': _sign_get(path, ts, tok['access_token'], tok['shop_id'])}
        req = urllib.request.Request(f"{API_HOST}{path}?{urllib.parse.urlencode(q)}",
                                     data=json.dumps(body).encode(),
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


def _ads_gms_metrics(rep):
    exp = float(rep.get('expense') or 0)
    return {
        'expense': exp,
        'impressions': int(float(rep.get('impression') or 0)),
        'clicks': int(float(rep.get('clicks') or 0)),
        'direct_orders': int(float(rep.get('direct_order') or 0)),
        # Report GMS tidak mengirim direct_gmv; direct_roi = direct GMV / biaya.
        'direct_gmv': exp * float(rep.get('direct_roi') or 0),
        'broad_orders': int(float(rep.get('broad_order') or 0)),
        'broad_gmv': float(rep.get('broad_gmv') or 0),
    }


def _ads_add(acc, m):
    for k in _ADS_SUM_KEYS:
        acc[k] = acc.get(k, 0) + m.get(k, 0)
    return acc


def _ads_gms(from_iso, to_iso):
    """Iklan otomatis GMS: total campaign + per item. Shopee: maks 3 bulan per request,
    data paling lama 6 bulan ke belakang."""
    sd = datetime.date.fromisoformat(from_iso)
    ed = datetime.date.fromisoformat(to_iso)
    earliest = datetime.date.today() - datetime.timedelta(days=180)
    empty = {'available': False, 'campaign_id': None, 'report': None, 'items': []}
    if ed < earliest:
        return dict(empty, note='Data GMS dari Shopee cuma tersedia 6 bulan terakhir.')
    note = None
    if sd < earliest:
        sd = earliest
        note = f'Data GMS dari Shopee cuma tersedia sejak {earliest:%d/%m/%Y}.'
    report, items, cid = {}, {}, None
    cur = sd
    while cur <= ed:
        chunk_end = min(ed, cur + datetime.timedelta(days=89))
        body = {'start_date': cur.strftime('%d-%m-%Y'), 'end_date': chunk_end.strftime('%d-%m-%Y')}
        r = _ads_post('/api/v2/ads/get_gms_campaign_performance', body)
        if r.get('error'):
            code = str(r.get('error'))
            msg = ('Toko belum di-whitelist Shopee untuk iklan GMS.' if 'not_whitelisted' in code
                   else f'Data GMS gagal ditarik ({code}).')
            return dict(empty, note=msg)
        resp = r.get('response') or {}
        cid = resp.get('campaign_id') or cid
        _ads_add(report, _ads_gms_metrics(resp.get('report') or {}))
        offset = 0
        for _ in range(20):
            ri = _ads_post('/api/v2/ads/get_gms_item_performance', dict(body, offset=offset, limit=100))
            if ri.get('error'):
                note = ((note + ' ') if note else '') + f"Rincian per item GMS gagal ditarik ({ri.get('error')})."
                break
            rr = ri.get('response') or {}
            rows = rr.get('result_list') or []
            for row in rows:
                if row.get('item_id'):
                    _ads_add(items.setdefault(row['item_id'], {}), _ads_gms_metrics(row.get('report') or {}))
            if not rr.get('has_next_page') or not rows:
                break
            offset += len(rows)
        cur = chunk_end + datetime.timedelta(days=1)
    return {'available': True, 'campaign_id': cid or None, 'note': note, 'report': report,
            'items': [dict(m, item_id=iid) for iid, m in items.items()]}


def _ads_ratios(m):
    e, imp = m.get('expense') or 0, m.get('impressions') or 0
    m['ctr'] = round(m.get('clicks', 0) / imp * 100, 2) if imp else 0.0
    m['direct_roas'] = round(m.get('direct_gmv', 0) / e, 2) if e > 0 else None
    m['broad_roas'] = round(m.get('broad_gmv', 0) / e, 2) if e > 0 else None
    for k in ('expense', 'direct_gmv', 'broad_gmv'):
        m[k] = round(m.get(k, 0))
    return m


def _ads_campaigns_builder(from_iso, to_iso):
    cams = _ads_campaign_list()
    ids = [c.get('campaign_id') for c in cams if c.get('campaign_id')]
    type_map = {c.get('campaign_id'): c.get('ad_type') for c in cams}
    settings = _ads_campaign_settings(ids) if ids else []
    perf = _ads_campaign_perf_batch(ids, from_iso, to_iso) if ids else {}
    try:
        gms = _ads_gms(from_iso, to_iso)
    except Exception as e:
        gms = {'available': False, 'campaign_id': None, 'report': None, 'items': [],
               'note': f'Data GMS gagal ditarik ({type(e).__name__}).'}
    gms_cid = gms.get('campaign_id')

    item_ids = {x for s in settings for x in (s.get('item_id_list') or [])} | {i['item_id'] for i in gms['items']}
    try:
        catalog = _ads_item_catalog(item_ids)
    except Exception:
        catalog = {}

    def group_of(iids):
        gs = {(catalog.get(int(x)) or {}).get('group') or _ADS_OTHER for x in iids}
        if not gs:
            return _ADS_OTHER
        return next(iter(gs)) if len(gs) == 1 else _ADS_MIXED

    campaigns = []
    for s in settings:
        cid = s.get('campaign_id')
        if gms_cid and cid == gms_cid:
            continue  # campaign GMS dihitung dari endpoint GMS
        m = {k: 0 for k in _ADS_SUM_KEYS}
        for x in perf.get(cid, []):
            _ads_add(m, {
                'expense': float(x.get('expense') or 0), 'impressions': int(x.get('impression') or 0),
                'clicks': int(x.get('clicks') or 0),
                'direct_orders': int(x.get('direct_order') or 0), 'direct_gmv': float(x.get('direct_gmv') or 0),
                'broad_orders': int(x.get('broad_order') or 0), 'broad_gmv': float(x.get('broad_gmv') or 0),
            })
        iids = s.get('item_id_list') or []
        c = _ads_ratios(dict(m))
        c.update({
            'campaign_id': cid, 'name': s.get('name'), 'placement': s.get('placement'), 'status': s.get('status'),
            'budget': s.get('budget'), 'ad_type': s.get('ad_type') or type_map.get(cid),
            'bidding_method': s.get('bidding_method'), 'roas_target': s.get('roas_target'),
            'keyword_count': s.get('keyword_count'), 'item_id_list': iids, 'product_group': group_of(iids),
            'days_with_data': len(perf.get(cid, [])),
            # kompatibel dengan frontend lama (broad)
            'orders': c['broad_orders'], 'gmv': c['broad_gmv'], 'roas': c['broad_roas'],
        })
        campaigns.append(c)
    campaigns.sort(key=lambda x: (-(x['expense'] or 0), str(x.get('name') or '')))

    gms_items = []
    for it in gms['items']:
        info = catalog.get(int(it['item_id'])) or {}
        row = _ads_ratios(dict(it))
        row.update({'name': info.get('name') or '', 'product_group': info.get('group') or _ADS_OTHER})
        gms_items.append(row)
    gms_items.sort(key=lambda x: -(x['expense'] or 0))

    _, order = _ads_sku_master()
    by_product = {}
    for g in list(order) + [_ADS_OTHER, _ADS_MIXED]:
        by_product[g] = {'manual': dict({k: 0 for k in _ADS_SUM_KEYS}, active=0),
                         'gms': dict({k: 0 for k in _ADS_SUM_KEYS}, active=0)}
    for src, rows in (('manual', campaigns), ('gms', gms_items)):
        for r in rows:
            b = by_product.setdefault(r['product_group'], {
                'manual': dict({k: 0 for k in _ADS_SUM_KEYS}, active=0),
                'gms': dict({k: 0 for k in _ADS_SUM_KEYS}, active=0)})[src]
            _ads_add(b, r)
            b['active'] += 1 if r['expense'] else 0
    for g, b in by_product.items():
        total = _ads_add(_ads_add({k: 0 for k in _ADS_SUM_KEYS}, b['manual']), b['gms'])
        total['active'] = b['manual']['active'] + b['gms']['active']
        b['total'] = _ads_ratios(total)
        _ads_ratios(b['manual'])
        _ads_ratios(b['gms'])

    return {
        'from': from_iso, 'to': to_iso, 'version': ADS_V2_VERSION,
        'count': len(campaigns), 'campaigns': campaigns,
        'gms': {'available': gms['available'], 'campaign_id': gms_cid, 'note': gms.get('note'),
                'report': _ads_ratios(dict(gms['report'])) if gms.get('report') else None,
                'items': gms_items},
        'groups': list(order),
        'by_product': by_product,
        'generated_at': int(time.time()),
        'source': ('ads product-level campaign list/setting/daily performance + '
                   'get_gms_campaign_performance + get_gms_item_performance; grup via item_id -> SKU master'),
    }


def ads_campaigns(from_iso, to_iso):
    key = f'adsc2_{from_iso}_{to_iso}'
    return _orders_get('ads_campaigns', key, lambda: _ads_campaigns_builder(from_iso, to_iso), ttl=90)
