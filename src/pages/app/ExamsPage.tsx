import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Play
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAssignments, isExamActive } from '../../services/firebaseService';
import { ExamAssignment, Exam } from '../../types';

export const ExamsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<(ExamAssignment & { exam?: Exam })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      getUserAssignments(currentUser.id)
        .then(res => setAssignments(res))
        .catch(err => console.error("Erro ao carregar provas:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
                <div
                  key={asgn.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {isStarted && (
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-400 border-amber-500/30">
                          Em Andamento
                        </span>
                      </div>
                    )}

                    <h3 className="text-base font-bold text-[#050f41] group-hover:text-teal-300 transition-colors line-clamp-2">
                      {asgn.exam?.name || 'Simulado Ortopedia TEOT'}
                    </h3>

                    {asgn.exam?.description && (
                      <p className="text-sm text-slate-400 mt-1.5 line-clamp-2">
                        {asgn.exam.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Total de Questões:</span>
                      <span className="font-semibold text-slate-200">{asgn.exam?.questionCount || 0}</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      onClick={() => navigate(`/app/exams/${asgn.id}`)}
                      className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm ${
                        isStarted
                          ? 'bg-amber-500 hover:bg-[#e5a52c] text-[#050f41] shadow-amber-500/20'
                          : 'bg-teal-500 hover:bg-teal-400 text-white shadow-teal-500/20'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isStarted ? 'Continuar Prova' : 'Iniciar Prova Agora'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};
