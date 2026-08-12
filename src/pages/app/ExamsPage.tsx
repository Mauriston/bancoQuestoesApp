import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, MoreVertical
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
          <span className="text-sm font-bold text-slate-300 truncate">{currentUser.name}</span>
        </div>
      )}

      {/* Active / In-Progress Section */}
      <section className="space-y-4">
        {availableExams.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-teal-500/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">Nenhuma prova pendente no momento</p>
            <p className="text-xs text-slate-500 mt-1">
              Novas avaliações publicadas pelo administrador aparecerão automaticamente aqui.
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
                  className="w-full h-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition-all flex flex-col gap-1 group relative"
                >
                  {isStarted && (
                    <span className="self-start text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-400 border-amber-500/30 mb-1">
                      Em Andamento
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[#050f41] group-hover:text-teal-300 transition-colors line-clamp-2 pr-6">
                      {asgn.exam?.name || 'Simulado Ortopedia TEOT'}
                    </h3>
                    <MoreVertical className="w-4 h-4 text-slate-600 shrink-0 absolute top-5 right-5" />
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    {asgn.exam?.questionCount || 0} questões
                  </span>

                </button>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};
