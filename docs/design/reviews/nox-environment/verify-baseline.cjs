// Run from the repository root. No dependencies; compares this milestone's saved baseline.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const dir = 'docs/design/reviews/nox-environment/';
const current = fs.readFileSync('src/components/nox/NoxCharacter.tsx', 'utf8');
const approved = fs.readFileSync(dir + 'approved-character-source.txt', 'utf8');
const geometry = fs.readFileSync('src/components/nox/introductionGeometry.ts');
const hash = crypto.createHash('sha256').update(geometry).digest('hex').toUpperCase();
assert.equal(hash, '5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E');
const eye = s => s.slice(s.indexOf('function Eye('), s.indexOf('export function NoxCharacter'));
const face = s => s.slice(s.indexOf("      <g id={ref('face')}"));
const eyeGradients = s => s.slice(s.indexOf("        <linearGradient id={ref('sclera')}"), s.indexOf("        <filter id={ref('soften')}"));
assert.equal(eye(current), eye(approved));
assert.equal(face(current), face(approved));
assert.equal(eyeGradients(current), eyeGradients(approved));
const before = JSON.parse(fs.readFileSync(dir + 'approved-geometry.json'));
const after = JSON.parse(fs.readFileSync(dir + 'final-geometry.json'));
assert.deepEqual(after, before);
assert.equal(after.arms.length, 8);
const results = { geometrySha256: hash, geometryFileUnchanged: true, eyeFunctionUnchanged: true, eyeGradientsUnchanged: true, faceArtworkUnchanged: true, renderedGeometryUnchanged: true, armCount: after.arms.length };
fs.writeFileSync(dir + 'geometry-validation.json', JSON.stringify(results, null, 2) + '\n');

const mantle = geometry.toString().match(/export const mantleContour =\s*'([^']+)'/)[1];
const paths = value => [mantle, ...value.arms.map(a => a.contour)].map(d => `<path d="${d}"/>`).join('');
fs.writeFileSync(dir + 'geometry-overlay.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1014" height="560" viewBox="0 0 507 280"><rect width="507" height="280" fill="#090f1c"/><g font-family="Arial" font-size="9" fill="#e4d9ed"><text x="14" y="18">Frozen geometry overlay: approved cyan / current dashed coral</text><text x="14" y="32">All 8 contours coincide. Mantle file hash and face/cup DOM also match.</text></g><g transform="translate(0 -182)" fill="none"><g stroke="#5ae0e2" stroke-width="1.2">${paths(before)}</g><g stroke="#ff719b" stroke-width=".7" stroke-dasharray="2 2">${paths(after)}</g></g></svg>`);
console.log(JSON.stringify(results, null, 2));
