import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Lembrete exibido ao abrir o app enquanto o usuário (comum ou leitor) ainda
// usa a senha inicial. "Sim" leva ao Perfil para trocar a senha; "Mais tarde"
// só fecha (volta a aparecer na próxima abertura do app).
export const InitialPasswordDialog: React.FC<{ settingsPath: string; onClose?: () => void }> = ({ settingsPath, onClose }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!currentUser || currentUser.role === 'admin' || !currentUser.passwordIsInitial || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <KeyRound className="w-6 h-6 text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-100">Troque sua senha inicial</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Você ainda está usando a senha inicial. Por segurança, recomendamos alterá-la agora. Deseja trocar a senha?
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setDismissed(true); onClose?.(); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Mais tarde
          </button>
          <button
            type="button"
            onClick={() => { setDismissed(true); onClose?.(); navigate(settingsPath); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
};
