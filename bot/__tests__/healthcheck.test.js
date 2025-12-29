const http = require('http');

jest.mock('../bot', () => {});

let server;

beforeAll(async () => {
  server = require('../server');
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }
});

afterAll((done) => {
  server.close(done);
});

test('responds with 200 on /health', (done) => {
  const port = process.env.PORT || 4000;
  http.get(`http://localhost:${port}/health`, (res) => {
    expect(res.statusCode).toBe(200);
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      expect(body).toBe('ok');
      done();
    });
  }).on('error', done);
});
