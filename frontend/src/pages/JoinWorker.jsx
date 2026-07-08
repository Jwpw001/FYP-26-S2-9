import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import {
  CalendarDays, DollarSign, MapPin, Star, Bell, Shield, BarChart2, Handshake,
} from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("join-styles")) {
  const tag = document.createElement("style");
  tag.id = "join-styles";
  tag.textContent = `
    @keyframes jUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes jPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
    .jcta:hover { background:#7C3AED !important; transform:translateY(-2px); box-shadow:0 16px 40px rgba(124,58,237,0.4) !important; }
    .jcta { transition:all 0.2s ease !important; }
    .jcard:hover { border-color:#C4B5FD !important; transform:translateY(-3px); box-shadow:0 8px 28px rgba(109,40,217,0.1) !important; }
    .jcard { transition:all 0.2s ease !important; }
    .jstep:hover .jstep-num { background:#7C3AED !important; color:#fff !important; }
    .jstep-num { transition:all 0.2s ease !important; }
  `;
  document.head.appendChild(tag);
}

const BENEFITS = [
  { icon: CalendarDays, title: "Flexible scheduling",    desc: "No rosters. No fixed hours. Pick shifts that actually fit your life." },
  { icon: DollarSign, title: "Earn on your terms",      desc: "Work as much or as little as you want — every shift is your decision." },
  { icon: MapPin, title: "Multiple venues",          desc: "Cafés, restaurants, hotels, events. Grow your experience across the city." },
  { icon: Star, title: "Build your reputation",   desc: "Great ratings unlock premium placements and more opportunities." },
  { icon: Bell, title: "Instant notifications",   desc: "Know the moment a matching shift opens up near you." },
  { icon: Shield, title: "Vetted placements only",  desc: "Every outlet is verified by our team. You work somewhere safe and professional." },
  { icon: BarChart2, title: "Your own dashboard",      desc: "Track shifts, earnings, and performance — all in one place." },
  { icon: Handshake, title: "Real human support",      desc: "Our coordinators are available to help you from day one." },
];

const HOW = [
  { n: "1", title: "Submit your application", desc: "A short form — no CV needed. Our coordinator reviews every application personally, not an algorithm." },
  { n: "2", title: "Get approved",             desc: "We'll email you within 2–3 working days with your account activation." },
  { n: "3", title: "Set your availability",    desc: "Log in, mark when you're free, and our system finds you the right shifts." },
  { n: "4", title: "Start earning",            desc: "Accept the shifts you want. Show up. Get paid. Repeat on your own terms." },
];

const FAQ = [
  { q: "Is it free to join?",                  a: "Yes. Completely free — no fees, no subscriptions, no hidden charges. Ever." },
  { q: "Do I need F&B experience?",            a: "Not always. Some roles need specific skills; others are open to motivated newcomers." },
  { q: "How soon can I start?",                a: "Typically within 2–3 working days of applying, once your account is activated." },
  { q: "Can I turn down shifts?",              a: "Always. You only ever work shifts you consciously accept. No penalties, no pressure." },
  { q: "What happens after I apply?",          a: "Our coordinator personally reviews your submission and emails you the outcome in 2–3 working days." },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #EDE9FE", paddingBottom: open ? "20px" : "0" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", gap: "16px" }}>
        <span style={{ fontSize: "15px", fontWeight: "700", color: "#1E1B4B" }}>{q}</span>
        <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: open ? "#7C3AED" : "#EDE9FE", color: open ? "#fff" : "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "300", flexShrink: 0, transition: "all 0.2s", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && <p style={{ fontSize: "14px", color: "#6B7280", lineHeight: 1.8, margin: "0 0 4px" }}>{a}</p>}
    </div>
  );
}

