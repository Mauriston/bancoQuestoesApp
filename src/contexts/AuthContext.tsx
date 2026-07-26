import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FbUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import { AppUser } from '../types';
import { getUserById } from '../services/firebaseService';
import { getCurrentSessionUserId, loginUserBySelection, loginAdminWithPassword, clearSession } from '../services/authService';

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: FbUser | null;
  role: "user" | "admin" | null;
  loading: boolean;
  selectUserSession: (userId: string) => Promise<AppUser>;
  adminLogin: (email: string, pass: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FbUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSession = async () => {
    try {
      const sessionUserId = getCurrentSessionUserId();
      if (sessionUserId) {
        const user = await getUserById(sessionUserId);
        if (user && user.active) {
          setCurrentUser(user);
        } else {
          await clearSession();
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      loadSession();
    });
    return () => unsubscribe();
  }, []);

  const selectUserSession = async (userId: string) => {
    setLoading(true);
    try {
      const user = await loginUserBySelection(userId);
      setCurrentUser(user);
      return user;
    } finally {
      setLoading(false);
    }
  };

  const adminLogin = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const admin = await loginAdminWithPassword(email, pass);
      setCurrentUser(admin);
      return admin;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await clearSession();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (currentUser) {
      const updated = await getUserById(currentUser.id);
      if (updated) setCurrentUser(updated);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      firebaseUser,
      role: currentUser ? currentUser.role : null,
      loading,
      selectUserSession,
      adminLogin,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
