if (typeof document !== "undefined" && !document.getElementById("sidebar-nav-styles")) {
  const style = document.createElement("style");
  style.id = "sidebar-nav-styles";
  style.textContent = `
    .sidebar-nav-item {
      position: relative;
      transition: background 0.15s ease, color 0.15s ease !important;
    }
    .sidebar-nav-item svg {
      transition: transform 0.15s ease, color 0.15s ease;
      flex-shrink: 0;
    }
    .sidebar-nav-item::before {
      content: "";
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%) scaleY(0);
      width: 3px; height: 55%;
      background: linear-gradient(180deg, #818CF8, #6366F1);
      border-radius: 0 3px 3px 0;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s ease;
      opacity: 0;
    }
    .sidebar-nav-item:hover:not(.sidebar-nav-active)::before {
      transform: translateY(-50%) scaleY(1);
      opacity: 0.5;
    }
    .sidebar-nav-item:hover:not(.sidebar-nav-active) {
      background: rgba(255,255,255,0.08) !important;
      color: rgba(255,255,255,0.95) !important;
    }
    .sidebar-nav-item:hover:not(.sidebar-nav-active) svg {
      color: rgba(255,255,255,0.95) !important;
      transform: scale(1.08);
    }
    .sidebar-nav-active {
      background: rgba(99,102,241,0.18) !important;
      color: #A5B4FC !important;
    }
    .sidebar-nav-active svg {
      color: #A5B4FC !important;
    }
    .sidebar-nav-active::before {
      content: "";
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%) scaleY(1);
      width: 3px; height: 55%;
      background: linear-gradient(180deg, #818CF8, #6366F1);
      border-radius: 0 3px 3px 0;
      opacity: 1;
    }

    /* Smooth scrollbar in main content */
    .main-content-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(148,163,184,0.4) transparent;
    }
    .main-content-scroll::-webkit-scrollbar { width: 5px; }
    .main-content-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 10px; }
  `;
  document.head.appendChild(style);
}
