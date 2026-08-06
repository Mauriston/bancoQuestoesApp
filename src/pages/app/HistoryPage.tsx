import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAttempts } from '../../services/firebaseService';
import { Attempt } from '../../types';
import { formatDateOnly } from '../../utils/helpers';

function scoreColor(score: number): string {
  if (score >= 60) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export const HistoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      getUserAttempts(currentUser.id)
        .then(res => setAttempts(res.sort((a, b) => {
          const aT = a.startedAt ? (typeof a.startedAt === 'object' && 'seconds' in a.startedAt ? a.startedAt.seconds : 0) : 0;
          const bT = b.startedAt ? (typeof b.startedAt === 'object' && 'seconds' in b.startedAt ? b.startedAt.seconds : 0) : 0;
          return bT - aT;
        })))
        .catch(err => console.error("Erro ao carregar histórico:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando seu histórico de tentativas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* History table list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {attempts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma tentativa registrada encontrada.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {attempts.map((att) => {
              const score = att.scorePercentage || 0;
              return (
                <div key={att.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">

                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateOnly(att.completedAt || att.startedAt)}
                    </span>

                    <h3 className="text-sm font-semibold text-slate-300 truncate">
                      {att.examName || 'Simulado Ortopedia'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {att.status === 'completed' ? (
                      <>
                        <span className={`text-3xl sm:text-4xl font-black leading-none ${scoreColor(score)}`}>
                          {score}%
                        </span>
                        <Link
                          to={`/app/attempts/${att.id}/result`}
                          aria-label="Ver relatório da prova"
                          title="Ver relatório"
                          className="tap-target flex items-center justify-center rounded-xl text-teal-400 hover:text-teal-300 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </>
                    ) : (
                      <Link
                        to={`/app/exams/${att.assignmentId}`}
                        className="flex items-center gap-1 text-sm font-bold text-amber-400 hover:text-[#734900] bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 min-h-11 rounded-xl"
                      >
                        <span>Continuar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
