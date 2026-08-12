#!/usr/bin/env node
// ==========================================
// scripts/fix-question-theme-id.mjs
// ==========================================
//
// Corrige documentos de `questions/{id}` cujo `themeId` não é o ID real de
// nenhum doc em `themes` — mesmo tipo de bug encontrado e corrigido em
// `areaId` por fix-question-area-id.mjs, aqui no campo `themeId`. Encontrado
// de duas formas:
//   1. themeId = nome do tema (ex.: "Fraturas do Colo do Fêmur ") em vez do
//      ID determinístico (ex.: "theme_fraturas_do_colo_do_femur");
//   2. themeId = variação do ID com pontuação preservada em vez de "_"
//      (ex.: "theme_fratura-luxacao_de_lisfranc" em vez de
//      "theme_fratura_luxacao_de_lisfranc").
//
// Resolve comparando uma forma "canônica" do valor gravado (minúsculo, sem
// acento, sem qualquer caractere não alfanumérico) contra a mesma forma
// canônica do `name` de cada tema. Só corrige quando há exatamente 1 tema
// candidato (nunca em caso de ambiguidade).
//
// Como o tema já resolvido é uma fonte mais confiável do que os campos
// desnormalizados da própria questão, a correção sincroniza TUDO que deriva
// do tema: themeId, themeName, areaId, areaName, groupId, groupName — não
// só o ID. Foi confirmado manualmente que várias dessas questões tinham
// areaId/groupId apontando para o lugar errado (não só formatação de ID).
//
// EXCEÇÕES CONHECIDAS (não resolvidas automaticamente, ficam de fora):
//   - "Artroplastias do tornozelo", "Fraturas do Pé e Tornozelo na criança":
//     nomes de tema sem nenhum doc correspondente em `themes` (tema nunca
//     foi cadastrado, ou foi cadastrado com nome diferente).
//   - "Ciência Básica": o nome de uma ÁREA foi gravado no campo de tema —
//     não há como saber qual tema real era a intenção.
//   Essas ficam listadas no relatório final para revisão manual.
//
// `questions/nan`: documento claramente corrompido (enunciado nulo,
// alternativas "nan", areaId/themeId nulos) — não é "corrigido", é excluído
// com --delete-nan (também remove o `questionAnswers/nan` correspondente,
// se existir).
//
// PRÉ-REQUISITOS: ver scripts/fix-question-area-id.mjs (mesmo padrão).
//
// USO
//   node scripts/fix-question-theme-id.mjs [--dry-run] [--delete-nan] [--key ./service-account.json]

import { readFileSync } from 'node:fs';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';

function normalizeText(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
function canon(str) {
  return normalizeText(str).replace(/^theme_/, '').replace(/[^a-z0-9]/g, '');
}

// Erro de digitação conhecido em algumas questões: "microúrgicos" em vez de
// "microcirúrgicos" — não bate por canon() porque falta a substring "cir",
// não é só pontuação/acentuação diferente.
const KNOWN_ALIASES = {
  'Princípios de microcirurgia, retalhos microúrgicos e reimplantes':
    'Princípios de microcirurgia, retalhos microcirúrgicos e reimplantes'
};

function parseArgs(argv) {
  const out = { dryRun: false, deleteNan: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--delete-nan') { out.deleteNan = true; continue; }
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

const { key, dryRun, deleteNan } = parseArgs(process.argv.slice(2));

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();
initializeApp({ credential });

const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

async function run() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo 'themes' e 'questions'...\n`);

  const [themesSnap, questionsSnap] = await Promise.all([
    db.collection('themes').get(),
    db.collection('questions').get()
  ]);

  const themeIds = new Set(themesSnap.docs.map(d => d.id));
  const themeById = new Map(themesSnap.docs.map(d => [d.id, d.data()]));
  const byCanon = new Map();
  themesSnap.forEach(d => {
    const key = canon(d.data().name || '');
    if (!byCanon.has(key)) byCanon.set(key, []);
    byCanon.get(key).push(d.id);
  });

  let batch = db.batch();
  let opCount = 0;
  const commitIfNeeded = async () => {
    if (opCount >= 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  let fixedCount = 0;
  let areaChangedCount = 0;
  let groupChangedCount = 0;
  const unresolved = [];
  let nanHandled = false;

  for (const qDoc of questionsSnap.docs) {
    const data = qDoc.data();
    const rawThemeId = data.themeId;

    if (qDoc.id === 'nan') {
      nanHandled = true;
      console.log(`${dryRun ? '[dry-run] ' : ''}Documento corrompido questions/nan ${deleteNan ? '(EXCLUINDO)' : '(mantido — rode com --delete-nan para excluir)'}`);
      if (deleteNan && !dryRun) {
        batch.delete(qDoc.ref);
        opCount++;
        const ansRef = db.collection('questionAnswers').doc('nan');
        const ansSnap = await ansRef.get();
        if (ansSnap.exists) { batch.delete(ansRef); opCount++; }
        await commitIfNeeded();
      }
      continue;
    }

    if (themeIds.has(rawThemeId)) continue; // já correto

    const aliasedRaw = KNOWN_ALIASES[rawThemeId] || rawThemeId;
    const key = canon(aliasedRaw);
    const matches = byCanon.get(key);

    if (!matches || matches.length !== 1) {
      unresolved.push({ qId: qDoc.id, themeId: rawThemeId, areaId: data.areaId });
      continue;
    }

    const theme = themeById.get(matches[0]);
    const areaChanged = data.areaId !== theme.areaId;
    const groupChanged = (data.groupId || null) !== (theme.groupId || null);
    if (areaChanged) areaChangedCount++;
    if (groupChanged) groupChangedCount++;
    fixedCount++;

    console.log(
      `${dryRun ? '[dry-run] ' : ''}  → questions/${qDoc.id}: themeId "${rawThemeId}" → "${matches[0]}"` +
      (areaChanged ? ` | areaId "${data.areaId}" → "${theme.areaId}"` : '') +
      (groupChanged ? ` | groupId "${data.groupId}" → "${theme.groupId}"` : '')
    );

    if (!dryRun) {
      const payload = {
        themeId: matches[0],
        themeName: theme.name,
        areaId: theme.areaId,
        areaName: theme.areaName,
        groupId: theme.groupId,
        groupName: theme.groupName,
        updatedAt: new Date()
      };
      // Alguns docs de tema não têm areaName/groupId/groupName preenchidos —
      // o Firestore rejeita `undefined` num update(), então tira do payload
      // em vez de gravar um valor inexistente.
      Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
      batch.update(qDoc.ref, payload);
      opCount++;
      await commitIfNeeded();
    }
  }

  if (!dryRun && opCount > 0) {
    await batch.commit();
  }

  console.log('\nResumo:');
  console.log(`  questões com themeId corrigido: ${fixedCount}`);
  console.log(`    das quais também tiveram areaId corrigido: ${areaChangedCount}`);
  console.log(`    das quais também tiveram groupId/groupName corrigido: ${groupChangedCount}`);
  console.log(`  questions/nan: ${nanHandled ? (deleteNan ? 'excluído' : 'encontrado, não excluído (use --delete-nan)') : 'não encontrado'}`);
  if (unresolved.length > 0) {
    console.log(`\n  ${unresolved.length} questão(ões) NÃO resolvida(s) automaticamente (revisar manualmente):`);
    unresolved.forEach(u => console.log(`    ✗ questions/${u.qId}: themeId="${u.themeId}" (areaId atual: ${u.areaId})`));
  }
  if (dryRun) {
    console.log('\n  nada foi gravado (--dry-run). Rode sem --dry-run para aplicar.');
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
