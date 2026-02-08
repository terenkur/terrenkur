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
});
