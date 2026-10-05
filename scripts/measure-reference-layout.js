// Read-only browser expression. Pipe this file into agent-browser eval --stdin.
(() => {
  const round = (n) => Math.round(n * 100) / 100;
  const measure = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { tag: el.tagName, selector: el.id ? `#${el.id}` : typeof el.className === 'string' ? el.className : '',
      text: (el.innerText || el.alt || el.getAttribute('aria-label') || '').trim().slice(0, 70),
      x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height),
      font: s.fontFamily, size: s.fontSize, line: s.lineHeight, weight: s.fontWeight,
      padding: s.padding, margin: s.margin, gap: s.gap, border: s.border,
      radius: s.borderRadius, shadow: s.boxShadow, color: s.color, background: s.backgroundColor };
  };
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight * 1.5 && r.bottom > 0; };
  const images = [...document.querySelectorAll('img')].filter(e => visible(e) && e.getBoundingClientRect().width > 100).slice(0, 12);
  return { url: location.href, capturedAt: new Date().toISOString(), viewport: [innerWidth, innerHeight], clientWidth: document.documentElement.clientWidth,
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 12).map(measure),
    images: images.map(e => ({ ...measure(e), ancestors: (() => { const list = []; let p = e.parentElement; for (let i = 0; p && i < 6; i++, p = p.parentElement) list.push(measure(p)); return list; })() })),
    controls: [...document.querySelectorAll('button,input,[role=tab]')].filter(visible).slice(0, 12).map(measure) };
})();
