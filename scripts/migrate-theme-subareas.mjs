#!/usr/bin/env node
// ==========================================
// scripts/migrate-theme-subareas.mjs
// ==========================================
//
// Preenche o campo `subArea` (string opcional em `themes/{id}`) a partir da
// árvore área → subárea → temas definida em
// `reference/arvore_temas_subareas.json`. Introduz o agrupamento intermediário
// "subárea" (ex.: "Ortopedia"/"Traumatologia") sem criar uma nova coleção no
// Firestore — é só um campo de rótulo no documento de tema já existente.
//
// Para cada área do JSON que tem `subáreas`, para cada subárea, para cada
// tema listado: procura em Firestore o doc de `themes` cuja `areaId` resolve
// a um doc em `areas` com `name` batendo (normalizado) com a "Área" do JSON,
// e cujo `name` bate (normalizado/trim) com o nome do tema do JSON. Ao
// encontrar, grava `subArea: "<nome da subárea>"` nesse doc. Áreas do JSON
// com `temas` "soltos" (sem subáreas — Anatomia, Ciência Básica) são
// explicitamente ignoradas/logadas, pois não têm subárea a atribuir.
//
// PRÉ-REQUISITOS
//   npm install               (garante a dependência firebase-admin)
//   Uma credencial de administrador do projeto Firebase, de uma das formas:
//     a) `firebase login` (Firebase CLI) + rodar este script na mesma
//        máquina — o SDK Admin reaproveita essa sessão automaticamente; ou
//     b) baixar uma Service Account Key (Console do Firebase > Configurações
//        do projeto > Contas de serviço > Gerar nova chave privada) e passar
//        o caminho do arquivo .json via --key ou GOOGLE_APPLICATION_CREDENTIALS
//
//   ⚠️  NUNCA versione a Service Account Key neste repositório nem a envie
//       por um canal que fique registrado/logado — ela dá acesso total de
//       administrador ao projeto Firebase.
//
// IDEMPOTÊNCIA
//   Seguro rodar mais de uma vez: gravar o mesmo valor de `subArea` que já
//   está no documento é inofensivo (apenas reafirma o mesmo dado).
//
// USO
//   node scripts/migrate-theme-subareas.mjs [--key ./service-account.json] [--dry-run]
//
//   --dry-run mostra exatamente o que SERIA atualizado, sem gravar nada no
//   Firestore — use antes de rodar de verdade.
//
// SAÍDA
//   Ao final, o script imprime:
//     - quantos temas foram casados e atualizados (ou seriam, em --dry-run);
//     - a lista de nomes de tema do JSON que NÃO encontraram doc correspon-
//       dente no Firestore, para reconciliação manual pelo responsável.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';
const JSON_PATH = path.join(__dirname, '..', 'reference', 'arvore_temas_subareas.json');

// Mesma normalização de src/utils/helpers.ts (normalizeText), duplicada aqui
// porque este é um script Node standalone (ESM, sem bundler) e não importa
// diretamente do código-fonte do app.
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

const { key, dryRun } = parseArgs(process.argv.slice(2));

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();
initializeApp({ credential });

const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

async function run() {
  const tree = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo ${JSON_PATH}...\n`);

  // Carrega todas as áreas e temas do Firestore de uma vez (coleções
  // pequenas, mesma abordagem usada no resto do app).
  const [areasSnap, themesSnap] = await Promise.all([
    db.collection('areas').get(),
    db.collection('themes').get(),
  ]);

  const areasByNormName = new Map();
  areasSnap.forEach(doc => {
    const data = doc.data();
    areasByNormName.set(normalizeText(data.name || ''), doc.id);
  });

  // themes agrupados por areaId -> lista de { id, normName }
  const themesByAreaId = new Map();
  themesSnap.forEach(doc => {
    const data = doc.data();
    const areaId = data.areaId;
    if (!themesByAreaId.has(areaId)) themesByAreaId.set(areaId, []);
    themesByAreaId.get(areaId).push({ id: doc.id, normName: normalizeText(data.name || ''), currentSubArea: data.subArea });
  });

  let matched = 0;
  let skippedAreasFlat = [];
  const unmatched = []; // { area, subArea, tema }
  const updates = []; // { themeId, subArea, areaName, temaName }

  for (const areaEntry of tree) {
    const areaName = areaEntry['Área'];
    const normArea = normalizeText(areaName);
    const areaId = areasByNormName.get(normArea);

    if (!areaEntry.subáreas) {
      // Anatomia / Ciência Básica — sem agrupamento, skip explícito.
      skippedAreasFlat.push(areaName);
      continue;
    }

    if (!areaId) {
      console.warn(`⚠ Área "${areaName}" não encontrada em Firestore (areas) — todos os temas dela ficarão sem match.`);
    }

    const themesOfArea = areaId ? (themesByAreaId.get(areaId) || []) : [];

    for (const subAreaEntry of areaEntry.subáreas) {
      const subAreaName = subAreaEntry['subárea'];
      for (const temaName of subAreaEntry.temas) {
        const normTema = normalizeText(temaName);
        const match = themesOfArea.find(t => t.normName === normTema);
        if (match) {
          matched++;
          updates.push({ themeId: match.id, subArea: subAreaName, areaName, temaName, alreadySet: match.currentSubArea === subAreaName });
        } else {
          unmatched.push({ area: areaName, subArea: subAreaName, tema: temaName });
        }
      }
    }
  }

  console.log(`Áreas sem subagrupamento (ignoradas de propósito): ${skippedAreasFlat.join(', ') || '(nenhuma)'}\n`);

  for (const u of updates) {
    const tag = u.alreadySet ? '(já definido, idempotente)' : '';
    console.log(`${dryRun ? '[dry-run] ' : ''}→ themes/${u.themeId} ("${u.temaName}", área "${u.areaName}") subArea = "${u.subArea}" ${tag}`);
    if (!dryRun) {
      await db.collection('themes').doc(u.themeId).update({ subArea: u.subArea, updatedAt: new Date() });
    }
  }

  console.log('\nResumo:');
  console.log(`  temas casados e ${dryRun ? '(a) ' : ''}atualizados: ${matched}`);
  if (unmatched.length > 0) {
    console.log(`  temas do JSON SEM correspondência em Firestore: ${unmatched.length}`);
    unmatched.forEach(u => {
      console.log(`    ✗ [${u.area} / ${u.subArea}] "${u.tema}"`);
    });
  } else {
    console.log('  todos os temas do JSON encontraram correspondência em Firestore.');
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
