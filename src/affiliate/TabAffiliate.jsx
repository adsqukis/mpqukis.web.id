import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Upload, RefreshCw, ChevronDown, Trash2 } from "lucide-react";

import { Card, Badge, InfoNote, MetricTile } from "../shared/ui.jsx";
import { RangeCalendar } from "../shared/ui.jsx";
import { fmtDmyDash, isoDaysAgo, fmtRp, fmtNum } from "../shared/format.js";
import {
  METRICS, AFFILIATE_CHANNELS, ORDER_TYPES, PERIODS,
  formatMetric, computeDelta, fetchAffiliateMetrics,
  parseAffiliateCsv, snapshotFromCsvRows, demoSnapshot,
} from "./model.js";

const LS = {
  orderType: "mp_aff_ordertype",
  period: "mp_aff_period",
  channel: "mp_aff_channel",
  source: "mp_aff_source",
  metric: "mp_aff_metric",
  csv: "mp_aff_csv",
};

const readLS = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : v;
  } catch { return fallback; }
};
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* kuota penuh / mode privat */ } };

const SOURCES = [
  { key: "auto", label: "Otomatis" },
  { key: "live", label: "Live API" },
  { key: "csv", label: "File CSV" },
  { key: "demo", label: "Contoh" },
];

// Label pemilih bergaya Seller Centre: judul kecil di kiri, nilai tebal, chevron.
function SelectPill({ label, value, onChange, options, mono = false }) {
  return (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 8, background: "#fff",
      border: "1px solid #E4E4E8", borderRadius: 10, padding: "6px 10px 6px 12px",
      fontFamily: "Inter, sans-serif", cursor: "pointer",
    }}>
      <span style={{ fontSize: 12, color: "#8A8A82", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
            border: "none", background: "transparent", outline: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: 600, color: "#17171A",
            fontFamily: mono ? "'JetBrains Mono', monospace" : "Inter, sans-serif",
            paddingRight: 18,
          }}
        >
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} color="#8A8A82" style={{ position: "absolute", right: 0, pointerEvents: "none" }} />
      </span>
    </label>
  );
}

