import { render, screen, fireEvent, within } from "@testing-library/react";
import { TOTAL_LABELS } from "@/lib/statLabels";
import i18n from "@/i18n";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";

const StatsPage = require("@/app/(main)/stats/page").default;

describe("StatsPage totals", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('ru');
  });

  it("renders totals section after expansion with data from TOTAL_LABELS", async () => {
    const totals = Object.fromEntries(
      Object.keys(TOTAL_LABELS).map((key, i) => [
        key,
        [{ id: i + 1, username: `User${i + 1}`, value: i + 1 }],
      ])
    );
    const hiddenTotals = ["combo_commands", "clips_created"];

    (global as any).fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => {
          if (url.includes("/stats/totals")) return { stats: totals };
          if (url.includes("/stats/intim") || url.includes("/stats/poceluy"))
            return { stats: {} };
          if (url.includes("/stats/popular-games") || url.includes("/stats/game-roulettes"))
            return { games: [] };
          if (url.includes("/stats/top-voters") || url.includes("/stats/top-roulette-users"))
            return { users: [] };
          return {};
        },
      })
    );

    render(<StatsPage />);

    const totalsSummary = await screen.findByText("Статистика", { selector: "summary" });
    const totalsDetails = totalsSummary.closest("details")!;
    expect(totalsDetails).not.toHaveAttribute("open");

    const visibleKeys = Object.keys(TOTAL_LABELS).filter(
      (key) => !hiddenTotals.includes(key)
    );
    const firstKey = visibleKeys[0];
    const firstLabel = TOTAL_LABELS[firstKey];

    fireEvent.click(totalsSummary);

    Object.entries(TOTAL_LABELS).forEach(([key, label]) => {
      const heading = screen.queryByText(label, { selector: "summary" });
      if (hiddenTotals.includes(key)) {
        expect(heading).not.toBeInTheDocument();
      } else {
        expect(heading).toBeInTheDocument();
      }
    });

    const tableSummary = screen.getByText(firstLabel, { selector: "summary" });
    fireEvent.click(tableSummary);
    const tableDetails = tableSummary.closest("details")!;
    const firstUser = totals[firstKey][0].username;
    expect(within(tableDetails).getByText(firstUser)).toBeInTheDocument();

    expect(
      screen.queryByText(TOTAL_LABELS["combo_commands"], { selector: "summary" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(TOTAL_LABELS["clips_created"], { selector: "summary" })
    ).not.toBeInTheDocument();
  });
});
