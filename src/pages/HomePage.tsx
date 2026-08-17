import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock, AlertCircle, ArrowRight, ShieldCheck, Mail, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserInactiveError, UserNotRegisteredError } from '../services/authService';

type Stage = 'splash' | 'gate';
type CardMode = 'user' | 'admin';

// Easings usados na animação de entrada da splash (bounce, para o ícone/
// título/subtítulo "pularem" para o lugar) e nas transições gerais de UI
// (suave, sem overshoot) — mesmos valores usados no protótipo de motion
// feito no Claude Design para esta tela.
const BOUNCE_EASE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Entrada em stagger do bloco de marca (ícone/título/subtítulo): parte de
// baixo, pequeno e levemente rotacionado, e "salta" para o lugar.
const brandEntrance = (delay: number) => ({
  initial: { opacity: 0, y: 60, scale: 0.55, rotate: -6 },
  animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
  transition: {
    default: { duration: 1, ease: BOUNCE_EASE, delay },
    opacity: { duration: 0.45, ease: 'easeOut' as const, delay }
  }
});

export const HomePage: React.FC = () => {
  const { userLogin, adminLogin, currentUser, loading } = useAuth();
  const navigate = useNavigate();

  // Sessão (usuário ou admin) fica salva no localStorage/Firebase Auth entre
  // fechamentos do app — ver authService.ts (SESSION_KEY) e a persistência
  // padrão do Firebase Auth (browserLocalPersistence). Esta tela é o ponto
  // de entrada ("/"), então ela é quem decide se já existe sessão válida e
  // pula direto para a home certa, em vez de sempre reexibir o login.
  useEffect(() => {
    if (!loading && currentUser) {
      navigate(currentUser.role === 'admin' ? '/admin/home' : '/app/home', { replace: true });
    }
  }, [loading, currentUser, navigate]);

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
      navigate('/app/home');
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
      navigate('/admin/home');
    } catch (err: any) {
      setAdminError(err.message || 'Falha na autenticação administrativa. Verifique seu e-mail e senha.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Enquanto a sessão salva ainda está sendo verificada, ou já foi
  // encontrada uma válida (redirecionamento acima em andamento), evita
  // piscar a tela de login antes de mandar o usuário para sua home.
  if (loading || currentUser) {
    return (
      <div className="min-h-screen bg-[#05413b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#05413b] text-white flex flex-col items-center p-4 relative overflow-hidden font-sans"
      onClick={() => {
        if (stage === 'splash') setStage('gate');
      }}
    >

      {/* Background Subtle Accent Gradients */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FFCB70]/10 rounded-full blur-3xl pointer-events-none" />
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
          className={`relative w-full flex flex-col items-center ${stage === 'splash' ? 'flex-1' : 'pt-16 md:pt-20'}`}
        >
          {/* Na splash, o bloco de marca fica centralizado de fato no meio
              da tela (wrapper absoluto, sem depender de flex-grow dividido
              com o "clique para continuar" abaixo — assim um não empurra o
              outro). No gate, o wrapper vira "contents" (não afeta layout) e
              o bloco volta ao fluxo normal, ancorado no topo. */}
          <div className={stage === 'splash' ? 'absolute inset-0 flex items-center justify-center' : 'contents'}>
            {/* Brand Header — ícone/título/subtítulo entram em stagger com
                bounce (ver brandEntrance); o ícone ainda flutua continuamente
                depois de assentar, num motion.img separado para não conflitar
                com a própria animação de entrada. */}
            <motion.div
              layout="position"
              transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1 }}
              className="text-center mb-8"
            >
              <motion.div {...brandEntrance(0)}>
                <motion.img
                  src="/icons/icon-192.png"
                  alt="TEOT HMA 2027"
                  className="w-[72px] h-[72px] rounded-2xl shadow-xl shadow-black/40 mb-4 mx-auto block object-contain"
                  animate={{ y: [0, -16, 0], rotate: [0, -4, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
              <motion.h1 {...brandEntrance(0.12)} className="text-2xl font-extrabold text-white tracking-tight">
                TEOT HMA 2027
              </motion.h1>
              <motion.p {...brandEntrance(0.22)} className="text-xs text-white/60 mt-1">
                O ano da vitória 🏆
              </motion.p>
            </motion.div>
          </div>

          <AnimatePresence>
            {stage === 'splash' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.35, 0.85, 0.35] }}
                exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
                transition={{
                  opacity: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="absolute inset-x-0 bottom-[16%] text-center text-[11px] text-white/40 tracking-wide"
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
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.4, ease: 'easeInOut' } }}
              transition={{ duration: 0.65, ease: SMOOTH_EASE, delay: 0.12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full mt-2"
            >
              <div className="bg-white text-[#05413b] rounded-2xl p-6 shadow-2xl overflow-hidden relative">
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
                        <div className="mb-4 p-3 rounded-2xl bg-[#FFF8E7] border border-[#F3D9A6] text-[#8a6a1f] text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-[#c99a3c] shrink-0 mt-0.5" />
                          <span>
                            Não encontramos cadastro para o e-mail <strong>{notRegisteredEmail}</strong>.{' '}
                            <Link to="/cadastro" state={{ email: notRegisteredEmail }} className="font-bold underline hover:text-[#5c4813]">
                              Clique aqui para se cadastrar
                            </Link>
                            .
                          </span>
                        </div>
                      )}

                      {authError && (
                        <div className="mb-4 p-3 rounded-2xl bg-[#FDEEEC] border border-[#F3C6C0] text-[#9b2c26] text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-[#9b2c26] shrink-0 mt-0.5" />
                          <span>{authError}</span>
                        </div>
                      )}

                      <form onSubmit={handleAccess} className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">E-mail</label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              type="email"
                              required
                              placeholder="seuemail@exemplo.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Senha</label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full flex items-center justify-center gap-2 bg-[#227d74] hover:bg-[#1b625a] text-white font-bold py-3.5 px-4 min-h-11 rounded-full shadow-lg shadow-[#227d74]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
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
                          className="text-xs text-slate-400 hover:text-[#05413b] inline-flex items-center gap-1.5 py-2.5 transition-colors"
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
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#05413b] mb-4 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Voltar para Seleção de Usuários</span>
                      </button>

                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-[#079551]/10 text-[#079551] border border-[#079551]/30 flex items-center justify-center">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h1 className="text-base font-bold text-[#05413b]">Área restrita</h1>
                        </div>
                      </div>

                      {adminError && (
                        <div className="mb-4 p-3 rounded-2xl bg-[#FDEEEC] border border-[#F3C6C0] text-[#9b2c26] text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-[#9b2c26] shrink-0 mt-0.5" />
                          <span>{adminError}</span>
                        </div>
                      )}

                      <form onSubmit={handleAdminSubmit} className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">E-mail do Administrador</label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              type="email"
                              required
                              placeholder="mauriston@oncoortopedia.com"
                              value={adminEmail}
                              onChange={(e) => setAdminEmail(e.target.value)}
                              className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Senha</label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={adminSubmitting}
                          className="w-full bg-[#227d74] hover:bg-[#1b625a] text-white font-bold py-3.5 px-4 min-h-11 rounded-full shadow-lg shadow-[#227d74]/30 text-sm transition-all disabled:opacity-50"
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
