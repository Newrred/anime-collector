// Read only File objects provided by an explicit drop/paste event. Never fetch a
// URL, inspect text/HTML, or request general clipboard access here.
export function filesFromTransfer(transfer) {
  if (!transfer) return [];
  const unique = files => [...new Set(files.filter(Boolean))];
  const files = [];
  for (const item of Array.from(transfer.items || [])) {
    if (item?.kind !== 'file' || typeof item.getAsFile !== 'function') continue;
    try {
      const file = item.getAsFile();
      if (file) files.push(file);
    } catch {
      // Some event sources expose items without readable Files; try FileList.
    }
  }
  // Do not merge the two representations of the same transfer: getAsFile() and
  // FileList can return different wrappers for the same file. Keep distinct
  // files even when their names/sizes match; the UI enforces the one-file limit.
  return files.length ? unique(files) : unique(Array.from(transfer.files || []));
}

export function isEditablePasteTarget(target) {
  const visited = new Set();
  for (let node = target; node && !visited.has(node);) {
    visited.add(node);
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable === true) return true;
    const editable = node.getAttribute?.('contenteditable');
    if (editable === '' || ['true', 'plaintext-only'].includes(String(editable).toLowerCase())) return true;
    node = node.assignedSlot || node.parentElement || node.parentNode || node.getRootNode?.()?.host || null;
  }
  return false;
}
