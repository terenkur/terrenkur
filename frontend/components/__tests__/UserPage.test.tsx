import { render, screen, act, fireEvent } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";

const UserPage = require("@/app/users/[id]/page").default;

jest.mock("@/lib/useTwitchUserInfo", () => ({
  useTwitchUserInfo: () => ({ profileUrl: null, roles: [], error: null }),
}));

describe("UserPage", () => {
  it("shows stats when categories expand", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 1,
            username: "Alice",
            auth_id: null,
            twitch_login: null,
            logged_in: false,
            total_streams_watched: 0,
            total_subs_gifted: 0,
            total_subs_received: 0,
            total_chat_messages_sent: 0,
            total_times_tagged: 0,
            total_commands_run: 0,
            total_months_subbed: 0,
            votes: 3,
            roulettes: 2,
            intim_no_tag_0: 1,
            poceluy_with_tag_69: 2,
          },
          history: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ games: [] }),
      });

    (global as any).fetch = fetchMock;

    await act(async () => {
      render(<UserPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(await screen.findByText("Votes: 3")).toBeInTheDocument();

    const intimSummary = screen.getByText("Интимы");
    fireEvent.click(intimSummary);
    expect(intimSummary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Интим с 0%: 1")).toBeInTheDocument();

    const poceluySummary = screen.getByText("Поцелуи");
    fireEvent.click(poceluySummary);
    expect(poceluySummary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Заставил кого-то поцеловаться с 69%: 2")).toBeInTheDocument();
  });
});

