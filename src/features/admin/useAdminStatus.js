import {useEffect, useRef, useState} from 'react';
import {createAdminRequestScope, adminErrorCode} from './adminService.js';

export function useAdminStatus(session, service) {
  const sessionKey = session?.user?.id && session?.access_token ? `${session.user.id}:${session.access_token}` : '';
  const activeKey = useRef(sessionKey);
  activeKey.current = sessionKey;
  const scope = useRef(createAdminRequestScope());
  const mounted = useRef(false);
  const [state, setState] = useState({owner: '', phase: 'idle', data: null, error: '', notice: ''});

  async function run(operation, notice = '') {
    if (!sessionKey) return;
    const ticket = scope.current.next(), owner = sessionKey;
    setState({owner, phase: 'loading', data: null, error: '', notice: ''});
    const current = () => mounted.current && activeKey.current === owner && scope.current.current(ticket);
    try {
      const data = await operation();
      if (current()) setState({owner, phase: 'ready', data, error: '', notice});
    } catch (error) {
      if (!current()) return;
      const code = adminErrorCode(error);
      if (code === 'ADMIN_REVISION_CONFLICT') {
        // Refresh the stale view, but do not replay a write against the new revision.
        try {
          const data = await service.read();
          if (current()) setState({owner, phase: 'ready', data, error: code, notice: ''});
        } catch (refreshError) {
          if (current()) setState({owner, phase: 'error', data: null, error: adminErrorCode(refreshError), notice: ''});
        }
      } else setState({owner, phase: 'error', data: null, error: code, notice: ''});
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (sessionKey) run(() => service.read());
    else setState({owner: '', phase: 'idle', data: null, error: '', notice: ''});
    return () => { mounted.current = false; scope.current.invalidate(); };
  }, [sessionKey, service]);

  const visible = state.owner === sessionKey ? state : {phase: 'loading', data: null, error: '', notice: ''};
  return {
    ...visible,
    refresh: () => run(() => service.read()),
    setPaused: (revision, paused) => run(() => service.setPaused(revision, paused), paused ? 'paused' : 'resumed'),
    clear: () => {
      scope.current.invalidate();
      setState({owner: '', phase: 'idle', data: null, error: '', notice: ''});
    },
  };
}
