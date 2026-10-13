import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileCheck, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const HOME_ITEMS = [
  { label: 'Questões', path: '/leitor/questions', icon: BookOpen },
  { label: 'Provas', path: '/leitor/exams', icon: FileCheck },
  { label: 'Sabatinas', path: '/leitor/sabatinas', icon: MessageSquare },
];

export const ReaderHomePage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
          Olá, {currentUser?.name?.split(' ')[0] || 'leitor'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">O que você quer fazer agora?</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {HOME_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="bg-teal-500 hover:bg-teal-600 rounded-2xl p-5 transition-colors flex flex-col items-center gap-3 text-center"
            >
              <Icon className="w-8 h-8 text-white" strokeWidth={1.75} />
              <span className="text-sm font-bold text-white">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
