import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, User, Search, ShieldCheck, Lock, AlertCircle, ArrowRight, Sparkles, CheckCircle2, UserPlus, X 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getActiveUsers, saveUser, getUsers } from '../services/firebaseService';
import { createNewUserWithAuth } from '../services/authService';
import { AppUser } from '../types';

export const HomePage: React.FC = () => {
  const { selectUserSession, adminLogin } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  
  // Admin password modal
  const [selectedAdminUser, setSelectedAdminUser] = useState<AppUser | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // New user registration modal state
  const [registerModalOpen, setRegisterModalOpen] = useState<boolean>(false);
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regError, setRegError] = useState<string>('');
  const [registering, setRegistering] = useState<boolean>(false);

  // Seed default admin helper if DB is completely empty
  const [seeding, setSeeding] = useState<boolean>(false);

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const activeList = await getActiveUsers();
      setUsers(activeList);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  // Filtered users dropdown list
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAccess = async () => {
    setAuthError('');
    if (!selectedUserId) {
      setAuthError('Por favor, selecione seu nome na lista para acessar.');
      return;
    }

    const targetUser = users.find(u => u.id === selectedUserId);
    if (!targetUser) return;

    if (!targetUser.active) {
      navigate('/inactive');
      return;
    }

    if (targetUser.role === 'admin') {
      setSelectedAdminUser(targetUser);
      return;
    }

    // Common user session start
    try {
      setSubmitting(true);
      await selectUserSession(targetUser.id);
      navigate('/app/exams');
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao iniciar sessão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminUser || !adminPassword) return;

    setSubmitting(true);
    setAuthError('');
    try {
      await adminLogin(selectedAdminUser.email, adminPassword);
      setSelectedAdminUser(null);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setAuthError(err.message || 'Senha incorreta ou acesso de administrador negado.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterNewCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegistering(true);

    try {
      if (!regName.trim()) throw new Error('Informe seu nome completo.');
      if (!regEmail.trim()) throw new Error('Informe um e-mail válido.');

      const newUser = await createNewUserWithAuth(regName, regEmail, 'user', regPassword);
      setRegisterModalOpen(false);
      setRegName('');
      setRegEmail('');
      setRegPassword('');

      // Auto login as new candidate
      await selectUserSession(newUser.id);
      navigate('/app/exams');
    } catch (err: any) {
      setRegError(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCreateInitialAdmin = async () => {
    setSeeding(true);
    try {
      await saveUser({
        name: "Administrador SBOT",
        email: "admin@sbot.org.br",
        role: "admin",
        active: true
      });
      await saveUser({
        name: "Dr. Carlos Eduardo (Residente)",
        email: "carlos.residente@ortopedia.br",
        role: "user",
        active: true
      });
      await saveUser({
        name: "Dra. Mariana Silva (R3)",
        email: "mariana.s@ortopedia.br",
        role: "user",
        active: true
      });
      await fetchUsersList();
    } catch (e: any) {
      setAuthError("Erro ao inicializar usuários padrão: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Subtle Accent Gradients */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-xl shadow-teal-500/20 mb-4">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Banco de Questões TEOT</h1>
          <p className="text-xs text-slate-400 mt-1">Sociedade Brasileira de Ortopedia e Traumatologia</p>
        </div>

        {/* Selection Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
            <User className="w-4 h-4 text-teal-400" />
            Identificação do Usuário
          </h2>
          <p className="text-xs text-slate-400 mb-4">Selecione o seu nome cadastrado na plataforma para iniciar.</p>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Search Filter for Dropdown */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar pelo seu nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* User Select Box */}
          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
            {loadingUsers ? (
              <div className="text-center py-6 text-xs text-slate-500">Carregando usuários cadastrados...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                Nenhum usuário ativo encontrado.
                {users.length === 0 && (
                  <button
                    onClick={handleCreateInitialAdmin}
                    disabled={seeding}
                    className="block mx-auto mt-3 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium"
                  >
                    {seeding ? 'Criando...' : 'Criar Usuários de Exemplo'}
                  </button>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUserId === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setAuthError('');
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500/50 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        user.role === 'admin' 
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                          : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-none">{user.name}</p>
                        <p className="text-[10px] text-slate-500 leading-none mt-1">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {user.role === 'admin' && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Admin
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={handleAccess}
            disabled={!selectedUserId || submitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs"
          >
            <span>{submitting ? 'Acessando...' : 'Acessar Sistema'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
            <button
              onClick={() => {
                setRegError('');
                setRegisterModalOpen(true);
              }}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Não encontrou seu nome? Cadastre-se</span>
            </button>

            <a
              href="/admin/login"
              className="text-xs text-slate-400 hover:text-cyan-400 inline-flex items-center gap-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login Admin</span>
            </a>
          </div>

        </div>

      </div>

      {/* Admin Password Form Modal */}
      {selectedAdminUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Autenticação Administrativa</h3>
                <p className="text-xs text-slate-400">{selectedAdminUser.name}</p>
              </div>
            </div>

            {authError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Informe a Senha Admin</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAdminUser(null);
                    setAuthError('');
                  }}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                >
                  {submitting ? 'Verificando...' : 'Entrar no Painel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Self-registration Modal */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-400" />
                Cadastro de Novo Residente / Candidato
              </h3>
              <button 
                onClick={() => setRegisterModalOpen(false)} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {regError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterNewCandidate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Fernando Souza"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="fernando@ortopedia.br"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Senha de Acesso (opcional)</label>
                <input
                  type="password"
                  placeholder="Deixe em branco para login rápido sem senha"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-500/20"
                >
                  {registering ? 'Cadastrando...' : 'Cadastrar e Acessar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
