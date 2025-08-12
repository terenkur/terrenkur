import { render, screen, waitFor } from "@testing-library/react";

process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = "true";

const UsersPage = require("@/app/users/page").default;

jest.mock("@/lib/useTwitchUserInfo", () => ({
  useTwitchUserInfo: jest.fn(),
}));

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

const { useTwitchUserInfo } = require("@/lib/useTwitchUserInfo");

describe("UsersPage sub badges", () => {
  beforeEach(() => {
    (useTwitchUserInfo as jest.Mock).mockReturnValue({
      profileUrl: null,
      roles: ["Sub"],
      error: null,
    });
  });

  it("shows proper badges for users", async () => {
    const months = [1, 2, 4, 7, 10, 15, 20, 30];
    const users = months.map((m, i) => ({
      id: i + 1,
      username: `U${i}`,
      auth_id: null,
      twitch_login: null,
      total_streams_watched: 0,
      total_subs_gifted: 0,
      total_subs_received: 0,
      total_chat_messages_sent: 0,
      total_times_tagged: 0,
      total_commands_run: 0,
      total_months_subbed: m,
      logged_in: false,
    }));

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users }),
    });

    render(<UsersPage />);

    await waitFor(() =>
      expect(screen.getAllByAltText("Sub")).toHaveLength(months.length)
    );
    const imgs = screen.getAllByAltText("Sub");
    const expected = ["1", "2", "3", "6", "9", "12", "18", "24"];
    imgs.forEach((img, idx) => {
      expect(img).toHaveAttribute("src", `/icons/subs/${expected[idx]}.svg`);
    });
  });
});
