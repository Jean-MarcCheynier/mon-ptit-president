// Starts the dev stack reachable from other devices on the local network (e.g. a phone).
// Vite listens on every interface; the API trusts the LAN origin and builds email links with it.
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const ip = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === 'IPv4' && !address.internal)?.address;

if (!ip) {
  console.error('No LAN IPv4 address found. Are you connected to a network?');
  process.exit(1);
}

const appUrl = `http://${ip}:5173`;
console.log(`\n  App:     ${appUrl}\n  Mailpit: http://${ip}:8025\n`);

const dev = spawn('pnpm', ['turbo', 'run', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, APP_URL: appUrl, DEV_HOST: '0.0.0.0' },
});
dev.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => dev.kill(signal));
