import { initializeApp, getApps } from 'firebase/app';
import {
  signInWithEmailAndPassword, signOut as fbSignOut, signInAnonymously, createUserWithEmailAndPassword, getAuth,
  EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword
} from 'firebase/auth';
import { auth, firebaseConfig } from '../firebase/config';
import { AppUser } from '../types';
import { getUserById, getUsers, saveUser } from './firebaseService';

const SESSION_KEY = 'teot_active_session_user_id';

// Lançado por loginUserWithPassword quando o e-mail informado não corresponde
// a nenhum usuário cadastrado no Firestore — a UI usa isso para oferecer o
// link de cadastro em vez de um erro genérico de credenciais inválidas.
export class UserNotRegisteredError extends Error {
  email: string;
  constructor(email: string) {
    super(`Não encontramos cadastro para o e-mail '${email}'.`);
    this.name = 'UserNotRegisteredError';
    this.email = email;
  }
}

// Lançado por loginUserWithPassword quando o usuário existe mas ainda está
// inativo (aguardando liberação do administrador).
export class UserInactiveError extends Error {
  constructor() {
    super("Este usuário está inativo. Entre em contato com o administrador.");
    this.name = 'UserInactiveError';
  }
}

export async function createNewUserWithAuth(
  name: string,
  email: string,
  role: 'user' | 'admin',
  password?: string,
  options?: { active?: boolean; startSession?: boolean }
): Promise<AppUser> {
  const active = options?.active ?? true;
  const startSession = options?.startSession ?? true;

  let authUid: string | undefined = undefined;

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user with email already exists in Firestore
  const allUsers = await getUsers();
  const existingUser = allUsers.find(u => u.email.trim().toLowerCase() === normalizedEmail);
  if (existingUser) {
    throw new Error(`Já existe um usuário cadastrado com o e-mail '${normalizedEmail}'.`);
  }

  // Attempt to register in Firebase Auth if password is provided
  if (password && password.trim().length > 0) {
    if (password.trim().length < 6) {
      throw new Error("A senha deve conter no mínimo 6 caracteres.");
    }
    try {
      // Use secondary app to prevent disrupting current logged in session
      let secondaryApp = getApps().find(a => a.name === 'SecondaryAuthApp');
      if (!secondaryApp) {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp');
      }
      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password.trim());
      authUid = userCred.user.uid;
      await fbSignOut(secondaryAuth);
    } catch (authErr: any) {
      console.warn("Aviso ao criar usuário no Firebase Auth:", authErr);
      if (authErr.code === 'auth/email-already-in-use') {
        throw new Error("Este e-mail já está em uso no Firebase Auth.");
      } else if (authErr.code === 'auth/invalid-email') {
        throw new Error("O endereço de e-mail fornecido é inválido.");
      } else if (authErr.code === 'auth/weak-password') {
        throw new Error("A senha escolhida é muito fraca (mínimo 6 caracteres).");
      }
      // Qualquer outro erro aqui significa que a conta de acesso (Firebase
      // Auth) NÃO foi criada — deixar passar em silêncio salvaria um usuário
      // no Firestore sem nenhuma senha válida associada, incapaz de fazer
      // login depois. Melhor falhar o cadastro inteiro e deixar tentar de novo.
      throw new Error("Não foi possível criar a conta de acesso. Verifique sua conexão e tente novamente.");
    }
  }

  const newUserData = {
    name: name.trim(),
    email: normalizedEmail,
    role,
    active,
    ...(authUid ? { authUid } : {})
  };

  const savedId = await saveUser(newUserData);

  if (startSession) {
    // Set session BEFORE anonymous sign in so listeners see active session
    localStorage.setItem(SESSION_KEY, savedId);

    // Ensure anonymous auth if needed
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        // ignore
      }
    }
  }

  return {
    id: savedId,
    ...newUserData
  };
}

export async function loginUserWithPassword(email: string, pass: string): Promise<AppUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const allUsers = await getUsers();
  const appUser = allUsers.find(u => u.email.trim().toLowerCase() === normalizedEmail);

  if (!appUser) {
    throw new UserNotRegisteredError(normalizedEmail);
  }
  if (appUser.role === 'admin') {
    throw new Error("Esta conta é de administrador. Use o acesso \"Área restrita\".");
  }
  if (!appUser.active) {
    throw new UserInactiveError();
  }

  let authUid: string;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
    authUid = userCredential.user.uid;
  } catch (authErr: any) {
    console.warn("Firebase Auth sign-in failed for user login:", authErr);
    throw new Error("E-mail ou senha incorretos.");
  }

  if (authUid && appUser.authUid !== authUid) {
    appUser.authUid = authUid;
    await saveUser(appUser);
  }

  localStorage.setItem(SESSION_KEY, appUser.id);
  return appUser;
}

