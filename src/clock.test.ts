import { expect, it } from 'vitest';
import { Clock, formatTime } from './clock';

it('does not run until first start', () => {
  let now = 100;
  const clock = new Clock(() => now);
  now = 5000;
  expect(clock.elapsed()).toBe(0);
  expect(clock.running).toBe(false);
});
it('start is idempotent and elapsed derives from monotonic time rather than tick count', () => {
  let now = 100;
  const clock = new Clock(() => now);
  clock.start(); now = 1350; clock.start();
  expect(clock.elapsed()).toBe(1250);
  expect(clock.running).toBe(true);
});
it('terminal stop freezes time even after repeated stop', () => {
  let now = 0;
  const clock = new Clock(() => now);
  clock.start(); now = 4321; clock.stop(); now = 9999; clock.stop();
  expect(clock.elapsed()).toBe(4321);
  expect(clock.running).toBe(false);
});
it('reset cancels an active round and a subsequent round starts cleanly', () => {
  let now = 0;
  const clock = new Clock(() => now);
  clock.start(); now = 4000; clock.reset(); now = 8000;
  expect(clock.elapsed()).toBe(0);
  expect(clock.running).toBe(false);
  clock.start(); now = 9000;
  expect(clock.elapsed()).toBe(1000);
});
it('stopped clock can resume without losing elapsed time', () => {
  let now = 0;
  const clock = new Clock(() => now);
  clock.start(); now = 2000; clock.stop(); now = 5000; clock.start(); now = 6000;
  expect(clock.elapsed()).toBe(3000);
});
it.each([[0, '00:00'], [999, '00:00'], [61000, '01:01'], [3600000, '60:00'], [-50, '00:00']])('formats %d as %s', (value, output) => {
  expect(formatTime(value)).toBe(output);
});
