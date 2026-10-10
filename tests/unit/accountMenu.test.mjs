import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMessageGroup } from '../../src/domain/messages.js';

const read = path => readFile(new URL(`../../src/${path}`, import.meta.url), 'utf8');

test('account menu has one shared data action and keeps the platform-safe destination', async () => {
  const [menu, sheet] = await Promise.all([
    read('components/TopNavDataMenu.jsx'), read('components/auth/AuthSheet.jsx'),
  ]);
  assert.equal((sheet.match(/onClick=\{onOpenData\}/g) || []).length, 1);
  assert.doesNotMatch(menu, /href=\{`\$\{base\}data\/`\}/);
  assert.match(menu, /toPlatformAppHref\(`\$\{base\}data\/`/);
  assert.match(menu, /await auth\.signIn\(`\$\{base\}data\/`\)/);
  assert.match(menu, /await auth\.signOut\(\)/);
  assert.match(menu, /isDataPage=\{currentRoute === "data"\}/);
  assert.match(sheet, /aria-current=\{isDataPage \? "page" : undefined\}/);
  assert.match(sheet, /\{syncStatus\}/);
});

test('account entry and data page use the same name in both languages', () => {
  for (const locale of ['ko', 'en']) {
    const sheet = getMessageGroup(locale, 'authSheet');
    const page = getMessageGroup(locale, 'dataCenter');
    assert.equal(sheet.openData, page.title);
    assert.equal(sheet.dialogTitle, page.title);
    assert.equal(sheet.syncLabel, locale === 'ko' ? '계정 상태' : 'Account status');
  }
});

test('data destination retains sync, administration, account privacy and backup tools', async () => {
  const page = await read('components/DataCenter.jsx');
  for (const component of ['MemoryAccountPanel', 'AdminEntry', 'AccountPrivacyPanel', 'ManualDataTools']) {
    assert.match(page, new RegExp(`<${component}\\b`));
  }
  assert.match(page, /PUBLIC_ACCOUNT_PRIVACY_V1 === '1'/);
});
