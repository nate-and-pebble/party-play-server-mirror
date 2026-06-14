/**
 * Display-name handling: sanitize, validate, lightly filter, and disambiguate.
 * Party-appropriate by default (PRIV/Content), but intentionally gentle — we
 * disambiguate rather than reject wherever we can (ID-04).
 */

const MAX_LEN = 16;
const MIN_LEN = 1;

// A deliberately small, family-setting blocklist. Real deployments would use a
// maintained list; this demonstrates the capability (ID-05).
const BLOCKLIST = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'faggot', 'retard',
  'dick', 'pussy', 'slut', 'whore', 'rape', 'nazi',
];

export interface NameCheck {
  ok: boolean;
  value: string;
  error?: string;
}

export function sanitizeName(raw: string): string {
  return (raw ?? '')
    .replace(/[\x00-\x1f\x7f]/g, "") // strip control chars
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
    .slice(0, MAX_LEN);
}

function isProfane(name: string): boolean {
  const flat = name.toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKLIST.some((bad) => flat.includes(bad));
}

export function validateName(raw: string): NameCheck {
  const value = sanitizeName(raw);
  if (value.length < MIN_LEN) {
    return { ok: false, value, error: 'Please enter a name.' };
  }
  if (value.length > MAX_LEN) {
    return { ok: false, value: value.slice(0, MAX_LEN), error: `Keep it under ${MAX_LEN} characters.` };
  }
  if (isProfane(value)) {
    return { ok: false, value, error: "Let's keep it party-friendly." };
  }
  return { ok: true, value };
}

/** If `name` collides with one already taken, append " 2", " 3", … (ID-04). */
export function disambiguateName(name: string, taken: Set<string>): string {
  const lc = (s: string) => s.toLowerCase();
  const takenLc = new Set([...taken].map(lc));
  if (!takenLc.has(lc(name))) return name;
  for (let n = 2; n < 100; n++) {
    const candidate = `${name} ${n}`.slice(0, MAX_LEN + 4);
    if (!takenLc.has(lc(candidate))) return candidate;
  }
  return `${name} ${Math.floor(Math.random() * 1000)}`;
}
