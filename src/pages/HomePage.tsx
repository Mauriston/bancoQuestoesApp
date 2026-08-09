import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy, Lock, AlertCircle, ArrowRight, ShieldCheck, Mail, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserInactiveError, UserNotRegisteredError } from '../services/authService';

type Stage = 'splash' | 'gate';
type CardMode = 'user' | 'admin';

export const HomePage: React.FC = () => {
  const { userLogin, adminLogin } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('splash');
  const [cardMode, setCardMode] = useState<CardMode>('user');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string>('');
  const [notRegisteredEmail, setNotRegisteredEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [adminEmail, setAdminEmail] = useState('mauriston@oncoortopedia.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setNotRegisteredEmail('');

    try {
      setSubmitting(true);
      await userLogin(email, password);
      navigate('/app/exams');
    } catch (err: any) {
      if (err instanceof UserNotRegisteredError) {
        setNotRegisteredEmail(err.email);
      } else if (err instanceof UserInactiveError) {
        navigate('/inactive');
      } else {
        setAuthError(err.message || 'Erro ao iniciar sessão.');
      }
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
        transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1 }}
        className="max-w-md w-full z-10 flex flex-col items-center"
        style={{ flex: stage === 'splash' ? 1 : undefined }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1 }}
          className={`flex flex-col items-center ${stage === 'splash' ? 'justify-center flex-1' : 'pt-16 md:pt-20'}`}
        >
          {/* Brand Header */}
          <motion.div
            layout="position"
            transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FAB932] text-[#050f41] shadow-xl shadow-black/20 mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">TEOT HMA 2027</h1>
            <p className="text-xs text-white/60 mt-1">O ano da vitória 🏆</p>
          </motion.div>

          <AnimatePresence>
            {stage === 'splash' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.35, 0.85, 0.35] }}
                exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
                transition={{
                  opacity: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="text-[11px] text-white/40 tracking-wide"
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.4, ease: 'easeInOut' } }}
              transition={{ type: 'spring', stiffness: 80, damping: 18, mass: 1, delay: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full mt-2"
            >
              <div className="bg-white text-[#050f41] rounded-2xl p-6 shadow-2xl overflow-hidden relative">
                <AnimatePresence mode="wait" initial={false}>
                  {cardMode === 'user' ? (
                    <motion.div
                      key="user-card"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#079551]" />
                        Acesso do Residente
                      </h2>
                      <p className="text-xs text-slate-400 mb-4">Entre com seu e-mail e senha cadastrados.</p>

                      {notRegisteredEmail && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>
                            Não encontramos cadastro para o e-mail <strong>{notRegisteredEmail}</strong>.{' '}
                            <Link to="/cadastro" state={{ email: notRegisteredEmail }} className="font-bold underline hover:text-amber-900">
                              Clique aqui para se cadastrar
                            </Link>
                            .
                          </span>
                        </div>
                      )}

                      {authError && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{authError}</span>
                        </div>
                      )}

                      <form onSubmit={handleAccess} className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="email"
                              required
                              placeholder="seuemail@exemplo.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-[#079551]"
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
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-[#079551]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full flex items-center justify-center gap-2 bg-[#050f41] hover:bg-[#0e1748] text-white font-bold py-3.5 px-4 min-h-11 rounded-xl shadow-lg shadow-[#050f41]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                        >
                          <span>{submitting ? 'Acessando...' : 'Entrar'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>

                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center">
                        <button
                          onClick={() => {
                            setAdminError('');
                            setCardMode('admin');
                          }}
                          className="text-xs text-slate-400 hover:text-[#050f41] inline-flex items-center gap-1.5 py-2.5 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Área restrita</span>
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="admin-card"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
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
                          <h1 className="text-base font-bold text-[#050f41]">Área restrita</h1>
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
                          {adminSubmitting ? 'Autenticando...' : 'Entrar'}
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
