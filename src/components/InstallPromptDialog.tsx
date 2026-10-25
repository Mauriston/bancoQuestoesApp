import React, { useEffect, useRef } from 'react';
import { EllipsisVertical, Share, Smartphone, X } from 'lucide-react';
import { AppUser } from '../types';
import { isResidentRole } from '../utils/cohort';
import { incrementInstallPromptCount } from '../services/firebaseService';
import { clearInstallPromptPending, isInstallPromptPending } from '../services/authService';
import { detectPlatform, iosShareOnTop, isStandalone, readDone } from './InstallAppTutorial';

export const INSTALL_PROMPT_MAX_LOGINS = 3;

// Convite para adicionar o app à tela de início, para residentes (user e
// user_hnmd) no celular: aparece logo após o login, uma vez por login, nos 3
// primeiros logins feitos no celular (contador installPromptCount no
// documento do usuário, então vale em qualquer aparelho). Some se o app já
// estiver instalado ou se o passo a passo já foi concluído neste aparelho.
export function shouldShowInstallPrompt(user: AppUser | null): boolean {
  if (!user || !isResidentRole(user.role)) return false;
  if (!isInstallPromptPending(user.id)) return false;
  if (!detectPlatform() || isStandalone() || readDone()) return false;
  return (user.installPromptCount || 0) < INSTALL_PROMPT_MAX_LOGINS;
}

export const InstallPromptDialog: React.FC<{
  user: AppUser;
  onShowTutorial: () => void;
  onClose: () => void;
}> = ({ user, onShowTutorial, onClose }) => {
  const platform = detectPlatform();

  // Conta esta exibição e consome o "login pendente" assim que aparece —
  // recarregar a página não mostra de novo até o próximo login.
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    clearInstallPromptPending();
    incrementInstallPromptCount(user.id).catch(err => console.error('Erro ao registrar convite de instalação:', err));
  }, [user.id]);

  const howTo = platform === 'android'
    ? <>Toque no menu <EllipsisVertical className="inline w-3.5 h-3.5 -mt-0.5" /> do navegador e escolha <strong className="text-slate-100">“Adicionar à tela inicial”</strong> (ou “Instalar app”).</>
    : <>Toque em <strong className="text-slate-100">Compartilhar</strong> <Share className="inline w-3.5 h-3.5 -mt-0.5 text-sky-400" /> {iosShareOnTop() ? 'ao lado do endereço, no topo do navegador,' : 'na barra inferior do navegador'} e escolha <strong className="text-slate-100">“Adicionar à Tela de Início”</strong>.</>;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="install-prompt-title">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 id="install-prompt-title" className="text-sm font-bold text-slate-100">
            Tenha o app na sua tela de início
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {user.name.split(' ')[0]}, adicione o app à tela de início do celular: ele abre como um aplicativo, em tela cheia, já logado e a um toque de distância — ideal para treinar as provas no dia a dia.
          </p>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 border border-slate-800 rounded-xl p-3 text-left">
            {howTo}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={onShowTutorial}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors"
          >
            Ver passo a passo
          </button>
        </div>
      </div>
    </div>
  );
};
