import { useAuth } from '../contexts/AuthContext';

// Perfil "Leitor": somente leitura. As páginas do admin (Questões, Provas,
// Exibição da prova) e Sabatinas são reaproveitadas nas rotas /leitor, e
// escondem toda ação de escrita quando isReader é true.
export function useAccess() {
  const { currentUser } = useAuth();
  const isReader = currentUser?.role === 'reader';
  return {
    isReader,
    // Prefixo das rotas internas (links para a lista/exibição de provas).
    basePath: isReader ? '/leitor' : '/admin'
  };
}
