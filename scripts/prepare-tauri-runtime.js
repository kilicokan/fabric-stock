const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const standaloneNextDir = path.join(standaloneDir, '.next');
const staticDir = path.join(projectRoot, '.next', 'static');
const publicDir = path.join(projectRoot, 'public');
const runtimeDir = path.join(projectRoot, '.next', 'tauri-runtime');
const nodeExecutable = path.join(runtimeDir, 'node.exe');

if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  throw new Error('Next.js standalone server was not created by the build.');
}

fs.mkdirSync(standaloneNextDir, { recursive: true });
fs.cpSync(staticDir, path.join(standaloneNextDir, 'static'), { recursive: true });
fs.cpSync(publicDir, path.join(standaloneDir, 'public'), { recursive: true });

for (const envFile of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  fs.rmSync(path.join(standaloneDir, envFile), { force: true });
}

fs.mkdirSync(runtimeDir, { recursive: true });
fs.copyFileSync(process.execPath, nodeExecutable);
fs.writeFileSync(
  path.join(standaloneDir, 'tauri-env.cjs'),
  `const fs = require('node:fs');
const dotenv = require('./node_modules/dotenv');
const envFile = process.env.MIRAAPP_ENV_FILE;

if (envFile && fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  console.error('Application environment file is missing. Configure DATABASE_URL and JWT_SECRET in the user config file.');
}
`,
);

console.log('Prepared the standalone Next.js server and Node.js runtime for Tauri.');
