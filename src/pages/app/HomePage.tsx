import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, History, BarChart3, CalendarDays, GraduationCap, Sparkles, MessageSquare, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeUserAssignments, isExamActive } from '../../services/firebaseService';
import { ExamAssignment, Exam } from '../../types';

const HOME_ITEMS = [
  { label: 'Provas', path: '/app/exams', icon: FileText },
  { label: 'Histórico', path: '/app/history', icon: History },
  { label: 'Desempenho', path: '/app/performance', icon: BarChart3 },
  { label: 'Sabatinas', path: '/app/sabatinas', icon: MessageSquare },
  { label: 'Cronograma', path: '/app/cronograma', icon: CalendarDays },
  { label: 'TARO/TEOT', path: '/app/exam-stats', icon: GraduationCap },
  { label: 'Extras', path: '/app/extras', icon: Sparkles },
];

function toSeconds(value: any): number {
  return value && typeof value === 'object' && 'seconds' in value ? value.seconds : 0;
}

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [pendingExams, setPendingExams] = useState<(ExamAssignment & { exam?: Exam })[]>([]);

  // Ao vivo, como em ExamsPage: uma prova recém-atribuída/reativada aparece
  // aqui sem precisar recarregar.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeUserAssignments(currentUser.id, (assignments) => {
      const pending = assignments
        .filter(a => a.status === 'started' || (a.status === 'available' && isExamActive(a.exam)))
        // Mais recente primeiro — por quando a prova foi atribuída ao usuário.
        .sort((a, b) => toSeconds(b.assignedAt) - toSeconds(a.assignedAt));
      setPendingExams(pending);
    });
    return unsubscribe;
  }, [currentUser]);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
          Olá, {currentUser?.name?.split(' ')[0] || 'residente'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">O que você quer fazer agora?</p>
      </div>

      {pendingExams.length > 0 && (
        <>
          <PendingExamsCarousel
            exams={pendingExams}
            onSelect={(assignmentId) => navigate(`/app/exams/${assignmentId}`)}
          />
          <div className="border-t border-slate-800/60" />
        </>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

const PendingExamsCarousel: React.FC<{
  exams: (ExamAssignment & { exam?: Exam })[];
  onSelect: (assignmentId: string) => void;
}> = ({ exams, onSelect }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollToIndex = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-red-500 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" />
        Provas Teóricas Pendentes
      </h2>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-1 px-1"
      >
        {exams.map((asgn) => {
          const isStarted = asgn.status === 'started';
          return (
            <button
              key={asgn.id}
              onClick={() => onSelect(asgn.id)}
              className="w-full shrink-0 snap-center text-left px-1"
            >
              <div className="bg-white border border-red-500/30 rounded-2xl p-5 transition-colors hover:border-red-500/60 flex flex-col gap-2">
                {isStarted && (
                  <span className="self-start text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
                    Em Andamento
                  </span>
                )}
                <h3 className="text-base font-bold text-slate-100 line-clamp-2">
                  {asgn.exam?.name || 'Simulado Ortopedia TEOT'}
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {asgn.exam?.questionCount || 0} questões
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 mt-1">
                  {isStarted ? 'Clique aqui para continuar a prova' : 'Clique aqui para iniciar a prova'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {exams.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {exams.map((asgn, idx) => (
            <button
              key={asgn.id}
              onClick={() => scrollToIndex(idx)}
              aria-label={`Ir para prova ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIndex ? 'w-5 bg-red-500' : 'w-1.5 bg-slate-700'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
