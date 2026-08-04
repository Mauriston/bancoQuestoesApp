#!/usr/bin/env node
// ==========================================
// scripts/import-question-images.mjs
// ==========================================
//
// Envia um lote de imagens para o Firebase Storage, no caminho
// `imagens_questoes/{PROVA}/{arquivo}`, e grava a URL pública resultante
// no campo `imageUrl` do documento correspondente em `questions/{id}`.
//
// Existe para não depender de upload manual (um a um) pela UI administrativa
// quando se tem um lote grande de imagens já escaneadas/rotuladas por prova
// (ex.: TEOT_ANATOMIA_2024, TEOT_TEORICA_2022), evitando divergência entre
// arquivos soltos no bucket e o campo imageUrl das questões.
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
// ARQUIVO DE MAPEAMENTO (--map)
//   JSON simples { "<questionId>": "<nomeDoArquivoDeImagem>", ... }, ex.:
//     {
//       "34c9a8a4-1d1d-424e-b10b-b353dca24f93": "TEOT_2022_TEORICA_Q35.jpeg"
//     }
//
// USO
//   node scripts/import-question-images.mjs \
//     --prova TEOT_TEORICA_2022 \
//     --dir ./caminho/para/as/imagens \
//     --map ./caminho/para/mapeamento.json \
//     [--key ./service-account.json] \
//     [--dry-run]
//
//   --dry-run mostra o que seria enviado/atualizado sem gravar nada — use
//   antes de rodar de verdade, já que a operação não é reversível a partir
//   deste script (sobrescreve o imageUrl atual da questão, se houver).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

const BUCKET = 'gen-lang-client-0316191622.firebasestorage.app';
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

function usageAndExit(message) {
  if (message) console.error(`Erro: ${message}\n`);
  console.error(
    'Uso: node scripts/import-question-images.mjs --prova <NOME_PROVA> --dir <pasta_com_imagens> --map <mapeamento.json> [--key <service-account.json>] [--dry-run]'
  );
  process.exit(1);
}

const { prova, dir, map, key, dryRun } = parseArgs(process.argv.slice(2));

if (!prova) usageAndExit('--prova é obrigatório (ex.: TEOT_TEORICA_2022)');
if (!dir) usageAndExit('--dir é obrigatório (pasta local com os arquivos de imagem)');
if (!map) usageAndExit('--map é obrigatório (arquivo .json com { questionId: nomeDoArquivo })');
if (!existsSync(dir)) usageAndExit(`pasta não encontrada: ${dir}`);
if (!existsSync(map)) usageAndExit(`arquivo de mapeamento não encontrado: ${map}`);

const mapping = JSON.parse(readFileSync(map, 'utf-8'));
const entries = Object.entries(mapping);

if (entries.length === 0) usageAndExit('mapeamento vazio — nada para importar');

for (const [questionId, fileName] of entries) {
  const localPath = path.join(dir, fileName);
  if (!existsSync(localPath)) {
    usageAndExit(`arquivo listado no mapeamento não existe em --dir: ${fileName} (questão ${questionId})`);
  }
}

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();

initializeApp({ credential, storageBucket: BUCKET });

const bucket = getStorage().bucket();
const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

function buildPublicUrl(objectPath) {
  const encoded = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media`;
}

async function run() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Processando ${entries.length} imagem(ns) da prova "${prova}"...\n`);

  let uploaded = 0;
  let linked = 0;
  let skippedMissingQuestion = 0;

  for (const [questionId, fileName] of entries) {
    const localPath = path.join(dir, fileName);
    const objectPath = `imagens_questoes/${prova}/${fileName}`;
    const imageUrl = buildPublicUrl(objectPath);

    console.log(`→ ${fileName}`);
    console.log(`    destino:  gs://${BUCKET}/${objectPath}`);
    console.log(`    imageUrl: ${imageUrl}`);

    const questionRef = db.collection('questions').doc(questionId);
    const snap = await questionRef.get();
    if (!snap.exists) {
      console.warn(`    ⚠ questions/${questionId} não existe no Firestore — pulando (upload NÃO realizado).`);
      skippedMissingQuestion++;
      continue;
    }

    if (dryRun) {
      console.log(`    [dry-run] upload e atualização do Firestore não executados.\n`);
      continue;
    }

    await bucket.upload(localPath, {
      destination: objectPath,
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      },
    });
    uploaded++;

    await questionRef.update({ imageUrl, updatedAt: new Date() });
    linked++;

    console.log(`    ✔ enviado e questions/${questionId}.imageUrl atualizado.\n`);
  }

  console.log('Resumo:');
  console.log(`  enviados:  ${uploaded}`);
  console.log(`  vinculados: ${linked}`);
  if (skippedMissingQuestion > 0) {
    console.log(`  pulados (questionId inexistente): ${skippedMissingQuestion}`);
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
