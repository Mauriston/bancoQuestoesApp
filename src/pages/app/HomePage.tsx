import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, History, BarChart3, CalendarDays, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const HOME_ITEMS = [
  { label: 'Provas', path: '/app/exams', icon: FileText, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { label: 'Histórico', path: '/app/history', icon: History, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  { label: 'Desempenho', path: '/app/performance', icon: BarChart3, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { label: 'Cronograma', path: '/app/cronograma', icon: CalendarDays, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { label: 'TARO/TEOT', path: '/app/exam-stats', icon: GraduationCap, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { label: 'Extras', path: '/app/extras', icon: Sparkles, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
];

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#050f41]">
          Olá, {currentUser?.name?.split(' ')[0] || 'residente'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">O que você quer fazer agora?</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {HOME_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-3 text-center"
            >
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${item.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-[#050f41]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
