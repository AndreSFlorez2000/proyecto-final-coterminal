const test = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('todas las referencias JS y CSS locales del HTML existen', () => {
  const refs=[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
    .map(match=>match[1]).filter(p=>!/^https?:/.test(p));
  assert.ok(refs.length>=28);
  for(const p of refs) assert.ok(fs.existsSync(path.join(root,p)),`Falta ${p}`);
});