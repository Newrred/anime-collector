import SystemDesignPreview from "./SystemDesignPreview.jsx";
import "./memory-visual.css";

const safeClassName = (value) => String(value || "").trim();

export default function MemoryVisual({
  visual,
  systemCopy = {},
  missingLabel = "Visual unavailable",
  fit = "cover",
  className = "",
}) {
  const kind = visual?.kind;
  const imageReady = kind === "IMAGE"
    && typeof visual.src === "string"
    && visual.src.length > 0
    && typeof visual.alt === "string"
    && visual.alt.trim().length > 0;
  const systemReady = kind === "SYSTEM_DESIGN" && visual.designSpec;
  const fitClass = fit === "contain" ? "memory-visual--contain" : "memory-visual--cover";
  const classes = [
    "memory-visual-scope",
    "memory-visual",
    systemReady ? "memory-visual--system" : imageReady ? "memory-visual--image" : "memory-visual--missing",
    fitClass,
    safeClassName(className),
  ].filter(Boolean).join(" ");

  if (systemReady) {
    return (
      <div className={classes}>
        <SystemDesignPreview
          spec={visual.designSpec}
          title={systemCopy.fallbackTitle}
          copy={systemCopy}
          ariaLabel={systemCopy.label}
        />
      </div>
    );
  }

  if (imageReady) {
    return (
      <div className={classes}>
        <img className="memory-visual__image" src={visual.src} alt={String(visual.alt || "")} />
      </div>
    );
  }

  return (
    <div className={classes} role="status" aria-label={missingLabel}>
      <span className="memory-visual__missing-mark" aria-hidden="true">◇</span>
      <span className="memory-visual__missing-label">{missingLabel}</span>
    </div>
  );
}
