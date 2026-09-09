// Retry only safe reads. Never replay a vote or another mutation automatically.
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 20000, retryRead = true): Promise<Response> {
  const attempts = retryRead && (init.method || 'GET').toUpperCase() === 'GET' ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) throw new DOMException('Request canceled', 'AbortError');
    init.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (attempt + 1 < attempts && [502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt + 1 === attempts) throw new Error('Не удалось связаться с сервером. Попробуйте ещё раз.');
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', abort);
    }
  }
  throw new Error('Сервер недоступен');
}
