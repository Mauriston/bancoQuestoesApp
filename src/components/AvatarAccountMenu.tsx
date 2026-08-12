import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, UserCircle } from 'lucide-react';
import { Avatar } from './Avatar';

interface AvatarAccountMenuProps {
  name: string;
  photoUrl?: string | null;
  role: 'admin' | 'user';
  avatarSize?: 'sm' | 'md' | 'lg';
  unreadCount: number;
  settingsPath: string;
  notificationsPath: string;
  // className do <button> gatilho — o chamador controla o "invólucro"
  // visual (ícone sozinho, chip com nome, linha de sidebar/gaveta...), este
  // componente só adiciona o comportamento de dropdown + badge por cima.
  triggerClassName: string;
  // Conteúdo extra dentro do gatilho, depois do avatar (ex.: nome do
  // usuário) — deixado a cargo do chamador para preservar classes
  // responsivas específicas de cada lugar (chip, linha de sidebar etc.).
  nameSlot?: React.ReactNode;
  // Abre o menu para cima em vez de para baixo — usado nos gatilhos
  // ancorados no rodapé da tela (sidebar/gaveta).
  dropUp?: boolean;
  align?: 'left' | 'right';
}

// Avatar clicável (topbar ou rodapé do menu lateral/gaveta) que abre um
// pequeno menu local com "Notificações" (com contador) e "Perfil" — mesmo
// comportamento nos acessos Admin e User.
export const AvatarAccountMenu: React.FC<AvatarAccountMenuProps> = ({
  name, photoUrl, role, avatarSize = 'sm', unreadCount,
  settingsPath, notificationsPath, triggerClassName, nameSlot,
  dropUp = false, align = 'right'
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={() => setOpen(prev => !prev)} className={triggerClassName}>
        <span className="relative inline-flex shrink-0">
          <Avatar name={name} photoUrl={photoUrl} role={role} size={avatarSize} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[0.95rem] h-[0.95rem] px-[3px] rounded-full bg-[#E20018] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#050f41] leading-none">
              {badgeLabel}
            </span>
          )}
        </span>
        {nameSlot}
      </button>

      {open && (
        <div
          className={`absolute z-50 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 overflow-hidden ${
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <Link
            to={notificationsPath}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              Notificações
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold text-[#E20018]">{badgeLabel}</span>
            )}
          </Link>
          <Link
            to={settingsPath}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <UserCircle className="w-3.5 h-3.5 text-slate-400" />
            Perfil
          </Link>
        </div>
      )}
    </div>
  );
};
