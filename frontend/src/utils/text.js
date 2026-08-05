// Normalizes free-text titles ("afternoon shift" -> "Afternoon Shift") to consistent
// Title Case so lists/rosters don't show mismatched casing between entries.
// Existing acronyms (e.g. "AML", "KYC") are left untouched instead of being mangled
// into "Aml"/"Kyc" — only mixed/lower-case words get re-cased.
export function toTitleCase(str) {
  return str.replace(/[A-Za-z']+/g, (word) => {
    if (word.length > 1 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
