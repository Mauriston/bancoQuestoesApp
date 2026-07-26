import React from 'react';
import { BookOpen, Network, Zap, Bookmark, BarChart3, Flame, Award, CheckCircle2 } from 'lucide-react';
import { UserStats } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: UserStats;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, stats }) => {
  const accuracy = stats.totalSolved > 0 
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) 
    : 0;

  const navItems = [
    { id: 'quiz', label: 'Simulados & Treino', icon: BookOpen },
    { id: 'arvore', label: 'Árvore de Temas', icon: Network },
    { id: 'flashcards', label: 'Flashcards', icon: Zap },
    { id: 'salvas', label: 'Caderno de Erros', icon: Bookmark },
    { id: 'stats', label: 'Meu Desempenho', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo / Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('quiz')}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-teal-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Award className="w-6 h-6 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-outfit">
                  Banco TEOT
                </span>
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 uppercase tracking-wide">
                  SBOT
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Ortopedia & Traumatologia • Preparações & Revisões
              </p>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="hidden lg:flex items-center space-x-4 bg-slate-800/60 rounded-full px-4 py-1.5 border border-slate-700/50">
            <div className="flex items-center space-x-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Resolvidas:</span>
              <span className="font-bold text-white">{stats.totalSolved}</span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center space-x-2 text-xs">
              <Award className="w-4 h-4 text-teal-400" />
              <span className="text-slate-400">Precisão:</span>
              <span className={`font-bold ${accuracy >= 70 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-slate-200'}`}>
                {accuracy}%
              </span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center space-x-2 text-xs">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Sequência:</span>
              <span className="font-bold text-amber-400">{stats.streakDays} dias</span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-between py-2 border-t border-slate-800 overflow-x-auto space-x-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
