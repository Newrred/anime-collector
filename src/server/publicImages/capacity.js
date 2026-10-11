// Public aggregates only. Never forward backend rows, paths or identities.
const counts = ['totalStoredBytes','privateStoredBytes','publicStoredBytes','privateReservedBytes','invalidObjectCount',
 'publicReservedBytes','fullBytes','thumbBytes','preparingCount','failedCount','cleanupPendingCount','overdueCount',
 'publicStorageLimitBytes','deliveryDailyLimit','deliveryUsed','deliveryBytesDailyLimit','deliveryBytesUsed'];
const flags = ['publicStorageBudgetEnabled','readsEnabled','deliveryEnabled','deliveryPaused','deliveryBytesEnabled','deliveryBytesPaused'];
export function publicCapacitySnapshot(value) {
 const at=Date.parse(value?.observedAt);
 if (!Number.isFinite(at) || counts.some(k=>!Number.isSafeInteger(value?.[k]) || value[k]<0)
   || flags.some(k=>typeof value?.[k]!=='boolean')
   || value.privateStoredBytes+value.publicStoredBytes>value.totalStoredBytes) throw new Error('INVALID_PUBLIC_CAPACITY');
 return {observedAt:new Date(at).toISOString(),...Object.fromEntries([...counts,...flags].map(k=>[k,value[k]]))};
}
export function evaluatePublicCapacity(value,{totalStorageAlertBytes,now=Date.now()}={}) {
 const s=publicCapacitySnapshot(value),age=now-Date.parse(s.observedAt);
 if(age>600000 || age < -60000 || !Number.isSafeInteger(totalStorageAlertBytes) || totalStorageAlertBytes<1) throw new Error('INVALID_PUBLIC_CAPACITY');
 const publicStorageBytes=Math.max(s.publicStoredBytes,s.publicReservedBytes);
 const totalReservedOrStoredBytes=s.totalStoredBytes-s.publicStoredBytes-s.privateStoredBytes
  +publicStorageBytes+Math.max(s.privateStoredBytes,s.privateReservedBytes);
 const alerts=[];
 if(s.invalidObjectCount) alerts.push('STORAGE_SIZE_METADATA_INVALID');
 if(totalReservedOrStoredBytes>=totalStorageAlertBytes) alerts.push('TOTAL_STORAGE_NEAR_LIMIT');
 if(s.publicStorageBudgetEnabled && s.publicStorageLimitBytes>0 && publicStorageBytes>=Math.ceil(s.publicStorageLimitBytes*.8)) alerts.push('PUBLIC_STORAGE_NEAR_LIMIT');
 if(s.readsEnabled && (!s.publicStorageBudgetEnabled || s.publicStorageLimitBytes<1 || !s.deliveryEnabled || !s.deliveryBytesEnabled
   || s.deliveryDailyLimit<1 || s.deliveryBytesDailyLimit<2097152)) alerts.push('PUBLIC_BUDGET_UNGUARDED');
 if(s.readsEnabled && (s.deliveryPaused || s.deliveryBytesPaused)) alerts.push('PUBLIC_DELIVERY_PAUSED');
 if(s.deliveryEnabled && s.deliveryDailyLimit>0 && s.deliveryUsed>=Math.ceil(s.deliveryDailyLimit*.8)) alerts.push('PUBLIC_DAILY_REQUESTS_NEAR_LIMIT');
 if(s.deliveryBytesEnabled && s.deliveryBytesDailyLimit>0 && s.deliveryBytesUsed>=Math.ceil(s.deliveryBytesDailyLimit*.8)) alerts.push('PUBLIC_DAILY_RESERVED_BYTES_NEAR_LIMIT');
 if(s.overdueCount) alerts.push('PUBLIC_IMAGE_CLEANUP_OVERDUE');
 return {...s,publicStorageBytes,totalReservedOrStoredBytes,totalStorageAlertBytes,alerts};
}
