const ACRONYMS = new Set(["ID", "HR", "POS", "CEO", "CFO", "CTO", "HQ", "IT", "PR", "SG"]);

export function toTitleCase(str) {
  if (!str) return str;
  return str
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
