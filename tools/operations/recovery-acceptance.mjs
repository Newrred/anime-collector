// Evidence acceptance only; does not authorize deployment or serving.
export function recoveryAcceptance(e, provenance) {
 const r=e?.report;
 const valid=e?.productionMutations===0 && e.hostedPublicUserActionPass===0 && e.storageHttpVerified===false
  && r?.status==='CURRENT_IMPORT_PUBLIC_REPLAY_CONTRACT_PASS_SERVING_CLOSED' && r.databaseImportVerified===true
  && r.network==='none' && r.publishedPorts===0 && r.safeToServe===false
  && r.containerStopped===true && r.privateAccessRemainsClosed===true && r.publicAccessRemainsClosed===true
  && r.database?.tables===99 && r.database.cronLaunch==='off'
  && r.publicContract?.checks===56 && r.publicContract.synthetic===true && r.publicContract.actualRestoredFunctions===true
  && r.publicContract.externalStorageHttpVerified===false && r.privateReplay?.operationSourceHashQuotaPreserved===true
  && r.access?.ownerReads===5 && r.access.otherOwnerDenied===5 && r.access.anonymousDenied===true && r.access.wrongOwnerCardRlsDenied===true
  && e.independentKeyCopyConfirmed===false && e.retentionScheduleEnabled===false;
 if(!valid)throw Error('RECOVERY_EVIDENCE_MISMATCH');
 return {
  state:'LOCAL_RESTORE_VERIFIED_OPERATIONS_PARTIAL',provenance,
  completed:{databaseTables:99,publicDeletionSyntheticChecks:56,ownerReads:5,otherOwnerDenied:5,anonymousDenied:true,cardRlsDenied:true,retryBodiesScrubbedLocally:r.publicReplay.scrubbedRetryBodies,sourceOperationHashQuotaPreserved:true,accessClosedAndContainerStopped:true},
  notClaimed:{hostedPublicRestore:true,storageHttpOrCdnRestore:true,newEncryptedPublicJournalArchive:true,productionAuthorization:true},
  independentKeyCopyStored:false,retentionScheduleEnabled:false,readyForProduction:false,
  remaining:[
   {id:'D05_KEY',action:'Store recovery key independently of this PC and backup ZIP; user confirmation still absent.'},
   {id:'D05_BACKUP_OPERATIONS',action:'Weekly external incremental backup is not active; user excluded local schedule. RPO7d/RTO24h are goals, not achieved guarantees. Preserve every referenced base archive; automatic retention deletion is not enabled.'},
   {id:'D05_RECOVERY_REOPEN',action:'Never reopen restored serving without complete fresh deletion/rights state, current policy/audit and Storage/CDN reconciliation. Current snapshots are not a durable deletion feed; populated Public restore was synthetic.'},
   {id:'W16_CANONICAL',action:'Preserve existing canonical completeness and small catalog publish/restore acceptance; this candidate does not ingest or replace catalog data.'}
  ]
 };
}
