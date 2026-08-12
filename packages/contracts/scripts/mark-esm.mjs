import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// dist/esm klasöründeki .js dosyaları ESM'dir. Paketin kökü CommonJS olduğu için
// bu klasöre kapsam belirten bir package.json yazılır; aksi hâlde Node ve
// paketleyiciler dosyaları CommonJS sanır.
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const esmDir = join(packageRoot, 'dist', 'esm');

mkdirSync(esmDir, { recursive: true });
writeFileSync(join(esmDir, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`, 'utf8');
