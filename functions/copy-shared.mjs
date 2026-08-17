// Copia os arquivos "puros" (sem dependências além um do outro) que o
// template do relatório em PDF compartilha com o frontend — mantém
// src/reportTemplate.ts e src/types.ts como fonte única, sem duplicar
// código nem exigir um monorepo. Roda automaticamente via `npm run build`
// (script "prebuild"); nunca edite os arquivos copiados em src/_shared
// diretamente, eles são sobrescritos a cada build.
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(here, 'src', '_shared');
mkdirSync(targetDir, { recursive: true });

const files = ['reportTemplate.ts', 'types.ts'];
for (const file of files) {
  copyFileSync(path.join(here, '..', 'src', file), path.join(targetDir, file));
}

console.log('[copy-shared] reportTemplate.ts e types.ts copiados para functions/src/_shared/');
