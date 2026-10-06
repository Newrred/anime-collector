import { useId, useState } from "react";

export function ChannelSection({ title, children }) {
  return <section className="channel-section"><h2>{title}</h2>{children}</section>;
}
export function ChannelFacts({ rows }) {
  return <dl className="channel-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function TextChoices({ label, options, value, onChange }) {
  return <div className="channel-choices" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
export default function ChannelHeader({ base = "/", title, trail, locale = "ko", sections, actions, extended = false }) {
  const [expanded, setExpanded] = useState(false), id = useId();
  return <header className={`channel-header ${expanded ? "is-expanded" : ""} ${extended ? "has-facets" : ""}`}>
    <div className="channel-heading"><h1 aria-label={trail ? `${title} / ${trail}` : title}><a href={base}>MOEMOA</a><span>/</span>{title}{trail ? <><span>/</span>{trail}</> : null}</h1>{actions ? <div className="channel-heading-actions">{actions}</div> : null}</div>
    <div className="channel-metadata" id={id}>{sections}</div>
    <button type="button" className="channel-expand" aria-controls={id} aria-expanded={expanded} aria-label={locale === "ko" ? (expanded ? "정보 접기" : "정보와 탐색 펼치기") : (expanded ? "Collapse information" : "Expand information and controls")} onClick={() => setExpanded(!expanded)}>{expanded ? "⌃" : "⌄"}</button>
  </header>;
}
