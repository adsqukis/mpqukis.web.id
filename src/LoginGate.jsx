import { useState } from "react";
import { Lock } from "lucide-react";

const AUTH_KEY = "mp_auth_ok";
const USERNAME = "mpqukis";
const PASSWORD = "mpqukis";

export default function LoginGate({ children }) {
  const [authed, setAuthed] = useState(() => {
    try { return localStorage.getItem(AUTH_KEY) === "1"; } catch { return false; }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(false);

  if (authed) return children;

  const submit = (e) => {
    e.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      try { localStorage.setItem(AUTH_KEY, "1"); } catch { /* ignore */ }
      setAuthed(true);
    } else {
      setErr(true);
      setPassword("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #17141F 0%, #2A1A0E 100%)", fontFamily: "Inter, sans-serif", color: "#F7F7FA",
    }}>
      <form onSubmit={submit} style={{
        background:"#15131C", borderRadius: 18, padding: "40px 36px", width: 340,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid #262430",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#FF6B1A,#FF8A3D)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
        }}>
          <Lock size={20} color="#fff" strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#F7F7FA", marginBottom: 4 }}>MP — Marketplace</div>
        <div style={{ fontSize: 13, color: "#9898A2", marginBottom: 24 }}>Masuk buat lihat dashboard.</div>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#9D9DA7", display: "block", marginBottom: 6 }}>Username</label>
        <input
          autoFocus
          value={username}
          onChange={(e) => { setUsername(e.target.value); setErr(false); }}
          style={{
            width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10,
            border: err ? "1px solid #E0574C" : "1px solid #292633", fontSize: 14, fontFamily: "Inter, sans-serif",
            marginBottom: 14, outline: "none",
          }}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#9D9DA7", display: "block", marginBottom: 6 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErr(false); }}
          style={{
            width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10,
            border: err ? "1px solid #E0574C" : "1px solid #292633", fontSize: 14, fontFamily: "Inter, sans-serif",
            marginBottom: err ? 10 : 20, outline: "none",
          }}
        />

        {err && (
          <div style={{ fontSize: 12.5, color: "#E0574C", marginBottom: 14, fontWeight: 600 }}>
            Username atau password salah.
          </div>
        )}

        <button type="submit" style={{
          width: "100%", padding: "11px 0", borderRadius: 10, border: "none", cursor: "pointer",
          background: "#FF6B1A", color: "#fff", fontSize: 14, fontWeight: 700,
          fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(255,107,26,.35)",
        }}>
          Masuk
        </button>
      </form>
    </div>
  );
}
