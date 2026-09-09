import { fetchWithTimeout } from '../fetchWithTimeout';

describe('bounded API requests', () => {
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
  it('retries a temporary GET failure once', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ status: 200 } as Response);
    expect((await fetchWithTimeout('/api/poll')).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not replay a mutation', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(fetchWithTimeout('/api/vote', { method: 'POST' })).rejects.toThrow('сервером');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry authorization errors', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ status: 401 } as Response);
    expect((await fetchWithTimeout('/api/me')).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('applies the timeout even with an external signal', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const result = expect(fetchWithTimeout('/api/test', { method: 'POST', signal: new AbortController().signal }, 100)).rejects.toThrow('сервером');
    await jest.advanceTimersByTimeAsync(100);
    await result;
  });
  it('does not retry when the component cancels', async () => {
    const controller = new AbortController();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const result = expect(fetchWithTimeout('/api/poll', { signal: controller.signal })).rejects.toThrow('aborted');
    controller.abort();
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
