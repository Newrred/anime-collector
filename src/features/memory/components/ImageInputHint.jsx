import "./image-input.css";

export default function ImageInputHint({ copy, dragging }) {
  return <div className="memory-image-input__hint">
    <p role="status">{dragging ? copy.drop : copy.hint}</p>
    <span><kbd>Ctrl V</kbd><span aria-hidden="true"> / </span><kbd>⌘ V</kbd><span> · {copy.formats}</span></span>
    <details>
      <summary>{copy.screenshot}</summary>
      <p>Windows · <kbd>Win ⇧ S</kbd><br />Mac · <kbd>⌃ ⇧ ⌘ 4</kbd></p>
      <p>{copy.screenshotHelp}</p>
    </details>
  </div>;
}
