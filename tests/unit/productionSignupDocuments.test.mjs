import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {transform} from '@astrojs/compiler';
import {
  SIGNUP_POLICY_VERSION, TERMS_VERSION, PRIVACY_VERSION,
  TEST_SIGNUP_POLICY_VERSION, TEST_TERMS_VERSION, TEST_PRIVACY_VERSION,
  PRODUCTION_SIGNUP_POLICY_VERSION, PRODUCTION_TERMS_VERSION, PRODUCTION_PRIVACY_VERSION,
  resolveSignupDocuments, needsAgeProcessingConsent,
} from '../../src/features/auth/signupDocuments.js';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const production = {version:PRODUCTION_SIGNUP_POLICY_VERSION,
  termsVersion:PRODUCTION_TERMS_VERSION, privacyVersion:PRODUCTION_PRIVACY_VERSION};
const legacy = {version:SIGNUP_POLICY_VERSION, termsVersion:TERMS_VERSION, privacyVersion:PRIVACY_VERSION};
const preview = {version:TEST_SIGNUP_POLICY_VERSION, termsVersion:TEST_TERMS_VERSION, privacyVersion:TEST_PRIVACY_VERSION};

test('production documents resolve only as the exact immutable tuple, without enabling signup', () => {
  const row = resolveSignupDocuments(production);
  assert.equal(row.policyVersion, 'simple-signup-2026-10-10');
  assert.equal(row.termsVersion, 'terms-2026-10-10');
  assert.equal(row.privacyVersion, 'privacy-2026-10-10');
  assert.equal(row.testOnly, false);
  assert.equal(row.guardianNotice, true);
  assert.equal(Object.isFrozen(row), true);
  assert.equal('enabled' in row, false);
  assert.equal('countries' in row, false);
  for (const key of ['version', 'termsVersion', 'privacyVersion']) {
    for (const other of [legacy, preview]) {
      assert.equal(resolveSignupDocuments({...production, [key]:other[key]}, {allowTestDocuments:true}), null);
    }
  }
  assert.equal(resolveSignupDocuments({...production, version:'https://untrusted.invalid/documents'}), null);
});

test('guardian notice and Philippine purpose consent do not rewrite legacy or test scopes', () => {
  const row = resolveSignupDocuments(production);
  assert.equal(needsAgeProcessingConsent('PH', row), true);
  for (const country of ['KR', 'TH', 'US', 'GB', 'DE', 'CH']) assert.equal(needsAgeProcessingConsent(country, row), false);
  assert.equal(resolveSignupDocuments(legacy).ageProcessingConsent, false);
  assert.equal(resolveSignupDocuments(legacy).guardianNotice, undefined);
  assert.equal(resolveSignupDocuments(preview), null);
  assert.equal(resolveSignupDocuments(preview, {allowTestDocuments:true}).guardianNotice, undefined);
  assert.equal('guardianVerified' in row, false);
});

test('earlier acceptance documents remain byte-equivalent apart from checkout line endings', async () => {
  const fixtures = {
    Terms20261009Draft:'f87dbcb55984bd6fd64999dccb89732140ee0e145ca785f4947875ff38a96776',
    Privacy20261009Draft:'5a9b34a66a53ab34e9e6b7eb97824a0b5a762a2c7f824d16ce26a89a92bbf50a',
    Terms20261010Test:'eb69416f7f549b249aa9e772aace38772ba975df6ebe09d0b7dbb4d42f2def74',
    Privacy20261010Test:'b364acb85b7b3ff43cb39314b2f28651163a6f58cd48f7563d43c4e4e9f29d59',
  };
  for (const [name, expected] of Object.entries(fixtures)) {
    const text = (await read(`src/components/legal/${name}.astro`)).replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(text).digest('hex'), expected, name);
  }
});

test('production legal routes compile and bind fixed local documents, never the mutable review', async () => {
  for (const [type, name] of [['terms','Terms20261010'], ['privacy','Privacy20261010']]) {
    const route = await read(`src/pages/legal/${type}-2026-10-10.astro`);
    assert.match(route, new RegExp(`${name}\\.astro`));
    const source = await read(`src/components/legal/${name}.astro`);
    assert.doesNotMatch(source, /2026-10-10-test|legal\/review|Test signup|테스트용 가입 문서/);
    assert.match(source, /<html lang="ko">/);
    assert.match(source, /lang="en"/);
    assert.match(source, /name="viewport"/);
    assert.match(source, /simple-signup-2026-10-10/);
    assert.match(source, /godburgundy@gmail\.com/);
    for (const [text, filename] of [[route, `route-${type}.astro`], [source, `${name}.astro`]]) {
      const result = await transform(text, {filename});
      assert.equal(result.diagnostics.filter(d => d.severity === 1).length, 0, filename);
    }
  }
});

test('production terms preserve private free use, real permission and mandatory minor rights', async () => {
  const text = await read('src/components/legal/Terms20261010.astro');
  for (const phrase of ['만13세, 한국은 만14세', '무료입니다', '같은 동의 항목을 직접 선택',
    '신원이나 보호자 동의를 인증하는 절차가 아닙니다', '계약 취소권', '포괄적으로 전가하는 배상의무를 두지 않습니다',
    '광고용 재사용·판매나 AI 학습을 위한 허락은 아닙니다', '모든 국가의 가입이나 공개 기능이 제공되는 것은 아닙니다']) {
    assert(text.includes(phrase), phrase);
  }
  assert.doesNotMatch(text, /guardianVerified|보호자 동의가 인증되었습니다/);
});

test('production privacy distinguishes exact expiry, account deletion, photo cleanup and backups', async () => {
  const text = await read('src/components/legal/Privacy20261010.astro');
  for (const phrase of ['10분', '5분', '2분', '매시간', '30일', '최대 50건',
    '계정이 존재하는 동안', 'MOEMOA 서버나 Google에 보내지 않습니다',
    '수동으로 관리합니다', '고정된 자동 백업 회전 주기', '목적이 끝나면 삭제하거나',
    '최신 삭제 내역을 대조', '선택을 신원·관계·동의 권한의 인증 기록으로 표시하지 않습니다']) {
    assert(text.includes(phrase), phrase);
  }
  for (const id of ['age-processing', 'retention', 'withdrawal', 'providers', 'processing-grounds']) {
    assert(text.includes(`id="${id}"`), id);
  }
});

test('production providers separate configured storage from global operations without invented representatives', async () => {
  const text = await read('src/components/legal/Privacy20261010.astro');
  for (const phrase of ['Supabase Pte. Ltd.', 'Vercel Inc.', 'ap-southeast-1', 'sin1',
    '미국', 'Google Drive', '모든 사본·로그가 싱가포르에만 있다는 뜻은 아닙니다',
    'https://supabase.com/legal/customer-resources/data-processing-addendum', 'https://vercel.com/legal/dpa']) {
    assert(text.includes(phrase), phrase);
  }
  assert.doesNotMatch(text, /미확정|확정되지 않았습니다|representative@|EU representative appointed|DataRep|Janus/);
  assert.match(text, /not end-to-end encryption/);
});
