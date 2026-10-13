import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { BookOpen, FileCheck, MessageSquare, Menu, X, Home } from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { useAuth } from '../contexts/AuthContext';
import { AvatarAccountMenu } from '../components/AvatarAccountMenu';

// Layout do perfil "Leitor" (somente leitura): menu lateral com Questões,
// Provas e Sabatinas; o avatar abre só "Perfil" e "Sair" — sem notificações,
// badges ou toasts.
export const ReaderLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Home', path: '/leitor/home', icon: Home },
    { label: 'Questões', path: '/leitor/questions', icon: BookOpen },
    { label: 'Provas', path: '/leitor/exams', icon: FileCheck },
    { label: 'Sabatinas', path: '/leitor/sabatinas', icon: MessageSquare }
  ];

  const currentTitle = navItems.find(item => location.pathname.startsWith(item.path))?.label
    || (location.pathname.startsWith('/leitor/settings') ? 'Perfil' : 'TEOT HMA 2027');

  const settingsActive = location.pathname.startsWith('/leitor/settings');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-100">
      <header className="sticky top-0 z-40 bg-slate-100 border-b border-white/10">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex-1 flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            <h1 className="flex-1 text-center text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight truncate px-2">
              {currentTitle}
            </h1>

            <div className="flex-1 flex items-center justify-end gap-3">
              {currentUser && (
                <AvatarAccountMenu
                  name={currentUser.name}
                  photoUrl={currentUser.photoUrl}
                  role={currentUser.role}
                  unreadCount={0}
                  hideNotifications
                  onLogout={handleLogout}
                  settingsPath="/leitor/settings"
                  notificationsPath="/leitor/settings"
                  triggerClassName="flex items-center gap-2 px-1 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:bg-white/10 sm:hover:bg-white/15 sm:border sm:border-white/10 text-xs transition-colors"
                  nameSlot={
                    <div className="hidden sm:block text-left">
                      <p className="font-semibold text-white leading-none">{currentUser.name}</p>
                      <p className="text-[10px] text-white/60 leading-none mt-0.5">{currentUser.email}</p>
                    </div>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className={`
        group/sidebar fixed inset-y-0 lg:inset-y-auto lg:top-16 lg:bottom-0 left-0 z-50 lg:z-30 w-64 lg:w-16 lg:hover:w-64 bg-slate-100 border-r border-white/10 p-3 lg:py-4 transition-[width,transform] duration-200 flex flex-col shadow-xl lg:shadow-none overflow-hidden
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col items-center pb-4 mb-4 border-b border-white/10 relative shrink-0">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden absolute right-0 top-0 text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
          <img src="/icons/icon-192.png" alt="TEOT HMA 2027" className="w-10 h-10 rounded-xl shadow-lg shadow-black/20 shrink-0" />
          <span className="mt-2 block text-[10px] font-bold text-white/70 tracking-wide text-center whitespace-nowrap lg:hidden lg:group-hover/sidebar:block">
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
                onClick={() => setMobileMenuOpen(false)}
                title={item.label}
                className={`flex items-center gap-3 lg:justify-center lg:group-hover/sidebar:justify-start px-3.5 lg:px-0 lg:group-hover/sidebar:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/40 font-semibold shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-500' : 'text-white/50'}`} />
                <span className="lg:hidden lg:group-hover/sidebar:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Botão do usuário no rodapé do menu: só Perfil e Sair. */}
        {currentUser && (
          <AvatarAccountMenu
            name={currentUser.name}
            photoUrl={currentUser.photoUrl}
            role={currentUser.role}
            unreadCount={0}
            settingsPath="/leitor/settings"
            notificationsPath="/leitor/settings"
            dropUp
            align="left"
            hideNotifications
            onLogout={handleLogout}
            onItemSelect={() => setMobileMenuOpen(false)}
            triggerClassName={`flex items-center gap-3 lg:justify-center lg:group-hover/sidebar:justify-start px-3.5 lg:px-0 lg:group-hover/sidebar:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 w-full ${
              settingsActive
                ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/40 font-semibold shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            nameSlot={<span className="lg:hidden lg:group-hover/sidebar:inline truncate">{currentUser.name}</span>}
          />
        )}
      </aside>

      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-20 bg-black/50 lg:hidden" />
      )}

      <div className="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-8 lg:pl-[calc(1rem+4rem)] py-6 pb-24 lg:pb-8 lg:ml-0">
        <section className="flex-1 min-w-0">
          <Outlet />
        </section>
      </div>

      {/* Barra flutuante mobile: Questões · Home · Provas */}
      <MobileBottomNav
        home={{ path: '/leitor/home', icon: Home, label: 'Home' }}
        left={{ path: '/leitor/questions', icon: BookOpen, label: 'Questões' }}
        right={{ path: '/leitor/exams', icon: FileCheck, label: 'Provas' }}
      />
    </div>
  );
};
