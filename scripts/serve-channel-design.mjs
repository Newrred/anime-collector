import { fileURLToPath } from 'node:url';
import { parseArguments, startDesignPrototypeServer } from './serve-design-prototypes.mjs';

try {
  const args = process.argv.slice(2);
  const options = args.length ? parseArguments(args) : { port: 4351 };
  if (options.help) {
    console.log('Usage: npm run design:preview:v84 -- [--port 1..65535]\nLoopback-only V8.4 design preview.');
  } else {
    const root = fileURLToPath(new URL('../design/', import.meta.url));
    const server = await startDesignPrototypeServer({ root, port: options.port });
    console.log(`V8.4 preview: http://127.0.0.1:${server.address().port}/channel-study-v8.4/index.html#home\nFictional prototype only. Press Ctrl+C to stop.`);
    const stop = () => { server.close(); server.closeAllConnections(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
} catch (error) {
  console.error(error.code === 'EADDRINUSE'
    ? 'Preview port is already in use. Choose another --port.'
    : `V8.4 preview failed: ${error.code === 'ENOENT' ? 'Fetch the design handoff files first.' : error.message}`);
  process.exitCode = 1;
}
