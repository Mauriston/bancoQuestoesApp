import React, { useState } from 'react';
import { requestPasswordReset } from '../services/authService';

// Link "Esqueci minha senha" das telas de login (residente e admin): envia
// o e-mail de redefinição do Firebase Auth para o e-mail já digitado no
// formulário, sem depender do admin nem do console do Firebase.
export const ForgotPasswordLink: React.FC<{ email: string }> = ({ email }) => {
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setSentTo('');
    const target = email.trim();
    if (!target) {
      setError('Digite seu e-mail no campo acima e clique de novo em "Esqueci minha senha".');
      return;
    }
    setSending(true);
    try {
      await requestPasswordReset(target);
      setSentTo(target.toLowerCase());
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar o e-mail de redefinição.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="text-xs text-[#227d74] hover:text-[#05413b] font-semibold py-2 transition-colors disabled:opacity-50"
      >
        {sending ? 'Enviando...' : 'Esqueci minha senha'}
      </button>
      {sentTo && (
        <p className="text-[11px] text-[#05413b] bg-[#079551]/10 border border-[#079551]/30 rounded-2xl p-2.5 mt-1">
          Se houver uma conta para <strong>{sentTo}</strong>, enviamos um link para criar uma nova senha. Confira também a caixa de spam.
        </p>
      )}
      {error && (
        <p className="text-[11px] text-[#9b2c26] bg-[#FDEEEC] border border-[#F3C6C0] rounded-2xl p-2.5 mt-1">{error}</p>
      )}
    </div>
  );
};