// Permite ao próprio usuário logado trocar e-mail e/ou senha (tela de
// Ajustes). Exige a senha atual para reautenticar no Firebase Auth antes de
// aplicar a alteração — updateEmail/updatePassword exigem login "recente".
export async function updateOwnCredentials(
  currentPassword: string,
  updates: { newEmail?: string; newPassword?: string }
): Promise<AppUser> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email) {
    throw new Error("Sessão expirada. Faça login novamente para alterar seus dados.");
  }

  const newEmail = updates.newEmail?.trim().toLowerCase();
  const newPassword = updates.newPassword?.trim();

  if (!newEmail && !newPassword) {
    throw new Error("Informe um novo e-mail ou uma nova senha para atualizar.");
  }
  if (newPassword && newPassword.length < 6) {
    throw new Error("A nova senha deve conter no mínimo 6 caracteres.");
  }

  try {
    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
    await reauthenticateWithCredential(fbUser, credential);
  } catch (err: any) {
    console.warn("Falha ao reautenticar para atualizar credenciais:", err);
    throw new Error("Senha atual incorreta.");
  }

  if (newEmail && newEmail !== fbUser.email.toLowerCase()) {
    const allUsers = await getUsers();
    const emailTaken = allUsers.some(u => u.email.trim().toLowerCase() === newEmail && u.authUid !== fbUser.uid);
    if (emailTaken) {
      throw new Error(`Já existe um usuário cadastrado com o e-mail '${newEmail}'.`);
    }
    try {
      await updateEmail(fbUser, newEmail);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error("Este e-mail já está em uso.");
      }
      throw new Error("Não foi possível atualizar o e-mail. Tente novamente.");
    }
  }

  if (newPassword) {
    try {
      await updatePassword(fbUser, newPassword);
    } catch (err: any) {
      throw new Error("Não foi possível atualizar a senha. Tente novamente.");
    }
  }

  const sessionUserId = getCurrentSessionUserId();
  if (!sessionUserId) {
    throw new Error("Sessão expirada. Faça login novamente para alterar seus dados.");
  }
  const currentAppUser = await getUserById(sessionUserId);
  if (!currentAppUser) {
    throw new Error("Usuário não encontrado.");
  }

  const updatedUser: AppUser = { ...currentAppUser, ...(newEmail ? { email: newEmail } : {}) };
  await saveUser(updatedUser);
  return updatedUser;
}

export async function loginAdminWithPassword(email: string, pass: string): Promise<AppUser> {
  const normalizedEmail = email.trim().toLowerCase();

  // Look up user in Firestore first
  const allUsers = await getUsers();
  let appUser = allUsers.find(u => u.email.trim().toLowerCase() === normalizedEmail);

  if (appUser && !appUser.active) {
    throw new Error("Sua conta de administrador está inativa.");
  }

  let authUid: string | null = null;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
    authUid = userCredential.user.uid;
  } catch (authErr: any) {
    console.warn("Firebase Auth sign-in failed, attempting account registration or fallback:", authErr);

    // If account does not exist in Firebase Auth yet, auto-create it with the provided password!
    if (
      authErr.code === 'auth/user-not-found' ||
      authErr.code === 'auth/invalid-credential' ||
      authErr.code === 'auth/invalid-email'
    ) {
      try {
        const newAuthCred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
        authUid = newAuthCred.user.uid;
      } catch (createErr: any) {
        console.warn("Could not create Firebase Auth account:", createErr);
        if (createErr.code === 'auth/email-already-in-use') {
          throw new Error("Senha incorreta. Verifique suas credenciais.");
        } else if (createErr.code === 'auth/weak-password') {
          throw new Error("A senha deve ter no mínimo 6 caracteres.");
        }

        // Não há fallback aqui: retornar um AppUser sem uma sessão real do
        // Firebase Auth por trás (request.auth continuaria null) deixava o
        // usuário "logado" na UI enquanto toda operação protegida por
        // Security Rules (ex.: upload de imagem no Storage) falhava sem
        // explicação nenhuma — o app achava que estava tudo certo, mas o
        // Storage/Firestore recusavam a requisição por falta de auth real.
        throw new Error("Não foi possível autenticar no Firebase. Verifique sua conexão e tente novamente.");
      }
    } else if (appUser && appUser.role === 'admin' && appUser.active) {
      // Mesmo raciocínio do bloco acima: um erro de rede/serviço aqui não
      // deve liberar acesso sem uma sessão real do Firebase Auth.
      throw new Error("Não foi possível autenticar no Firebase. Verifique sua conexão e tente novamente.");
    } else {
      throw new Error("Senha incorreta. Verifique suas credenciais.");
    }
  }

  // Find corresponding user document by authUid or email
  if (!appUser) {
    // Bootstrap user document if authenticated as admin in Firebase Auth
    const newAdminId = `admin_${authUid}`;
    appUser = {
      id: newAdminId,
      name: normalizedEmail.split('@')[0] || "Administrador",
      email: normalizedEmail,
      role: "admin",
      active: true,
      authUid: authUid
    };
    await saveUser(appUser);
  } else if (authUid && appUser.authUid !== authUid) {
    // Link authUid to existing Firestore user document
    appUser.authUid = authUid;
    await saveUser(appUser);
  }

  if (appUser.role !== "admin") {
    await fbSignOut(auth);
    throw new Error("Você não possui permissões de administrador.");
  }

  // Set session key in localStorage BEFORE returning
  localStorage.setItem(SESSION_KEY, appUser.id);
  return appUser;
}

export function getCurrentSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export async function clearSession(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  if (auth.currentUser) {
    await fbSignOut(auth);
  }
}
