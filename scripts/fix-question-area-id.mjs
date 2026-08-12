#!/usr/bin/env node
// ==========================================
// scripts/fix-question-area-id.mjs
// ==========================================
//
// Corrige documentos de `questions/{id}` gravados com `areaId` errado — o
// valor do campo `name` da área (ex.: "Quadril") em vez do ID real do
// documento em `areas` (ex.: "area_cirurgia_do_quadril"). Encontrado em
// questões da área Quadril, provavelmente de um cadastro/import feito fora
// desta base de código.
//
// Por padrão corrige TODAS as questões cujo `areaId` bate com o `name` de
// alguma área existente (não só "Quadril" — cobre o mesmo problema em
// qualquer outra área, se existir). Use --area-name para limitar a correção
// a uma única área.
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
// USO
//   node scripts/fix-question-area-id.mjs [--area-name "Quadril"] [--dry-run] [--key ./service-account.json]
//
//   --dry-run mostra exatamente o que SERIA atualizado, sem gravar nada no
//   Firestore — rode assim primeiro para conferir a lista.
//
// O QUE FAZ
//   1. Lê todos os docs de `areas` e monta um mapa nome -> id.
//   2. Para cada área (ou só a indicada em --area-name), busca em
//      `questions` os docs cujo `areaId` é igual ao `name` dessa área
//      (o bug: ID errado = nome da área).
//   3. Atualiza esses docs para `areaId` = ID real da área, mantendo
//      `areaName` como está (já correto, é o nome mesmo).

import { readFileSync } from 'node:fs';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

const { key, dryRun, 'area-name': areaNameFilter } = parseArgs(process.argv.slice(2));

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();
initializeApp({ credential });

const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

async function run() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo coleção 'areas'...\n`);

  const areasSnap = await db.collection('areas').get();
  const areasById = new Map();
  areasSnap.forEach(doc => areasById.set(doc.id, doc.data().name));

  const targetAreas = areaNameFilter
    ? [...areasById.entries()].filter(([, name]) => name === areaNameFilter)
    : [...areasById.entries()];

  if (targetAreas.length === 0) {
    console.error(`Nenhuma área encontrada${areaNameFilter ? ` com name = "${areaNameFilter}"` : ''}.`);
    process.exit(1);
  }

  let totalMatched = 0;
  let totalUpdated = 0;

  for (const [correctAreaId, areaName] of targetAreas) {
    // O bug: questions com areaId == nome da área (não o ID do doc).
    const badSnap = await db.collection('questions').where('areaId', '==', areaName).get();
    if (badSnap.empty) continue;

    console.log(`Área "${areaName}" (id correto: ${correctAreaId}): ${badSnap.size} questão(ões) com areaId errado = "${areaName}"`);
    totalMatched += badSnap.size;

    let batch = db.batch();
    let opCount = 0;

    for (const qDoc of badSnap.docs) {
      console.log(`${dryRun ? '[dry-run] ' : ''}  → questions/${qDoc.id}: areaId "${areaName}" → "${correctAreaId}"`);
      if (!dryRun) {
        batch.update(qDoc.ref, { areaId: correctAreaId, updatedAt: new Date() });
        opCount++;
        totalUpdated++;
        if (opCount >= 400) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
    }

    if (!dryRun && opCount > 0) {
      await batch.commit();
    }
  }

  console.log('\nResumo:');
  console.log(`  questões encontradas com areaId errado: ${totalMatched}`);
  if (dryRun) {
    console.log('  nada foi gravado (--dry-run). Rode sem --dry-run para aplicar.');
  } else {
    console.log(`  questões atualizadas: ${totalUpdated}`);
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
