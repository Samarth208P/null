import { createServer } from 'node:http';
import { organizationHandler } from './server.js';
const server = createServer(organizationHandler);
server.requestTimeout = 30_000; server.headersTimeout = 10_000;
const port = Number(process.env.ORGANIZATION_PORT ?? '8788');
server.listen(port, '127.0.0.1', () => console.info(`NULL organization API listening on port ${port}`));
