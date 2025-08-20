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

test('shows text and hides overlay when playback completes', () => {
  jest.useFakeTimers();
  const event: ObsEvent = {
    type: 'intim',
    timestamp: Date.now(),
    text: 'Интим',
    gifUrl: '/obs/intim.gif',
    soundUrl: '/obs/intim.mp3',
  };
  const onComplete = jest.fn();
  const { queryByText, rerender } = render(
    <ObsEventOverlay event={event} onComplete={onComplete} />
  );
  expect(screen.getByText('Интим')).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  // simulate parent clearing the event on completion
  rerender(<ObsEventOverlay event={null} onComplete={onComplete} />);
  expect(onComplete).toHaveBeenCalled();
  expect(queryByText('Интим')).toBeNull();
  jest.useRealTimers();
});
