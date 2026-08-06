import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3, Award, Target, CheckCircle2, AlertTriangle, BookOpen, Users, Minus, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { getUserStats, getAllUserStats, getAreas, getThemes } from '../../services/firebaseService';
import { UserStats, Area, Theme } from '../../types';

const MIN_TARGET = 60;

type Tier = 'good' | 'warn' | 'bad';

function getTier(accuracy: number): Tier {
  if (accuracy >= MIN_TARGET) return 'good';
  if (accuracy >= 40) return 'warn';
  return 'bad';
}

const TIER_STYLES: Record<Tier, { text: string; ring: string; bar: string }> = {
  good: { text: 'text-emerald-400', ring: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  warn: { text: 'text-amber-400', ring: 'border-amber-500/30', bar: 'bg-amber-500' },
  bad: { text: 'text-red-400', ring: 'border-red-500/30', bar: 'bg-red-500' }
};

export const PerformancePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [peerStats, setPeerStats] = useState<UserStats[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const [uStats, allStats, areaList, themeList] = await Promise.all([
          getUserStats(currentUser.id),
          getAllUserStats(),
          getAreas(),
          getThemes()
        ]);
        setStats(uStats);
        setPeerStats(allStats.filter(s => s.userId !== currentUser.id));
        setAreas(areaList);
        setThemes(themeList);
      } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentUser]);

  // Média (ponderada pelo volume de questões) dos demais usuários, por área.
  const peerAreaAverage = useMemo(() => {
    const totals: Record<string, { solved: number; correct: number }> = {};
    peerStats.forEach(s => {
      Object.entries(s.areas || {}).forEach(([areaId, data]) => {
        if (!totals[areaId]) totals[areaId] = { solved: 0, correct: 0 };
        totals[areaId].solved += data.solved || 0;
        totals[areaId].correct += data.correct || 0;
      });
    });
    const result: Record<string, number | null> = {};
    Object.entries(totals).forEach(([areaId, t]) => {
      result[areaId] = t.solved > 0 ? Math.round((t.correct / t.solved) * 100) : null;
    });
    return result;
  }, [peerStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Calculando indicadores de desempenho...</p>
      </div>
    );
  }

  const totalSolved = stats?.totalSolved || 0;
  const totalCorrect = stats?.totalCorrect || 0;
  const overallAcc = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

  const areaPerformanceList = areas.map(area => {
    const areaData = stats?.areas?.[area.id] || { solved: 0, correct: 0 };
    const acc = areaData.solved > 0 ? Math.round((areaData.correct / areaData.solved) * 100) : 0;
    return {
      id: area.id,
      name: area.name,
      solved: areaData.solved,
      correct: areaData.correct,
      accuracy: acc,
      peerAverage: peerAreaAverage[area.id] ?? null
    };
  }).filter(a => a.solved > 0);

  const themePerformanceList = themes.map(theme => {
    const themeData = stats?.themes?.[theme.id] || { solved: 0, correct: 0 };
    const acc = themeData.solved > 0 ? Math.round((themeData.correct / themeData.solved) * 100) : 0;
    return { id: theme.id, name: theme.name, solved: themeData.solved, correct: themeData.correct, accuracy: acc };
  }).filter(t => t.solved > 0);

  const weakAreas = areaPerformanceList.filter(a => a.accuracy < MIN_TARGET);
  const weakThemes = themePerformanceList.filter(t => t.accuracy < MIN_TARGET).sort((a, b) => a.accuracy - b.accuracy);

  const radarData = areaPerformanceList.map(a => ({
    area: a.name.length > 14 ? a.name.slice(0, 14) + '…' : a.name,
    Você: a.accuracy,
    Colegas: a.peerAverage ?? 0
  }));

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">

      <div>
        <h1 className="text-lg sm:text-xl font-bold text-[#050f41] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-400" />
          Meu Desempenho
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Questões Respondidas</p>
              <p className="text-xl font-black text-[#050f41] mt-0.5">{totalSolved}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Acertos Totais</p>
              <p className="text-xl font-black text-[#050f41] mt-0.5">{totalCorrect}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Taxa Geral de Acerto</p>
              <p className="text-xl font-black text-cyan-400 mt-0.5">{overallAcc}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Radar: Você vs Média dos Colegas */}
      {radarData.length >= 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Você vs. Média dos Colegas
          </h2>
          <p className="text-xs text-slate-400 mb-2">Comparativo de aproveitamento (%) por área.</p>
          <div className="h-72 sm:h-80 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#dbe0f0" />
                <PolarAngleAxis dataKey="area" tick={{ fill: '#4b567f', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#7680ac', fontSize: 10 }} />
                <Radar name="Você" dataKey="Você" stroke="#050f41" fill="#050f41" fillOpacity={0.35} />
                <Radar name="Colegas" dataKey="Colegas" stroke="#fab932" fill="#fab932" fillOpacity={0.25} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weak Areas Warning */}
      {weakAreas.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Áreas Recomendadas para Revisão (abaixo de {MIN_TARGET}%)</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {weakAreas.map(a => (
              <span key={a.id} className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-400">
                {a.name} ({a.accuracy}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards por Área */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-[#050f41]">Desempenho Detalhado por Área</h2>

        {areaPerformanceList.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Complete simulados para visualizar a estatística por Área.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areaPerformanceList.map(item => {
              const tier = getTier(item.accuracy);
              const style = TIER_STYLES[tier];
              const hasPeer = item.peerAverage !== null;
              const delta = hasPeer ? item.accuracy - (item.peerAverage as number) : null;

              return (
                <div key={item.id} className={`bg-slate-900 border ${style.ring} rounded-2xl p-4 sm:p-5 shadow-xl`}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{item.name}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-3xl font-black ${style.text}`}>{item.accuracy}%</span>
                    <span className="text-xs text-slate-500">{item.correct}/{item.solved}</span>
                  </div>

                  {/* Barra de progresso — reforça visualmente o percentual e a
                      posição em relação à meta mínima. */}
                  <div className="mt-3 relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all`}
                      style={{ width: `${Math.min(100, item.accuracy)}%` }}
                    />
                    <div
                      className="absolute top-0 h-full w-px bg-slate-500/70"
                      style={{ left: `${MIN_TARGET}%` }}
                      title={`Meta mínima: ${MIN_TARGET}%`}
                    />
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1"><Target className="w-3 h-3" /> Meta mínima</span>
                      <span className="font-semibold text-slate-300">{MIN_TARGET}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" /> Média dos colegas</span>
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        {hasPeer ? (
                          <>
                            {item.peerAverage}%
                            {delta !== null && delta > 0 && <ArrowUp className="w-3 h-3 text-emerald-400" />}
                            {delta !== null && delta < 0 && <ArrowDown className="w-3 h-3 text-red-400" />}
                            {delta !== null && delta === 0 && <Minus className="w-3 h-3 text-slate-500" />}
                          </>
                        ) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Temas para revisão (granularidade menor que Área) */}
      {weakThemes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-3">Temas Específicos para Revisão</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {weakThemes.map(t => {
              const tier = getTier(t.accuracy);
              const style = TIER_STYLES[tier];
              return (
                <div key={t.id} className="py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300 truncate">{t.name}</span>
                    <span className={`font-bold shrink-0 ${style.text}`}>{t.accuracy}% <span className="text-xs text-slate-500 font-normal">({t.correct}/{t.solved})</span></span>
                  </div>
                  <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, t.accuracy)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
