import { render, screen } from "@testing-library/react";
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
    expect(fetchMock.mock.calls[0][0]).toBe('http://backend/api/users');
  } finally { global.fetch = oldFetch; }
});
