import { render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = "true";

const UsersPage = require("@/app/(main)/users/page").default;

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe("UsersPage sub badges", () => {
  it("shows proper badges for users", async () => {
    const months = [0, 1, 2, 4, 7, 10, 15, 20, 30];
    const users = months.map((m, i) => ({
      id: i + 1,
      username: `U${i}`,
      auth_id: null,
      twitch_login: `u${i}`,
      total_streams_watched: 0,
      total_subs_gifted: 0,
      total_subs_received: 0,
      total_chat_messages_sent: 0,
      total_times_tagged: 0,
      total_commands_run: 0,
      total_months_subbed: m,
      clips_created: 0,
      combo_commands: 0,
      logged_in: false,
    }));

    (global as any).fetch = jest.fn((url: string) => {
      if (url === "http://backend/api/users") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ users }),
        });
      }
      if (url.startsWith("http://backend/api/twitch-roles?")) {
        const roles = users.reduce(
          (acc, user) => ({
            ...acc,
            [user.twitch_login as string]: { roles: ["Sub"] },
          }),
          {} as Record<string, { roles: string[] }>
        );
        return Promise.resolve({
          ok: true,
          json: async () => ({ roles }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<UsersPage />);

    await waitFor(() =>
      expect(screen.getAllByAltText("Sub")).toHaveLength(months.length - 1)
    );
    const imgs = screen.getAllByAltText("Sub");
    const expected = ["1", "2", "3", "6", "9", "12", "18", "24"];
    imgs.forEach((img, idx) => {
      expect(img).toHaveAttribute("src", `/icons/subs/${expected[idx]}.svg`);
    });

    const firstRow = screen.getByText("U0").closest("li");
    expect(within(firstRow as HTMLElement).queryByAltText("Sub")).toBeNull();
  });
});
