import { useEffect, useRef, useState } from "react";
import { Sparkle, MousePointerClick } from "lucide-react";

// Layar bumper ala gambar referensi user: layar nyaris hitam + grid samar,
// sorot cahaya orange terang dari atas, wordmark "QUKIS MARKETPLACE" menyala
// di tengah, dan busur horizon planet besar bercahaya di bawah.
// Tunggu ±3 detik -> otomatis transisi ke dashboard; klik di mana saja
// (atau Enter/Spasi/Esc) untuk masuk lebih cepat.
const AUTO_ENTER_MS = 3200;

export default function Bumper() {
  const [phase, setPhase] = useState("show"); // show | leaving | gone
  const timerRef = useRef(null);

  const dismiss = () => {
    if (phase !== "show") return;
    setPhase("leaving");
    setTimeout(() => setPhase("gone"), 680);
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    timerRef.current = setTimeout(() => dismissRef.current(), AUTO_ENTER_MS);
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (phase === "gone") return null;
  const leaving = phase === "leaving";

  const sparkles = [
    { top: "22%", left: "18%", size: 13, delay: "0.9s" },
    { top: "30%", left: "82%", size: 11, delay: "1.3s" },
    { top: "64%", left: "12%", size: 10, delay: "1.7s" },
    { top: "58%", left: "88%", size: 14, delay: "1.1s" },
    { top: "16%", left: "64%", size: 9, delay: "2.0s" },
    { top: "74%", left: "76%", size: 9, delay: "1.5s" },
  ];

  return (
    <div
      onClick={dismiss}
      role="button"
      aria-label="Masuk ke dashboard"
      style={{
        position: "fixed", inset: 0, zIndex: 9999, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "#050303",
        backgroundImage:
          "linear-gradient(rgba(255,190,140,0.045) 1px, rgba(255,190,140,0) 1px), linear-gradient(90deg, rgba(255,190,140,0.045) 1px, rgba(255,190,140,0) 1px), radial-gradient(700px 420px at 108% -12%, rgba(255,110,26,0.13), rgba(255,110,26,0) 60%)",
        backgroundSize: "56px 56px, 56px 56px, 100% 100%",
        fontFamily: "Inter, sans-serif", color: "#F7F7FA", overflow: "hidden",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "scale(1.05)" : "scale(1)",
        transition: "opacity .65s ease, transform .65s ease",
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        @keyframes bumpWord { from { opacity: 0; transform: scale(.92); filter: blur(6px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
        @keyframes bumpFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bumpBeam { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bumpPlanet { from { opacity: 0; transform: translate(-50%, 46px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes bumpTwinkle { 0%, 100% { opacity: .15; transform: scale(.8) rotate(0deg); } 50% { opacity: .9; transform: scale(1.15) rotate(20deg); } }
        @keyframes bumpHint { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
        @keyframes bumpProgress { from { width: 0%; } to { width: 100%; } }
        @keyframes bumpRimPulse { 0%, 100% { opacity: .85; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .bump-anim { animation: none !important; } }
      `}</style>

      {/* brand kecil pojok kiri atas */}
      <div className="bump-anim" style={{
        position: "absolute", top: 22, left: 26, fontSize: 13, fontWeight: 600,
        color: "#B0A696", letterSpacing: ".2px", animation: "bumpFadeUp .8s .2s ease both", zIndex: 2,
      }}>mpqukis</div>

      {/* sumber cahaya terang di tepi atas */}
      <div className="bump-anim" style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 420, height: 150, borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(255,170,80,0.55), rgba(255,140,50,0) 65%)",
        filter: "blur(10px)", animation: "bumpBeam 1s .1s ease both", pointerEvents: "none",
      }} />
      {/* sorot cahaya dari atas tengah — lebih terang & jenuh */}
      <div className="bump-anim" style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 330, height: "54%", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
        background: "linear-gradient(180deg, rgba(255,150,55,0.52), rgba(255,130,45,0.16) 55%, rgba(255,130,45,0) 82%)",
        filter: "blur(7px)", animation: "bumpBeam 1.1s .15s ease both", pointerEvents: "none",
      }} />

      {/* sparkles betebaran */}
      {sparkles.map((sp, i) => (
        <Sparkle key={i} className="bump-anim" size={sp.size} color="#FFB25E" fill="#FFB25E" style={{
          position: "absolute", top: sp.top, left: sp.left, pointerEvents: "none", zIndex: 1,
          animation: `bumpTwinkle 2.8s ${sp.delay} ease-in-out infinite`,
        }} />
      ))}

      {/* horizon planet besar bercahaya di bawah */}
      <div className="bump-anim" style={{
        position: "absolute", left: "50%", bottom: 0, width: "170%", maxWidth: 2600, height: "36vh",
        transform: "translateX(-50%)", animation: "bumpPlanet 1.4s .45s cubic-bezier(.22,.8,.32,1) both",
        pointerEvents: "none",
      }}>
        {/* cahaya panas tepat di puncak busur */}
        <div style={{
          position: "absolute", left: "50%", top: "-4%", transform: "translateX(-50%)",
          width: "46%", height: 120, borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(255,170,80,0.5), rgba(255,140,50,0) 65%)",
          filter: "blur(12px)",
        }} />
        <svg width="100%" height="100%" viewBox="0 0 1600 340" preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id="bumpDome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#160B04" />
              <stop offset="55%" stopColor="#070302" />
              <stop offset="100%" stopColor="#050408" />
            </linearGradient>
          </defs>
          {/* isi kubah planet */}
          <path d="M0,340 L0,300 A1400,1400 0 0 1 1600,300 L1600,340 Z" fill="url(#bumpDome)" />
          {/* busur kedua, lebih tipis, di atas rim utama */}
          <path className="bump-anim" d="M0,282 A1400,1400 0 0 1 1600,282" fill="none" stroke="rgba(255,150,70,0.45)" strokeWidth="1.4"
            style={{ animation: "bumpRimPulse 3.4s ease-in-out infinite" }} />
          {/* rim utama menyala */}
          <path className="bump-anim" d="M0,300 A1400,1400 0 0 1 1600,300" fill="none" stroke="#FF8A3D" strokeWidth="2.6" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 -3px 14px rgba(255,140,50,0.95))", animation: "bumpRimPulse 3.4s ease-in-out infinite" }} />
          <path d="M0,300 A1400,1400 0 0 1 1600,300" fill="none" stroke="#FFE3C0" strokeWidth="0.9" strokeLinecap="round" opacity="0.85"
            style={{ filter: "drop-shadow(0 -1px 6px rgba(255,200,140,0.9))" }} />
        </svg>
      </div>

      {/* wordmark hero */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        padding: "0 24px", position: "relative", zIndex: 2, marginTop: "-6vh",
        opacity: leaving ? 0 : 1, transform: leaving ? "translateY(-16px)" : "translateY(0)",
        transition: "opacity .45s ease, transform .45s ease",
      }}>
        <div className="bump-anim" style={{
          display: "flex", alignItems: "center", gap: 14,
          animation: "bumpWord 1s .3s cubic-bezier(.22,.8,.32,1) both",
        }}>
          <Sparkle size={30} color="#FF8A3D" fill="#FF8A3D" style={{ filter: "drop-shadow(0 0 10px rgba(255,140,50,0.8))", flexShrink: 0 }} />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(34px, 5.4vw, 58px)", fontWeight: 700,
            letterSpacing: "0.005em", color: "#fff", lineHeight: 1.02, whiteSpace: "nowrap",
            textShadow: "0 0 34px rgba(255,140,50,0.35)",
          }}>QUKIS MARKETPLACE</span>
        </div>

        {/* nama toko diapit dua garis tipis */}
        <div className="bump-anim" style={{
          display: "flex", alignItems: "center", gap: 16, marginTop: 18,
          animation: "bumpFadeUp .8s .85s ease both",
        }}>
          <span style={{ display: "block", width: 56, height: 1, background: "linear-gradient(90deg, rgba(216,210,200,0), rgba(216,210,200,0.65))" }} />
          <span style={{ fontSize: 14.5, color: "#D8D2C8" }}>Generos Official Store</span>
          <span style={{ display: "block", width: 56, height: 1, background: "linear-gradient(90deg, rgba(216,210,200,0.65), rgba(216,210,200,0))" }} />
        </div>

        <div className="bump-anim" style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 40,
          fontSize: 11.5, fontWeight: 600, letterSpacing: "2.2px", textTransform: "uppercase", color: "#FFC79A",
          animation: "bumpFadeUp .8s 1.15s ease both, bumpHint 2.2s 2s ease-in-out infinite",
        }}>
          <MousePointerClick size={14} />
          Klik di mana saja untuk masuk
        </div>

        {/* penanda tunggu ±3 detik */}
        <div className="bump-anim" style={{
          width: 180, height: 3, borderRadius: 3, marginTop: 14, overflow: "hidden",
          background: "rgba(255,255,255,0.09)", animation: "bumpFadeUp .8s 1.25s ease both",
        }}>
          <div style={{
            height: "100%", borderRadius: 3,
            background: "linear-gradient(90deg, #FF6B1A, #FFB25E)",
            boxShadow: "0 0 10px rgba(255,140,50,0.7)",
            animation: `bumpProgress ${AUTO_ENTER_MS}ms linear both`,
          }} />
        </div>
      </div>
    </div>
  );
}
