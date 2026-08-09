import React, { useState } from 'react';
import { Settings, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateOwnCredentials } from '../../services/authService';

export const SettingsPage: React.FC = () => {
  const { currentUser, refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Informe sua senha atual para confirmar as alterações.');
      return;
    }
    if (!newEmail.trim() && !newPassword.trim()) {
      setError('Informe um novo e-mail ou uma nova senha para atualizar.');
      return;
    }
    if (newPassword && newPassword !== confirmNewPassword) {
      setError('A confirmação da nova senha não coincide.');
      return;
    }

    setSubmitting(true);
    try {
      await updateOwnCredentials(currentPassword, {
        newEmail: newEmail.trim() || undefined,
        newPassword: newPassword.trim() || undefined
      });
      await refreshUser();
      setSuccess('Dados atualizados com sucesso.');
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar seus dados.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-md space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#FAB932]/20 text-[#FAB932] border border-[#FAB932]/30 flex items-center justify-center font-bold text-lg shrink-0">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#050f41] truncate">{currentUser.name}</h1>
          <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
          <Settings className="w-4 h-4 text-teal-400" />
          Alterar e-mail ou senha
        </h2>
        <p className="text-xs text-slate-400 -mt-2">
          Confirme sua senha atual e informe apenas os campos que deseja alterar.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Senha Atual</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <label className="block text-xs font-medium text-slate-300 mb-1 mt-3">Novo E-mail (opcional)</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                placeholder={currentUser.email}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nova Senha (opcional)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {newPassword && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Confirmar Nova Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs"
          >
            {submitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
};
