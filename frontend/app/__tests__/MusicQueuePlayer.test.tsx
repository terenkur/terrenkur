import { act, fireEvent, render } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "https://queue.test";
let mockPlayerProps: any;
let mockSession: any = { access_token: "moderator" };
const mockPlay = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: {
  getSession: jest.fn(async () => ({ data: { session: mockSession } })),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
} } }));
jest.mock("@/lib/profile", () => ({ fetchMyProfile: jest.fn(async () => ({ data: { is_moderator: true }, error: null })) }));
jest.mock("@/components/music-queue/YouTubePlayer", () => {
  const React = require("react");
  return { __esModule: true, default: React.forwardRef((props: any, ref: any) => {
    mockPlayerProps = props;
    React.useImperativeHandle(ref, () => ({ play: mockPlay }));
    return <div data-testid="video" />;
  }) };
});
const Page = require("../(player)/music-queue/player/page").default;
let stream: any;
let active: any;
let queue: any[];
let autoStart: boolean;
let fetchMock: jest.Mock;
const track = (id: number) => ({ id, url: "https://youtu.be/aaaaaaaaaaa", status: "pending" });
const flush = async () => { await act(async () => {}); };
const tick = async () => { await act(async () => { jest.advanceTimersByTime(1); }); };

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, "", "/player");
  jest.useFakeTimers();
  mockSession = { access_token: "moderator" };
  mockPlay.mockClear();
  active = null; queue = []; autoStart = true;
  global.EventSource = jest.fn().mockImplementation(() => {
    stream = { onopen: null, onmessage: null, close: jest.fn() };
    return stream;
  }) as any;
  fetchMock = jest.fn(async (url: string, options: any) => {
    if (url.endsWith("/player-access")) return { ok: true, json: async () => ({ canPlay: true }) };
    if (options.method === "POST") {
      if (url.includes("/start")) { active = queue.shift(); }
      else active = null;
    }
    return { ok: true, json: async () => ({ active, queue: [...queue], autoStart }) };
  });
  global.fetch = fetchMock;
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it("waits on an empty screen, starts a new order, advances, then returns to idle", async () => {
  const { container } = render(<Page />);
  await flush();
  expect(container.textContent).toBe("");
  expect(mockPlayerProps.videoId).toBeNull();
  queue = [track(1), track(2)];
  await act(async () => stream.onmessage());
  await tick();
  expect(mockPlayerProps.playbackKey).toBe(1);
  expect(mockPlayerProps.videoId).toBe("aaaaaaaaaaa");
  await act(async () => mockPlayerProps.onEnded());
  await tick(); await tick();
  expect(mockPlayerProps.playbackKey).toBe(2);
  await act(async () => mockPlayerProps.onEnded());
  await tick();
  expect(mockPlayerProps.videoId).toBeNull();
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(4);
});

it("skips an unavailable video and continues with the next order", async () => {
  active = track(1); queue = [track(2)];
  render(<Page />); await flush();
  await act(async () => mockPlayerProps.onError(100));
  await tick(); await tick();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/1/skip"), expect.objectContaining({ method: "POST" }));
  expect(mockPlayerProps.playbackKey).toBe(2);
});

it("retries a failed completion without replaying the ended video", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  active = track(1); render(<Page />); await flush();
  const normalFetch = fetchMock.getMockImplementation()!;
  let failed = false;
  fetchMock.mockImplementation(async (url, options) => {
    if (url.endsWith("/complete") && !failed) { failed = true; throw new Error("offline"); }
    return normalFetch(url, options);
  });
  await act(async () => mockPlayerProps.onEnded());
  expect(mockPlayerProps.videoId).toBeNull();
  await act(async () => { jest.advanceTimersByTime(5000); });
  await tick();
  expect(active).toBeNull();
});

it("respects the saved pause and never mutates the queue anonymously", async () => {
  autoStart = false; queue = [track(1)];
  const { unmount } = render(<Page />); await flush();
  expect(fetchMock.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
  unmount();
  autoStart = true; mockSession = null;
  render(<Page />); await flush();
  expect(fetchMock.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("activates fullscreen and playback from one click without visible controls", async () => {
  const fullscreen = jest.fn().mockResolvedValue(undefined);
  const { getByRole } = render(<Page />); await flush();
  const surface = getByRole("button");
  surface.requestFullscreen = fullscreen;
  fireEvent.click(surface);
  expect(fullscreen).toHaveBeenCalledTimes(1);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

it("runs the entire queue from a token link with no login or interaction", async () => {
  const token = "ab".repeat(32);
  window.history.replaceState(null, "", `/player#token=${token}`);
  mockSession = null; queue = [track(1), track(2)];
  const { container } = render(<Page />); await flush(); await tick();
  expect(mockPlayerProps.playbackKey).toBe(1);
  await act(async () => mockPlayerProps.onEnded());
  await tick(); await tick();
  expect(mockPlayerProps.playbackKey).toBe(2);
  expect(container.textContent).toBe("");
  expect(require("@/lib/supabase").supabase.auth.getSession).not.toHaveBeenCalled();
  expect(require("@/lib/profile").fetchMyProfile).not.toHaveBeenCalled();
  for (const [url, options] of fetchMock.mock.calls) {
    expect(url).not.toContain(token);
    expect(options.headers).toEqual({ "X-Music-Player-Token": token });
  }
});

it("does not start requests when the link is invalid or revoked", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  window.history.replaceState(null, "", `/player#token=${"ab".repeat(32)}`);
  mockSession = null; queue = [track(1)];
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  render(<Page />); await flush();
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(fetchMock.mock.calls.every(([url]) => url.endsWith("/player-access"))).toBe(true);
  expect(mockPlayerProps.videoId).toBeNull();
});
