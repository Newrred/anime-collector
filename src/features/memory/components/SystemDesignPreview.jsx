import { createSystemDesignViewModel } from "../domain/systemDesign.js";
import "./system-design-preview.css";

export default function SystemDesignPreview({ spec, title, className = "", copy = {} }) {
  const view = createSystemDesignViewModel(spec);
  const hue = Number.parseInt(view.patternToken.slice(0, 2), 16);
  const angle = Number.parseInt(view.patternToken.slice(2, 4), 16) % 180;
  return (
    <div
      className={`system-design-preview ${className}`.trim()}
      style={{ "--design-hue": hue, "--design-angle": `${angle}deg` }}
      data-pattern-token={view.patternToken}
    >
      <span className="system-design-preview__label">{copy.label || "System design preview"}</span>
      <strong>{title || copy.fallbackTitle || "Your memory"}</strong>
      <small>{copy.footer || "MOEMOA · Private memory"}</small>
    </div>
  );
}
