import React, { useEffect, useRef, useState } from 'react';
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

  // Some ao rolar para baixo (conteúdo sobe na tela) e reaparece ao rolar
  // para cima — mesmo comportamento de "expressive nav bar" do vídeo de
  // referência. Fica sempre visível perto do topo da página, para não
  // sumir/reaparecer sozinha por causa de um scroll mínimo ali.
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (currentY < 24) {
        setVisible(true);
      } else if (delta > 8) {
        setVisible(false);
      } else if (delta < -8) {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const buttons = [left, home, right];

  return (
    <nav
      className={`lg:hidden fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-1.5 bg-[#05413b]/95 backdrop-blur-md border border-white/10 rounded-full shadow-2xl shadow-black/40 px-2 py-2 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-[calc(150%+1rem)]'
      }`}
    >
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
              active ? 'bg-[#FFCB70]/20 text-[#FFCB70]' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon className="w-5 h-5" />
          </Link>
        );
      })}
    </nav>
  );
};
