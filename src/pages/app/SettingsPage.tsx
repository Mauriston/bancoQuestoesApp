import React, { useEffect, useRef, useState } from 'react';
import { Settings, Mail, Lock, AlertCircle, CheckCircle2, Camera, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateOwnCredentials } from '../../services/authService';
import { uploadUserAvatar, updateUserPhone } from '../../services/firebaseService';
import { maskPhoneInput } from '../../utils/helpers';
import { Avatar } from '../../components/Avatar';

export const SettingsPage: React.FC = () => {
  const { currentUser, refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Telefone/WhatsApp, mascarado à digitação (ver maskPhoneInput) — usado
  // pelo admin para enviar convites de prova (ExamViewPage).
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    setPhoneInput(currentUser?.phone ? maskPhoneInput(currentUser.phone) : '');
  }, [currentUser?.phone]);

  const handlePhotoChange = async (file: File | null) => {
    if (!file || !currentUser) return;
    setUploadingPhoto(true);
    try {
      await uploadUserAvatar(currentUser.id, file);
      await refreshUser();
    } catch (err) {
      setError('Erro ao enviar foto de perfil.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSavePhone = async () => {
    if (!currentUser || phoneInput === (currentUser.phone ? maskPhoneInput(currentUser.phone) : '')) return;
    setSavingPhone(true);
    try {
      await updateUserPhone(currentUser.id, phoneInput);
      await refreshUser();
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2000);
    } catch (err) {
      setError('Erro ao salvar telefone.');
    } finally {
      setSavingPhone(false);
    }
  };

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
        <div className="relative shrink-0">
          <Avatar name={currentUser.name} photoUrl={currentUser.photoUrl} role={currentUser.role} size="lg" />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            title="Alterar foto de perfil"
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-teal-500 hover:bg-teal-400 border-2 border-slate-950 flex items-center justify-center text-slate-950 disabled:opacity-50"
          >
            <Camera className="w-2.5 h-2.5" />
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#05413b] truncate">{currentUser.name}</h1>
          <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <h2 className="text-sm font-bold text-[#05413b] flex items-center gap-2">
          <Phone className="w-4 h-4 text-teal-400" />
          Telefone / WhatsApp
        </h2>
        <p className="text-xs text-slate-400 -mt-2">
          Usado para receber convites de prova.
        </p>
        <div className="relative">
          <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            value={phoneInput}
            onChange={(e) => setPhoneInput(maskPhoneInput(e.target.value))}
            onBlur={handleSavePhone}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#05413b] focus:outline-none focus:border-teal-500"
          />
        </div>
        {savingPhone && <p className="text-[11px] text-slate-500">Salvando...</p>}
        {!savingPhone && phoneSaved && (
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Telefone salvo.
          </p>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-[#05413b] flex items-center gap-2">
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#05413b] focus:outline-none focus:border-teal-500"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#05413b] focus:outline-none focus:border-teal-500"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#05413b] focus:outline-none focus:border-teal-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#05413b] focus:outline-none focus:border-teal-500"
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
