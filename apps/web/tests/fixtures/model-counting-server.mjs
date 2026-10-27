import { createServer } from "node:http";

let count = 0;
createServer((request, response) => {
  if (request.url === "/count") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ count }));
    return;
  }
  count += 1;
  response.writeHead(400);
  response.end("Local test provider");
}).listen(Number(process.env.MODEL_STUB_PORT ?? 3219), "127.0.0.1");
