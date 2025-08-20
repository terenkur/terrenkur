import { render, screen, act } from '@testing-library/react';
import ObsEventOverlay, { ObsEvent } from '../ObsEventOverlay';

beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: jest.fn(),
  });
});

test('shows and hides media for event', () => {
  jest.useFakeTimers();
  const event: ObsEvent = { type: 'intim', timestamp: Date.now() };
  const onComplete = jest.fn();
  const { queryByText } = render(
    <ObsEventOverlay event={event} onComplete={onComplete} />
  );
  expect(screen.getByText('Интим')).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(onComplete).toHaveBeenCalled();
  expect(queryByText('Интим')).toBeNull();
  jest.useRealTimers();
});
