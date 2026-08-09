#!/usr/bin/env node
// ==========================================
// scripts/setup-user-passwords.mjs
// ==========================================
//
// Garante que todo usuário já cadastrado em Firestore (`users`, role
// "user") tenha uma conta de acesso no Firebase Auth com a senha padrão
// "123456", e vincula o `authUid` de volta ao documento do usuário — o
// mesmo campo que o app já usa (ver src/services/authService.ts) para achar
// o documento certo depois de um login com e-mail/senha.
//
// Isso existe porque o login de candidatos deixou de ser "escolher o nome
// numa lista" e passou a ser e-mail + senha (Firebase Auth de verdade).
// Usuários que já existiam em Firestore ANTES dessa mudança não tinham
// nenhuma conta de acesso associada — sem rodar este script, eles ficam sem
// conseguir entrar.
//
// Contas de administrador (role "admin") NÃO são tocadas por este script —
// senhas de admin são geridas separadamente (ver README / AdminLoginPage).
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
//   Seguro rodar mais de uma vez: usuários que já têm conta no Firebase Auth
//   têm a senha REDEFINIDA para "123456" (não criam conta duplicada), e
//   gravar o mesmo `authUid` que já está no documento é inofensivo.
//
// USO
//   node scripts/setup-user-passwords.mjs [--key ./service-account.json] [--dry-run]
//
//   --dry-run mostra exatamente o que SERIA feito, sem gravar nada no
//   Firebase Auth nem no Firestore — use antes de rodar de verdade.

import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';
const DEFAULT_PASSWORD = '123456';

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
const auth = getAuth();

async function run() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo coleção users...\n`);

  const usersSnap = await db.collection('users').where('role', '==', 'user').get();

  let created = 0;
  let passwordReset = 0;
  let linked = 0;
  let failed = 0;

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    const email = (data.email || '').trim().toLowerCase();
    if (!email) {
      console.warn(`⚠ users/${docSnap.id} não tem e-mail — pulando.`);
      continue;
    }

    try {
      let authUser;
      try {
        authUser = await auth.getUserByEmail(email);
        console.log(`${dryRun ? '[dry-run] ' : ''}→ ${email}: conta já existe no Firebase Auth (uid=${authUser.uid}), redefinindo senha para "${DEFAULT_PASSWORD}"`);
        if (!dryRun) {
          await auth.updateUser(authUser.uid, { password: DEFAULT_PASSWORD });
        }
        passwordReset++;
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
        console.log(`${dryRun ? '[dry-run] ' : ''}→ ${email}: criando conta no Firebase Auth com senha "${DEFAULT_PASSWORD}"`);
        if (!dryRun) {
          authUser = await auth.createUser({ email, password: DEFAULT_PASSWORD, displayName: data.name || undefined });
        }
        created++;
      }

      if (authUser && data.authUid !== authUser.uid) {
        console.log(`  vinculando authUid=${authUser.uid} a users/${docSnap.id}`);
        if (!dryRun) {
          await docSnap.ref.update({ authUid: authUser.uid, updatedAt: FieldValue.serverTimestamp() });
        }
        linked++;
      }
    } catch (err) {
      failed++;
      console.error(`✗ Falha ao processar ${email} (users/${docSnap.id}):`, err.message || err);
    }
  }

  console.log('\nResumo:');
  console.log(`  usuários processados: ${usersSnap.size}`);
  console.log(`  contas criadas: ${created}`);
  console.log(`  senhas redefinidas para "${DEFAULT_PASSWORD}": ${passwordReset}`);
  console.log(`  documentos vinculados (authUid): ${linked}`);
  if (failed > 0) {
    console.log(`  falhas: ${failed}`);
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
