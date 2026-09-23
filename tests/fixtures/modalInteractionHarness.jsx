import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GlobalQuickActionSheet from '../../src/components/search/GlobalQuickActionSheet.jsx';
import MemoryConflictDialog from '../../src/components/data/MemoryConflictDialog.jsx';
import ConflictResolveModal from '../../src/components/data/ConflictResolveModal.jsx';

const copy = { close: 'Close conflict', title: 'Resolve conflict', lead: 'Choose a version',
  localVersion: 'Local', cloudVersion: 'Cloud', unknownTitle: 'Sample', emptyNote: 'Empty',
  keepLocal: 'Keep local', useCloud: 'Use cloud', exportBackup: 'Export backup' };
function Harness() {
  const [sheet, setSheet] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  window.finishModalWork = () => setBusy(false);
  return <>
    <button onClick={() => setSheet(true)}>Open sheet</button>
    <button onClick={() => setLegacy(true)}>Open legacy conflict</button>
    <GlobalQuickActionSheet open={sheet} title="Quick action" onClose={() => setSheet(false)}>
      <button onClick={() => setConflict(true)}>Open conflict</button>
      <button>Last action</button>
    </GlobalQuickActionSheet>
    <MemoryConflictDialog conflict={conflict ? { localEntity: { note: 'Local text' } } : null}
      copy={copy} busy={busy} onClose={() => setConflict(false)} onKeepLocal={() => setBusy(true)} />
    <ConflictResolveModal open={legacy} copy={copy} onClose={() => setLegacy(false)} />
  </>;
}
export function mount() {
  const node = document.createElement('div'); document.body.append(node);
  createRoot(node).render(<Harness />);
}
