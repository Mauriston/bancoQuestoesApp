import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, History, BarChart3, CalendarDays, GraduationCap, Sparkles, MessageSquare, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeUserAssignments, isExamActive, getUserStats, getAllUserStats, getUserAttempts, getThemes, getAttemptAnswers
} from '../../services/firebaseService';
import { ExamAssignment, Exam, UserStats, Theme, Attempt } from '../../types';
import { scoreColorHex } from '../../utils/helpers';

const SHORTCUTS = [
  { label: 'Provas', path: '/app/exams', icon: FileText },
  { label: 'Histórico', path: '/app/history', icon: History },
  { label: 'Desempenho', path: '/app/performance', icon: BarChart3 },
  { label: 'Sabatinas', path: '/app/sabatinas', icon: MessageSquare },
  { label: 'Cronograma', path: '/app/cronograma', icon: CalendarDays },
  { label: 'TARO/TEOT', path: '/app/exam-stats', icon: GraduationCap },
  { label: 'Extras', path: '/app/extras', icon: Sparkles },
];

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  return null;
}

// Sequência de semanas consecutivas (buckets de 7 dias corridos, não
// necessariamente alinhados ao calendário) com pelo menos uma prova
// concluída, contando para trás a partir da semana atual — tolera a semana
// corrente ainda sem prova concluída para não "quebrar" a sequência de quem
// já estudou esta semana mas ainda não terminou outra.
function computeStreakWeeks(attempts: Attempt[]): number {
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  const weekBuckets = new Set<number>();
  attempts.forEach(a => {
    if (a.status !== 'completed') return;
    const d = toDateSafe(a.completedAt);
    if (!d) return;
    weekBuckets.add(Math.floor(d.getTime() / MS_WEEK));
  });
  if (weekBuckets.size === 0) return 0;
  let week = Math.floor(Date.now() / MS_WEEK);
  if (!weekBuckets.has(week)) week -= 1;
  let streak = 0;
  while (weekBuckets.has(week)) {
    streak += 1;
    week -= 1;
  }
  return streak;
}

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [pendingExams, setPendingExams] = useState<(ExamAssignment & { exam?: Exam })[]>([]);
  const [pendingAnsweredCount, setPendingAnsweredCount] = useState<number | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [peerAverage, setPeerAverage] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);

  // Ao vivo, como em ExamsPage: uma prova recém-atribuída/reativada aparece
  // aqui sem precisar recarregar.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeUserAssignments(currentUser.id, (assignments) => {
      const pending = assignments
        .filter(a => a.status === 'started' || (a.status === 'available' && isExamActive(a.exam)))
        .sort((a, b) => (a.status === 'started' ? -1 : 1) - (b.status === 'started' ? -1 : 1));
      setPendingExams(pending);
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      getUserStats(currentUser.id),
      getAllUserStats(),
      getUserAttempts(currentUser.id),
      getThemes()
    ]).then(([uStats, allStats, userAttempts, themeList]) => {
      setStats(uStats);
      const peers = allStats.filter(s => s.userId !== currentUser.id);
      let solved = 0, correct = 0;
      peers.forEach(s => { solved += s.totalSolved || 0; correct += s.totalCorrect || 0; });
      setPeerAverage(solved > 0 ? Math.round((correct / solved) * 100) : null);
      setAttempts(userAttempts);
      setThemes(themeList);
    }).catch(err => console.error('Erro ao carregar indicadores da home:', err));
  }, [currentUser]);

  const topPending = pendingExams[0];

  useEffect(() => {
    if (topPending?.status === 'started' && topPending.attemptId) {
      getAttemptAnswers(topPending.attemptId)
        .then(ans => setPendingAnsweredCount(ans.length))
        .catch(() => setPendingAnsweredCount(null));
    } else {
      setPendingAnsweredCount(null);
    }
  }, [topPending?.attemptId, topPending?.status]);

  const overallAcc = stats && stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;
  const completedCount = attempts.filter(a => a.status === 'completed').length;
  const streakWeeks = useMemo(() => computeStreakWeeks(attempts), [attempts]);
  const delta = peerAverage !== null && stats && stats.totalSolved > 0 ? overallAcc - peerAverage : null;

  // "Onde você perde pontos" — os temas com pior aproveitamento entre os já
  // respondidos, mesma lógica de Desempenho Crítico da PerformancePage.
  const weakestThemes = useMemo(() => {
    if (!stats?.themes) return [];
    return Object.values(stats.themes)
      .filter(t => t.solved > 0)
      .map(t => ({
        name: themes.find(th => th.id === t.themeId)?.name || t.themeId,
        accuracy: Math.round((t.correct / t.solved) * 100)
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 4);
  }, [stats, themes]);

  const firstName = currentUser?.name?.split(' ')[0] || 'residente';
  const questionCount = topPending?.exam?.questionCount || 0;
  const progressPercent = topPending?.status === 'started' && pendingAnsweredCount !== null && questionCount > 0
    ? Math.min(100, Math.round((pendingAnsweredCount / questionCount) * 100))
    : 0;

  return (
    <div className="space-y-6 pb-12">

      {/* Hero — número grande de aproveitamento geral + delta vs. colegas +
          mini-métricas (provas concluídas, questões respondidas, semanas
          seguidas estudando). */}
      <div className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 px-4 sm:px-6 lg:px-8 pt-5 pb-6 bg-[#050f41] rounded-b-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">
          Treinamento HMA TEOT 2027
        </p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold text-white leading-tight">
          Bom plantão, {firstName}
        </h1>

        <div className="mt-4 flex items-end gap-2">
          <span className="text-5xl font-black text-white tabular-nums leading-none">{overallAcc}</span>
          <span className="text-2xl font-black text-white/60 leading-none mb-0.5">%</span>
        </div>
        {delta !== null && (
          <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
            {delta >= 0 ? '+' : ''}{delta} pp vs. colegas
          </span>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="bg-white/[0.07] rounded-xl px-3 py-2.5">
            <p className="text-lg font-extrabold text-white leading-none">{completedCount}</p>
            <p className="text-[11px] text-white/55 mt-1">provas</p>
          </div>
          <div className="bg-white/[0.07] rounded-xl px-3 py-2.5">
            <p className="text-lg font-extrabold text-white leading-none">{stats?.totalSolved || 0}</p>
            <p className="text-[11px] text-white/55 mt-1">questões</p>
          </div>
          <div className="bg-white/[0.07] rounded-xl px-3 py-2.5">
            <p className="text-lg font-extrabold text-[#FAB932] leading-none">{streakWeeks}</p>
            <p className="text-[11px] text-white/55 mt-1">semanas seguidas</p>
          </div>
        </div>
      </div>

      {/* Prova pendente em destaque — a mais recente 'started' tem
          prioridade; senão, a primeira disponível. */}
      {topPending && (
        <button
          onClick={() => navigate(`/app/exams/${topPending.id}`)}
          className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl hover:shadow-2xl transition-all space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            {topPending.status === 'started' ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold uppercase tracking-wide">
                Em andamento
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wide">
                Disponível
              </span>
            )}
            <span className="text-[11px] font-semibold text-slate-400">
              {topPending.status === 'started' && pendingAnsweredCount !== null
                ? `questão ${Math.min(pendingAnsweredCount + 1, questionCount)} de ${questionCount}`
                : `${questionCount} questões`}
            </span>
          </div>

          <h2 className="text-base font-bold text-[#050f41] leading-tight line-clamp-2">
            {topPending.exam?.name || 'Simulado Ortopedia TEOT'}
          </h2>

          {topPending.status === 'started' && (
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          <span className="flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-colors">
            {topPending.status === 'started' ? 'Continuar' : 'Iniciar prova'}
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      )}

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SHORTCUTS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3"
            >
              <span className="w-9 h-9 rounded-[10px] bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Icon className="w-[17px] h-[17px]" strokeWidth={1.9} />
              </span>
              <span className="text-sm font-bold text-[#050f41] leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Onde você perde pontos */}
      {weakestThemes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#050f41]">Onde você perde pontos</h3>
          <div className="space-y-2.5">
            {weakestThemes.map(t => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300 flex-1 truncate">{t.name}</span>
                <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(4, t.accuracy)}%`, backgroundColor: scoreColorHex(t.accuracy) }}
                  />
                </div>
                <span className="text-xs font-black tabular-nums shrink-0 w-9 text-right" style={{ color: scoreColorHex(t.accuracy) }}>
                  {t.accuracy}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
