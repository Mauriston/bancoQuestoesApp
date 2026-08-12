#!/usr/bin/env node
// ==========================================
// scripts/import-references.mjs
// ==========================================
//
// Cria/atualiza a coleção `reference` (raiz do Firestore) a partir de
// reference/livros_referencia.csv — livros de referência bibliográfica que
// podem ser vinculados ao gabarito/comentário de uma questão
// (questionAnswers/{id}.referenceId, ver src/types.ts Reference).
//
// Cada linha do CSV vira um doc `reference/{id}`, com id determinístico
// gerado a partir de `referecenceId` (mesmo padrão de `area_<nome>`/
// `theme_<nome>` usado no resto do app):
//   id = `ref_<referecenceId normalizado, minúsculo, sem acento, não
//   alfanumérico virando "_">`
//
// Idempotente: roda de novo sem duplicar nada (merge:true por id
// determinístico) — útil se o CSV for atualizado no futuro (novo livro,
// URL trocada, etc.).
//
// PRÉ-REQUISITOS: ver scripts/fix-question-area-id.mjs (mesmo padrão).
//
// USO
//   node scripts/import-references.mjs [--dry-run] [--key ./service-account.json]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';
const CSV_PATH = path.join(__dirname, '..', 'reference', 'livros_referencia.csv');

function normalizeText(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Parser simples de CSV com suporte a campos entre aspas contendo vírgulas
// (ex.: a citação ABNT completa em referenceName) — não lida com quebras de
// linha dentro de um campo, o que não ocorre neste arquivo.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row = {};
    header.forEach((col, i) => { row[col] = values[i] ?? ''; });
    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(v => v.trim());
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
  const csvText = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(csvText);

  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo ${CSV_PATH} (${rows.length} linha(s))...\n`);

  const seenIds = new Set();
  let batch = db.batch();
  let opCount = 0;

  for (const row of rows) {
    const referenceId = (row.referecenceId || row.referenceId || '').trim();
    const referenceName = (row.referenceName || '').trim();
    const referenceUrlDownload = (row.referenceUrlDownload || '').trim();

    if (!referenceId || !referenceName || !referenceUrlDownload) {
      console.warn(`  ⚠ linha ignorada (campo faltando): ${JSON.stringify(row)}`);
      continue;
    }

    const norm = normalizeText(referenceId);
    const id = `ref_${norm.replace(/[^a-z0-9]/g, '_')}`;

    if (seenIds.has(id)) {
      console.warn(`  ⚠ id "${id}" duplicado (referenceId "${referenceId}") — só o último do CSV será gravado.`);
    }
    seenIds.add(id);

    console.log(`${dryRun ? '[dry-run] ' : ''}  → reference/${id}: referenceId="${referenceId}", referenceName="${referenceName.slice(0, 60)}...", referenceUrlDownload="${referenceUrlDownload}"`);

    if (!dryRun) {
      batch.set(db.collection('reference').doc(id), {
        id,
        referenceId,
        referenceName,
        referenceUrlDownload,
        active: true,
        updatedAt: new Date()
      }, { merge: true });
      opCount++;
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

  console.log(`\nResumo: ${seenIds.size} referência(s) ${dryRun ? 'seriam gravadas' : 'gravadas'} em 'reference'.`);
  if (dryRun) {
    console.log('  nada foi gravado (--dry-run). Rode sem --dry-run para aplicar.');
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
