// Repaints masked areas of a reference panel with gpt-image-1. Needs OPENAI_API_KEY in the environment.
// Usage: node scripts/gen-plate.mjs <image.png> <mask.png> <prompt.txt> <out.png> [quality]
import { readFileSync, writeFileSync } from 'node:fs';
const [image, mask, promptFile, out, quality = 'high'] = process.argv.slice(2);
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
const form = new FormData();
form.append('model', 'gpt-image-1');
form.append('image', new Blob([readFileSync(image)], { type: 'image/png' }), 'image.png');
form.append('mask', new Blob([readFileSync(mask)], { type: 'image/png' }), 'mask.png');
form.append('prompt', readFileSync(promptFile, 'utf8'));
form.append('size', '1024x1024');
form.append('quality', quality);
form.append('n', '1');
const started = Date.now();
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
const body = await res.json();
if (!res.ok) { console.error('API error', res.status, JSON.stringify(body.error ?? body).slice(0, 400)); process.exit(1); }
writeFileSync(out, Buffer.from(body.data[0].b64_json, 'base64'));
console.log('saved', out, `${((Date.now() - started) / 1000).toFixed(1)}s`, body.usage ? JSON.stringify(body.usage) : '');