export default function JoinWorker() {
  const goTo = useGoTo();

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA" }}>

      {/* ── Navbar ── */}
      <nav style={{ height: "68px", background: "#fff", borderBottom: "1px solid #EDE9FE", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", boxSizing: "border-box", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg,#7C3AED,#4F46E5)", color: "#fff", fontSize: "15px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center" }}>K</div>
          <span style={{ fontSize: "17px", fontWeight: "800", letterSpacing: "-0.02em", color: "#1E1B4B" }}>Krewby</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>Already a worker?</span>
          <button onClick={() => goTo("/login")}
            style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)", border: "none", color: "#fff", padding: "9px 22px", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
            Log in →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(160deg,#1E1B4B 0%,#312E81 50%,#4338CA 100%)", padding: "96px 64px 80px", position: "relative", overflow: "hidden", animation: "jUp 0.6s ease both" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-120px", right: "-80px", width: "500px", height: "500px", borderRadius: "50%", background: "rgba(124,58,237,0.25)", pointerEvents: "none" }}/>
        <div style={{ position: "absolute", bottom: "-100px", left: "30%", width: "350px", height: "350px", borderRadius: "50%", background: "rgba(99,102,241,0.15)", pointerEvents: "none" }}/>

        <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "100px", padding: "6px 18px 6px 12px", marginBottom: "32px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#A78BFA", animation: "jPulse 2s ease infinite" }}/>
            <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4B5FD" }}>Krewby Worker Pool — Now Accepting Applications</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "clamp(38px,5vw,64px)", fontWeight: "900", lineHeight: 1.05, letterSpacing: "-0.04em", color: "#F5F3FF", marginBottom: "22px" }}>
                The smarter way<br/>to work <span style={{ color: "#A78BFA" }}>F&amp;B.</span>
              </h1>
              <p style={{ fontSize: "17px", color: "#A5B4FC", lineHeight: 1.8, marginBottom: "40px" }}>
                Join the Krewby worker pool — get matched to cafés, restaurants, and F&amp;B venues on your own schedule. No fixed hours, no long-term contracts, no pressure.
              </p>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <button className="jcta" onClick={() => goTo("/join/apply")}
                  style={{ padding: "16px 36px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>
                  Apply now — it's free →
                </button>
                <span style={{ fontSize: "13px", color: "#7C83A0" }}>2–3 days to get approved</span>
              </div>
            </div>

            {/* Floating stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {[
                { val: "500+", label: "Monthly shifts",    bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)", val_c: "#C4B5FD" },
                { val: "4.8", label: "Worker rating",     bg: "rgba(99,102,241,0.18)",  border: "rgba(99,102,241,0.35)",  val_c: "#A5B4FC", showStar: true },
                { val: "100%", label: "Free to join",      bg: "rgba(99,102,241,0.18)",  border: "rgba(99,102,241,0.35)",  val_c: "#A5B4FC" },
                { val: "2–3",  label: "Days to approve",   bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)", val_c: "#C4B5FD" },
              ].map(s => (
                <div key={s.val} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "16px", padding: "28px 22px" }}>
                  <p style={{ fontSize: "32px", fontWeight: "900", color: s.val_c, letterSpacing: "-0.03em", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                    {s.val}{s.showStar && <Star size={22} fill={s.val_c} color={s.val_c} />}
                  </p>
                  <p style={{ fontSize: "12px", color: "#7C83A0", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ background: "#fff", padding: "80px 64px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#7C3AED", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Process</p>
          <h2 style={{ fontSize: "38px", fontWeight: "800", color: "#1E1B4B", letterSpacing: "-0.03em", marginBottom: "48px" }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "32px" }}>
            {HOW.map(step => (
              <div key={step.n} className="jstep" style={{ cursor: "default" }}>
                <div className="jstep-num" style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#EDE9FE", color: "#7C3AED", fontSize: "16px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>{step.n}</div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E1B4B", marginBottom: "10px", lineHeight: 1.35 }}>{step.title}</p>
                <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.75 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Benefits ── */}
      <div style={{ padding: "80px 64px", background: "#FAFAFA" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#7C3AED", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Benefits</p>
          <h2 style={{ fontSize: "38px", fontWeight: "800", color: "#1E1B4B", letterSpacing: "-0.03em", marginBottom: "40px" }}>Why join Krewby?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}>
            {BENEFITS.map(b => (
              <div key={b.title} className="jcard"
                style={{ background: "#fff", border: "1.5px solid #EDE9FE", borderRadius: "16px", padding: "24px" }}>
                <div style={{ marginBottom: "14px" }}><b.icon size={24} color="#7C3AED" /></div>
                <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E1B4B", marginBottom: "8px" }}>{b.title}</p>
                <p style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.75 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Testimonial ── */}
      <div style={{ background: "#fff", padding: "80px 64px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ background: "linear-gradient(135deg,#1E1B4B 0%,#312E81 100%)", borderRadius: "24px", padding: "56px 60px", display: "grid", gridTemplateColumns: "1fr 300px", gap: "60px", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "80px", color: "#4338CA", lineHeight: 0.8, marginBottom: "20px", fontFamily: "Georgia,serif" }}>"</div>
              <p style={{ fontSize: "21px", fontWeight: "600", color: "#E0E7FF", lineHeight: 1.65, marginBottom: "32px" }}>
                I pick up shifts at different cafés on weekends. The app is clean — I see what's available, accept what fits, and just show up. No confusion at all.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "linear-gradient(135deg,#7C3AED,#4F46E5)", color: "#fff", fontWeight: "900", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>P</div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#E0E7FF" }}>Priya N.</p>
                  <p style={{ fontSize: "13px", color: "#6366F1" }}>Krewby Worker · Singapore</p>
                  <div style={{ display: "flex", gap: "2px", marginTop: "5px" }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={13} fill="#FCD34D" color="#FCD34D" />)}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[["Shifts completed","47"],["Avg rating","4.9",true],["Venues worked","12"],["Months active","8"]].map(([l,v,showStar]) => (
                <div key={l} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "12px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#818CF8" }}>{l}</span>
                  <span style={{ fontSize: "19px", fontWeight: "800", color: "#E0E7FF", display: "flex", alignItems: "center", gap: "4px" }}>
                    {v}{showStar && <Star size={15} fill="#FCD34D" color="#FCD34D" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ background: "#FAFAFA", padding: "80px 64px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#7C3AED", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>FAQ</p>
          <h2 style={{ fontSize: "38px", fontWeight: "800", color: "#1E1B4B", letterSpacing: "-0.03em", marginBottom: "36px" }}>Questions?</h2>
          {FAQ.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#fff", padding: "0 64px 80px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#4338CA 100%)", borderRadius: "20px", padding: "64px", textAlign: "center" }}>
            <h2 style={{ fontSize: "38px", fontWeight: "800", color: "#fff", letterSpacing: "-0.03em", marginBottom: "14px" }}>Ready to join?</h2>
            <p style={{ fontSize: "15px", color: "#C4B5FD", lineHeight: 1.8, maxWidth: "420px", margin: "0 auto 36px" }}>
              Our coordinator personally reviews every application and will be in touch within 2–3 working days.
            </p>
            <button className="jcta" onClick={() => goTo("/join/apply")}
              style={{ padding: "17px 44px", background: "#fff", color: "#7C3AED", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "800", cursor: "pointer" }}>
              Apply now — it's free →
            </button>
            <p style={{ fontSize: "12px", color: "#7C83A0", marginTop: "18px" }}>No fees. No commitment. Reviewed personally by our team.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
