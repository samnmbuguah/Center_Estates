const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: "./apps/web" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  require("http").createServer((request, response) => handle(request, response)).listen(port);
});
