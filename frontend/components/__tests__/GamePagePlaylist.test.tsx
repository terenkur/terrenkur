import { render, screen, act } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";

const GamePage = require("@/app/(main)/games/[id]/page").default;

describe("GamePage playlist", () => {
  it("displays playlist when available", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        game: {
          id: 1,
          name: "Game1",
          background_image: "img",
          status: "backlog",
          rating: null,
          selection_method: null,
          released_year: null,
          genres: null,
          initiators: [],
        },
        polls: [],
        playlist: {
          tag: "rpg",
          videos: [
            {
              id: "v1",
              title: "Video1",
              description: "",
              publishedAt: "2024-01-01",
              thumbnail: null,
            },
          ],
        },
      }),
    });

    await act(async () => {
      render(<GamePage params={Promise.resolve({ id: "1" })} />);
    });

    const heading = await screen.findByRole("heading", { level: 2, name: /Game1/ });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-white");
    expect(screen.queryByText(/#rpg/)).not.toBeInTheDocument();
    expect(screen.getByText("Video1")).toBeInTheDocument();
  });
  it("orders participation by activity and date and links to the correct results", async () => {
    const polls = [
      { id: 10, archived: true, created_at: "2024-01-01", winnerId: 2, winnerName: "Other", voters: [] },
      { id: 11, archived: true, created_at: "2024-02-01", winnerId: 1, voters: [{ id: 3, username: "Player", count: 4 }] },
      { id: 12, archived: false, created_at: "2023-01-01", voters: [] },
      { id: 13, archived: true, created_at: "2023-02-01", voters: [] },
    ];
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      game: { id: 1, name: "Game", status: "active", initiators: [], votes: 4, roulettes: 4 }, polls,
    }) });
    await act(async () => { render(<GamePage params={Promise.resolve({ id: "1" })} />); });
    const history = screen.getByRole("heading", { name: "Участие в рулетках" }).parentElement!;
    expect(Array.from(history.querySelectorAll("li > div > a"), link => link.getAttribute("href")))
      .toEqual(["/", "/archive/11", "/archive/10", "/archive/13"]);
    expect(screen.getByText("Победа")).toBeInTheDocument();
    expect(screen.getByText("Победитель не указан.")).toBeInTheDocument();
    expect(screen.getByText("Голосов за игру: 4")).toBeInTheDocument();
    expect(screen.getByText("Player").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Other" })).toHaveAttribute("href", "/games/2");
  });
});
