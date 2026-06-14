import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import "./StaggeredMenu.css";

export default function StaggeredMenu({
  items = [],
  position = "right",
  colors = ["#0F172A", "#1E293B"],
  accentColor = "#3B82F6",
  menuButtonColor = "#0F172A",
  textColor = "#FFFFFF",
  isFixed = false,
}) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);
  const itemsRef = useRef([]);
  const footerRef = useRef(null);
  const btnRef = useRef(null);
  const tlRef = useRef(null);

  useEffect(() => {
    if (!overlayRef.current) return;

    const overlay = overlayRef.current;
    const menuItems = itemsRef.current.filter(Boolean);
    const footer = footerRef.current;

    if (open) {
      // Animate open
      tlRef.current = gsap.timeline();

      tlRef.current
        .set(overlay, { display: "flex" })
        .to(overlay, {
          clipPath: `circle(150% at ${position === "right" ? "100%" : "0%"} 0%)`,
          duration: 0.7,
          ease: "power4.inOut",
        })
        .to(
          menuItems,
          {
            y: 0,
            stagger: 0.08,
            duration: 0.6,
            ease: "power3.out",
          },
          "-=0.3"
        )
        .to(
          footer,
          { opacity: 1, duration: 0.4, ease: "power2.out" },
          "-=0.2"
        );
    } else {
      // Animate close
      tlRef.current = gsap.timeline();
      tlRef.current
        .to(menuItems, {
          y: "110%",
          stagger: { each: 0.05, from: "end" },
          duration: 0.4,
          ease: "power3.in",
        })
        .to(footer, { opacity: 0, duration: 0.2 }, "<")
        .to(
          overlay,
          {
            clipPath: `circle(0% at ${position === "right" ? "100%" : "0%"} 0%)`,
            duration: 0.6,
            ease: "power4.inOut",
          },
          "-=0.1"
        )
        .set(overlay, { display: "none" });
    }
  }, [open, position]);

  // Reset items y on unmount / re-open prep
  useEffect(() => {
    const menuItems = itemsRef.current.filter(Boolean);
    gsap.set(menuItems, { y: "110%" });
    gsap.set(overlayRef.current, { display: "none", clipPath: `circle(0% at ${position === "right" ? "100%" : "0%"} 0%)` });
  }, [position]);

  function handleItemClick(item) {
    setOpen(false);
    if (item.onClick) {
      setTimeout(() => item.onClick(), 400);
    } else if (item.link) {
      if (item.link.startsWith("#")) {
        setTimeout(() => {
          const id = item.link.slice(1);
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        }, 500);
      } else {
        setTimeout(() => { window.location.href = item.link; }, 400);
      }
    }
  }

  const wrapperClass = [
    "staggered-menu-wrapper",
    isFixed ? "fixed-wrapper" : "",
    open ? "menu-open" : "",
  ].filter(Boolean).join(" ");

  const toggleStyle = {
    top: isFixed ? "16px" : "16px",
  };

  return (
    <div className={wrapperClass}>
      {/* Toggle button */}
      <button
        ref={btnRef}
        className={`menu-toggle-btn position-${position}`}
        style={toggleStyle}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <div className="hamburger-icon">
          <span style={{
            background: open ? textColor : menuButtonColor,
            transform: open ? "rotate(45deg) translate(5px, 5px)" : "none",
            width: "24px",
          }}/>
          <span style={{
            background: open ? textColor : menuButtonColor,
            opacity: open ? 0 : 1,
            width: "18px",
            alignSelf: position === "right" ? "flex-end" : "flex-start",
          }}/>
          <span style={{
            background: open ? textColor : menuButtonColor,
            transform: open ? "rotate(-45deg) translate(5px, -5px)" : "none",
            width: "24px",
          }}/>
        </div>
      </button>

      {/* Full overlay menu */}
      <div
        ref={overlayRef}
        className={`menu-overlay position-${position}`}
        style={{
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`,
          display: "none",
        }}
      >
        {/* Menu items */}
        <nav>
          {items.map((item, i) => (
            <div key={i} className="menu-item-container">
              <button
                ref={el => (itemsRef.current[i] = el)}
                className="menu-item-link"
                style={{ color: textColor }}
                onClick={() => handleItemClick(item)}
                aria-label={item.ariaLabel || item.label}
              >
                <span style={{ display: "inline-block" }}>
                  <span style={{
                    display: "inline-block",
                    marginRight: "12px",
                    color: accentColor,
                    fontSize: "0.4em",
                    verticalAlign: "middle",
                    opacity: 0.7,
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </span>
                <span style={{
                  position: "absolute",
                  bottom: "6px",
                  left: 0,
                  height: "3px",
                  borderRadius: "2px",
                  background: accentColor,
                  transition: "width 0.3s ease",
                  width: 0,
                }} className="item-underline"/>
              </button>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div ref={footerRef} className="menu-footer">
          <div className="menu-footer-logo">
            <div style={{
              width: "30px", height: "30px", borderRadius: "8px",
              background: accentColor, color: "#fff",
              fontSize: "14px", fontWeight: "800",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>K</div>
            <span style={{ color: textColor, fontWeight: "800", fontSize: "16px", opacity: 0.9 }}>Krewby</span>
          </div>
          <div className="menu-footer-links">
            <a href="/get-started" style={{ color: textColor }}>Get Started</a>
            <a href="/join" style={{ color: textColor }}>Join as Worker</a>
          </div>
        </div>
      </div>
    </div>
  );
}
