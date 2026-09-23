import React, { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  lightenHex, fmtDmy, fmtPct, RANGE_PRESETS, RANGE_FILTERS, _BLN, _HR,
} from "./format.js";

// ─────────────────────────────────────────────────────────────────────────────
// Primitif UI bersama. Dipakai oleh semua tab; jangan taruh logika data di sini.
// ─────────────────────────────────────────────────────────────────────────────

export function StatCard({ icon: Icon, label, value, delta, deltaPositive = true, accent = "#7C5CBF", active = true, onClick = null }) {
  return (
    <div
      onClick={onClick}
      title={onClick ? (active ? "Klik untuk sembunyikan dari Total" : "Klik untuk tampilkan lagi") : undefined}
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${lightenHex(accent)} 100%)`,
        border: active ? "1px solid rgba(255,255,255,0.18)" : "1px dashed rgba(255,255,255,0.6)",
        borderRadius: 14,
        boxShadow: active ? `0 8px 20px ${accent}38` : "none",
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
        opacity: active ? 1 : 0.45,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity .15s ease, box-shadow .15s ease",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.88)", fontFamily: "Inter, sans-serif" }}>{label}</span>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.25)",
        }}>
          <Icon size={16} color="#fff" strokeWidth={2.3} />
        </div>
      </div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 23, fontWeight: 600,
        color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
      {delta && (
        <div style={{
          display: "flex", alignItems: "center", gap: 3, fontSize: 12,
          color: "rgba(255,255,255,0.92)", fontFamily: "Inter, sans-serif", fontWeight: 500,
        }}>
          {deltaPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta}
        </div>
      )}
    </div>
  );
}

export function Card({ title, subtitle, children, right }) {
  return (
    <div className="mp-card" style={{ background: "#fff", border: "1px solid #ECECEF", borderRadius: 14, boxShadow: "0 1px 2px rgba(23,23,26,0.03), 0 4px 14px rgba(23,23,26,0.04)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: "#17171A" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "#8A8A82", marginTop: 2, fontFamily: "Inter, sans-serif" }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Badge({ text, color }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, color, background: color + "17",
      padding: "3px 9px", borderRadius: 6, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

export function InfoNote({ children, tone = "warn" }) {
  const TONE = {
    warn: { color: "#8A6A3B", background: "#FFF6E6", border: "#F5E3BE" },
    info: { color: "#2A4B8D", background: "#EEF3FE", border: "#CFDCFA" },
    ok: { color: "#1B6B4E", background: "#ECF8F2", border: "#C3E7D6" },
  };
  const t = TONE[tone] || TONE.warn;
  return (
    <div style={{
      fontSize: 12, color: t.color, background: t.background, border: `1px solid ${t.border}`,
      borderRadius: 10, padding: "9px 12px", marginBottom: 16, fontFamily: "Inter, sans-serif", lineHeight: 1.5,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricTile — kartu KPI bersih ala "Metrik Utama" Seller Centre.
// Beda dengan StatCard (gradient penuh warna): tile ini putih, garis aksen tipis
// di atas saat terpilih, angka besar, lalu baris pembanding "vs <periode lalu>".
// Delta dirender netral: naik = hijau, turun = merah, nol = abu — tanpa menebak
// mana yang "bagus" untuk metrik yang arah baiknya tidak selalu naik.
// ─────────────────────────────────────────────────────────────────────────────
export function MetricTile({
  label, hint, value, delta, compareLabel = "vs Kemarin",
  selected = false, onClick = null, accent = "#7C5CBF", muted = false,
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const dir = !hasDelta ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const dColor = dir > 0 ? "#1E9E6F" : dir < 0 ? "#E5484D" : "#8A8A93";

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        position: "relative", background: "#fff",
        border: `1px solid ${selected ? accent + "66" : "#ECECEF"}`,
        borderRadius: 14, padding: "15px 17px 14px",
        boxShadow: selected
          ? `0 4px 16px ${accent}22`
          : "0 1px 2px rgba(23,23,26,0.03), 0 4px 14px rgba(23,23,26,0.035)",
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden", minWidth: 0,
        transition: "border-color .15s ease, box-shadow .15s ease",
      }}
    >
      {/* garis aksen atas — penanda metrik yang sedang dipilih untuk grafik */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: selected ? `linear-gradient(90deg, ${accent}, ${lightenHex(accent, 0.45)})` : "transparent",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
        <span style={{ fontSize: 12.5, color: "#6B6B73", fontFamily: "Inter, sans-serif" }}>{label}</span>
        {hint && (
          <span title={hint} style={{
            width: 13, height: 13, borderRadius: "50%", border: "1px solid #C8C8CE",
            color: "#9A9AA2", fontSize: 9, lineHeight: "11px", textAlign: "center",
            fontFamily: "Inter, sans-serif", cursor: "help", flexShrink: 0,
          }}>?</span>
        )}
      </div>

      <div style={{
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 25, fontWeight: 600,
        color: muted ? "#B4B4BC" : "#17171A", letterSpacing: "-0.015em", lineHeight: 1.1,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, marginTop: 9,
      }}>
        <span style={{ fontSize: 11.5, color: "#A0A0A8", fontFamily: "Inter, sans-serif" }}>{compareLabel}</span>
        {hasDelta ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 2,
            fontSize: 11.5, fontWeight: 600, color: dColor, fontFamily: "Inter, sans-serif",
          }}>
            <span style={{ fontSize: 8, lineHeight: 1 }}>{dir > 0 ? "▲" : dir < 0 ? "▼" : "●"}</span>
            {fmtPct(delta)}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: "#C4C4CC", fontFamily: "Inter, sans-serif" }}>—</span>
        )}
      </div>
    </div>
  );
}

export function RangeCalendar({ from, to, maxDate, onApply, onClose }) {
  const today = new Date();
  const base = from ? new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [selFrom, setSelFrom] = useState(from || null);
  const [selTo, setSelTo] = useState(to || null);
  const [fromTxt, setFromTxt] = useState(fmtDmy(from));
  const [toTxt, setToTxt] = useState(fmtDmy(to));

  const shift = (delta) => {
    let m = view.m + delta;
    let y = view.y;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setView({ y, m });
  };

  const pickDay = (y, m, d) => {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (maxDate && iso > maxDate) return;
    if (!selFrom || (selFrom && selTo)) {
      setSelFrom(iso);
      setSelTo(null);
      setFromTxt(fmtDmy(iso));
      setToTxt("");
    } else {
      const a = iso < selFrom ? iso : selFrom;
      const b = iso < selFrom ? selFrom : iso;
      setSelFrom(a);
      setSelTo(b);
      setFromTxt(fmtDmy(a));
      setToTxt(fmtDmy(b));
      // Range lengkap → langsung apply, tanpa klik Terapkan
      onApply(a, b);
      onClose();
    }
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  const renderMonth = (y, m) => {
    const dim = daysInMonth(y, m);
    // offset per-bulan: Senin=0 (getDay: 0=Min..6=Sab → (firstDow+6)%7)
    const firstDow = new Date(y, m, 1).getDay();
    const offset = (firstDow + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) {
      cells.push(<div key={`sp${i}`} style={{ width: 34, height: 30, margin: 1 }} />);
    }
    for (let d = 1; d <= dim; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      let bg = "#fff", color = "#17171A", radius = 0;
      const inRange = selFrom && selTo && iso >= selFrom && iso <= selTo;
      const isStart = selFrom === iso;
      const isEnd = selTo === iso;
      if (inRange) { bg = "#FDECEA"; }
      if (isStart || isEnd) { bg = "#7C5CBF"; color = "#fff"; radius = 8; }
      const disabled = maxDate && iso > maxDate;
      cells.push(
        <div key={iso} onClick={() => !disabled && pickDay(y, m, d)}
          style={{
            width: 34, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace", cursor: disabled ? "default" : "pointer",
            background: bg, color: disabled ? "#D8D2CE" : color, borderRadius: radius, margin: 1,
          }}>{d}</div>
      );
    }
    return (
      <div>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: "#17171A", fontFamily: "'Space Grotesk', sans-serif" }}>
          {_BLN[m]} {y}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,34px)", gap: 1, justifyContent: "center" }}>
          {_HR.map((h, i) => <div key={i} style={{ width: 34, textAlign: "center", fontSize: 10.5, color: "#8A8A82", paddingBottom: 4 }}>{h}</div>)}
          {cells}
        </div>
      </div>
    );
  };

  const view2 = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };

  const quickApply = (key) => {
    const fn = RANGE_PRESETS[key];
    if (!fn) return;
    const { from: f, to: t } = fn();
    if (maxDate && t > maxDate) return;
    setSelFrom(f);
    setSelTo(t);
    setFromTxt(fmtDmy(f));
    setToTxt(fmtDmy(t));
    onApply(f, t);
    onClose();
  };

  return (
    <div style={{
      position: "absolute", zIndex: 50, top: "calc(100% + 6px)", right: 0,
      background: "#fff", border: "1px solid #E4E4E8", borderRadius: 14, boxShadow: "0 10px 30px rgba(23,23,26,.12)",
      padding: "14px 16px", width: 700, maxWidth: "94vw",
    }}>
      <div style={{ display: "flex", gap: 14 }}>
        {/* Side panel preset — klik langsung terapkan (gaya Shopee) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 118, borderRight: "1px solid #ECECEF", paddingRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8A82", marginBottom: 4, fontFamily: "Inter, sans-serif", letterSpacing: 0.4 }}>PRESET</div>
          {RANGE_FILTERS.map((f) => {
            const pd = RANGE_PRESETS[f.key]();
            const active = from === pd.from && to === pd.to;
            return (
              <button key={f.key} onClick={() => quickApply(f.key)} style={{
                textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? "linear-gradient(135deg,#7C5CBF,#5B7CFA)" : "transparent",
                color: active ? "#fff" : "#3A3A40", fontSize: 12, fontWeight: active ? 700 : 500,
                fontFamily: "Inter, sans-serif",
              }}>{f.label}</button>
            );
          })}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => shift(-1)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#7C5CBF" }}>‹</button>
            <div style={{ display: "flex", gap: 24 }}>
              <div>{renderMonth(view.y, view.m)}</div>
              <div>{renderMonth(view2.y, view2.m)}</div>
            </div>
            <button onClick={() => shift(1)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#7C5CBF" }}>›</button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#8A8A82" }}>Dari</span>
            <input value={fromTxt} onChange={(e) => setFromTxt(e.target.value)} placeholder="dd/mm/yyyy"
              style={{ width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #E4E4E8", fontSize: 12, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} />
            <span style={{ fontSize: 12, color: "#8A8A82" }}>sampai</span>
            <input value={toTxt} onChange={(e) => setToTxt(e.target.value)} placeholder="dd/mm/yyyy"
              style={{ width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #E4E4E8", fontSize: 12, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} />
            <button onClick={onClose} style={{
              padding: "7px 12px", borderRadius: 9, border: "1px solid #E4E4E8", background: "#fff",
              color: "#6B7280", fontSize: 12.5, cursor: "pointer",
            }}>Batal</button>
          </div>
          <div style={{ fontSize: 11, color: "#8A8A82", textAlign: "center", marginTop: 8, fontFamily: "Inter, sans-serif" }}>
            Klik tanggal awal & akhir di kalender — rentang langsung diterapkan.
          </div>
        </div>
      </div>
    </div>
  );
}
