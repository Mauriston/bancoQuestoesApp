import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { useHideOnScroll } from '../hooks/useHideOnScroll';

interface NavButton {
  path: string;
  icon: LucideIcon;
  label: string;
}

interface MobileBottomNavProps {
  items: NavButton[];
}

// Barra de navegação inferior mobile — pílula flutuante com ícone + rótulo
// por item (padrão do handoff de design: 60px por item, rótulo 10px). Some
// ao rolar para baixo e reaparece ao rolar para cima (useHideOnScroll).
// Nunca renderizada durante a execução de uma prova (isTakingExam já
// contorna todo o chrome do layout antes de chegar aqui).
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);
  const hidden = useHideOnScroll();

  return (
    <nav
      className={`lg:hidden fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-1 bg-[#050f41]/95 backdrop-blur-md border border-white/10 rounded-[22px] shadow-2xl shadow-black/40 px-2 py-1.5 transition-transform duration-300 ease-out ${
        hidden ? 'translate-y-[calc(150%+1rem)]' : 'translate-y-0'
      }`}
    >
      {items.map((btn) => {
        const Icon = btn.icon;
        const active = isActive(btn.path);
        return (
          <Link
            key={btn.path}
            to={btn.path}
            aria-label={btn.label}
            className={`tap-target flex flex-col items-center justify-center gap-1 w-[52px] py-1.5 rounded-2xl transition-colors ${
              active ? 'bg-[#FAB932]/18 text-[#FAB932]' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon className="w-[19px] h-[19px]" />
            <span className="text-[9px] font-bold leading-none">{btn.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
