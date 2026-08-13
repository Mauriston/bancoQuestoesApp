import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Mesma dupla de easing usada em HomePage/RegisterPage — suave, sem
// overshoot, para a entrada em fade+slide do cartão de login.
const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const AdminLoginPage: React.FC = () => {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('mauriston@oncoortopedia.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await adminLogin(email, password);
      navigate('/admin/home');
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação administrativa. Verifique seu e-mail e senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05413b] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Background Subtle Accent Gradients — mesmo padrão de HomePage/RegisterPage */}
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
          <span>Voltar para Seleção de Usuários</span>
        </Link>

        <div className="bg-white text-[#05413b] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#079551]/10 text-[#079551] border border-[#079551]/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#05413b]">Área restrita</h1>
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
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">E-mail do Administrador</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="mauriston@oncoortopedia.com"
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
              className="w-full bg-[#227d74] hover:bg-[#1b625a] text-white font-bold py-3.5 px-4 min-h-11 rounded-full shadow-lg shadow-[#227d74]/30 text-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
