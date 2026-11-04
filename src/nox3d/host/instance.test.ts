import { type ComponentProps, type ReactNode, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { EngineInstance } from './EngineInstance';
import { type InstanceState, createInstanceState } from './instance';
import { useInstance } from './instanceContext';
import { NOX_BUNDLE } from '../bundle.nox';

/** A world with this id: Nox's data under another name (the instance reads only the id and mode here). */
const world = (id: string) => ({ ...NOX_BUNDLE, id });

test('two instance states share no reference', () => {
  const a = createInstanceState(world('a'), 'page');
  const b = createInstanceState(world('b'), 'preview');
  expect(a.bubbleLive).not.toBe(b.bubbleLive);
  expect(a.liveAnchors).not.toBe(b.liveAnchors);
  expect(a.hover).not.toBe(b.hover);
  expect(a.reliefGate).not.toBe(b.reliefGate);
});

test('an instance carries its id and mode, and starts with the relief shown and no hover', () => {
  const state = createInstanceState(world('nox'), 'page');
  expect(state.id).toBe('nox');
  expect(state.mode).toBe('page');
  expect(state.hover.bubble).toBe(false);
  expect(state.reliefGate.value).toBe(1);
  expect(createInstanceState(world('p'), 'preview').mode).toBe('preview');
});

test('writing one instance leaves the other as it was', () => {
  const a = createInstanceState(world('a'), 'page');
  const b = createInstanceState(world('b'), 'page');
  a.bubbleLive.resize(3);
  a.hover.bubble = true;
  a.reliefGate.value = 0;
  expect(a.bubbleLive.spots.length).toBe(3);
  expect(b.bubbleLive.spots.length).toBe(0);
  expect(b.hover.bubble).toBe(false);
  expect(b.reliefGate.value).toBe(1);
});

test('one instance\'s subscribers are not told of the other\'s frame', () => {
  const a = createInstanceState(world('a'), 'page');
  const b = createInstanceState(world('b'), 'page');
  let told = 0;
  b.bubbleLive.subscribe(() => told++);
  a.bubbleLive.notify();
  expect(told).toBe(0);
  b.bubbleLive.notify();
  expect(told).toBe(1);
});

test('useInstance outside an EngineInstance throws a named error', () => {
  const Probe = () => {
    useInstance();
    return null;
  };
  expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/useInstance: no <EngineInstance>/);
});

// createElement takes the children as arguments; the props type asks for them too, so it is told they are there.
const mount = (id: string, mode: 'page' | 'preview', ...children: ReactNode[]) => createElement(EngineInstance, { bundle: world(id), mode } as ComponentProps<typeof EngineInstance>, ...children);

test('an EngineInstance gives its children one state with its id and mode; two providers give two', () => {
  const seen: InstanceState[] = [];
  const Probe = () => {
    seen.push(useInstance());
    return null;
  };
  renderToStaticMarkup(mount('nox', 'page', createElement(Probe), createElement(Probe)));
  renderToStaticMarkup(mount('preview', 'preview', createElement(Probe)));
  expect(seen[0]).toBe(seen[1]);
  expect(seen[2]).not.toBe(seen[0]);
  expect([seen[0].id, seen[0].mode, seen[2].id, seen[2].mode]).toEqual(['nox', 'page', 'preview', 'preview']);
});
