import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModeratorPage from '../(main)/moderator/page';
import { supabase } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/profile';
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: jest.fn(), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  signInWithPassword: jest.fn(), signOut: jest.fn().mockResolvedValue({error:null}),
} } }));
jest.mock('@/lib/profile', () => ({ fetchMyProfile: jest.fn() }));
const auth = supabase.auth as any;
beforeEach(() => {
  jest.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null } });
});
async function submit() {
  render(<ModeratorPage />);
  fireEvent.change(await screen.findByLabelText('Email'), {target:{value:'staff@example.com'}});
  fireEvent.change(screen.getByLabelText('Пароль'), {target:{value:'test-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Войти'}));
}
it('uses password login and shows controls only after server approval', async () => {
  auth.signInWithPassword.mockResolvedValue({data:{session:{access_token:'fixture'}}});
  (fetchMyProfile as jest.Mock).mockResolvedValue({data:{is_moderator:true}});
  await submit();
  expect(await screen.findByRole('link',{name:'Создать рулетку'})).toHaveAttribute('href','/new-poll');
  expect(auth.signInWithPassword).toHaveBeenCalledWith({email:'staff@example.com',password:'test-password'});
});
it('clears a valid session if the server rejects staff access', async () => {
  auth.signInWithPassword.mockResolvedValue({data:{session:{access_token:'fixture'}}});
  (fetchMyProfile as jest.Mock).mockResolvedValue({data:null,error:new Error('forbidden')});
  await submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Доступ к управлению не подтверждён');
  expect(auth.signOut).toHaveBeenCalledWith({scope:'local'});
  expect(screen.queryByRole('link',{name:'Настройки'})).not.toBeInTheDocument();
});
it('handles incorrect passwords without showing controls or leaking provider errors', async () => {
  auth.signInWithPassword.mockResolvedValue({data:{session:null},error:{message:'internal details'}});
  await submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Проверьте email и пароль');
  expect(fetchMyProfile).not.toHaveBeenCalled();
  await waitFor(()=>expect(screen.getByLabelText('Пароль')).toHaveValue(''));
});
it('ends a staff session on logout', async () => {
  auth.getSession.mockResolvedValue({data:{session:{access_token:'fixture'}}});
  (fetchMyProfile as jest.Mock).mockResolvedValue({data:{is_moderator:true}});
  render(<ModeratorPage />);
  fireEvent.click(await screen.findByRole('button',{name:'Выйти'}));
  expect(await screen.findByRole('button',{name:'Войти'})).toBeInTheDocument();
  expect(auth.signOut).toHaveBeenCalledWith({scope:'local'});
});
