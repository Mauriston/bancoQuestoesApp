import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, Users, TrendingUp, TrendingDown, Minus, Eye, X
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip,
  AreaChart, Area as RechartsArea, XAxis, YAxis, ReferenceLine, LineChart, Line, LabelList
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { getUserStats, getAllUserStats, getAreas, getThemes, getUserAttempts } from '../../services/firebaseService';
import { UserStats, Area as ExamArea, Theme, Attempt } from '../../types';
import { scoreColorHex } from '../../utils/helpers';

type Tier = 'good' | 'warn' | 'bad';

// Regra de cor institucional para qualquer valor numérico percentual de
// desempenho (e barras/anéis associados): verde >= 60, amarelo 50-59,
// vermelho < 50. Ver também scoreColorHex/scoreColorClass em utils/helpers.
function scoreTier(accuracy: number): Tier {
  if (accuracy >= 60) return 'good';
  if (accuracy >= 50) return 'warn';
  return 'bad';
}

const getTier = scoreTier;

const TIER_STYLES: Record<Tier, { text: string; ring: string; bar: string }> = {
  good: { text: 'text-[#079551]', ring: 'border-[#079551]/30', bar: 'bg-[#079551]' },
  warn: { text: 'text-[#FAB932]', ring: 'border-[#FAB932]/30', bar: 'bg-[#FAB932]' },
  bad: { text: 'text-[#E20018]', ring: 'border-[#E20018]/30', bar: 'bg-[#E20018]' }
};

