jest.mock('../supabase', () => ({ supabase: { auth: {} } }));
import { storeProviderToken, getStoredProviderToken } from '../twitch';
afterEach(() => localStorage.clear());
it('stores the current user provider token', () => { storeProviderToken('fixture'); expect(getStoredProviderToken()).toBe('fixture'); });
it('clears the current user provider token at logout', () => { storeProviderToken('fixture'); storeProviderToken(undefined); expect(getStoredProviderToken()).toBeUndefined(); });
