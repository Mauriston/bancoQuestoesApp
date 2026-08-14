import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeUserAssignments, isExamActive } from '../../services/firebaseService';
import { ExamAssignment, Exam } from '../../types';

export const ExamsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<(ExamAssignment & { exam?: Exam })[]>([]);
  const [loading, setLoading] = useState(true);

  // Assinatura ao vivo: uma prova recém-publicada/atribuída pelo admin
  // aparece aqui automaticamente, sem precisar recarregar a página.
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeUserAssignments(currentUser.id, (res) => {
      setAssignments(res);
      setLoading(false);
    });
    return unsubscribe;
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando suas provas e simulados...</p>
      </div>
    );
  }

  // Uma prova recém-desativada não pode ser mais iniciada, mas quem já
  // estava no meio dela não é interrompido — só não aparecem mais provas
  // 'available' cuja prova de origem está inativa.
  const availableExams = assignments.filter(a =>
    a.status === 'started' || (a.status === 'available' && isExamActive(a.exam))
  );

  return (
    <div className="space-y-8">

      {currentUser && (
        <div className="flex items-center">
          <h1 className="text-base sm:text-lg font-bold text-slate-300">
            {currentUser.name}, essas são as suas provas pendentes de realização:
          </h1>
        </div>
      )}

      {/* Active / In-Progress Section */}
      <section className="space-y-4">
        {availableExams.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-slate-700 text-center text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">Nada mais pendente</p>
            <p className="text-xs text-slate-500 mt-1">
              Novas avaliações aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableExams.map((asgn) => {
              const isStarted = asgn.status === 'started';
              return (
                <button
                  key={asgn.id}
                  onClick={() => navigate(`/app/exams/${asgn.id}`)}
                  className={`w-full h-full text-left rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group ${
                    isStarted ? 'bg-slate-900 border border-slate-700' : 'bg-slate-900 border border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {isStarted ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold uppercase tracking-wide">
                        Em andamento
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wide">
                        Disponível
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                      {asgn.exam?.questionCount || 0} questões
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#050f41] leading-tight line-clamp-2 flex-1">
                    {asgn.exam?.name || 'Simulado Ortopedia TEOT'}
                  </h3>

                  {isStarted ? (
                    <span className="flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-500 group-hover:bg-emerald-400 text-white text-sm font-bold transition-colors">
                      Continuar
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 h-11 rounded-xl border-[1.5px] border-emerald-500 text-emerald-700 group-hover:bg-emerald-500/10 text-sm font-bold transition-colors">
                      Iniciar prova
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};
