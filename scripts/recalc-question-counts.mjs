#!/usr/bin/env node
// ==========================================
// scripts/recalc-question-counts.mjs
// ==========================================
//
// Recalcula `questionCount` em `areas/{id}` e `themes/{id}` a partir da
// contagem real de documentos em `questions` (`where('areaId'/'themeId',
// '==', <id>)`), usando consultas de agregação (`.count()`) — não baixa os
// documentos de questions, só o total.
//
// Esse campo é gravado como 0 uma única vez no momento da importação
// (`importQuestionBankJson`, em src/services/importService.ts) e nunca é
// atualizado depois — questões criadas, editadas (troca de área/tema) ou
// excluídas pela UI administrativa não o mantêm em dia. Hoje ele também não
// é lido em nenhuma tela do app (conferido em src/), então rodar este script
// é seguro a qualquer momento, sem afetar comportamento visível — só deixa
// o número correto para uso futuro/analítico.
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
//   node scripts/recalc-question-counts.mjs [--dry-run] [--key ./service-account.json]
//
//   --dry-run mostra os valores que SERIAM gravados, sem alterar nada no
//   Firestore.

import { readFileSync } from 'node:fs';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, AggregateField } from 'firebase-admin/firestore';

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

const { key, dryRun } = parseArgs(process.argv.slice(2));

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();
initializeApp({ credential });

const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

async function countQuestions(field, id) {
  const snap = await db.collection('questions').where(field, '==', id).count().get();
  return snap.data().count;
}

async function recalcCollection(collectionName, questionField, label) {
  const snap = await db.collection(collectionName).get();
  console.log(`\n${label} (${snap.size} documento(s)):`);

  let batch = db.batch();
  let opCount = 0;
  let changed = 0;

  for (const docSnap of snap.docs) {
    const current = docSnap.data().questionCount ?? null;
    const actual = await countQuestions(questionField, docSnap.id);

    if (current !== actual) {
      changed++;
      console.log(`${dryRun ? '[dry-run] ' : ''}  → ${collectionName}/${docSnap.id} ("${docSnap.data().name}"): questionCount ${current} → ${actual}`);
      if (!dryRun) {
        batch.update(docSnap.ref, { questionCount: actual, updatedAt: new Date() });
        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
    }
  }

  if (!dryRun && opCount > 0) {
    await batch.commit();
  }

  console.log(`  ${changed} de ${snap.size} já estavam desatualizados${dryRun ? ' (nada gravado, --dry-run)' : ' e foram corrigidos'}.`);
}

async function run() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Recalculando questionCount a partir da contagem real em 'questions'...`);
  await recalcCollection('areas', 'areaId', 'Áreas');
  await recalcCollection('themes', 'themeId', 'Temas');
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
