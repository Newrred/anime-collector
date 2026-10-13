export default function CollectionGroupTabs({ entries, selected, onSelect, locale, children, disabled = false }) {
  const ko = locale === "ko";
  return <nav className="collection-section-tabs" aria-label={ko ? "컬렉션 묶음" : "Collection groups"}>
    <button type="button" disabled={disabled} aria-pressed={selected === "all"} onClick={() => onSelect("all")}>{ko ? "전체" : "All"}</button>
    {entries.map(e => <button type="button" disabled={disabled} key={e.key} aria-pressed={selected === e.key} onClick={() => onSelect(e.key)}>
      <small>{e.kind === "TITLE_SHELF" ? (ko ? "작품 선반" : "Title shelf") : (ko ? "이미지 보드" : "Memory Board")}</small><span>{e.label}</span>{e.count !== undefined && <small>{ko ? `${e.count}개` : e.count}</small>}
    </button>)}{children}
  </nav>;
}
