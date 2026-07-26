const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function colorFor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/**
 * Renders a circular avatar: shows the image when avatar_url is available,
 * falls back to a coloured letter-initial circle otherwise.
 *
 * Props:
 *   name       – display name (used for initials + fallback colour)
 *   avatar_url – path like "/avatars/default.png" (optional)
 *   size       – px number (default 40)
 *   fontSize   – px number for the initials text (default size/2.5)
 *   style      – extra style overrides on the outer element
 */
export default function UserAvatar({ name = "", avatar_url, size = 40, fontSize, style = {} }) {
  const fs = fontSize || Math.round(size / 2.5);
  const initials = name
    ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || name[0]?.toUpperCase() || "?"
    : "?";

  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...style,
  };

  if (avatar_url) {
    return (
      <div style={{ ...base, background: "#14B8A6" }}>
        <img
          src={avatar_url}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement.style.background = colorFor(name);
            e.currentTarget.parentElement.style.color = "#FFF";
            e.currentTarget.parentElement.style.fontSize = `${fs}px`;
            e.currentTarget.parentElement.style.fontWeight = "700";
            e.currentTarget.parentElement.innerText = initials;
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...base, background: colorFor(name), color: "#FFF", fontSize: fs, fontWeight: "700" }}>
      {initials}
    </div>
  );
}
