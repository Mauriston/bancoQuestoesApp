import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, FileCheck, History, UploadCloud,
  LogOut, ShieldAlert, Menu, X, Images
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Gerenciar Usuários', path: '/admin/users', icon: Users },
    { label: 'Banco de Questões', path: '/admin/questions', icon: BookOpen },
    { label: 'Imagens em Lote', path: '/admin/images', icon: Images },
    { label: 'Provas e Simulados', path: '/admin/exams', icon: FileCheck },
    { label: 'Tentativas & Respostas', path: '/admin/attempts', icon: History },
    { label: 'Importar Banco JSON', path: '/admin/import', icon: UploadCloud }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-[#FAB932] selection:text-[#050f41]">

      {/* Top Admin Bar */}
      <header className="sticky top-0 z-40 bg-[#050f41] border-b border-white/10">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link to="/admin/dashboard" className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FAB932] flex items-center justify-center text-[#050f41] shadow-lg shadow-black/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight flex items-center gap-1.5">
                    Painel Administrativo
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-[#FAB932] border border-white/10">
                      ADMIN
                    </span>
                  </h1>
                  <p className="text-[11px] text-white/60">Plataforma TEOT Ortopedia</p>
                </div>
              </Link>
            </div>

            {/* Admin User Info & Logout */}
            <div className="flex items-center gap-3">
              {currentUser && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                  <div className="w-6 h-6 rounded-full bg-[#FAB932]/25 text-[#FAB932] flex items-center justify-center font-bold text-[11px]">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-white leading-none">{currentUser.name}</p>
                    <p className="text-[10px] text-white/60 leading-none mt-0.5">{currentUser.email}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                title="Sair do Painel"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
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
        group/sidebar fixed inset-y-0 lg:inset-y-auto lg:top-16 lg:bottom-0 left-0 z-30 w-64 lg:w-16 lg:hover:w-64 bg-[#0c1c5c] border-r border-white/10 p-3 lg:py-4 transition-[width,transform] duration-200 flex flex-col shadow-xl lg:shadow-2xl overflow-hidden
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="lg:hidden flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <span className="text-sm font-semibold text-white">Navegação Admin</span>
          <button onClick={() => setMobileMenuOpen(false)} className="text-white/70">
            <X className="w-5 h-5" />
          </button>
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
      <div className="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-8 lg:pl-[calc(1rem+4rem)] py-6 lg:ml-0">

        {/* Content Area */}
        <section className="flex-1 min-w-0">
          {children || <Outlet />}
        </section>

      </div>

    </div>
  );
};
