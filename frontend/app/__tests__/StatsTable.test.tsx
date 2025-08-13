import { render, screen, within, fireEvent } from "@testing-library/react";
import StatsTable, { StatUser } from "@/components/StatsTable";

describe("StatsTable", () => {
  it("renders medal icons for top three rows", () => {
    const rows: StatUser[] = [
      { id: 1, username: "Alice", value: 10 },
      { id: 2, username: "Bob", value: 9 },
      { id: 3, username: "Charlie", value: 8 },
      { id: 4, username: "Dave", value: 7 },
    ];

    render(<StatsTable title="Value" rows={rows} />);

    const summary = screen.getByText("Value", { selector: "summary" });
    fireEvent.click(summary);

    const tableRows = screen.getAllByRole("row");
    expect(within(tableRows[1]).getByText("🥇")).toBeInTheDocument();
    expect(within(tableRows[2]).getByText("🥈")).toBeInTheDocument();
    expect(within(tableRows[3]).getByText("🥉")).toBeInTheDocument();
    expect(within(tableRows[4]).queryByText(/🥇|🥈|🥉/)).toBeNull();
  });
});
