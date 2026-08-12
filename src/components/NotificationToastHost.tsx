import React, { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeNewNotifications } from '../services/firebaseService';
import { AppNotification } from '../types';

const AUTO_DISMISS_MS = 6000;

// Pop-ups de notificação em tempo real — montado uma vez em cada layout.
// Só mostra notificações criadas DEPOIS que este componente montou (ver
// mountedAt), e nunca a própria ação do usuário logado (ver useAuth filter
// em subscribeNewNotifications abaixo, aplicado no cliente).
export const NotificationToastHost: React.FC = () => {
  const { currentUser } = useAuth();
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const mountedAt = useRef(new Date());

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeNewNotifications(mountedAt.current, (notification) => {
      const isForMe = notification.audience === 'all' || currentUser.role === 'user';
      if (!isForMe || notification.actorId === currentUser.id) return;
      setToasts(prev => [...prev, notification]);
      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== notification.id));
      }, AUTO_DISMISS_MS);
    });
    return unsubscribe;
  }, [currentUser?.id, currentUser?.role]);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 sm:top-20 right-3 sm:right-6 z-[60] flex flex-col gap-2 w-[calc(100%-1.5rem)] sm:w-80 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-900 border border-slate-800 shadow-2xl rounded-xl p-3 flex items-start gap-2.5 animate-[fadeSlideIn_0.25s_ease-out]"
        >
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs text-slate-200 flex-1 leading-snug pt-0.5">{toast.message}</p>
          <button onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-300 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
