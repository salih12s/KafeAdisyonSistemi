// Hostinger için tek bir Node.js paketi üretir (ADR-026): `dist` içindeki Express API,
// derlenmiş web uygulamasını aynı alan adında `dist/public` klasöründen sunar.
// Kullanım: npm run package:hostinger  ->  deploy/kafe-adisyon-hostinger.zip
import { execSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const apiDir = join(root, 'apps', 'api');
const contractsDir = join(root, 'packages', 'contracts');
const deployDir = join(root, 'deploy');
const packageDir = join(deployDir, 'hostinger');
const distDir = join(packageDir, 'dist');
const vendorContracts = join(distDir, 'vendor', 'contracts');
const archiveName = 'kafe-adisyon-hostinger.zip';

function run(command, { cwd = root, env = {} } = {}) {
  process.stdout.write(`> ${command}\n`);
  execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

// Yalnız bu betiğin çıktısı silinir; deploy/ içindeki diğer dosyalar korunur.
rmSync(packageDir, { recursive: true, force: true });
rmSync(join(deployDir, archiveName), { force: true });
mkdirSync(packageDir, { recursive: true });

// Site ve API aynı alan adında: web uygulaması göreli /api yollarını kullanır (ADR-004).
run('npm run build -w @kafe/contracts');
run('npm run build -w @kafe/web', { env: { VITE_API_URL: '' } });

// API doğrudan paket klasörüne derlenir; apps/api/dist'teki eski dosyalar karışmaz.
run('npx prisma generate', { cwd: apiDir });
run(
  `npx tsc -p tsconfig.json --outDir "${distDir}" --declaration false --declarationMap false --sourceMap false`,
  { cwd: apiDir },
);
cpSync(join(root, 'apps', 'web', 'dist'), join(distDir, 'public'), { recursive: true });
// Canlı demo boş veritabanında şemayı bu dosyalardan kendisi kurar (demo-schema.ts).
cpSync(join(apiDir, 'prisma', 'migrations'), join(distDir, 'prisma', 'migrations'), {
  recursive: true,
});

// @kafe/contracts npm'de yok: derlenmiş hâli pakete gömülür ve require yolları ona çevrilir.
cpSync(join(contractsDir, 'dist'), join(vendorContracts, 'dist'), { recursive: true });
cpSync(join(contractsDir, 'package.json'), join(vendorContracts, 'package.json'));
function javascriptFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = join(directory, name);
    if (file === join(distDir, 'vendor') || file === join(distDir, 'public')) return [];
    if (statSync(file).isDirectory()) return javascriptFiles(file);
    return file.endsWith('.js') ? [file] : [];
  });
}
let rewritten = 0;
for (const file of javascriptFiles(distDir)) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('require("@kafe/contracts")')) continue;
  let target = relative(dirname(file), vendorContracts).split(sep).join('/');
  if (!target.startsWith('.')) target = `./${target}`;
  writeFileSync(file, source.replaceAll('require("@kafe/contracts")', `require("${target}")`));
  rewritten += 1;
}
if (rewritten === 0) throw new Error('@kafe/contracts kullanan derlenmiş dosya bulunamadı.');

// Hostinger giriş dosyasını require() ile yükler. Varsayılanlar paket düzenine göredir
// ve paneldeki ortam değişkenleriyle ezilebilir.
writeFileSync(
  join(distDir, 'main.cjs'),
  `const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.WEB_DIST_PATH = process.env.WEB_DIST_PATH || path.join(__dirname, 'public');
process.env.MIGRATIONS_PATH =
  process.env.MIGRATIONS_PATH || path.join(__dirname, 'prisma', 'migrations');

try {
  require('./server.js');
} catch (error) {
  console.error('Kafe Adisyon başlatılamadı:', error);
  process.exit(1);
}
`,
);

const apiPackage = JSON.parse(readFileSync(join(apiDir, 'package.json'), 'utf8'));
// Gömülü contracts ve yalnız kurulum betiğinin kullandığı prompts pakete girmez.
const dependencies = Object.fromEntries(
  Object.entries(apiPackage.dependencies).filter(
    ([name]) => name !== '@kafe/contracts' && name !== 'prompts',
  ),
);
// Prisma 7, Node.js 20.19 ve üstünü ister.
const engines = { node: '>=20.19.0' };
// Her şey yerelde derlendi; host yalnız bağımlılıkları kurar, build komutu bir şey yapmaz.
const prebuilt = 'node -e "console.log(\'Prebuilt package\')"';
const manifest = (main) =>
  `${JSON.stringify(
    {
      name: 'kafe-adisyon',
      version: apiPackage.version,
      private: true,
      main,
      engines,
      scripts: { build: prebuilt, start: `node ${main}` },
      dependencies,
    },
    null,
    2,
  )}\n`;
writeFileSync(join(packageDir, 'package.json'), manifest('dist/main.cjs'));
// NestJS preset'i yalnız çıktı klasörünü (dist) yayınlar; dist kendi bağımlılık listesini taşır.
writeFileSync(join(distDir, 'package.json'), manifest('main.cjs'));

// Host'un kuracağı sürümler sabitlenir.
run('npm install --package-lock-only --ignore-scripts --no-audit --no-fund', { cwd: packageDir });
cpSync(join(packageDir, 'package-lock.json'), join(distDir, 'package-lock.json'));

// Windows'taki bsdtar taşınabilir yollarla zip yazar. Açıkça çağrılır: Git Bash PATH'te
// önce GNU tar'ı bulur ve o zip yazamaz.
const tar =
  process.platform === 'win32'
    ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : 'bsdtar';
run(`"${tar}" -a -c -f ../${archiveName} package.json package-lock.json dist`, {
  cwd: packageDir,
});
process.stdout.write(
  `\nHazır: ${join(deployDir, archiveName)} (${rewritten} dosyada contracts yolu çevrildi)\n`,
);
