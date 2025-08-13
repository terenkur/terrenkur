import { render, screen } from "@testing-library/react";

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

describe("SettingsPage moderator access without provider token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads rewards using streamer token", async () => {
    (global as any).fetch = jest.fn((url: string, options?: any) => {
      if (url === "http://backend/api/log_reward_ids") {
        return Promise.resolve({ ok: true, json: async () => ({ ids: [] }) });
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

    const SettingsPage = require("@/app/settings/page").default;
    render(<SettingsPage />);

    expect(await screen.findByText("Reward1")).toBeInTheDocument();
    expect((global as any).fetch).toHaveBeenCalledWith("http://backend/api/streamer-token");
  });
});
