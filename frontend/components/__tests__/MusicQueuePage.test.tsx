import { act, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
jest.mock("@/lib/supabase", () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} } }));
jest.mock("event-source-polyfill", () => ({
  EventSourcePolyfill: jest.fn().mockImplementation(() => ({ close() {} })),
}));
const Page = require("@/app/(main)/music-queue/page").default;
const { EventSourcePolyfill } = require("event-source-polyfill");
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

it("retries a failed load, shows queue positions, expands history and refreshes on reconnect", async () => {
  const track = { id: 1, title: "First", url: "https://youtu.be/first", requested_by: "Viewer" };
  const history = Array.from({ length: 4 }, (_, i) => ({ ...track, id: i + 2, title: `Old ${i}`, status: "completed" }));
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ queue: [track], history }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ active: track, queue: [], history }) });
  global.fetch = fetchMock;
  render(<Page />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Сейчас играет")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
  expect(await screen.findByText("Следующий трек — First")).toBeVisible();
  expect(screen.getByText("№1 · Следующий")).toBeVisible();
  expect(screen.queryByText("Old 3")).toBeNull();
  fireEvent.click(screen.getByText("Показать всю историю (4)"));
  expect(screen.getByText("Old 3")).toBeVisible();
  const stream = EventSourcePolyfill.mock.results.at(-1).value;
  await act(async () => { stream.onopen(); });
  expect(screen.queryByText("Следующий трек — First")).toBeNull();
  expect(screen.getByRole("link", { name: "First" })).toBeVisible();
});
