import { render, screen, fireEvent, within, act } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = "false";

jest.mock("@/lib/useTwitchUserInfo", () => ({
  useTwitchUserInfo: () => ({ profileUrl: null, roles: [], error: null }),
}));

const UserPage = require("@/app/users/[id]/page").default;

describe("UserPage stats filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hides zero values and empty sections", async () => {
    const user: any = {
      id: 1,
      username: "User",
      auth_id: null,
      twitch_login: null,
      logged_in: false,
      votes: 0,
      roulettes: 0,
      total_streams_watched: 5,
      total_subs_gifted: 0,
      total_subs_received: 0,
      total_chat_messages_sent: 0,
      total_times_tagged: 0,
      total_commands_run: 0,
      total_months_subbed: 0,
      intim_no_tag_0: 0,
      intim_no_tag_69: 2,
      poceluy_no_tag_0: 0,
    };

    (global as any).fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => {
          if (url.includes("/api/users/1")) return { user, history: [] };
          if (url.includes("/api/games")) return { games: [] };
          if (url.includes("/api/achievements/1")) return { achievements: [] };
          if (url.includes("/api/medals/1")) return { medals: {} };
          return {};
        },
      })
    );

    await act(async () => {
      render(<UserPage params={Promise.resolve({ id: "1" })} />);
    });

    const intimSummary = await screen.findByText("Интимы");
    fireEvent.click(intimSummary);
    const intimDetails = intimSummary.closest("details")!;
    expect(
      within(intimDetails).getByText("Интим с 69%: 2")
    ).toBeInTheDocument();
    expect(
      within(intimDetails).queryByText("Интим с 0%")
    ).not.toBeInTheDocument();

    expect(screen.queryByText("Поцелуи")).not.toBeInTheDocument();

    const totalSummary = screen.getByText("Статистика");
    fireEvent.click(totalSummary);
    const totalDetails = totalSummary.closest("details")!;
    expect(
      within(totalDetails).getByText("Просмотрено стримов: 5")
    ).toBeInTheDocument();
    expect(
      within(totalDetails).queryByText("Получено подписок")
    ).not.toBeInTheDocument();
  });
});

