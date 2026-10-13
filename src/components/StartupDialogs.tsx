import React, { useState } from 'react';
import { InitialPasswordDialog } from './InitialPasswordDialog';
import { InstallAppTutorial, useInstallTutorialEligible } from './InstallAppTutorial';
import { useAuth } from '../contexts/AuthContext';

// Diálogos exibidos ao abrir o app (usuário comum e leitor), um de cada vez:
// primeiro o lembrete de senha inicial; depois o tutorial de instalação.
export const StartupDialogs: React.FC<{ settingsPath: string }> = ({ settingsPath }) => {
  const { currentUser } = useAuth();
  const installEligible = useInstallTutorialEligible();
  const [passwordHandled, setPasswordHandled] = useState(false);
  const [installClosed, setInstallClosed] = useState(false);

  const needsPasswordDialog = !!currentUser && currentUser.role !== 'admin' && !!currentUser.passwordIsInitial && !passwordHandled;
  if (needsPasswordDialog) {
    return <InitialPasswordDialog settingsPath={settingsPath} onClose={() => setPasswordHandled(true)} />;
  }
  if (installEligible && !installClosed) {
    return <InstallAppTutorial onClose={() => setInstallClosed(true)} />;
  }
  return null;
};