// Keterangan sumber data. Jujur soal dari mana angka datang — ini dashboard
// bisnis, bukan mockup: kalau angkanya contoh, harus kelihatan contoh.
function SourceBanner({ resolved, error, csvMeta, onClearCsv }) {
  if (resolved === "demo") {
    return (
      <InfoNote>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <Badge text="CONTOH" color="#B8860B" />
          <span style={{ fontWeight: 600 }}>Angka di bawah ini bukan data toko kamu.</span>
        </div>
        Dipakai untuk menilai tata letak saja. Ganti ke <b>File CSV</b> (import hasil export
        Metrik Utama dari Seller Centre) atau <b>Live API</b> kalau endpoint AMS sudah tersedia
        di backend.
      </InfoNote>
    );
  }
  if (resolved === "csv") {
    return (
      <InfoNote tone="ok">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Badge text="CSV" color="#1E9E6F" />
          <span>
            Dari <b>{csvMeta?.name || "file import"}</b> — {fmtNum(csvMeta?.rowCount || 0)} baris,
            {" "}{csvMeta?.dateFrom ? `${fmtDmyDash(csvMeta.dateFrom)} s/d ${fmtDmyDash(csvMeta.dateTo)}` : "tanpa kolom tanggal"}.
          </span>
          <button onClick={onClearCsv} style={{
            display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto",
            border: "1px solid #C3E7D6", background: "#fff", color: "#1B6B4E",
            borderRadius: 8, padding: "4px 9px", fontSize: 11.5, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}><Trash2 size={12} /> Hapus</button>
        </div>
      </InfoNote>
    );
  }
  if (resolved === "live") {
    return (
      <InfoNote tone="info">
        <Badge text="LIVE" color="#2E6BE0" /> <span style={{ marginLeft: 8 }}>
          Ditarik langsung dari <code>api.qukis.id/api/affiliate/metrics</code>.
        </span>
      </InfoNote>
    );
  }
  // Tidak ada sumber yang berhasil.
  return (
    <InfoNote>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Belum ada data affiliate yang bisa ditampilkan.</div>
      Metrik Utama berasal dari <b>Affiliate Marketing Solution</b> di Seller Centre. Modul itu
      belum punya endpoint di Shopee Open Platform, jadi partner key toko saja tidak cukup —
      backend perlu menyediakan <code>/api/affiliate/metrics</code> lebih dulu.
      {error ? <div style={{ marginTop: 4, opacity: .85 }}>Status percobaan live: {error}</div> : null}
      <div style={{ marginTop: 6 }}>
        Jalan tercepat sekarang: <b>Import CSV</b> hasil export dari halaman Metrik Utama.
      </div>
    </InfoNote>
  );
}

export default function TabAffiliate() {
  const [orderType, setOrderType] = useState(() => readLS(LS.orderType, "confirmed"));
  const [period, setPeriod] = useState(() => readLS(LS.period, "day"));
  const [channel, setChannel] = useState(() => readLS(LS.channel, "all"));
  const [source, setSource] = useState(() => readLS(LS.source, "auto"));
  const [metricKey, setMetricKey] = useState(() => readLS(LS.metric, "sales"));

  // Data AMS selalu tertinggal beberapa jam; default ke kemarin seperti Seller Centre.
  const [date, setDate] = useState(() => isoDaysAgo(1));
  const [calOpen, setCalOpen] = useState(false);

  const [csv, setCsv] = useState(() => {
    try {
      const raw = localStorage.getItem(LS.csv);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [csvError, setCsvError] = useState(null);

  const [live, setLive] = useState(null);
  const [liveErr, setLiveErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const fileRef = useRef(null);

  const periodDef = PERIODS.find((p) => p.key === period) || PERIODS[0];

  useEffect(() => writeLS(LS.orderType, orderType), [orderType]);
  useEffect(() => writeLS(LS.period, period), [period]);
  useEffect(() => writeLS(LS.channel, channel), [channel]);
  useEffect(() => writeLS(LS.source, source), [source]);
  useEffect(() => writeLS(LS.metric, metricKey), [metricKey]);

  // Tarik dari backend. Dicoba hanya kalau sumbernya "auto" atau "live" —
  // supaya memilih CSV/Contoh tidak menembak endpoint yang memang belum ada.
  useEffect(() => {
    if (source !== "auto" && source !== "live") { setLive(null); setLiveErr(null); return; }
    const ctrl = new AbortController();
    let alive = true;
    setBusy(true);
    setLiveErr(null);
    fetchAffiliateMetrics({ orderType, period, date, channel, signal: ctrl.signal })
      .then((d) => { if (alive) { setLive(d); setLiveErr(null); } })
      .catch((e) => {
        if (!alive || e.name === "AbortError") return;
        setLive(null);
        setLiveErr(e.status ? `HTTP ${e.status}` : (e.message || "gagal terhubung"));
      })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; ctrl.abort(); };
  }, [orderType, period, date, channel, source, tick]);

  // Snapshot dari CSV yang sudah di-import.
  const csvSnap = useMemo(() => {
    if (!csv || !csv.rows || !csv.rows.length) return null;
    return snapshotFromCsvRows(csv.rows, { date, channel, step: periodDef.step });
  }, [csv, date, channel, periodDef.step]);

  // Urutan pemilihan sumber.
  const resolved = (() => {
    if (source === "live") return live ? "live" : "none";
    if (source === "csv") return csvSnap && csvSnap.current ? "csv" : "none";
    if (source === "demo") return "demo";
    if (live) return "live";
    if (csvSnap && csvSnap.current) return "csv";
    return "none";
  })();

  const snap = (() => {
    if (resolved === "live") return live;
    if (resolved === "csv") return csvSnap;
    if (resolved === "demo") return demoSnapshot({ date, channel, step: periodDef.step });
    return null;
  })();

  const current = snap?.current || null;
  const previous = snap?.previous || null;
  const series = snap?.series || null;

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseAffiliateCsv(String(reader.result || ""));
      if (!parsed.rows.length) {
        setCsvError(parsed.warnings.join(" ") || "File tidak bisa dibaca.");
        return;
      }
      const dates = parsed.rows.map((r) => r.date).filter(Boolean).sort();
      const payload = {
        rows: parsed.rows,
        name: f.name,
        rowCount: parsed.rows.length,
        matched: parsed.matched,
        warnings: parsed.warnings,
        dateFrom: dates[0] || null,
        dateTo: dates[dates.length - 1] || null,
      };
      setCsv(payload);
      setSource("csv");
      // Lompat ke tanggal terakhir di file supaya langsung kelihatan isinya.
      if (payload.dateTo) setDate(payload.dateTo);
      try { localStorage.setItem(LS.csv, JSON.stringify(payload)); }
      catch { setCsvError("Data terbaca, tapi terlalu besar untuk disimpan di browser — hilang saat refresh."); }
    };
    reader.onerror = () => setCsvError("Gagal membaca file.");
    reader.readAsText(f, "utf-8");
    e.target.value = "";
  };

  const clearCsv = () => {
    setCsv(null);
    setCsvError(null);
    if (source === "csv") setSource("auto");
    try { localStorage.removeItem(LS.csv); } catch { /* ignore */ }
  };

  const activeMetric = METRICS.find((m) => m.key === metricKey) || METRICS[0];
  const chartData = useMemo(() => {
    if (!series || series.length < 2) return null;
    return series
      .filter((r) => r && r.date && Number.isFinite(Number(r[metricKey])))
      .map((r) => ({ d: fmtDmyDash(r.date).slice(0, 5), v: Number(r[metricKey]) }));
  }, [series, metricKey]);

  const updatedLabel = snap?.updatedAt
    ? new Date(snap.updatedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })
    : resolved === "csv"
      ? `dari file, ${csv?.dateTo ? fmtDmyDash(csv.dateTo) : "-"}`
      : resolved === "demo" ? "—" : null;

  return (
    <>
      {/* ── Baris kontrol: tipe pesanan, periode, tanggal, sumber ───────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap", marginBottom: 14,
      }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 17, color: "#17171A" }}>
          Metrik Utama
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SelectPill label="Tipe Pesanan" value={orderType} onChange={setOrderType} options={ORDER_TYPES} />
          <SelectPill label="Periode Data" value={period} onChange={setPeriod} options={PERIODS} />

          <div style={{ position: "relative", display: "inline-block" }}>
            <button onClick={() => setCalOpen((v) => !v)} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#fff", border: "1px solid #E4E4E8", borderRadius: 10,
              padding: "7px 12px", cursor: "pointer",
              fontSize: 12.5, fontWeight: 600, color: "#17171A",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {fmtDmyDash(date)}
              <span style={{ fontSize: 11, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>(GMT +07)</span>
              <ChevronDown size={13} color="#8A8A82" />
            </button>
            {calOpen && (
              <RangeCalendar
                from={date}
                to={date}
                maxDate={isoDaysAgo(0)}
                onApply={(f) => setDate(f)}
                onClose={() => setCalOpen(false)}
              />
            )}
          </div>

          <SelectPill label="Sumber" value={source} onChange={setSource} options={SOURCES} />

          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            title="Import CSV hasil export Metrik Utama dari Seller Centre"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#fff", border: "1px solid #E4E4E8", borderRadius: 10,
              padding: "7px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              color: "#5F6368", fontFamily: "Inter, sans-serif",
            }}>
            <Upload size={14} /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: "none" }} />

          <button
            onClick={() => setTick((t) => t + 1)}
            title="Tarik ulang dari backend"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "#fff", border: "1px solid #E4E4E8", borderRadius: 10,
              width: 34, height: 34, cursor: "pointer", color: "#5F6368",
            }}>
            <RefreshCw size={14} style={busy ? { animation: "mpspin 1s linear infinite" } : undefined} />
          </button>
        </div>
      </div>

      <style>{`@keyframes mpspin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Sub-tab kanal + waktu pembaruan ─────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap", marginBottom: 14,
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {AFFILIATE_CHANNELS.map((c) => {
            const on = channel === c.key;
            return (
              <button key={c.key} onClick={() => setChannel(c.key)} style={{
                padding: "8px 18px", borderRadius: 10, cursor: "pointer",
                background: on ? "linear-gradient(135deg,#7C5CBF,#5B7CFA)" : "#fff",
                color: on ? "#fff" : "#5F6368", fontSize: 13, fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                boxShadow: on ? "0 4px 12px rgba(124,92,191,.35)" : "0 1px 2px rgba(0,0,0,.05)",
                border: on ? "1px solid transparent" : "1px solid #E4E4E8",
              }}>{c.label}</button>
            );
          })}
        </div>
        {updatedLabel && (
          <span style={{ fontSize: 11.5, color: "#A0A0A8", fontFamily: "Inter, sans-serif" }}>
            Waktu Pembaruan Terakhir: {updatedLabel}
          </span>
        )}
      </div>

      <SourceBanner resolved={resolved} error={liveErr} csvMeta={csv} onClearCsv={clearCsv} />

      {csvError && (
        <InfoNote>
          <b>Import gagal.</b> {csvError}
        </InfoNote>
      )}
      {resolved === "csv" && csv?.warnings?.length > 0 && (
        <InfoNote>{csv.warnings.join(" ")}</InfoNote>
      )}
      {resolved === "csv" && csvSnap?.effectiveDate && csvSnap.effectiveDate !== date && (
        <InfoNote>
          Tanggal {fmtDmyDash(date)} tidak ada di file — yang ditampilkan {fmtDmyDash(csvSnap.effectiveDate)}.
        </InfoNote>
      )}

      {/* ── Delapan kartu metrik ────────────────────────────────────────────── */}
      <div className="mp-grid4" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18,
      }}>
        {METRICS.map((m) => (
          <MetricTile
            key={m.key}
            label={m.label}
            hint={m.hint}
            value={formatMetric(m.kind, current ? current[m.key] : null)}
            delta={current && previous ? computeDelta(current[m.key], previous[m.key]) : null}
            compareLabel={periodDef.compare}
            selected={metricKey === m.key}
            onClick={() => setMetricKey(m.key)}
            muted={!current}
          />
        ))}
      </div>

      {/* ── Grafik tren metrik terpilih ─────────────────────────────────────── */}
      {chartData && chartData.length >= 2 && (
        <Card
          title={`Tren ${activeMetric.label}`}
          subtitle={`${AFFILIATE_CHANNELS.find((c) => c.key === channel)?.label} · klik kartu di atas untuk ganti metrik`}
          right={resolved === "demo" ? <Badge text="CONTOH" color="#B8860B" /> : null}
        >
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="affGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CBF" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7C5CBF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF3" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#8A8A82" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8A8A82" }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v) => formatMetric(activeMetric.kind, v)}
                />
                <Tooltip
                  formatter={(v) => [
                    activeMetric.kind === "currency" ? fmtRp(v) : formatMetric(activeMetric.kind, v),
                    activeMetric.label,
                  ]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #ECECEF", fontSize: 12, fontFamily: "Inter, sans-serif" }}
                />
                <Area type="monotone" dataKey="v" stroke="#7C5CBF" strokeWidth={2} fill="url(#affGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </>
  );
}
