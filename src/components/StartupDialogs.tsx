import React, { useState } from 'react';
import { InitialPasswordDialog } from './InitialPasswordDialog';
import { InstallAppTutorial, useInstallTutorialEligible } from './InstallAppTutorial';
import { InstallPromptDialog, shouldShowInstallPrompt } from './InstallPromptDialog';
import { useAuth } from '../contexts/AuthContext';
import { isResidentRole } from '../utils/cohort';

// Diálogos exibidos ao abrir o app (residente e leitor), um de cada vez:
// primeiro o lembrete de senha inicial; depois o convite de instalação.
// Residentes (user/user_hnmd) veem o convite (InstallPromptDialog) só nos 3
// primeiros logins no celular, com opção de abrir o passo a passo; leitores
// continuam vendo o passo a passo direto até concluí-lo no aparelho.
export const StartupDialogs: React.FC<{ settingsPath: string }> = ({ settingsPath }) => {
  const { currentUser } = useAuth();
  const installEligible = useInstallTutorialEligible();
  const [passwordHandled, setPasswordHandled] = useState(false);
  const [installClosed, setInstallClosed] = useState(false);
  // Decidido uma vez por montagem: o próprio diálogo consome o "login
  // pendente" ao aparecer, o que tornaria shouldShowInstallPrompt falso.
  const [promptEligible] = useState(() => shouldShowInstallPrompt(currentUser));
  const [promptStage, setPromptStage] = useState<'prompt' | 'tutorial' | 'closed'>('prompt');

  const needsPasswordDialog = !!currentUser && currentUser.role !== 'admin' && !!currentUser.passwordIsInitial && !passwordHandled;
  if (needsPasswordDialog) {
    return <InitialPasswordDialog settingsPath={settingsPath} onClose={() => setPasswordHandled(true)} />;
  }

  if (currentUser && isResidentRole(currentUser.role)) {
    if (!promptEligible || promptStage === 'closed') return null;
    if (promptStage === 'tutorial') {
      return <InstallAppTutorial onClose={() => setPromptStage('closed')} />;
    }
    return (
      <InstallPromptDialog
        user={currentUser}
        onShowTutorial={() => setPromptStage('tutorial')}
        onClose={() => setPromptStage('closed')}
      />
    );
  }

  if (installEligible && !installClosed) {
    return <InstallAppTutorial onClose={() => setInstallClosed(true)} />;
  }
  return null;
};
