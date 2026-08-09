import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy, User, Lock, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, Mail, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getActiveUsers } from '../services/firebaseService';
import { AppUser } from '../types';

type Stage = 'splash' | 'gate';
type CardMode = 'user' | 'admin';

export const HomePage: React.FC = () => {
  const { selectUserSession, adminLogin } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('splash');
  const [cardMode, setCardMode] = useState<CardMode>('user');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [adminEmail, setAdminEmail] = useState('mauriston@oncoortopedia.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

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

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminSubmitting(true);
    try {
      await adminLogin(adminEmail, adminPassword);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setAdminError(err.message || 'Falha na autenticação administrativa. Verifique seu e-mail e senha.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#050f41] text-white flex flex-col items-center p-4 relative overflow-hidden font-sans"
      onClick={() => {
        if (stage === 'splash') setStage('gate');
      }}
    >

      {/* Background Subtle Accent Gradients */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FAB932]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#079551]/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        layout
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full z-10 flex flex-col items-center"
        style={{ flex: stage === 'splash' ? 1 : undefined }}
      >
        <motion.div
          layout
          className={`flex flex-col items-center ${stage === 'splash' ? 'justify-center flex-1' : 'pt-16 md:pt-20'}`}
        >
          {/* Brand Header */}
          <motion.div layout="position" className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FAB932] text-[#050f41] shadow-xl shadow-black/20 mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Treinamento TEOT HMA 2027</h1>
            <p className="text-xs text-white/60 mt-1">O ano da vitória 🏆</p>
          </motion.div>

          <AnimatePresence>
            {stage === 'splash' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[11px] text-white/40 tracking-wide animate-pulse"
              >
                clique para continuar
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {stage === 'gate' && (
            <motion.div
              key="gate-card"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full mt-2"
            >
              <div className="bg-white text-[#050f41] rounded-2xl p-6 shadow-2xl overflow-hidden relative">
                <AnimatePresence mode="wait" initial={false}>
                  {cardMode === 'user' ? (
                    <motion.div
                      key="user-card"
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
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
                        <button
                          onClick={() => {
                            setAdminError('');
                            setCardMode('admin');
                          }}
                          className="text-xs text-slate-400 hover:text-[#050f41] inline-flex items-center gap-1.5 py-2.5 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Login Admin</span>
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="admin-card"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <button
                        onClick={() => setCardMode('user')}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#050f41] mb-4 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Voltar para Seleção de Usuários</span>
                      </button>

                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 flex items-center justify-center">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h1 className="text-base font-bold text-[#050f41]">Acesso Administrativo</h1>
                          <p className="text-xs text-slate-400">Autenticação com Firebase Auth</p>
                        </div>
                      </div>

                      {adminError && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{adminError}</span>
                        </div>
                      )}

                      <form onSubmit={handleAdminSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">E-mail do Administrador</label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="email"
                              required
                              placeholder="mauriston@oncoortopedia.com"
                              value={adminEmail}
                              onChange={(e) => setAdminEmail(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Senha</label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={adminSubmitting}
                          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 min-h-11 rounded-xl shadow-lg shadow-cyan-500/20 text-sm transition-all disabled:opacity-50"
                        >
                          {adminSubmitting ? 'Autenticando...' : 'Entrar no Painel Admin'}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
};
