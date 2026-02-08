import { render, screen } from "@testing-library/react";
import { SettingsProvider } from "@/components/SettingsProvider";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
process.env.NEXT_PUBLIC_TWITCH_CHANNEL_ID = "chan";

jest.mock("@/lib/supabase", () => {
  const maybeSingle = jest.fn().mockResolvedValue({ data: { is_moderator: true } });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq, maybeSingle });
  const from = jest.fn().mockReturnValue({ select, eq, maybeSingle });
  return {
    supabase: {
      auth: {
        getSession: jest
          .fn()
          .mockResolvedValue({ data: { session: { user: { id: "u1" }, access_token: "access" } } }),
        onAuthStateChange: jest
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
      from,
    },
  };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe("SettingsPage moderator access without provider token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads rewards using streamer token and sends auth for obs-media", async () => {
    (global as any).fetch = jest.fn((url: string, options?: any) => {
      if (url === "http://backend/api/log_reward_ids") {
        return Promise.resolve({ ok: true, json: async () => ({ ids: [] }) });
      }
      if (url === "http://backend/api/obs-media?grouped=true") {
        expect(options?.headers?.Authorization).toBe("Bearer access");
        return Promise.resolve({
          ok: true,
          json: async () => ({ media: { intim: [], kiss: [] }, types: ["intim", "kiss"] }),
        });
      }
      if (url === "http://backend/api/streamer-token") {
        return Promise.resolve({ ok: true, json: async () => ({ token: "streamer-token" }) });
      }
      if (
        url ===
        "http://backend/api/get-stream?endpoint=channel_points/custom_rewards&broadcaster_id=chan"
      ) {
        expect(options?.headers?.Authorization).toBe("Bearer streamer-token");
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: "1", title: "Reward1" }] }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const SettingsPage = require("@/app/(main)/settings/page").default;
    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    expect(await screen.findByText("Reward1")).toBeInTheDocument();
    expect((global as any).fetch).toHaveBeenCalledWith("http://backend/api/streamer-token");
  });

  it("renders multiple obs media entries", async () => {
    (global as any).fetch = jest.fn((url: string) => {
      if (url === "http://backend/api/log_reward_ids") {
        return Promise.resolve({ ok: true, json: async () => ({ ids: [] }) });
      }
      if (url === "http://backend/api/obs-media?grouped=true") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            media: {
              intim: [
                { id: 1, gif: "g1", sound: "s1" },
                { id: 2, gif: "g2", sound: "s2" },
              ],
              kiss: [],
            },
            types: ["intim", "kiss"],
          }),
        });
      }
      if (url === "http://backend/api/streamer-token") {
        return Promise.resolve({ ok: true, json: async () => ({ token: "tok" }) });
      }
      if (url.startsWith("http://backend/api/get-stream")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({ ok: false });
    });

    const SettingsPage = require("@/app/(main)/settings/page").default;
    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    expect(await screen.findAllByText("addMedia")).toHaveLength(2);
  });
});
