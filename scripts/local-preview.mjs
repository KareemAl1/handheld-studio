import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new URL('../.cache/', import.meta.url);
const stateFile = new URL('local-preview.json', cache);
const logFile = new URL('local-preview.log', cache);
const url = 'http://127.0.0.1:5173';
const action = process.argv[2] ?? 'status';

function savedState() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch { return null; }
}

function isManaged(current) {
  const saved = savedState();
  return saved?.pid === current.pid && saved?.instance === current.instance;
}

async function health() {
  try {
    const response = await fetch(`${url}/__handheld_studio_health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return null;
    const value = await response.json();
    return value.app === 'handheld-studio' ? value : null;
  } catch { return null; }
}

async function verifyAssets() {
  const checks = [
    { path: '/', mime: 'text/html', signature: '<!doctype html>' },
    { path: '/src/scene/StudioScene.tsx', mime: 'javascript', signature: null },
    { path: '/models/hs-01.glb', mime: 'model/gltf-binary', signature: 'glTF' },
    { path: '/images/hs-01-poster.webp', mime: 'image/webp', signature: 'RIFF' },
  ];
  return Promise.all(checks.map(async ({ path, mime, signature }) => {
    const response = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(10_000) });
    const type = response.headers.get('content-type') ?? '';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !type.includes(mime) || (signature && !bytes.subarray(0, signature.length).toString().toLowerCase().startsWith(signature.toLowerCase()))) {
      throw new Error(`Preview asset failed: ${path} (${response.status}, ${type})`);
    }
    return { path, status: response.status, type, bytes: bytes.length };
  }));
}

async function start() {
  const existing = await health();
  if (existing) {
    console.log(JSON.stringify({ status: 'already-running', managed: isManaged(existing), url, pid: existing.pid, assets: await verifyAssets() }, null, 2));
    if (!isManaged(existing)) console.log('This preview was started elsewhere; keep its launching terminal running.');
    return;
  }
  mkdirSync(cache, { recursive: true });
  const output = openSync(logFile, 'a');
  const instance = randomUUID();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', output, output],
    env: { ...process.env, HANDHELD_PREVIEW_INSTANCE: instance },
  });
  closeSync(output);
  let startupError;
  child.once('error', (error) => { startupError = error; });
  child.unref();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (startupError) throw startupError;
    const current = await health();
    if (current?.instance === instance && current.pid === child.pid) {
      let assets;
      try { assets = await verifyAssets(); }
      catch (error) {
        // A failed preflight must not leave a new detached process behind.
        child.kill();
        throw error;
      }
      writeFileSync(stateFile, JSON.stringify({ pid: child.pid, instance, url, startedAt: new Date().toISOString() }, null, 2));
      console.log(JSON.stringify({ status: 'started', managed: true, url, pid: child.pid, assets, log: fileURLToPath(logFile) }, null, 2));
      return;
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  // Stop only the child this invocation created; never a process already using the port.
  if (child.exitCode === null) child.kill();
  throw new Error(`Preview did not start on port 5173. Check ${fileURLToPath(logFile)}; an existing listener is never replaced automatically.`);
}

async function stop() {
  const saved = savedState();
  if (!saved) { console.log('No managed preview to stop.'); return; }
  const current = await health();
  if (current?.instance === saved.instance && current.pid === saved.pid) {
    process.kill(saved.pid);
    rmSync(stateFile);
    console.log('Handheld Studio local preview stopped.');
  } else if (!current) {
    try { process.kill(saved.pid, 0); }
    catch (error) {
      if (error.code === 'ESRCH') {
        rmSync(stateFile);
        console.log('Managed preview has exited; removed its stale state file. No process was stopped.');
        return;
      }
    }
    throw new Error('Preview health is unreachable, so process identity could not be confirmed. State was retained and no process was stopped; retry shortly.');
  } else throw new Error('The listener does not match this launcher’s saved process. It was left untouched.');
}

try {
  if (action === 'start') await start();
  else if (action === 'stop') await stop();
  else if (action === 'status') {
    const current = await health();
    if (!current) throw new Error(`Handheld Studio is not running at ${url}. Run npm run preview:start.`);
    console.log(JSON.stringify({ status: 'running', managed: isManaged(current), url, pid: current.pid, assets: await verifyAssets() }, null, 2));
  } else throw new Error('Usage: node scripts/local-preview.mjs start|status|stop');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
