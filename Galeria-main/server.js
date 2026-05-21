const http = require("http");
const { port, host } = require("./src/config");
const { handler } = require("./src/staticHandler");

const server = http.createServer(handler);

server.listen(port, host, () => {
  console.log(`Galeria Live available at http://${host}:${port}`);
});
