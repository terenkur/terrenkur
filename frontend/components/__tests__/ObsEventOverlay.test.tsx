import { render, screen, act } from '@testing-library/react';
import ObsEventOverlay, { ObsEvent } from '../ObsEventOverlay';

// Mock data representing rows from the obs_media table
const obsMediaMock = [
  {
    type: 'intim',
    text: 'Интим',
    gif_url: '/obs/intim.gif',
    sound_url: '/obs/intim.mp3',
  },
  {
    type: 'poceluy',
    text: 'Поцелуй',
    gif_url: '/obs/poceluy.gif',
    sound_url: '/obs/poceluy.mp3',
  },
];

const originalAudio = window.Audio;

afterEach(() => {
  window.Audio = originalAudio;
  jest.useRealTimers();
});

test.each(obsMediaMock)('renders %s event and hides after timeout', (media) => {
  jest.useFakeTimers();

  const play = jest.fn().mockResolvedValue(undefined);
  const pause = jest.fn();
  const audioMock = jest.fn(() => ({ play, pause, currentTime: 0 }));
  // Mock the Audio constructor so we can verify it is called with the soundUrl
  // and that playback is initiated.
  // @ts-ignore
  window.Audio = audioMock;

  const event: ObsEvent = {
    type: media.type,
    text: media.text,
    gifUrl: media.gif_url,
    soundUrl: media.sound_url,
    timestamp: Date.now(),
  };

  const onComplete = jest.fn();
  const { queryByText, rerender } = render(
    <ObsEventOverlay event={event} onComplete={onComplete} />
  );

  expect(screen.getByText(media.text)).toBeInTheDocument();
  expect(audioMock).toHaveBeenCalledWith(media.sound_url);
  expect(play).toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(5000);
  });

  // simulate parent clearing the event on completion
  rerender(<ObsEventOverlay event={null} onComplete={onComplete} />);

  expect(onComplete).toHaveBeenCalled();
  expect(queryByText(media.text)).toBeNull();
});

