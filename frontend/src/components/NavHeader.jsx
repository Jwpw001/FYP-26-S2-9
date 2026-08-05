import { useRef, useState } from "react";
import { motion } from "framer-motion";

/* ─────────────────────────────────────────────
   Ported from a shadcn/Tailwind nav-pill block to
   this project's plain-JSX + inline-style convention,
   restyled to match the rest of the site (soft, no
   thick borders/uppercase/mix-blend tricks) — keeps
   the sliding hover-highlight mechanic underneath.
   Props:
   - items: string[] — tab labels (defaults to the
     original demo's Home/Pricing/About/Services/Contact)
   - onSelect: (label: string) => void — optional click handler
───────────────────────────────────────────── */

const DEFAULT_ITEMS = ["Home", "Pricing", "About", "Services", "Contact"];

function Tab({ children, setPosition, onClick }) {
  const ref = useRef(null);
  const [hov, setHov] = useState(false);
  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        setHov(true);
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft });
      }}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{ ...s.tab, color: hov ? "#3B82F6" : "#475569" }}
    >
      {children}
    </li>
  );
}

function Cursor({ position }) {
  return <motion.li animate={position} style={s.cursor} />;
}

export default function NavHeader({ items = DEFAULT_ITEMS, onSelect }) {
  const [position, setPosition] = useState({ left: 0, width: 0, opacity: 0 });

  return (
    <ul style={s.nav} onMouseLeave={() => setPosition(pv => ({ ...pv, opacity: 0 }))}>
      {items.map(label => (
        <Tab key={label} setPosition={setPosition} onClick={() => onSelect?.(label)}>
          {label}
        </Tab>
      ))}
      <Cursor position={position} />
    </ul>
  );
}

const s = {
  nav: {
    position: "relative", display: "flex", alignItems: "center", width: "fit-content",
    borderRadius: "100px", listStyle: "none", margin: 0, padding: "4px", gap: "2px",
  },
  tab: {
    position: "relative", zIndex: 10, cursor: "pointer",
    padding: "8px 18px", fontSize: "21px", fontWeight: "500",
    color: "#475569", whiteSpace: "nowrap", borderRadius: "100px",
    transition: "color 0.15s ease",
  },
  cursor: {
    position: "absolute", zIndex: 0, top: "4px", height: "calc(100% - 8px)",
    borderRadius: "100px", background: "#EFF6FF", listStyle: "none",
  },
};
