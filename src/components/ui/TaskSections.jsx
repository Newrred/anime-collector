import { Children, useEffect, useId, useState } from 'react';
import './task-sections.css';
const NO_ALIASES = Object.freeze({});

// Keep panels mounted: changing the task must not discard an editor draft.
export default function TaskSections({ label, children, hashAliases = NO_ALIASES }) {
  const panels = Children.toArray(children).filter(Boolean);
  const [active, setActive] = useState(panels[0]?.props.sectionId);
  const prefix = useId();
  const ids = panels.map(panel => panel.props.sectionId).join('|');
  useEffect(() => {
    const syncHash = () => {
      const raw = window.location.hash.slice(1);
      const value = hashAliases[raw] || raw;
      if (ids.split('|').includes(value)) setActive(value);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [ids, hashAliases]);
  return <div className="task-sections">
    <nav className="task-sections__nav" aria-label={label}>
      {panels.map(panel => <button type="button" key={panel.props.sectionId}
        aria-pressed={active === panel.props.sectionId} aria-controls={`${prefix}-${panel.props.sectionId}`}
        onClick={() => {
          setActive(panel.props.sectionId);
          window.history.replaceState(window.history.state, '', `#${panel.props.sectionId}`);
        }}>{panel.props.label}</button>)}
    </nav>
    {panels.map(panel => <section key={panel.props.sectionId} id={`${prefix}-${panel.props.sectionId}`}
      aria-label={panel.props.label} hidden={active !== panel.props.sectionId} className="task-sections__panel">{panel}</section>)}
  </div>;
}

export function TaskPanel({ children }) { return children; }
