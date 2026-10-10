import {useEffect, useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {createAdminService} from './adminService.js';

const service = createAdminService(supabase);
export const adminUiEnabled = import.meta.env.PUBLIC_SERVICE_ADMIN_V1 === '1';

export default function AdminEntry({session, locale = 'ko', base = '/'}) {
  const key = session?.user?.id && session?.access_token ? `${session.user.id}:${session.access_token}` : '';
  const [allowedKey, setAllowedKey] = useState('');
  useEffect(() => {
    let alive = true;
    setAllowedKey('');
    if (adminUiEnabled && key) service.read().then(() => { if (alive) setAllowedKey(key); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return adminUiEnabled && key && allowedKey === key
    ? <a href={`${base}admin/`}>{locale === 'ko' ? '서비스 관리' : 'Service management'}</a> : null;
}
