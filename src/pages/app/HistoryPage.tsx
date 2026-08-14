import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleDot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAttempts } from '../../services/firebaseService';
import { Attempt } from '../../types';
import { formatDateOnly, scoreColorHex } from '../../utils/helpers';

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  return null;
}

const MONTH_LABELS = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

export const HistoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      getUserAttempts(currentUser.id)
        .then(res => setAttempts(res.sort((a, b) => {
          const aT = toDateSafe(a.startedAt)?.getTime() || 0;
          const bT = toDateSafe(b.startedAt)?.getTime() || 0;
          return bT - aT;
        })))
        .catch(err => console.error("Erro ao carregar histórico:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const completed = attempts.filter(a => a.status === 'completed' && typeof a.scorePercentage === 'number');
  const summary = useMemo(() => {
    if (completed.length === 0) return null;
    const avg = Math.round(completed.reduce((s, a) => s + (a.scorePercentage || 0), 0) / completed.length);
    const best = Math.max(...completed.map(a => a.scorePercentage || 0));
    return { count: completed.length, avg, best };
  }, [completed]);

  // Agrupa por mês (do mais recente primeiro), usando a data de conclusão
  // para provas terminadas e a de início para as em andamento.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: Attempt[] }>();
    attempts.forEach(att => {
      const d = toDateSafe(att.completedAt) || toDateSafe(att.startedAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) {
        map.set(key, { label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, items: [] });
      }
      map.get(key)!.items.push(att);
    });
    return Array.from(map.values());
  }, [attempts]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando seu histórico de tentativas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      <div className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 px-4 sm:px-6 lg:px-8 pt-5 pb-5 bg-[#050f41] rounded-b-3xl">
        <h1 className="text-lg font-bold text-white">Histórico</h1>
        {summary ? (
          <p className="text-xs text-white/55 mt-1">
            {summary.count} prova{summary.count === 1 ? '' : 's'} concluída{summary.count === 1 ? '' : 's'} · média {summary.avg}% · melhor {summary.best}%
          </p>
        ) : (
          <p className="text-xs text-white/55 mt-1">Nenhuma prova concluída ainda.</p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500">
          Nenhuma tentativa registrada encontrada.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">{group.label}</p>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-800/80">
                  {group.items.map(att => {
                    const score = att.scorePercentage || 0;
                    const isCompleted = att.status === 'completed';
                    const dest = isCompleted
                      ? `/app/attempts/${att.id}/result`
                      : `/app/exams/${att.assignmentId}`;

                    return (
                      <Link
                        key={att.id}
                        to={dest}
                        className="p-3.5 flex items-center gap-3 hover:bg-slate-800/40 transition-colors"
                      >
                        {isCompleted ? (
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-[15px] tabular-nums shrink-0"
                            style={{ backgroundColor: `${scoreColorHex(score)}1a`, color: scoreColorHex(score) }}
                          >
                            {score}
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                            <CircleDot className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-[#050f41] truncate">
                            {att.examName || 'Simulado Ortopedia'}
                          </h3>
                          {isCompleted ? (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDateOnly(att.completedAt)} · {att.totalQuestions} questões · {att.correctAnswers ?? 0} certas
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-amber-600 mt-0.5">
                              {formatDateOnly(att.startedAt)} · em andamento
                            </p>
                          )}
                        </div>

                        {isCompleted ? (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 shrink-0">
                            Continuar
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
