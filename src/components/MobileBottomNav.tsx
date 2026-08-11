import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface NavButton {
  path: string;
  icon: LucideIcon;
  label: string;
}

interface MobileBottomNavProps {
  home: NavButton;
  left: NavButton;
  right: NavButton;
}

// Barra de navegação inferior mobile (só ícones, sem texto) — Home ao centro,
// e dois atalhos contextuais por perfil (ver UserLayout/AdminLayout). Nunca
// renderizada durante a execução de uma prova (isTakingExam already bypasses
// the whole layout chrome upstream).
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ home, left, right }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  const buttons = [left, home, right];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#050f41] border-t border-white/10 flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        const active = isActive(btn.path);
        return (
          <Link
            key={btn.path}
            to={btn.path}
            aria-label={btn.label}
            title={btn.label}
            className={`tap-target flex items-center justify-center w-12 h-12 rounded-full transition-colors ${
              active ? 'bg-[#FAB932]/20 text-[#FAB932]' : 'text-white/60 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
          </Link>
        );
      })}
    </nav>
  );
};
