import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Mail, Lock, User, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createNewUserWithAuth } from '../services/authService';

// Mesma dupla de easing usada em HomePage/AdminLoginPage — suave, sem
// overshoot, para a entrada em fade+slide da página e a troca entre o
// formulário e a tela de sucesso.
const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const RegisterPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefillEmail = (location.state as { email?: string } | null)?.email || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      await createNewUserWithAuth(name, email, 'user', password, { active: false, startSession: false });
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05413b] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Background Subtle Accent Gradients — mesmo padrão de HomePage/AdminLoginPage */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FFCB70]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#079551]/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: SMOOTH_EASE }}
        className="max-w-md w-full z-10"
      >

        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para o login</span>
        </Link>

        <div className="bg-white text-[#05413b] rounded-2xl p-6 shadow-2xl overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.985, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.55, ease: SMOOTH_EASE }}
                className="text-center py-4"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#079551]/10 text-[#079551] border border-[#079551]/30 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h1 className="text-base font-bold text-[#05413b] mb-2">Usuário cadastrado com sucesso</h1>
                <p className="text-xs text-slate-500 mb-6">
                  Aguarde a liberação do administrador para acessar o sistema.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-[#227d74] hover:bg-[#1b625a] text-white font-bold py-3.5 px-4 min-h-11 rounded-full shadow-lg shadow-[#227d74]/30 text-sm transition-all"
                >
                  Voltar para o login
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.985, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.55, ease: SMOOTH_EASE }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#079551]/10 text-[#079551] border border-[#079551]/30 flex items-center justify-center">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-[#05413b]">Cadastro de Usuário</h1>
                    <p className="text-xs text-slate-400">Crie seu acesso com e-mail e senha</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-2xl bg-[#FDEEEC] border border-[#F3C6C0] text-[#9b2c26] text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#9b2c26] shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Dr. Roberto Alcantara"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">E-mail</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="roberto@ortopedia.br"
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
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Confirmar Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white border-[1.5px] border-[#0f4a43] rounded-full pl-11 pr-4 py-3 text-xs text-[#05413b] focus:outline-none focus:border-[#079551]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#079551] hover:bg-[#068045] text-white font-bold py-3.5 px-4 min-h-11 rounded-full shadow-lg shadow-[#079551]/30 text-sm transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </motion.div>
    </div>
  );
};
