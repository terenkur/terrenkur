import { render, act } from '@testing-library/react';
import RouletteWheel, { RouletteWheelHandle } from '../RouletteWheel';

jest.useFakeTimers();

const playMock = jest.fn();
beforeEach(() => {
  playMock.mockClear();
  (window as any).Audio = jest.fn().mockImplementation(() => ({
    currentTime: 0,
    preload: '',
    play: playMock,
  }));
});

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

test('plays click sound for each boundary crossing', () => {
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

  const maxVotes = games.reduce((m, g) => Math.max(m, g.count), 0);
  const weighted = games.map((g) => ({
    ...g,
    weight: g.count === 0 ? 40 : 1 + 2 * (maxVotes - g.count),
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

  const duration = spinDuration + (rand() - 0.5) * 2;
  const spins = 4;
  const rotation = 0;
  const normalized = rotation % (2 * Math.PI);
  const target =
    rotation + spins * 2 * Math.PI + (Math.PI * 3) / 2 - angle - normalized;
  const delta = target - rotation;
  const omega = delta / duration;

  const boundaries: number[] = [];
  let start = -Math.PI / 2;
  for (const item of weighted) {
    const slice = (item.weight / totalWeight) * Math.PI * 2;
    start += slice;
    boundaries.push((start + 2 * Math.PI) % (2 * Math.PI));
  }
  let crossings = 0;
  for (const b of boundaries) {
    for (let k = 0; ; k++) {
      const crossing = b + 2 * Math.PI * k;
      if (crossing <= rotation) continue;
      if (crossing >= target) break;
      crossings++;
    }
  }

  act(() => {
    ref.current!.spin();
    jest.runAllTimers();
  });

  expect(playMock).toHaveBeenCalledTimes(crossings);
});
