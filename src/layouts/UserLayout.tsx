import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  FileText, History, BarChart3, LogOut, Trophy, Menu, X, CalendarDays, Sparkles, GraduationCap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { Avatar } from '../components/Avatar';

export const UserLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Provas', path: '/app/exams', icon: FileText },
    { label: 'Histórico', path: '/app/history', icon: History },
    { label: 'Desempenho', path: '/app/performance', icon: BarChart3 },
    { label: 'Cronograma', path: '/app/cronograma', icon: CalendarDays },
    { label: 'TARO/TEOT', path: '/app/exam-stats', icon: GraduationCap },
    { label: 'Extras', path: '/app/extras', icon: Sparkles }
  ];

  const currentTitle = navItems.find(item => location.pathname.startsWith(item.path))?.label
    || (location.pathname.startsWith('/app/settings') ? 'Ajustes' : 'Treinamento TEOT');

  // Execução de prova roda em tela cheia: sem topbar, sem navegação para
  // outras páginas e sem rodapé — só o conteúdo da prova (TakeExamPage já
  // desenha seu próprio topo minimalista com o ícone do app + nome da prova).
  const isTakingExam = /^\/app\/exams\/[^/]+$/.test(location.pathname);

  if (isTakingExam) {
    return (
      <div className="min-h-dvh bg-slate-950 font-sans selection:bg-[#FAB932] selection:text-[#050f41]">
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
          {children || <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col font-sans selection:bg-[#FAB932] selection:text-[#050f41]">
      {/* Top Bar Navigation */}
      <header className="sticky top-0 z-40 bg-[#050f41] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">

            {/* Hamburger (mobile only) + Logo Brand */}
            <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1 md:flex-initial">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="tap-target md:hidden -ml-2 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 shrink-0"
                aria-label="Abrir menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link to="/app/home" className="hidden md:flex items-center gap-2.5 group min-w-0 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-[#FAB932] flex items-center justify-center text-[#050f41] shadow-lg shadow-black/20 group-hover:scale-105 transition-transform shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
              </Link>

              <h1 className="flex-1 md:flex-initial text-center md:text-left text-2xl sm:text-xl font-extrabold text-white tracking-tight leading-tight truncate px-1">
                {currentTitle}
              </h1>
            </div>

            {/* Desktop Navigation Links (md até antes de lg — a partir de lg
                a navegação passa a viver na sidebar fixa abaixo) */}
            <nav className="hidden md:flex lg:hidden items-center space-x-1">
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

            {/* Active User Badge & Logout — avatar sozinho no mobile, chip
                completo (avatar + nome) a partir de sm. */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {currentUser && (
                <>
                  <div className="sm:hidden shrink-0" title={currentUser.name}>
                    <Avatar name={currentUser.name} photoUrl={currentUser.photoUrl} role={currentUser.role} size="sm" />
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                    <Avatar name={currentUser.name} photoUrl={currentUser.photoUrl} role={currentUser.role} size="sm" />
                    <span className="font-medium text-white max-w-[120px] truncate">{currentUser.name}</span>
                  </div>
                </>
              )}

              <button
                onClick={handleLogout}
                title="Sair da Conta"
                className="tap-target flex items-center justify-center gap-1.5 sm:min-w-0 sm:min-h-0 sm:px-3.5 sm:py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
              >
                <LogOut className="w-5 h-5" strokeWidth={2.5} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>

          </div>
        </div>

      </header>

      {/* Backdrop do menu mobile — desfoca e escurece o plano de fundo,
          com fade suave em conjunto com a gaveta abrindo/fechando. */}
      <div
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-40 bg-[#050f41]/60 backdrop-blur-sm transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Gaveta do menu mobile — desliza da esquerda para a direita, limitada
          a aproximadamente 50% da largura da tela quando totalmente
          expandida. */}
      <nav
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-1/2 max-w-xs bg-[#050f41] border-r border-white/10 shadow-2xl px-3 py-4 flex flex-col gap-1 overflow-y-auto transition-transform duration-300 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Ícone do app — o mesmo usado na tela de login. */}
        <div className="flex flex-col items-center py-2 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-[#FAB932] flex items-center justify-center text-[#050f41] shadow-lg shadow-black/20">
            <Trophy className="w-6 h-6" />
          </div>
          <span className="mt-2 text-[10px] font-bold text-white/70 tracking-wide text-center whitespace-nowrap">
            TEOT HMA 2027
          </span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-3.5 min-h-11 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#FAB932]' : 'text-white/50'}`} />
              {item.label}
            </Link>
          );
        })}

        {/* Avatar + nome do usuário fica fixo no rodapé do menu lateral,
            dando acesso à tela de Ajustes (troca de e-mail/senha). */}
        <Link
          to="/app/settings"
          onClick={() => setMobileMenuOpen(false)}
          className={`mt-auto flex items-center gap-3 px-3.5 py-3.5 min-h-11 rounded-lg text-sm font-medium transition-colors ${
            location.pathname.startsWith('/app/settings')
              ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          {currentUser && <Avatar name={currentUser.name} photoUrl={currentUser.photoUrl} role={currentUser.role} size="sm" />}
          <span className="truncate">{currentUser?.name}</span>
        </Link>
      </nav>

      {/* Desktop Sidebar — mesmo padrão da AdminLayout: fixa, colada na
          borda esquerda, recolhida (só ícones) por padrão, expande em
          overlay ao passar o mouse. Só aparece a partir de lg; abaixo disso
          a navegação continua na gaveta/topbar mobile de sempre. */}
      <aside className="group/sidebar hidden lg:flex fixed inset-y-0 top-16 bottom-0 left-0 z-30 w-16 hover:w-64 bg-[#0c1c5c] border-r border-white/10 py-4 px-3 transition-[width] duration-200 flex-col shadow-2xl overflow-hidden">
        <div className="flex flex-col items-center pb-4 mb-4 border-b border-white/10 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#FAB932] flex items-center justify-center text-[#050f41] shadow-lg shadow-black/20 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="mt-2 hidden text-[10px] font-bold text-white/70 tracking-wide text-center whitespace-nowrap group-hover/sidebar:block">
            TEOT HMA 2027
          </span>
        </div>

        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex items-center gap-3 justify-center group-hover/sidebar:justify-start px-0 group-hover/sidebar:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40 font-semibold shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FAB932]' : 'text-white/50'}`} />
                <span className="hidden group-hover/sidebar:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Avatar + nome do usuário fica fixo no rodapé do menu lateral,
            dando acesso à tela de Ajustes (troca de e-mail/senha). */}
        <Link
          to="/app/settings"
          title={currentUser?.name}
          className={`flex items-center gap-3 justify-center group-hover/sidebar:justify-start px-0 group-hover/sidebar:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
            location.pathname.startsWith('/app/settings')
              ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40 font-semibold shadow-sm'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          {currentUser && <Avatar name={currentUser.name} photoUrl={currentUser.photoUrl} role={currentUser.role} size="sm" />}
          <span className="hidden group-hover/sidebar:inline truncate">{currentUser?.name}</span>
        </Link>
      </aside>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 lg:pl-[calc(1rem+4rem)] py-4 sm:py-6 pb-20 lg:pb-6">
        {children || <Outlet />}
      </main>

      {/* Footer */}
      <footer className="hidden sm:block border-t border-white/10 bg-[#050f41] py-6 text-center text-xs text-white/50">
        <p>2026. Developed by Mauriston Martins. Powered by Claude Code / Google AI Studio.</p>
      </footer>

      <MobileBottomNav
        home={{ path: '/app/home', icon: Trophy, label: 'Home' }}
        left={{ path: '/app/history', icon: History, label: 'Histórico' }}
        right={{ path: '/app/performance', icon: BarChart3, label: 'Desempenho' }}
      />
    </div>
  );
};
