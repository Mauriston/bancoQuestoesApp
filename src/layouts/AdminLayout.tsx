import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, FileCheck, History, UploadCloud,
  LogOut, Trophy, Menu, X, GraduationCap, Sparkles, Home, MessageSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { AvatarAccountMenu } from '../components/AvatarAccountMenu';
import { NotificationToastHost } from '../components/NotificationToastHost';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { unreadCount } = useUnreadNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Questões', path: '/admin/questions', icon: BookOpen },
    { label: 'Provas', path: '/admin/exams', icon: FileCheck },
    { label: 'Resultados', path: '/admin/attempts', icon: History },
    { label: 'Sabatinas', path: '/admin/sabatinas', icon: MessageSquare },
    { label: 'Usuários', path: '/admin/users', icon: Users },
    { label: 'Importar', path: '/admin/import', icon: UploadCloud },
    { label: 'TEOT / TARO', path: '/admin/exam-stats', icon: GraduationCap },
    { label: 'Extras', path: '/admin/extras', icon: Sparkles }
  ];

  const currentTitle = navItems.find(item => location.pathname.startsWith(item.path))?.label || 'Painel Administrativo';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-[#FAB932] selection:text-[#050f41]">

      {/* Top Admin Bar */}
      <header className="sticky top-0 z-40 bg-[#050f41] border-b border-white/10">
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

            {/* Admin User Info & Logout — avatar sozinho no mobile, chip
                completo (avatar + nome + e-mail) a partir de sm. */}
            <div className="flex-1 flex items-center justify-end gap-3">
              {currentUser && (
                <>
                  <AvatarAccountMenu
                    name={currentUser.name}
                    photoUrl={currentUser.photoUrl}
                    role={currentUser.role}
                    unreadCount={unreadCount}
                    settingsPath="/admin/settings"
                    notificationsPath="/admin/notifications"
                    triggerClassName="sm:hidden shrink-0"
                  />
                  <AvatarAccountMenu
                    name={currentUser.name}
                    photoUrl={currentUser.photoUrl}
                    role={currentUser.role}
                    unreadCount={unreadCount}
                    settingsPath="/admin/settings"
                    notificationsPath="/admin/notifications"
                    triggerClassName="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs transition-colors"
                    nameSlot={
                      <div className="text-left">
                        <p className="font-semibold text-white leading-none">{currentUser.name}</p>
                        <p className="text-[10px] text-white/60 leading-none mt-0.5">{currentUser.email}</p>
                      </div>
                    }
                  />
                </>
              )}

              <button
                onClick={handleLogout}
                title="Sair do Painel"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-white/70 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut className="w-5 h-5" strokeWidth={2.5} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Desktop Sidebar / Mobile Overlay — fixa na tela (não rola com o
          conteúdo), colada na borda esquerda do viewport, ocupando toda a
          altura abaixo da topbar. Por padrão fica recolhida (só ícones);
          passar o mouse por cima expande por cima do conteúdo (overlay, sem
          empurrar layout), revelando os rótulos. No mobile, continua a
          gaveta de sempre, ocupando a tela inteira em altura. */}
      <aside className={`
        group/sidebar fixed inset-y-0 lg:inset-y-auto lg:top-16 lg:bottom-0 left-0 z-50 lg:z-30 w-64 lg:w-16 lg:hover:w-64 bg-[#0c1c5c] border-r border-white/10 p-3 lg:py-4 transition-[width,transform] duration-200 flex flex-col shadow-xl lg:shadow-2xl overflow-hidden
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col items-center pb-4 mb-4 border-b border-white/10 relative shrink-0">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden absolute right-0 top-0 text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#FAB932] flex items-center justify-center text-[#050f41] shadow-lg shadow-black/20 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
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
                    ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40 font-semibold shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FAB932]' : 'text-white/50'}`} />
                <span className="lg:hidden lg:group-hover/sidebar:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Avatar + nome do admin fica fixo no rodapé do menu lateral,
            dando acesso ao menu de Notificações/Perfil — mesmo padrão do
            acesso User. */}
        {currentUser && (
          <AvatarAccountMenu
            name={currentUser.name}
            photoUrl={currentUser.photoUrl}
            role={currentUser.role}
            unreadCount={unreadCount}
            settingsPath="/admin/settings"
            notificationsPath="/admin/notifications"
            dropUp
            align="left"
            triggerClassName={`flex items-center gap-3 lg:justify-center lg:group-hover/sidebar:justify-start px-3.5 lg:px-0 lg:group-hover/sidebar:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 w-full ${
              location.pathname.startsWith('/admin/settings') || location.pathname.startsWith('/admin/notifications')
                ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40 font-semibold shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            nameSlot={<span className="lg:hidden lg:group-hover/sidebar:inline truncate">{currentUser.name}</span>}
          />
        )}
      </aside>

      {/* Backdrop do menu mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
        />
      )}

      {/* Main Shell — margem esquerda fixa no desktop equivalente à largura
          recolhida da sidebar (w-16); a expansão por hover é um overlay e
          não deve empurrar o conteúdo. */}
      <div className="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-8 lg:pl-[calc(1rem+4rem)] py-6 pb-20 lg:pb-6 lg:ml-0">

        {/* Content Area */}
        <section className="flex-1 min-w-0">
          {children || <Outlet />}
        </section>

      </div>

      <MobileBottomNav
        items={[
          { path: '/admin/questions', icon: BookOpen, label: 'Questões' },
          { path: '/admin/home', icon: Home, label: 'Home' },
          { path: '/admin/exams', icon: FileCheck, label: 'Provas' }
        ]}
      />

      <NotificationToastHost />

    </div>
  );
};
