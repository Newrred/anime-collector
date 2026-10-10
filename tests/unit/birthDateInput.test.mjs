import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBirthDateParts} from '../../src/features/auth/birthDateInput.js';

const today='2026-10-10';
const parse=(year,month,day)=>parseBirthDateParts({year,month,day},today);
test('empty birth fields stay empty and require the first missing part',()=>{
 assert.deepEqual(parseBirthDateParts({},today),{birthDate:'',field:'year',code:'BIRTH_YEAR_REQUIRED'});
 assert.equal(parse('2000','','').field,'month');
 assert.equal(parse('2000','2','').field,'day');
});
test('valid dates are canonical without changing the supplied parts',()=>{
 const parts={year:'2000',month:'2',day:'9'};
 assert.deepEqual(parseBirthDateParts(parts,today),{birthDate:'2000-02-09',field:null,code:null});
 assert.deepEqual(parts,{year:'2000',month:'2',day:'9'});
 assert.equal(parse('2000','02','29').birthDate,'2000-02-29');
 assert.equal(parse('2024','02','29').birthDate,'2024-02-29');
});
test('calendar overflow, leap-century rules and incomplete digits are not corrected',()=>{
 for(const parts of [['2001','02','29'],['1900','02','29'],['2000','04','31']]) {
  assert.deepEqual(parse(...parts),{birthDate:'',field:'day',code:'BIRTH_DAY_INVALID'});
 }
 for(const year of ['99','200','20000','+200','2e03','２０００'])assert.equal(parse(year,'1','1').code,'BIRTH_YEAR_REQUIRED');
 for(const month of ['0','00','13','002','1x',' 1'])assert.equal(parse('2000',month,'1').field,'month');
 for(const day of ['0','00','32','001','1x'])assert.equal(parse('2000','1',day).field,'day');
});
test('future dates point to the first future part and never yield a DOB',()=>{
 assert.deepEqual(parse('2027','1','1'),{birthDate:'',field:'year',code:'BIRTH_DATE_FUTURE'});
 assert.equal(parse('2026','11','1').field,'month');
 assert.equal(parse('2026','10','11').field,'day');
 assert.equal(parse('2026','10','10').birthDate,'2026-10-10');
});
test('uses existing plausible-date bounds, not the signup minimum age',()=>{
 assert.equal(parse('1899','1','1').code,'INVALID_BIRTH_DATE');
 assert.equal(parse('1900','1','1').code,'INVALID_BIRTH_DATE');
 assert.equal(parse('1905','10','11').birthDate,'1905-10-11');
 assert.equal(parse('2025','10','10').birthDate,'2025-10-10');
});
