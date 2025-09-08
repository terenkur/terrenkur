import { render, act } from '@testing-library/react';
import RouletteWheel, { RouletteWheelHandle } from '../RouletteWheel';

jest.useFakeTimers();

const games = [
  { id: 1, name: 'G1', count: 1, background_image: null },
  { id: 2, name: 'G2', count: 0, background_image: null },
];

const spinDuration = 4;

test('calls onDone after spin', () => {
  const onDone = jest.fn();
  const ref = { current: null as RouletteWheelHandle | null };
  render(
    <RouletteWheel
      ref={ref}
      games={games}
      onDone={onDone}
      spinSeed="seed"
      spinDuration={spinDuration}
    />
  );
  act(() => {
    ref.current!.spin();
    jest.runAllTimers();
  });
  expect(onDone).toHaveBeenCalled();
});

test('spins twice to expected angles', () => {
  const onDone = jest.fn();
  const ref = { current: null as RouletteWheelHandle | null };
  const { container } = render(
    <RouletteWheel
      ref={ref}
      games={games}
      onDone={onDone}
      spinSeed="seed"
      spinDuration={spinDuration}
    />
  );

  const canvas = container.querySelector('canvas') as HTMLCanvasElement;

  const mulberry32 = (a: number) => {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  let seed = 0;
  for (const ch of 'seed') {
    seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  }
  const rand = mulberry32(seed);

  const rotations: number[] = [];
  let rotation = 0;

  const computeExpectedRotation = () => {
    const maxVotes = games.reduce((m, g) => Math.max(m, g.count), 0);
    const weighted = games.map((g) => ({
      ...g,
      weight:
        g.count === 0
          ? 40
          : 1 + 2 * (maxVotes - g.count),
    }));
    const totalWeight = weighted.reduce((sum, g) => sum + g.weight, 0);

    const rnd = rand() * totalWeight;
    let cumulative = 0;
    let selected = weighted[0];
    for (const item of weighted) {
      cumulative += item.weight;
      if (rnd <= cumulative) {
        selected = item;
        break;
      }
    }

    let angle = -Math.PI / 2;
    for (const item of weighted) {
      const slice = (item.weight / totalWeight) * Math.PI * 2;
      if (item.id === selected.id) {
        angle += slice / 2;
        break;
      }
      angle += slice;
    }

    rand(); // duration random

    const spins = spinDuration;
    const normalized = rotation % (2 * Math.PI);
    const target =
      rotation + spins * 2 * Math.PI + (Math.PI * 3) / 2 - angle - normalized;
    rotation = target;
    rotations.push(target);
  };

  // First spin
  act(() => {
    ref.current!.spin();
    jest.runAllTimers();
  });
  computeExpectedRotation();
  const angle1 = parseFloat(canvas.style.transform.replace(/[^0-9.-]/g, ''));
  expect(angle1).toBeCloseTo(rotations[0]);

  // Second spin
  act(() => {
    ref.current!.spin();
    jest.runAllTimers();
  });
  computeExpectedRotation();
  const angle2 = parseFloat(canvas.style.transform.replace(/[^0-9.-]/g, ''));
  expect(angle2).toBeCloseTo(rotations[1]);
});
