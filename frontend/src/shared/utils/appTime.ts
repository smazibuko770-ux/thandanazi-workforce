export function nowIso(): string {
  const override = localStorage.getItem('thandanazi.test.nowIso');
  if (import.meta.env.DEV && override) {
    const parsed = new Date(override);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
