import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localBaseURL } from '../support/runtime.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const stack = fileURLToPath(new URL('../.stack/pwd.yml', import.meta.url));
const upstream = 'https://raw.githubusercontent.com/frappe/frappe_docker/48b9479a9697d0049e795fd7b682eb6544923410/pwd.yml';
const sha256 = '940af608ae22276ae660357e7bf33944c0fb16e87f505cf535658f415b3ff978';
const composeArgs = ['compose', '--project-name', 'erpnext-qa-work-sample', '--project-directory', '.', '-f', stack, '-f', 'compose.qa.yml'];

function docker(args, capture = false) {
  const result = spawnSync('docker', [...composeArgs, ...args], {
    cwd: root, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', timeout: 600_000,
  });
  if (result.error || result.status !== 0) {
    if (capture) console.error(result.stderr?.trim());
    throw new Error(`docker compose ${args.join(' ')} failed with ${result.error?.message ?? result.status}`);
  }
  return result.stdout;
}

async function prepareStackFile() {
  let bytes;
  try {
    bytes = readFileSync(stack);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(upstream, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Could not fetch pinned Compose file (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Upstream Compose checksum mismatch');
  mkdirSync(new URL('../.stack/', import.meta.url), { recursive: true });
  writeFileSync(stack, bytes);
}

async function waitForSite(baseURL) {
  for (let attempt = 0; attempt < 45; attempt++) {
    const response = await fetch(`${baseURL}/api/method/ping`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (response?.ok && (await response.json().catch(() => null))?.message === 'pong') return;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('ERPNext did not respond to /api/method/ping');
}

const action = process.argv[2];
const state = new URL('../.runtime/site.json', import.meta.url);
const baseURL = localBaseURL();
await prepareStackFile();

switch (action) {
  case 'up': {
    rmSync(state, { force: true });
    docker(['up', '-d']);
    docker(['wait', 'create-site']);
    const out = docker(['exec', '-T', 'backend', './env/bin/python', '/qa/scripts/seed.py'], true);
    const marker = out.split(/\r?\n/).find(line => line.startsWith('QA_SITE='));
    if (!marker) throw new Error('Site setup did not produce the QA_SITE marker');
    const credentials = JSON.parse(marker.slice('QA_SITE='.length));
    await waitForSite(baseURL);
    mkdirSync(new URL('../.runtime/', import.meta.url), { recursive: true });
    writeFileSync(state, JSON.stringify({ ...credentials, baseURL }, null, 2), { mode: 0o600 });
    console.log(`Prepared ERPNext at ${baseURL}`);
    break;
  }
  case 'domain':
    docker(['exec', '-T', 'backend', './env/bin/python', '/qa/tests/unit/delivery_rules.py']);
    break;
  case 'logs':
    docker(['logs', '--no-color', '--tail', '60', 'create-site', 'backend', 'frontend']);
    break;
  case 'down':
    docker(['down', '--volumes']);
    rmSync(state, { force: true });
    break;
  default:
    throw new Error('Use up, domain, logs or down');
}
