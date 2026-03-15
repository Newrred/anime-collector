export default function TierPresetBar({
  presets = [],
  activePresetId = "all",
  onSelectPreset,
  label = "",
}) {
  return (
    <section className="surface-card tier-preset-bar" aria-label={label}>
      <div className="tier-preset-bar__row">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`pill-btn tier-preset-bar__chip${preset.id === activePresetId ? " is-active" : ""}`}
            onClick={() => onSelectPreset?.(preset.id)}
          >
            <span>{preset.label}</span>
            <span className="tier-preset-bar__count">{preset.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
