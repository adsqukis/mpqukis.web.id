# ext_ads_pacing.py — pacing iklan manual per produk per jam untuk satu tanggal (default hari ini).
#
# Dimuat app.py lewat blok "EXT MODULES" (ops/install_ext.py), setelah blok "ADS V2", jadi
# ads_campaigns() dari ads_v2.py (campaign + grup produk via item_id → SKU + budget) langsung kepakai.
# Route: /api/ads/pacing?date=YYYY-MM-DD
#
# Sumber per jam: ads.get_product_campaign_hourly_performance (maks 100 campaign per request).
# Iklan GMS tidak punya data per jam di API, jadi pacing hanya untuk iklan manual.

ADS_PACING_VERSION = '2026-09-27'
_PACE_FULL = 0.95          # biaya >= 95% budget → budget dianggap habis
_PACE_WIB = datetime.timezone(datetime.timedelta(hours=7))


def _pace_hourly(ids, date_iso):
    """campaign_id -> list metrics per jam. Batch gagal dipecah supaya satu id rusak tidak menghapus yang lain."""
    dmy = datetime.date.fromisoformat(date_iso).strftime('%d-%m-%Y')
    out, errors = {}, []

    def fetch(batch):
        r = shopee_get('/api/v2/ads/get_product_campaign_hourly_performance', {
            'performance_date': dmy, 'campaign_id_list': ','.join(str(x) for x in batch)})
        if r.get('error'):
            return f"{r.get('error')}: {str(r.get('message') or '')[:120]}"
        resp = r.get('response')
        for block in (resp if isinstance(resp, list) else [resp or {}]):
            for c in (block or {}).get('campaign_list') or []:
                out[c.get('campaign_id')] = c.get('metrics_list') or []
        return None

    def run(batch, depth=0):
        e = fetch(batch)
        if e and len(batch) > 1 and depth < 3:
            mid = len(batch) // 2
            run(batch[:mid], depth + 1)
            run(batch[mid:], depth + 1)
        elif e:
            errors.append(e)

    for i in range(0, len(ids), 100):
        run(ids[i:i + 100])
    return out, errors


def _pace_blank_hours():
    return [{'hour': h, 'expense': 0.0, 'direct_gmv': 0.0, 'clicks': 0} for h in range(24)]


def _pace_builder(date_iso):
    today = datetime.datetime.now(_PACE_WIB).date()
    is_today = date_iso == today.isoformat()
    data = ads_campaigns(date_iso, date_iso)
    camps = [c for c in data.get('campaigns') or [] if c.get('status') == 'ongoing' or (c.get('expense') or 0) > 0]
    hourly, errors = _pace_hourly([c['campaign_id'] for c in camps], date_iso) if camps else ({}, [])

    by = {}
    last_hour = -1
    for c in camps:
        hrs = _pace_blank_hours()
        for m in hourly.get(c['campaign_id']) or []:
            h = int(m.get('hour') or 0)
            if 0 <= h < 24:
                hrs[h]['expense'] += float(m.get('expense') or 0)
                hrs[h]['direct_gmv'] += float(m.get('direct_gmv') or 0)
                hrs[h]['clicks'] += int(m.get('clicks') or 0)
                if m.get('expense') or m.get('clicks'):
                    last_hour = max(last_hour, h)
        spent = sum(x['expense'] for x in hrs)
        budget = float(c.get('budget') or 0)
        out_hour, cum = None, 0.0
        if budget > 0:
            for x in hrs:
                cum += x['expense']
                if cum >= budget * _PACE_FULL:
                    out_hour = x['hour']
                    break
        g = by.setdefault(c.get('product_group') or 'Lainnya', {
            'hours': _pace_blank_hours(), 'budget': 0.0, 'spent_budgeted': 0.0, 'unlimited': 0, 'campaigns': []})
        for a, b in zip(g['hours'], hrs):
            a['expense'] += b['expense']
            a['direct_gmv'] += b['direct_gmv']
            a['clicks'] += b['clicks']
        if budget > 0:
            g['budget'] += budget
            g['spent_budgeted'] += spent   # % budget terpakai hanya dari campaign yang punya budget
        else:
            g['unlimited'] += 1
        dg = sum(x['direct_gmv'] for x in hrs)
        g['campaigns'].append({
            'campaign_id': c['campaign_id'], 'name': c.get('name'), 'status': c.get('status'),
            'placement': c.get('placement'), 'budget': round(budget), 'spent': round(spent),
            'pct_budget': round(spent / budget * 100, 1) if budget > 0 else None,
            'out_hour': out_hour, 'direct_gmv': round(dg), 'direct_roas': round(dg / spent, 2) if spent else None,
        })

    for g in by.values():
        cum = 0.0
        for x in g['hours']:
            cum += x['expense']
            x['cum_expense'] = round(cum)
            x['expense'] = round(x['expense'])
            x['direct_gmv'] = round(x['direct_gmv'])
        g['spent'] = round(cum)
        g['direct_gmv'] = sum(x['direct_gmv'] for x in g['hours'])
        g['direct_roas'] = round(g['direct_gmv'] / cum, 2) if cum else None
        g['budget'] = round(g['budget'])
        g['spent_budgeted'] = round(g['spent_budgeted'])
        g['pct_budget'] = round(g['spent_budgeted'] / g['budget'] * 100, 1) if g['budget'] else None
        g['capped'] = sum(1 for c in g['campaigns'] if c['out_hour'] is not None)
        g['campaigns'].sort(key=lambda c: -(c['spent'] or 0))

    return {
        'date': date_iso, 'version': ADS_PACING_VERSION, 'is_today': is_today,
        'hour_now': datetime.datetime.now(_PACE_WIB).hour if is_today else None,
        'last_hour_with_data': last_hour if last_hour >= 0 else None,
        'groups': (data.get('groups') or []) + ['Lainnya', 'Campuran'],
        'by_product': by, 'errors': errors[:5],
        'note': 'Per jam hanya iklan manual: iklan GMS tidak punya data per jam di API Shopee. '
                'Budget = setelan saat ini; dianggap habis kalau biaya hari itu sudah >= 95% budget.',
        'generated_at': int(time.time()),
    }


def _pace_route(qs):
    today = datetime.datetime.now(_PACE_WIB).date()
    try:
        d = datetime.date.fromisoformat(qs.get('date', [''])[0])
    except ValueError:
        d = today
    d = min(d, today)
    ttl = 300 if d == today else 3600
    return _orders_get('ads_pacing', f'pace1_{d.isoformat()}', lambda: _pace_builder(d.isoformat()), ttl=ttl)


EXT_ROUTES['/api/ads/pacing'] = _pace_route
