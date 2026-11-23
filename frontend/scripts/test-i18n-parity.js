import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hiPath = path.resolve(__dirname, '../src/i18n/hi.json');
const enPath = path.resolve(__dirname, '../src/i18n/en.json');
const chhPath = path.resolve(__dirname, '../src/i18n/chh.json');

const hi = JSON.parse(fs.readFileSync(hiPath, 'utf-8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const chh = JSON.parse(fs.readFileSync(chhPath, 'utf-8'));

function getDeepKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const hiKeys = new Set(getDeepKeys(hi));
const enKeys = new Set(getDeepKeys(en));
const chhKeys = new Set(getDeepKeys(chh));

const missingInEn = [...hiKeys].filter(k => !enKeys.has(k));
const missingInHi = [...enKeys].filter(k => !hiKeys.has(k));
const missingInChh = [...hiKeys].filter(k => !chhKeys.has(k));

if (missingInEn.length > 0 || missingInHi.length > 0 || missingInChh.length > 0) {
  console.error("i18n Key Parity Check FAILED:");
  if (missingInEn.length > 0) {
    console.error("Missing in en.json:", missingInEn);
  }
  if (missingInHi.length > 0) {
    console.error("Missing in hi.json:", missingInHi);
  }
  if (missingInChh.length > 0) {
    console.error("Missing in chh.json:", missingInChh);
  }
  process.exit(1);
} else {
  console.log(`i18n Key Parity Check PASSED! All ${hiKeys.size} keys match between Hindi, English, and Chhattisgarhi.`);
  process.exit(0);
}

