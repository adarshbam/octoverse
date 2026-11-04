import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { type InstanceApi, InstanceApiContext, useInstanceApi } from './useInstanceApi';

const api = (extra: Partial<InstanceApi> = {}): InstanceApi => ({
  stage: 'overview',
  faceAnchor: [0, 0, 0],
  liveShift: () => ({ dx: 0, dy: 0 }),
  explore: () => {},
  back: () => {},
  skip: () => {},
  attend: () => {},
  ...extra,
});

function Probe({ read }: { read: (value: InstanceApi) => void }) {
  read(useInstanceApi());
  return null;
}

test('a child of the host reads the instance API; outside a host the missing host is named', () => {
  const seen: InstanceApi[] = [];
  const mine = api({ stage: 'detail' });
  renderToStaticMarkup(createElement(InstanceApiContext.Provider, { value: mine }, createElement(Probe, { read: value => seen.push(value) })));
  expect(seen).toEqual([mine]);
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => renderToStaticMarkup(createElement(Probe, { read: () => {} }))).toThrow(/useInstanceApi: no <WorldHost>/);
  quiet.mockRestore();
});

test('the host builds the API from the same dispatchers as its own UI (explore, skip and attend are wired in the host source)', async () => {
  const { readFileSync } = await import('node:fs');
  const host = readFileSync(new URL('./WorldHost.tsx', import.meta.url), 'utf8');
  expect(host).toMatch(/explore: \(\) => dispatch\(\{ type: 'OPEN_OVERVIEW' \}\)/);
  expect(host).toMatch(/onExplore=\{api\.explore\}/);
  expect(host).toMatch(/onSkip=\{api\.skip\}/);
  expect(host).toMatch(/instance\.attend\.set\(/);
});
