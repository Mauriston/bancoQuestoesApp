import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, FileCheck, History, UploadCloud,
  LogOut, ShieldAlert, Menu, X, Sparkles
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
    { label: 'Provas e Simulados', path: '/admin/exams', icon: FileCheck },
    { label: 'Tentativas & Respostas', path: '/admin/attempts', icon: History },
    { label: 'Importar Banco JSON', path: '/admin/import', icon: UploadCloud }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-[#FAB932] selection:text-[#050f41]">

      {/* Top Admin Bar */}
      <header className="sticky top-0 z-40 bg-[#050f41] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  <h1 className="text-base font-bold text-white tracking-tight leading-tight flex items-center gap-1.5">
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

      {/* Main Shell with Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">

        {/* Desktop Sidebar / Mobile Overlay */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#050f41] rounded-none lg:rounded-2xl border border-white/10 p-4 transition-transform duration-200 flex flex-col shadow-xl lg:shadow-md lg:h-fit
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#FAB932]/15 text-[#FAB932] border border-[#FAB932]/40 font-semibold shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#FAB932]' : 'text-white/50'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 p-4 rounded-xl bg-white/10 border border-white/10 text-xs text-white/70 space-y-2">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FAB932]" />
              Banco Protegido TEOT
            </p>
            <p className="text-[11px] leading-relaxed">Gabaritos e relatórios são restritos. Operações registradas em log.</p>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 min-w-0">
          {children || <Outlet />}
        </section>

      </div>

      <footer className="border-t border-white/10 bg-[#050f41] py-4 text-center text-xs text-white/50">
        <p>Sistema Administrativo TEOT • SBOT</p>
      </footer>

    </div>
  );
};
