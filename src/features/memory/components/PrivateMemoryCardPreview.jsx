import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../../../hooks/useAuthSession.js';
import { isPrivateUserImage, privateImageTransfer, privateImageUiEnabled } from '../runtime/platformPrivateImages.js';
import MemoryCardPreview from './MemoryCardPreview.jsx';

// No shared byte cache. Bound concurrent list reads without retaining another account's images.
const waiting = [];
let running = 0;
function drain() {
  while (running < 4 && waiting.length) {
    const task = waiting.shift();
    if (task.signal.aborted) { task.resolve(null); continue; }
    running++;
    Promise.resolve().then(task.read).then(task.resolve, task.reject).finally(() => { running--; drain(); });
  }
}
function queuedRead(read, signal) {
  return new Promise((resolve, reject) => {
    const task = { read, signal, resolve, reject };
    const cancel = () => { const i = waiting.indexOf(task); if (i >= 0) { waiting.splice(i, 1); resolve(null); } };
    signal.addEventListener('abort', cancel, { once: true });
    task.resolve = value => { signal.removeEventListener('abort', cancel); resolve(value); };
    task.reject = error => { signal.removeEventListener('abort', cancel); reject(error); };
    waiting.push(task); drain();
  });
}

export default function PrivateMemoryCardPreview({ runtime, bundle, ...props }) {
  const { user } = useAuthSession();
  const element = useRef(null), [remote, setRemote] = useState(null);
  const owner = bundle?.card.ownerId, asset = bundle?.asset;
  const eligible = privateImageUiEnabled() && runtime && props.visual?.kind === 'MISSING' && isPrivateUserImage(asset)
    && owner === `account:${user?.id}` && asset.sync?.syncState === 'SYNCED' && asset.sync.remoteVersion > 0;
  const key = `${owner}:${bundle?.card.id}:${asset?.id}:${asset?.sync?.remoteVersion}:${user?.id}`;
  useEffect(() => {
    if (!eligible) return;
    let active = true, objectUrl = null, started = false;
    const abort = new AbortController(); let timer;
    const start = () => {
      if (started) return; started = true;
      queuedRead(async () => {
        timer = setTimeout(() => abort.abort(), 30000);
        return privateImageTransfer(runtime, bundle).read(abort.signal, 'thumb');
      }, abort.signal).then(blob => {
        if (!active || abort.signal.aborted || !blob) return;
        objectUrl = URL.createObjectURL(blob); setRemote({ key, url: objectUrl });
      }).catch(() => { /* Existing unavailable visual remains; never publish/upload as a fallback. */ })
        .finally(() => clearTimeout(timer));
    };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: '160px' }) : null;
    if (observer && element.current) observer.observe(element.current); else start();
    return () => { active = false; observer?.disconnect(); abort.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [eligible, key, runtime]);
  const visual = eligible && remote?.key === key ? { kind: 'IMAGE', src: remote.url, alt: props.title } : props.visual;
  return <MemoryCardPreview {...props} visual={visual} elementRef={element} />;
}
