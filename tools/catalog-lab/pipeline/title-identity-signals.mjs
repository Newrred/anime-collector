// Identity comparisons retain punctuation: ?, :, primes and integral signs can identify sequels.
export const identityTitleKey = (value) => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ');

export function seasonSignals(value) {
  const text = identityTitleKey(value);
  const signals = new Set();
  for (const match of text.matchAll(/(?:제\s*)?(\d{1,2})\s*기|season\s*(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+season/gu)) signals.add(`season:${Number(match[1] || match[2] || match[3])}`);
  for (const match of text.matchAll(/(?:part|cour)\s*(\d{1,2})|(\d{1,2})\s*쿨/gu)) signals.add(`part:${Number(match[1] || match[2])}`);
  if (text.includes('∫∫')) signals.add('symbol:double-integral');
  if (/(?:^|\s)(ii|iii|iv|vi|vii|viii|ix)(?:\s|$)/u.test(text)) signals.add(`roman:${text.match(/(?:^|\s)(ii|iii|iv|vi|vii|viii|ix)(?:\s|$)/u)[1]}`);
  return [...signals].sort();
}
