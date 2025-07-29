import { render, act } from '@testing-library/react';
import RouletteWheel, { RouletteWheelHandle } from '../RouletteWheel';

jest.useFakeTimers();

const games = [
  { id: 1, name: 'G1', count: 1, background_image: null },
  { id: 2, name: 'G2', count: 0, background_image: null },
];

test('calls onDone after spin', () => {
  const onDone = jest.fn();
  const ref = { current: null as RouletteWheelHandle | null };
  render(<RouletteWheel ref={ref} games={games} onDone={onDone} spinSeed="seed" />);
  act(() => {
    ref.current!.spin();
    jest.runAllTimers();
  });
  expect(onDone).toHaveBeenCalled();
});
