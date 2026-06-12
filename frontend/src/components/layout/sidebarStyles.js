if (typeof document !== "undefined" && !document.getElementById("sidebar-nav-styles")) {
  const style = document.createElement("style");
  style.id = "sidebar-nav-styles";
  style.textContent = `
    .sidebar-nav-item {
      position: relative;
    }
    .sidebar-nav-item::before {
      content: "";
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%) scaleY(0);
      width: 3px; height: 60%;
      background: #3B82F6;
      border-radius: 0 3px 3px 0;
      transition: transform 0.18s ease, opacity 0.18s ease;
      opacity: 0;
    }
    .sidebar-nav-item:hover:not(.sidebar-nav-active)::before {
      transform: translateY(-50%) scaleY(1);
      opacity: 0.7;
    }
    .sidebar-nav-item:hover:not(.sidebar-nav-active) {
      background: rgba(255,255,255,0.07) !important;
      color: rgba(255,255,255,0.9) !important;
    }
    .sidebar-nav-item:hover:not(.sidebar-nav-active) svg {
      color: rgba(255,255,255,0.9) !important;
    }
    .sidebar-nav-active {
      background: rgba(59,130,246,0.15) !important;
      color: #93C5FD !important;
    }
    .sidebar-nav-active::before {
      content: "";
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%) scaleY(1);
      width: 3px; height: 60%;
      background: #3B82F6;
      border-radius: 0 3px 3px 0;
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}
