import { act, render } from "@testing-library/react";
import { createRef, StrictMode } from "react";
import YouTubePlayer, { type YouTubePlayerHandle } from "../YouTubePlayer";

let events: any;
let instance: any;
let create: jest.Mock;
beforeEach(() => {
  create = jest.fn().mockImplementation((mount, options) => {
    const iframe = document.createElement("iframe");
    mount.replaceWith(iframe);
    events = options.events;
    instance = {
      loadVideoById: jest.fn(), playVideo: jest.fn(), pauseVideo: jest.fn(),
      stopVideo: jest.fn(), unMute: jest.fn(), getIframe: () => iframe,
      cueVideoById: jest.fn(), setVolume: jest.fn(), mute: jest.fn(), getPlayerState: () => 1,
      destroy: jest.fn(() => iframe.remove()),
    };
    return instance;
  });
  window.YT = { Player: create as any };
});
afterEach(() => { delete window.YT; jest.restoreAllMocks(); });

it("keeps a connected player across idle periods, changes and repeat orders", async () => {
  const { rerender, container, unmount } = render(<YouTubePlayer videoId={null} />);
  await act(async () => {});
  act(() => events.onReady());
  rerender(<YouTubePlayer videoId="aaaaaaaaaaa" playbackKey={1} />);
  expect(instance.loadVideoById).toHaveBeenLastCalledWith("aaaaaaaaaaa");
  rerender(<YouTubePlayer videoId="bbbbbbbbbbb" playbackKey={2} />);
  expect(instance.loadVideoById).toHaveBeenLastCalledWith("bbbbbbbbbbb");
  rerender(<YouTubePlayer videoId="bbbbbbbbbbb" playbackKey={3} />);
  expect(instance.loadVideoById).toHaveBeenCalledTimes(3);
  rerender(<YouTubePlayer videoId={null} />);
  expect(instance.stopVideo).toHaveBeenCalled();
  expect(create).toHaveBeenCalledTimes(1);
  expect(container.querySelector("iframe")).toBeInTheDocument();
  unmount();
  expect(instance.destroy).toHaveBeenCalledTimes(1);
});

it("does not reload for callbacks and uses the latest completion callback once", async () => {
  const oldEnded = jest.fn(), ended = jest.fn();
  const { rerender } = render(<YouTubePlayer videoId="aaaaaaaaaaa" onEnded={oldEnded} />);
  await act(async () => {});
  act(() => events.onReady());
  rerender(<YouTubePlayer videoId="aaaaaaaaaaa" onEnded={ended} />);
  act(() => { events.onStateChange({ data: 0 }); events.onStateChange({ data: 0 }); });
  expect(ended).toHaveBeenCalledTimes(1);
  expect(oldEnded).not.toHaveBeenCalled();
  expect(instance.loadVideoById).toHaveBeenCalledTimes(1);
});

it("recovers blocked autoplay on a gesture without skipping the request", async () => {
  jest.spyOn(console, "info").mockImplementation(() => {});
  const ref = createRef<YouTubePlayerHandle>(), error = jest.fn();
  render(<YouTubePlayer ref={ref} videoId="aaaaaaaaaaa" onError={error} />);
  await act(async () => {});
  act(() => { events.onReady(); });
  act(() => { events.onAutoplayBlocked(); ref.current?.play(); });
  expect(instance.playVideo).toHaveBeenCalled();
  expect(instance.unMute).toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

it("skips unavailable videos but not global player configuration errors", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const error = jest.fn();
  render(<YouTubePlayer videoId="aaaaaaaaaaa" onError={error} />);
  await act(async () => {});
  act(() => events.onReady());
  act(() => events.onError({ data: 153 }));
  expect(error).not.toHaveBeenCalled();
  act(() => events.onError({ data: 100 }));
  expect(error).toHaveBeenCalledWith(100);
});

it("survives StrictMode mount cleanup", async () => {
  const { container } = render(<StrictMode><YouTubePlayer videoId="aaaaaaaaaaa" /></StrictMode>);
  await act(async () => {});
  act(() => events.onReady());
  expect(container.querySelectorAll("iframe")).toHaveLength(1);
  expect(instance.loadVideoById).toHaveBeenCalledWith("aaaaaaaaaaa");
});

it("retries temporary HTML5 playback errors without losing the order", async () => {
  jest.useFakeTimers();
  jest.spyOn(console, "error").mockImplementation(() => {});
  const error = jest.fn();
  const { unmount } = render(<YouTubePlayer videoId="aaaaaaaaaaa" onError={error} />);
  await act(async () => {});
  act(() => events.onReady());
  act(() => events.onError({ data: 5 }));
  act(() => jest.advanceTimersByTime(5000));
  expect(instance.loadVideoById).toHaveBeenCalledTimes(2);
  expect(error).not.toHaveBeenCalled();
  unmount();
  jest.useRealTimers();
});

it("applies remote pause, resume, volume and mute without restarting the video", async () => {
  const { rerender } = render(<YouTubePlayer videoId="aaaaaaaaaaa" />);
  await act(async () => {}); act(() => events.onReady());
  rerender(<YouTubePlayer videoId="aaaaaaaaaaa" paused volume={25} muted />);
  expect(instance.pauseVideo).toHaveBeenCalled();
  expect(instance.setVolume).toHaveBeenLastCalledWith(25);
  expect(instance.mute).toHaveBeenCalled();
  rerender(<YouTubePlayer videoId="aaaaaaaaaaa" paused={false} volume={25} />);
  expect(instance.playVideo).toHaveBeenCalled();
  expect(instance.unMute).toHaveBeenCalled();
  expect(instance.loadVideoById).toHaveBeenCalledTimes(1);
});

it("cues instead of autoplaying when a remote pause survives a reload", async () => {
  render(<YouTubePlayer videoId="aaaaaaaaaaa" paused />);
  await act(async () => {}); act(() => events.onReady());
  expect(instance.cueVideoById).toHaveBeenCalledWith("aaaaaaaaaaa");
  expect(instance.loadVideoById).not.toHaveBeenCalled();
});
