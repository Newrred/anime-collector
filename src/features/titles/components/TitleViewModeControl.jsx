export default function TitleViewModeControl({ mode, copy, onChange }) {
  return (
    <div className="title-mode-control" role="radiogroup" aria-label={copy.viewLabel}>
      {[["POSTER", copy.posterView], ["MEMORY", copy.memoryView]].map(([value, label]) => (
        <button
          key={value}
          className={`title-mode-control__option${mode === value ? " is-active" : ""}`}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
