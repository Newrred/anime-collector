#!/usr/bin/env node
/** Local file-only checks. Does not connect to, configure, or approve any service. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const schemaPath = fileURLToPath(new URL('../config/service-policy.schema.json', import.meta.url));
const defaultPath = fileURLToPath(new URL('../config/service-policy.candidate.json', import.meta.url));
const matchesType = (v,t) => t==='null' ? v===null : t==='array' ? Array.isArray(v) :
  t==='object' ? v!==null && typeof v==='object' && !Array.isArray(v) :
  t==='integer' ? Number.isSafeInteger(v) : t==='number' ? typeof v==='number' && Number.isFinite(v) : typeof v===t;
/** Validates precisely the keywords used by the bundled schema, not an arbitrary JSON Schema. */
function checkNode(value, schema, path, errors) {
  if (schema.type && ![].concat(schema.type).some(t=>matchesType(value,t))) {errors.push(`${path}: invalid type`);return;}
  if ('const' in schema && JSON.stringify(value)!==JSON.stringify(schema.const)) errors.push(`${path}: conflicts with fixed launch scope`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: invalid option`);
  if (value===null) return;
  if (typeof value==='number') {
    if (schema.minimum!==undefined && value<schema.minimum) errors.push(`${path}: below minimum`);
    if (schema.maximum!==undefined && value>schema.maximum) errors.push(`${path}: above maximum`);
  }
  if (typeof value==='string') {
    if (schema.minLength && value.trim().length<schema.minLength) errors.push(`${path}: empty string`);
    if (schema.maxLength && value.length>schema.maxLength) errors.push(`${path}: too long`);
  }
  if (Array.isArray(value)) {
    if (schema.uniqueItems && new Set(value.map(x=>JSON.stringify(x))).size!==value.length) errors.push(`${path}: duplicate items`);
    value.forEach((v,i)=>schema.items && checkNode(v,schema.items,`${path}[${i}]`,errors));
  } else if (typeof value==='object') {
    for (const key of schema.required||[]) if (!Object.hasOwn(value,key)) errors.push(`${path}.${key}: required`);
    for (const [key,v] of Object.entries(value)) {
      if (schema.properties?.[key]) checkNode(v,schema.properties[key],`${path}.${key}`,errors);
      else if (schema.additionalProperties===false) errors.push(`${path}.${key}: unexpected field`);
    }
  }
}
export async function validatePolicy(policy,{releasePreview=false}={}) {
  const schema=JSON.parse(await readFile(schemaPath,'utf8'));
  const errors=[];checkNode(policy,schema,'policy',errors);
  if(errors.length) return {ok:false,errors,warnings:[]};
  const p=policy, f=p.free, b=p.budget;
  if(f.mainMaxBytes>f.privateImageQuotaBytes) errors.push('free: main exceeds total quota');
  if(f.mainMaxBytes+f.thumbnailMaxBytes>f.transportBodyMaxBytes) errors.push('free: output bundle exceeds transport bound');
  if(f.transportBodyMaxBytes>=4000000) errors.push('free: transport bound needs a new verified provider contract');
  if(f.sourceSelectionMaxBytes<f.mainMaxBytes) errors.push('free: selection bound below stored main bound');
  if(f.thumbnailLongEdgePx>f.targetLongEdgePx) errors.push('free: thumbnail dimensions exceed main target');
  if(!(0<b.warnFractionOfVariableBudget && b.warnFractionOfVariableBudget<b.throttleFractionOfVariableBudget && b.throttleFractionOfVariableBudget<b.stopFractionOfVariableBudget && b.stopFractionOfVariableBudget<=1)) errors.push('budget: invalid escalation order');
  if(b.safetyReserveKrw>=b.monthlyIncrementalCeilingKrw) errors.push('budget: reserve consumes full budget');
  const variable=b.fixedMonthlyEstimateKrw===null ? null : b.monthlyIncrementalCeilingKrw-b.fixedMonthlyEstimateKrw-b.safetyReserveKrw;
  if(variable!==null && variable<=0) errors.push('budget: no safe variable budget; launch must not assume extra funds');
  const missing=[];
  if(b.fixedMonthlyEstimateKrw===null) missing.push('budget.fixedMonthlyEstimateKrw');
  for(const key of ['privateReadBytesPerMonth','publicReadBytesPerMonth']) if(f[key]===null) missing.push(`free.${key}`);
  for(const [key,v] of Object.entries(p.globalLimits)) if(v===null) missing.push(`globalLimits.${key}`);
  for(const [key,v] of Object.entries(p.retention)) if(v===null) missing.push(`retention.${key}`);
  for(const [key,v] of Object.entries(p.approvalEvidence)) if(v===null) missing.push(`approvalEvidence.${key}`);
  if(releasePreview){
    if(p.approvalState!=='APPROVED_FOR_CONFIG_REVIEW') errors.push('policy: candidate has no configuration approval');
    errors.push(...missing.map(key=>`${key}: required before release configuration review`));
  }
  return {ok:errors.length===0,errors,warnings:[...missing.map(key=>`${key}: unresolved; not unlimited`),
    'This check validates configuration shape/consistency only. Evidence references are NOT verified. It is NOT a release or deployment approval.'],variableBudgetKrw:variable};
}
async function main(){
  const args=process.argv.slice(2),unknown=args.filter(x=>x.startsWith('--') && x!=='--release-preview');
  const inputs=args.filter(x=>!x.startsWith('--'));
  if(unknown.length||inputs.length>1) throw new Error('Usage: node tools/validate_policy.mjs [policy.json] [--release-preview]');
  const policy=JSON.parse(await readFile(inputs[0]?resolve(inputs[0]):defaultPath,'utf8'));
  const result=await validatePolicy(policy,{releasePreview:args.includes('--release-preview')});
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.ok?0:1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(e=>{console.error(`POLICY_CHECK_ERROR: ${e.message}`);process.exitCode=2;});
