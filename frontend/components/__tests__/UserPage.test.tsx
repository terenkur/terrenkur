import { render, screen, act, fireEvent, waitFor, within } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = "true";

const UserPage = require("@/app/users/[id]/page").default;

jest.mock("@/lib/useTwitchUserInfo", () => ({
  useTwitchUserInfo: jest.fn(),
}));

const { useTwitchUserInfo } = require("@/lib/useTwitchUserInfo");

const originalFetch = (global as any).fetch;

describe("UserPage", () => {
  beforeEach(() => {
    (useTwitchUserInfo as jest.Mock).mockReturnValue({
      profileUrl: null,
      roles: [],
      error: null,
    });
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ achievements: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ medals: {} }),
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

    const totalSummary = screen.getByText("Статистика");
    fireEvent.click(totalSummary);
    expect(totalSummary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Просмотрено стримов: 0")).toBeInTheDocument();
  });

  it("displays achievements and medals from API", async () => {
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
            votes: 0,
            roulettes: 0,
          },
          history: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ games: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          achievements: [
            {
              id: 1,
              title: "First Blood",
              stat_key: "total_streams_watched",
              description: "desc",
              threshold: 1,
              earned_at: "2020-01-01",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          medals: { total_streams_watched: "gold" },
        }),
      });

    (global as any).fetch = fetchMock;

    await act(async () => {
      render(<UserPage params={Promise.resolve({ id: "1" })} />);
    });

    const achievementsSummary = screen.getByText("Achievements");
    fireEvent.click(achievementsSummary);
    const achievementsDetails = achievementsSummary.closest("details")!;
    expect(
      within(achievementsDetails).getByText("First Blood")
    ).toBeInTheDocument();

    const medalsSummary = screen.getByText("Medals");
    fireEvent.click(medalsSummary);
    const medalsDetails = medalsSummary.closest("details")!;
    expect(
      within(medalsDetails).getByText("Просмотрено стримов")
    ).toBeInTheDocument();
    expect(within(medalsDetails).getByText("🥇")).toBeInTheDocument();
  });
});

describe("UserPage sub badges", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = "true";
    (useTwitchUserInfo as jest.Mock).mockReturnValue({
      profileUrl: null,
      roles: ["Sub"],
      error: null,
    });
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  it.each([
    [1, "1"],
    [2, "2"],
    [4, "3"],
    [7, "6"],
    [10, "9"],
    [15, "12"],
    [20, "18"],
    [30, "24"],
  ])("renders %s.svg for %d months", async (months, badge) => {
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
            total_months_subbed: months,
            votes: 0,
            roulettes: 0,
          },
          history: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ games: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ achievements: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ medals: {} }),
      });

    (global as any).fetch = fetchMock;

    await act(async () => {
      render(<UserPage params={Promise.resolve({ id: "1" })} />);
    });

    const img = await screen.findByAltText("Sub");
    expect(img).toHaveAttribute("src", `/icons/subs/${badge}.svg`);
  });

  it("does not render badge for 0 months", async () => {
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
            votes: 0,
            roulettes: 0,
          },
          history: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ games: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ achievements: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ medals: {} }),
      });

    (global as any).fetch = fetchMock;

    await act(async () => {
      render(<UserPage params={Promise.resolve({ id: "1" })} />);
    });

    await waitFor(() => {
      expect(screen.queryByAltText("Sub")).toBeNull();
    });
  });
});

