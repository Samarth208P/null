import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = dirname(fileURLToPath(import.meta.url));
let yaml = await readFile(resolve(directory, 'subgraph.template.yaml'), 'utf8');
yaml += await readFile(resolve(directory, 'erc5564.template.yaml'), 'utf8');
const values = { NULL_POOL: '0x0000000000000000000000000000000000000000', ERC5564_ANNOUNCER: '0x0000000000000000000000000000000000000001', START_BLOCK: '0', ERC5564_START_BLOCK: '0', CHAIN_ID: '11155111' };
for (const [key, value] of Object.entries(values)) yaml = yaml.replaceAll(`{{${key}}}`, value);
await writeFile(resolve(directory, 'subgraph.build.yaml'), '# SOURCE COMPILATION ONLY. Inert addresses; never deploy this manifest.\n' + yaml);