export const PerformancePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [peerStats, setPeerStats] = useState<UserStats[]>([]);
  const [areas, setAreas] = useState<ExamArea[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAreaModal, setActiveAreaModal] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const [uStats, allStats, areaList, themeList, userAttempts] = await Promise.all([
          getUserStats(currentUser.id),
          getAllUserStats(),
          getAreas(),
          getThemes(),
          getUserAttempts(currentUser.id)
        ]);
        setStats(uStats);
        setPeerStats(allStats.filter(s => s.userId !== currentUser.id));
        setAreas(areaList);
        setThemes(themeList);
        setAttempts(userAttempts);
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

  // Média geral da plataforma (todos os colegas), ponderada por questões.
  const platformAverage = useMemo(() => {
    let solved = 0, correct = 0;
    peerStats.forEach(s => {
      solved += s.totalSolved || 0;
      correct += s.totalCorrect || 0;
    });
    return solved > 0 ? Math.round((correct / solved) * 100) : null;
  }, [peerStats]);

  // Evolução por prova concluída, ordenada cronologicamente — usada no
  // sparkline de tendência e no gráfico de evolução.
  const completedAttemptsChrono = useMemo(() => {
    return attempts
      .filter(a => a.status === 'completed' && typeof a.scorePercentage === 'number')
      .sort((a, b) => {
        const aT = a.completedAt && typeof a.completedAt === 'object' && 'seconds' in a.completedAt ? a.completedAt.seconds : 0;
        const bT = b.completedAt && typeof b.completedAt === 'object' && 'seconds' in b.completedAt ? b.completedAt.seconds : 0;
        return aT - bT;
      });
  }, [attempts]);

  const evolutionData = completedAttemptsChrono.map((a, idx) => ({
    idx: idx + 1,
    name: a.examName || `Prova ${idx + 1}`,
    score: a.scorePercentage || 0
  }));

  // Índices do maior e do menor score na série — usados para rotular só
  // esses dois pontos no gráfico de evolução (demais só via tooltip).
  const evolutionMaxIdx = evolutionData.length > 0
    ? evolutionData.reduce((best, cur, i) => (cur.score > evolutionData[best].score ? i : best), 0)
    : -1;
  const evolutionMinIdx = evolutionData.length > 0
    ? evolutionData.reduce((worst, cur, i) => (cur.score < evolutionData[worst].score ? i : worst), 0)
    : -1;
  // Offset de gradiente (0-1, de cima para baixo) onde a linha de
  // referência de 50% cruza o eixo Y, considerando o domínio [0,100].
  const evoYMax = 100, evoYMin = 0;
  const evoSplitOffset = Math.min(1, Math.max(0, (evoYMax - 50) / (evoYMax - evoYMin)));

  // Tendência: compara o desempenho médio da segunda metade das provas com
  // a primeira metade (ou última vs. primeira, se houver poucas provas).
  const trend = useMemo(() => {
    if (evolutionData.length < 2) return null;
    const mid = Math.floor(evolutionData.length / 2);
    const firstHalf = evolutionData.slice(0, mid || 1);
    const secondHalf = evolutionData.slice(mid || 1);
    const avg = (arr: typeof evolutionData) => arr.reduce((s, e) => s + e.score, 0) / arr.length;
    const delta = Math.round(avg(secondHalf) - avg(firstHalf));
    return delta;
  }, [evolutionData]);

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
  const overallTier = scoreTier(overallAcc);
  const platformDelta = platformAverage !== null ? overallAcc - platformAverage : null;

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
    return { id: theme.id, name: theme.name, areaId: theme.areaId, solved: themeData.solved, correct: themeData.correct, accuracy: acc };
  }).filter(t => t.solved > 0);

  // Desempenho crítico: 5 piores temas, de quaisquer áreas.
  const criticalThemes = [...themePerformanceList].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

  const radarData = areaPerformanceList.map(a => ({
    area: a.name.length > 14 ? a.name.slice(0, 14) + '…' : a.name,
    Você: a.accuracy,
    Colegas: a.peerAverage ?? 0
  }));

  const modalArea = areaPerformanceList.find(a => a.id === activeAreaModal);
  const modalThemes = modalArea
    ? themePerformanceList.filter(t => t.areaId === modalArea.id).sort((a, b) => b.accuracy - a.accuracy)
    : [];

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">

      {/* Overall Accuracy KPI — cartão mais proeminente da página */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Taxa Geral de Acerto</p>
            <p className={`text-5xl sm:text-6xl font-black leading-none mt-2 ${TIER_STYLES[overallTier].text}`}>
              {overallAcc}%
            </p>

            {platformDelta !== null && (
              <div className="flex items-center gap-1.5 mt-3 text-sm">
                {platformDelta > 0 && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                {platformDelta < 0 && <TrendingDown className="w-4 h-4 text-red-400" />}
                {platformDelta === 0 && <Minus className="w-4 h-4 text-slate-500" />}
                <span className={platformDelta > 0 ? 'text-emerald-400 font-semibold' : platformDelta < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                  {platformDelta > 0 ? '+' : ''}{platformDelta} pp
                </span>
                <span className="text-slate-500">vs. média da plataforma ({platformAverage}%)</span>
              </div>
            )}
          </div>

          {/* Sparkline de tendência */}
          {evolutionData.length >= 2 && (
            <div className="flex flex-col items-end gap-1">
              <div className="w-28 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData}>
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={trend !== null && trend < 0 ? '#c7362f' : '#079551'}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {trend !== null && (
                <div className={`flex items-center gap-1 text-xs font-semibold ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  <span>Tendência {trend > 0 ? `+${trend}` : trend}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Evolução ao longo das provas — só a partir de 2 provas concluídas */}
      {evolutionData.length >= 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-1">Evolução do Desempenho</h2>
          <p className="text-xs text-slate-400 mb-2">Aproveitamento (%) ao longo das provas realizadas.</p>
          <div className="h-48 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset={evoSplitOffset} stopColor="#34d399" stopOpacity={0.15} />
                    <stop offset={evoSplitOffset} stopColor="#f87171" stopOpacity={0.15} />
                    <stop offset={1} stopColor="#f87171" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="idx" hide />
                <YAxis domain={[0, 100]} hide />
                <ReferenceLine y={50} stroke="#a8b0d2" strokeDasharray="4 4" />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Aproveitamento']}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.name || ''}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dbe0f0', borderRadius: '12px', fontSize: '12px' }}
                />
                <RechartsArea
                  type="monotone"
                  dataKey="score"
                  stroke="#050f41"
                  strokeWidth={2.5}
                  fill="url(#evoFill)"
                  dot={{ r: 4, fill: '#050f41', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey="score"
                    content={(props: any) => {
                      const { x, y, index, value } = props;
                      if (index !== evolutionMaxIdx && index !== evolutionMinIdx) return null;
                      return (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill={scoreColorHex(value)}
                        >
                          {value}%
                        </text>
                      );
                    }}
                  />
                </RechartsArea>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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

      {/* KPI Cards por Área — 2 colunas mesmo em mobile */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-[#050f41]">Desempenho Detalhado por Área</h2>

        {areaPerformanceList.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Complete simulados para visualizar a estatística por Área.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {areaPerformanceList.map(item => {
              const tier = getTier(item.accuracy);
              const style = TIER_STYLES[tier];
              const hasPeer = item.peerAverage !== null;

              return (
                <div key={item.id} className={`relative bg-slate-900 border ${style.ring} rounded-2xl p-3.5 sm:p-5 shadow-xl`}>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide truncate pr-5">{item.name}</p>
                  <span className={`text-2xl sm:text-3xl font-black ${style.text}`}>{item.accuracy}%</span>

                  {/* Barra de progresso com marcador da média dos colegas */}
                  <div className="mt-3 relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all`}
                      style={{ width: `${Math.min(100, item.accuracy)}%` }}
                    />
                    {hasPeer && (
                      <div
                        className="absolute -top-0.5 h-3 w-0.5 bg-[#fab932]"
                        style={{ left: `${Math.min(100, item.peerAverage as number)}%` }}
                        title={`Média dos colegas: ${item.peerAverage}%`}
                      />
                    )}
                  </div>

                  <button
                    onClick={() => setActiveAreaModal(item.id)}
                    aria-label={`Ver detalhamento por tema de ${item.name}`}
                    title="Ver detalhamento por tema"
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desempenho Crítico — 5 piores temas, de quaisquer áreas */}
      {criticalThemes.length > 0 && (
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Desempenho Crítico
          </h2>
          <p className="text-xs text-slate-400 mb-3">Seus 5 temas com menor aproveitamento, de todas as áreas.</p>
          <div className="space-y-2">
            {criticalThemes.map(t => {
              const tier = getTier(t.accuracy);
              const style = TIER_STYLES[tier];
              return (
                <div key={t.id} className="py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300 truncate">{t.name}</span>
                    <span className={`font-bold shrink-0 ${style.text}`}>{t.accuracy}%</span>
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

      {/* Modal: detalhamento por tema dentro da área */}
      {modalArea && (
        <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveAreaModal(null)}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#050f41]">{modalArea.name}</h3>
                <p className="text-xs text-slate-400">Desempenho por tema</p>
              </div>
              <button
                onClick={() => setActiveAreaModal(null)}
                aria-label="Fechar"
                className="tap-target flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalThemes.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhum tema respondido nesta área ainda.</p>
            ) : (
              <div className="space-y-3">
                {modalThemes.map(t => {
                  const tier = getTier(t.accuracy);
                  const style = TIER_STYLES[tier];
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between gap-3 text-sm mb-1">
                        <span className="text-slate-300 truncate">{t.name}</span>
                        <span className={`font-bold shrink-0 ${style.text}`}>{t.accuracy}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, t.accuracy)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
