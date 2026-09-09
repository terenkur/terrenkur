const express = require('express');
const request = require('supertest');
const { createImageProxy } = require('../imageProxy');

describe('image proxy resilience', () => {
  let app;
  const url = '/image?url=https://media.rawg.io/test.jpg';
  const image = () => new Response('jpeg', { headers: { 'content-type': 'image/jpeg' } });
  beforeEach(() => { app = express(); app.get('/image', createImageProxy()); });
  afterEach(() => jest.restoreAllMocks());
  it('caches successful responses', async () => {
    const upstream = jest.spyOn(global, 'fetch').mockResolvedValue(image());
    expect((await request(app).get(url)).status).toBe(200);
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('max-age=3600');
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('returns a stale cached image during an outage', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(image()).mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    await request(app).get(url);
    Date.now.mockReturnValue(now + 3600001);
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
    expect(response.headers.warning).toContain('stale');
  });
  it('returns 504 for an uncached timeout', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    expect((await request(app).get(url)).status).toBe(504);
  });
  it('rejects non-image upstream content', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
    expect((await request(app).get(url)).status).toBe(502);
  });
  it('rejects oversized images before buffering', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('jpeg', { headers: { 'content-type': 'image/jpeg', 'content-length': '5000000' } }));
    expect((await request(app).get(url)).status).toBe(502);
  });
  it('rejects HTTP and credentials and disables automatic redirects', async () => {
    const upstream = jest.spyOn(global, 'fetch').mockResolvedValue(image());
    expect((await request(app).get('/image?url=http://media.rawg.io/test')).status).toBe(400);
    expect((await request(app).get('/image?url=https://user:password@media.rawg.io/test')).status).toBe(400);
    await request(app).get(url);
    expect(upstream).toHaveBeenCalledWith('https://media.rawg.io/test.jpg', expect.objectContaining({ redirect: 'error' }));
  });
});
