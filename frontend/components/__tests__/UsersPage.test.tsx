import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend";
process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = "true";
const UsersPage = require("@/app/(main)/users/page").default;
it("shows participants without login history or role requests even with the old flag", async () => {
  await i18n.changeLanguage('ru');
  const oldFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({ok:true,json:async()=>({users:[{id:1,username:'Alice',twitch_login:'alice',auth_id:'old-id',logged_in:true},{id:2,username:'Bob',logged_in:false}]})});
  global.fetch = fetchMock;
  try {
    render(<UsersPage />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText(/входил|Вход через сайт|Фильтр ролей/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend/api/users?votersOnly=true');
  } finally { global.fetch = oldFetch; }
});

it("keeps previous results while searching and distinguishes an empty search from an empty list", async () => {
  const oldFetch = global.fetch;
  const response = (users: object[]) => ({ ok: true, json: async () => ({ users }) });
  let finish!: (value: ReturnType<typeof response>) => void;
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response([{ id: 1, username: "Alice", twitch_login: "stream_alice" }]))
    .mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(response([]));
  try {
    render(<UsersPage />);
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("loading"));
    const row = await screen.findByRole("link", { name: /Alice @stream_alice/ });
    expect(row).toHaveAttribute("href", "/users/1");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(row).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Обновляем");
    finish(response([]));
    expect(await screen.findByText("Никого не нашли.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
    expect(await screen.findByText("Пока никто не голосовал.")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  } finally { global.fetch = oldFetch; }
});
