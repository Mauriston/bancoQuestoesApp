import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, User, Lock, AlertCircle, ArrowRight, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getActiveUsers } from '../services/firebaseService';
import { AppUser } from '../types';

export const HomePage: React.FC = () => {
  const { selectUserSession } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const activeList = await getActiveUsers();
      // O admin já tem seu próprio caminho de acesso (link "Login Admin" no
      // rodapé, autenticado por senha). Ele não deve aparecer na lista de
      // seleção de candidatos.
      setUsers(activeList.filter(u => u.role !== 'admin'));
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  const handleAccess = async () => {
    setAuthError('');
    if (!selectedUserId) {
      setAuthError('Por favor, selecione seu nome na lista para acessar.');
      return;
    }

    const targetUser = users.find(u => u.id === selectedUserId);
    if (!targetUser) return;

    if (!targetUser.active) {
      navigate('/inactive');
      return;
    }

    // Common user session start
    try {
      setSubmitting(true);
      await selectUserSession(targetUser.id);
      navigate('/app/exams');
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao iniciar sessão.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050f41] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Background Subtle Accent Gradients */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FAB932]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#079551]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full z-10">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FAB932] text-[#050f41] shadow-xl shadow-black/20 mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Treinamento TEOT HMA 2027</h1>
          <p className="text-xs text-white/60 mt-1">O ano da vitória 🏆</p>
        </div>

        {/* Selection Card */}
        <div className="bg-white text-[#050f41] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <User className="w-4 h-4 text-[#079551]" />
            Identificação do Usuário
          </h2>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* User Select Box */}
          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
            {loadingUsers ? (
              <div className="text-center py-6 text-xs text-slate-400">Carregando usuários cadastrados...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                Nenhum usuário ativo encontrado. Procure o administrador para ser cadastrado.
              </div>
            ) : (
              users.map((user) => {
                const isSelected = selectedUserId === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setAuthError('');
                    }}
                    className={`w-full flex items-center justify-between p-3 min-h-[52px] rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#079551]/10 border-[#079551]/40 text-[#050f41] shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900 hover:text-[#050f41]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-[#079551]/15 text-[#079551] border border-[#079551]/30">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-base font-bold leading-none">{user.name}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#079551]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={handleAccess}
            disabled={!selectedUserId || submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#050f41] hover:bg-[#0e1748] text-white font-bold py-3.5 px-4 min-h-11 rounded-xl shadow-lg shadow-[#050f41]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            <span>{submitting ? 'Acessando...' : 'Acessar Sistema'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center">
            <a
              href="/admin/login"
              className="text-xs text-slate-400 hover:text-[#050f41] inline-flex items-center gap-1.5 py-2.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login Admin</span>
            </a>
          </div>

        </div>

      </div>

    </div>
  );
};
