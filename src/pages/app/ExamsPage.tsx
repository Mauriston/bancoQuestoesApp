import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText, CheckCircle2, Play, ChevronRight, Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAssignments } from '../../services/firebaseService';
import { ExamAssignment, Exam } from '../../types';
import { formatDate } from '../../utils/helpers';

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

  const availableExams = assignments.filter(a => a.status === 'available' || a.status === 'started');
  const completedExams = assignments.filter(a => a.status === 'completed');

  return (
    <div className="space-y-8">
      
      {/* Page Title Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-400" />
          Provas & Simulados Atribuídos
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Acesse suas avaliações ativas e consulte os resultados das provas concluídas.
        </p>
      </div>

      {/* Active / In-Progress Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Provas Pendentes ou em Andamento ({availableExams.length})
        </h2>

        {availableExams.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-teal-500/40 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">Nenhuma prova pendente no momento</p>
            <p className="text-[11px] text-slate-500 mt-1">
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
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isStarted
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                      }`}>
                        {isStarted ? 'Em Andamento' : 'Disponível'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors line-clamp-2">
                      {asgn.exam?.name || 'Simulado Ortopedia TEOT'}
                    </h3>

                    {asgn.exam?.description && (
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                        {asgn.exam.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Total de Questões:</span>
                      <span className="font-semibold text-slate-200">{asgn.exam?.questionCount || 0}</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      onClick={() => navigate(`/app/exams/${asgn.id}`)}
                      className={`w-full flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all text-xs ${
                        isStarted
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                          : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
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

      {/* Completed Section */}
      <section className="space-y-4 pt-4 border-t border-slate-900">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Provas Concluídas ({completedExams.length})
        </h2>

        {completedExams.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Você ainda não concluiu nenhuma prova.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedExams.map((asgn) => (
              <div
                key={asgn.id}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Concluída
                    </span>
                    <span className="text-[11px] text-slate-500">{formatDate(asgn.completedAt)}</span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-200">
                    {asgn.exam?.name || 'Simulado Ortopedia'}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Ver Correção & Comentários</span>
                  {asgn.attemptId && (
                    <Link
                      to={`/app/attempts/${asgn.attemptId}/result`}
                      className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                    >
                      <span>Resultado</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
