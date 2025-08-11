import { render, screen, fireEvent, within } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";

const StatsPage = require("@/app/stats/page").default;

describe("StatsPage intim & poceluy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders categories, two-column tables, and scrollable lists", async () => {
    const intim = {
      intim_tag_match_success: [{ id: 1, username: "Alice", value: 1 }],
      intim_tagged_equals_partner: [{ id: 2, username: "Bob", value: 2 }],
      intim_no_tag_69: [{ id: 3, username: "Carol", value: 3 }],
      intim_with_tag_69: [{ id: 4, username: "Dave", value: 4 }],
    };
    const poceluy = {
      poceluy_tag_match_success: [{ id: 5, username: "Eve", value: 5 }],
      poceluy_tagged_equals_partner: [{ id: 6, username: "Frank", value: 6 }],
      poceluy_no_tag_0: [{ id: 7, username: "Grace", value: 7 }],
      poceluy_with_tag_0: [{ id: 8, username: "Heidi", value: 8 }],
    };

    (global as any).fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => {
          if (url.includes("/stats/intim")) return { stats: intim };
          if (url.includes("/stats/poceluy")) return { stats: poceluy };
          if (
            url.includes("/stats/popular-games") ||
            url.includes("/stats/game-roulettes")
          )
            return { games: [] };
          if (
            url.includes("/stats/top-voters") ||
            url.includes("/stats/top-roulette-users")
          )
            return { users: [] };
          return {};
        },
      })
    );

    render(<StatsPage />);

    const intimGroupSummary = await screen.findByText("Интимы");
    fireEvent.click(intimGroupSummary);
    const intimGroupDetails = intimGroupSummary.closest("details")!;
    expect(within(intimGroupDetails).getByText("Интим: Без процентов"))
      .toBeInTheDocument();
    expect(within(intimGroupDetails).getByText("Интим: 69%"))
      .toBeInTheDocument();

    const poceluyGroupSummary = screen.getByText("Поцелуи");
    fireEvent.click(poceluyGroupSummary);
    const poceluyGroupDetails = poceluyGroupSummary.closest("details")!;
    expect(within(poceluyGroupDetails).getByText("Поцелуй: Без процентов"))
      .toBeInTheDocument();
    expect(within(poceluyGroupDetails).getByText("Поцелуй: 0%"))
      .toBeInTheDocument();

    const intimNoneSummary = within(intimGroupDetails).getByText(
      "Интим: Без процентов"
    );
    fireEvent.click(intimNoneSummary);
    const intimNoneDetails = intimNoneSummary.closest("details")!;
    const intimGrid = intimNoneDetails.querySelector("div.grid")!;
    expect(intimGrid.className).toContain("md:grid-cols-2");
    expect(intimGrid.querySelectorAll("details").length).toBe(2);

    const innerIntimSummary = within(intimGrid).getAllByText(
      "Заставил кого-то интимиться с самим собой"
    )[0];
    fireEvent.click(innerIntimSummary);
    const intimTableContainer = innerIntimSummary
      .closest("details")!
      .querySelector("div.max-h-60.overflow-y-auto")!;
    expect(intimTableContainer).toBeInTheDocument();
    expect(within(intimTableContainer).getByText("Alice")).toBeInTheDocument();

    const poceluy0Summary = within(poceluyGroupDetails).getByText(
      "Поцелуй: 0%"
    );
    fireEvent.click(poceluy0Summary);
    const poceluy0Details = poceluy0Summary.closest("details")!;
    const poceluyGrid = poceluy0Details.querySelector("div.grid")!;
    expect(poceluyGrid.querySelectorAll("details").length).toBe(2);

    const innerPoceluySummary = within(poceluyGrid).getAllByText(
      "Поцелуй с 0%"
    )[0];
    fireEvent.click(innerPoceluySummary);
    const poceluyTableContainer = innerPoceluySummary
      .closest("details")!
      .querySelector("div.max-h-60.overflow-y-auto")!;
    expect(poceluyTableContainer).toBeInTheDocument();
    expect(within(poceluyTableContainer).getByText("Grace")).toBeInTheDocument();
  });
});

