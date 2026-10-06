import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./collection-select.css";

// Keep focus on the combobox while its themed, viewport-bounded list is open.
export default function CollectionSelect({ label, value, options, onChange, disabled = false }) {
  const id = useId(), trigger = useRef(null), menu = useRef(null), typeahead = useRef({ text: "", at: 0 });
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const [open, setOpen] = useState(false), [active, setActive] = useState(selected), [position, setPosition] = useState(null);
  const choose = index => { if (options[index]) onChange?.(options[index].value); setOpen(false); trigger.current?.focus(); };
  const show = index => { setActive(index); setOpen(true); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current.getBoundingClientRect(), margin = 12, height = innerHeight;
      const rowHeight = window.matchMedia("(max-width: 700px)").matches ? 44 : 38;
      const width = Math.min(Math.max(rect.width, 180), innerWidth - margin * 2), desired = Math.min(280, options.length * rowHeight + 10);
      const below = height - rect.bottom - margin, above = rect.top - margin;
      const upwards = below < Math.min(desired, 160) && above > below, available = Math.max(48, upwards ? above - 5 : below - 5);
      const listHeight = Math.min(desired, available);
      const layer = trigger.current.closest('[data-modal-layer]');
      const zIndex = (Number(layer?.style.zIndex) || 150) + 10;
      setPosition({ left: Math.max(margin, Math.min(rect.left, innerWidth - width - margin)), top: upwards ? rect.top - listHeight - 5 : rect.bottom + 5, width, maxHeight: listHeight, zIndex });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => { if (open) menu.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [open, active, position]);
  const keyboard = event => {
    const key = event.key;
    if (key === "Tab") { setOpen(false); return; }
    if (key === "Escape") { if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } return; }
    if (["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (key === "Enter" || key === " ") { if (open) choose(active); else show(selected); }
      else if (key === "Home" || key === "End") show(key === "Home" ? 0 : options.length - 1);
      else if (!open) show(selected);
      else setActive(index => (index + (key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now(), text = (now - typeahead.current.at < 600 ? typeahead.current.text : "") + key.toLocaleLowerCase();
      typeahead.current = { text, at: now };
      const index = options.findIndex(option => option.label.toLocaleLowerCase().startsWith(text));
      if (index >= 0) { event.preventDefault(); show(index); }
    }
  };
  return <span className="collection-select">
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length} className="collection-select__trigger" data-value={value} onKeyDown={keyboard} onClick={() => open ? setOpen(false) : show(selected)}>
      <span>{options.find(option => option.value === value)?.label || "—"}</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
    </button>
    {open && position ? createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="collection-select__list" style={position} onMouseDown={event => { event.preventDefault(); event.stopPropagation(); }}>{options.map((option, index) => <div id={`${id}-${index}`} key={option.value} role="option" aria-selected={option.value === value} className={active === index ? "is-active" : ""} onPointerMove={() => setActive(index)} onClick={() => choose(index)}><span>{option.label}</span>{option.value === value ? <span aria-hidden="true">✓</span> : null}</div>)}</div>, trigger.current?.closest('[role="dialog"]') || document.body) : null}
  </span>;
}
