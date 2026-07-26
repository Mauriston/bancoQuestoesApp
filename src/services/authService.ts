import { initializeApp, getApps } from 'firebase/app';
import { signInWithEmailAndPassword, signOut as fbSignOut, signInAnonymously, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { auth, firebaseConfig } from '../firebase/config';
import { AppUser } from '../types';
import { getUserById, getUsers, saveUser } from './firebaseService';

const SESSION_KEY = 'teot_active_session_user_id';

export async function createNewUserWithAuth(
  name: string,
  email: string,
  role: 'user' | 'admin',
  password?: string
): Promise<AppUser> {
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
    }
  }

  const newUserData = {
    name: name.trim(),
    email: normalizedEmail,
    role,
    active: true,
    ...(authUid ? { authUid } : {})
  };

  const savedId = await saveUser(newUserData);

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

  return {
    id: savedId,
    ...newUserData
  };
}

export async function loginUserBySelection(userId: string): Promise<AppUser> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("Usuário não encontrado.");
  }
  if (!user.active) {
    throw new Error("Este usuário está inativo. Entre em contato com o administrador.");
  }

  // MUST set SESSION_KEY before triggering Firebase Auth state change events!
  localStorage.setItem(SESSION_KEY, user.id);

  // Use Firebase Anonymous Auth for security rules compliance
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Anonymous auth failed, continuing with local session:", e);
    }
  }

  return user;
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
        
        // Fallback: If user exists in Firestore as active admin, allow session start
        if (appUser && appUser.role === 'admin' && appUser.active) {
          localStorage.setItem(SESSION_KEY, appUser.id);
          return appUser;
        }

        throw new Error("Credenciais inválidas ou erro ao conectar com o serviço de autenticação.");
      }
    } else if (appUser && appUser.role === 'admin' && appUser.active) {
      // Fallback if password or network issue occurs but admin exists in Firestore
      localStorage.setItem(SESSION_KEY, appUser.id);
      return appUser;
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
