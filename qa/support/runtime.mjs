import { readFileSync } from 'node:fs';

export function localBaseURL(port = process.env.ERP_QA_PORT || '18080') {
  if (!/^[0-9]{1,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
    throw new Error('ERP_QA_PORT must be a TCP port between 1024 and 65535');
  }
  return `http://127.0.0.1:${Number(port)}`;
}

export function readSite() {
  let site;
  try {
    site = JSON.parse(readFileSync(new URL('../.runtime/site.json', import.meta.url), 'utf8'));
  } catch (cause) {
    throw new Error('Prepare the disposable site first with npm run stack:up', { cause });
  }
  if (site.baseURL !== localBaseURL() || site.company !== 'QA Synthetic Aster Relay Cooperative' ||
      site.username !== 'qa-sales-operator@example.invalid' || site.erpnextVersion !== '17.0.0-dev' ||
      !site.apiKey || !site.apiSecret) {
    throw new Error('The runtime file does not describe this disposable QA site');
  }
  return site;
}
