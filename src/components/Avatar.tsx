import React from 'react';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  role?: 'admin' | 'user';
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-lg',
};

// Avatar único usado em toda a aplicação: mostra a foto do usuário quando
// existir `photoUrl` (Firebase Storage, ver uploadUserAvatar), senão cai de
// volta na inicial do nome com cor por perfil — mesmo comportamento que já
// existia duplicado em UsersPage/UserDetailPage.
export const Avatar: React.FC<AvatarProps> = ({ name, photoUrl, role = 'user', size = 'md' }) => {
  const sizeClass = SIZE_CLASSES[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border border-slate-700 shrink-0`}
      />
    );
  }

  const colorClass = role === 'admin'
    ? 'bg-cyan-500/20 text-cyan-600 border border-cyan-500/30'
    : 'bg-teal-500/20 text-teal-600 border border-teal-500/30';

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0 ${colorClass}`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
};
