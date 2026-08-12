import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, ChevronRight, Calendar, ThumbsUp, AlertTriangle, OctagonAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAttempts } from '../../services/firebaseService';
import { Attempt } from '../../types';
import { formatDateOnly, scoreColorClass } from '../../utils/helpers';

function ScoreIcon({ score, className }: { score: number; className?: string }) {
  if (score >= 60) return <ThumbsUp className={className} />;
  if (score >= 50) return <AlertTriangle className={className} />;
  return <OctagonAlert className={className} />;
}

// Divide o nome da prova em duas linhas quando houver um hífen cercado de
// espaços (ex.: "PEDIÁTRICA - Trauma MMSS") — a parte antes fica em
// destaque, a parte depois em uma segunda linha menor e mais discreta.
function splitExamName(name: string): [string, string | null] {
  const parts = name.split(/\s+-\s+/);
  if (parts.length < 2) return [name, null];
  return [parts[0], parts.slice(1).join(' - ')];
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

      {currentUser && (
        <div className="flex items-center">
          <h1 className="text-base sm:text-lg font-bold text-slate-300">
            {currentUser.name}, esse é o seu histórico de provas realizadas.
          </h1>
        </div>
      )}

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
              const isCompleted = att.status === 'completed';
              const dest = isCompleted
                ? `/app/attempts/${att.id}/result`
                : `/app/exams/${att.assignmentId}`;
              const [examNamePrimary, examNameSecondary] = splitExamName(att.examName || 'Simulado Ortopedia');

              return (
                <Link
                  key={att.id}
                  to={dest}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors relative"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateOnly(att.completedAt || att.startedAt)}
                    </span>

                    <h3 className="text-sm font-semibold text-slate-300 truncate">
                      {examNamePrimary}
                    </h3>
                    {examNameSecondary && (
                      <h4 className="text-xs text-slate-500 truncate">
                        {examNameSecondary}
                      </h4>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isCompleted ? (
                      <span className={`flex items-center gap-1.5 text-2xl sm:text-3xl font-black leading-none ${scoreColorClass(score)}`}>
                        <ScoreIcon score={score} className="w-5 h-5 sm:w-6 sm:h-6" />
                        {score}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm font-bold text-amber-400">
                        <span>Continuar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <MoreVertical className="w-4 h-4 text-slate-600 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
