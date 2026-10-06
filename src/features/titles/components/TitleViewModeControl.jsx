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
          tabIndex={mode === value ? 0 : -1}
          onClick={() => onChange(value)}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const options = [...event.currentTarget.parentElement.querySelectorAll('[role="radio"]')];
            const next = event.key === "Home" ? options[0] : event.key === "End" ? options.at(-1) : options.find(option => option !== event.currentTarget);
            next?.click(); next?.focus();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
