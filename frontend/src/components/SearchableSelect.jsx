import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Search } from "lucide-react";

/**
 * A searchable dropdown replacement for the native <select>.
 * options: [{ value, label }]
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  clearable = true,
  searchable = true,
  disabled = false,
  style,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Cut-off dropdown fix: an ancestor with `overflow: hidden` (or a short viewport) can clip this
  // dropdown when it always opens downward — flip it to open upward instead when there isn't
  // enough room below the trigger. Measured once on open (trigger position doesn't move while a
  // dropdown from the same trigger is open), not continuously tracked on scroll/resize.
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      if (searchable) setTimeout(() => inputRef.current?.focus(), 0);
      const rect = ref.current?.getBoundingClientRect();
      const estimatedDropdownHeight = 280; // search bar + a handful of options, generous estimate
      setDropUp(!!rect && window.innerHeight - rect.bottom < estimatedDropdownHeight && rect.top > estimatedDropdownHeight);
    }
  }, [open, searchable]);

  function pick(val) { onChange(val); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        style={{ ...s.trigger, ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#1C1B18" : "#94A3B8", fontSize: "20px" }}>
          {selected ? selected.label : placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {clearable && value !== "" && value != null && (
            <span onMouseDown={e => { e.stopPropagation(); pick(""); }}
              style={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
              <X size={11} />
            </span>
          )}
          <ChevronDown size={12} color="#94A3B8" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {open && (
        <div style={dropUp ? s.dropdownUp : s.dropdown}>
          {searchable && (
            <div style={s.searchWrap}>
              <Search size={12} color="#94A3B8" />
              <input ref={inputRef} style={s.searchInput} placeholder={searchPlaceholder}
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          )}
          <div style={s.optionList}>
            {clearable && (
              <div style={{ ...s.option, color: (value === "" || value == null) ? "#3B82F6" : "#64748B", fontStyle: "italic" }}
                onMouseDown={() => pick("")}>
                {placeholder}{(value === "" || value == null) && <span style={{ fontSize: "17px", color: "#3B82F6" }}>✓</span>}
              </div>
            )}
            {filtered.map(o => {
              const active = String(o.value) === String(value);
              return (
                <div key={o.value}
                  style={{ ...s.option, color: active ? "#3B82F6" : "#1C1B18", background: active ? "#EFF6FF" : "transparent", fontWeight: active ? "700" : "500" }}
                  onMouseDown={() => pick(o.value)}>
                  {o.label}{active && <span style={{ fontSize: "17px", color: "#3B82F6" }}>✓</span>}
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: "19px", color: "#94A3B8", textAlign: "center" }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  trigger: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", width: "100%", padding: "8px 11px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "20px", background: "#FAFAFA", color: "#1C1B18", boxSizing: "border-box", outline: "none", fontFamily: "inherit", cursor: "pointer" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: "11px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" },
  dropdownUp: { position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: "11px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" },
  searchWrap: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderBottom: "1px solid #F1F5F9" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: "19px", color: "#1C1B18", background: "transparent", fontFamily: "inherit" },
  optionList: { maxHeight: "220px", overflowY: "auto" },
  option: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", fontSize: "19px", cursor: "pointer" },
};
