const http = require('http');
const port = process.env.PORT || 3002;
require('./bot');                    // starts the bot

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); }
  else { res.writeHead(404); res.end(); }
});

server.listen(port, () => console.log(`Healthcheck listening on ${port}`));

module.exports = server;
