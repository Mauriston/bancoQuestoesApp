import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  FileText, History, BarChart3, LogOut, Trophy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const UserLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Provas & Simulados', path: '/app/exams', icon: FileText },
    { label: 'Meu Histórico', path: '/app/history', icon: History },
    { label: 'Meu Desempenho', path: '/app/performance', icon: BarChart3 }
  ];

  // Execução de prova roda em tela cheia: sem topbar, sem navegação para
  // outras páginas e sem rodapé — só o conteúdo da prova (TakeExamPage já
  // desenha seu próprio topo minimalista com o ícone do app + nome da prova).
  const isTakingExam = /^\/app\/exams\/[^/]+$/.test(location.pathname);

  if (isTakingExam) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans selection:bg-[#FAB932] selection:text-[#050f41]">
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
          {children || <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-[#FAB932] selection:text-[#050f41]">
      {/* Top Bar Navigation */}
      <header className="sticky top-0 z-40 bg-[#050f41] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo Brand */}
            <div className="flex items-center space-x-3">
              <Link to="/app/exams" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-[#FAB932] flex items-center justify-center text-[#050f41] shadow-lg shadow-black/20 group-hover:scale-105 transition-transform">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight leading-tight flex items-center gap-1.5">
                    Treinamento TEOT HMA 2027
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white/10 text-[#FAB932] border border-white/10">
                      Candidato
                    </span>
                  </h1>
                  <p className="text-[11px] text-white/60">O ano da vitória 🏆</p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40 shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#FAB932]' : 'text-white/50'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Active User Badge & Logout */}
            <div className="flex items-center gap-3">
              {currentUser && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                  <div className="w-6 h-6 rounded-full bg-[#FAB932]/25 text-[#FAB932] flex items-center justify-center font-semibold text-[11px]">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-white max-w-[120px] truncate">{currentUser.name}</span>
                </div>
              )}

              <button
                onClick={handleLogout}
                title="Sair da Conta"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <div className="md:hidden border-t border-white/10 bg-black/10 px-2 py-1.5 flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isActive ? 'text-[#FAB932]' : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children || <Outlet />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#050f41] py-6 text-center text-xs text-white/50">
        <p>2026. Developed by Mauriston Martins. Powered by Claude Code / Google AI Studio.</p>
      </footer>
    </div>
  );
};
