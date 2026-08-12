import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Users, TrendingUp, TrendingDown, Minus, BarChart3, Layers
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip,
  AreaChart, Area as RechartsArea, XAxis, YAxis, ReferenceLine, LabelList, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { getUserStats, getAllUserStats, getAreas, getThemes, getUserAttempts, getUsers } from '../../services/firebaseService';
import { UserStats, Area as ExamArea, Theme, Attempt } from '../../types';
import { scoreColorHex } from '../../utils/helpers';
import { RankingChart, RankingEntry } from '../../components/RankingChart';

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
  const [allStatsForRanking, setAllStatsForRanking] = useState<UserStats[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const [uStats, allStats, areaList, themeList, userAttempts, allUsers] = await Promise.all([
          getUserStats(currentUser.id),
          getAllUserStats(),
          getAreas(),
          getThemes(),
          getUserAttempts(currentUser.id),
          getUsers()
        ]);
        setStats(uStats);
        setPeerStats(allStats.filter(s => s.userId !== currentUser.id));
        setAllStatsForRanking(allStats);
        setUserNameById(Object.fromEntries(allUsers.map(u => [u.id, u.name])));
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
    return { id: theme.id, name: theme.name, areaId: theme.areaId, subArea: theme.subArea, solved: themeData.solved, correct: themeData.correct, accuracy: acc };
  }).filter(t => t.solved > 0);

  // Desempenho crítico: 5 piores temas, de quaisquer áreas.
  const criticalThemes = [...themePerformanceList].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

  // Desempenho por Subárea — agrega os temas já respondidos (themePerformanceList)
  // por área + subárea. Áreas sem subagrupamento (Anatomia, Ciência Básica) e
  // temas ainda sem subArea migrado simplesmente não entram aqui.
  const subAreaPerformanceList = (() => {
    const groups: Record<string, { areaId: string; areaName: string; subArea: string; solved: number; correct: number }> = {};
    themePerformanceList.forEach(t => {
      if (!t.subArea) return;
      const key = `${t.areaId}::${t.subArea}`;
      if (!groups[key]) {
        groups[key] = {
          areaId: t.areaId,
          areaName: areas.find(a => a.id === t.areaId)?.name || t.areaId,
          subArea: t.subArea,
          solved: 0,
          correct: 0
        };
      }
      groups[key].solved += t.solved;
      groups[key].correct += t.correct;
    });
    return Object.values(groups)
      .map(g => ({ ...g, accuracy: g.solved > 0 ? Math.round((g.correct / g.solved) * 100) : 0 }))
      .sort((a, b) => a.areaName.localeCompare(b.areaName) || a.subArea.localeCompare(b.subArea));
  })();

  const radarData = areaPerformanceList.map(a => ({
    area: a.name.length > 14 ? a.name.slice(0, 14) + '…' : a.name,
    Você: a.accuracy,
    Colegas: a.peerAverage ?? 0
  }));

  // Área atualmente filtrada nos cards de "Desempenho por Área" e "Desempenho
  // por Tema" — por padrão, a primeira área com questões respondidas.
  const effectiveAreaId = selectedAreaId || areaPerformanceList[0]?.id || '';
  const selectedArea = areaPerformanceList.find(a => a.id === effectiveAreaId) || null;
  const selectedAreaSubAreas = subAreaPerformanceList.filter(s => s.areaId === effectiveAreaId);
  const selectedAreaDelta = selectedArea && selectedArea.peerAverage !== null
    ? selectedArea.accuracy - selectedArea.peerAverage
    : null;

  const selectedAreaThemes = selectedArea
    ? themePerformanceList.filter(t => t.areaId === selectedArea.id).sort((a, b) => b.accuracy - a.accuracy)
    : [];

  // Agrupa os temas da área filtrada por subárea (quando a área tem esse
  // agrupamento) — "Sem Subárea" reúne temas sem subArea definido, o que só
  // deve acontecer para dados legados ainda não migrados.
  const themeIdToSubArea = new Map(themes.map(t => [t.id, t.subArea]));
  const selectedAreaHasSubAreas = selectedAreaThemes.some(t => themeIdToSubArea.get(t.id));
  const selectedAreaThemesBySubArea = selectedAreaHasSubAreas
    ? selectedAreaThemes.reduce((acc, t) => {
        const key = themeIdToSubArea.get(t.id) || 'Sem Subárea';
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      }, {} as Record<string, typeof selectedAreaThemes>)
    : null;

  const rankingData: RankingEntry[] = allStatsForRanking
    .filter(s => (s.totalSolved || 0) > 0 && s.userId)
    .map(s => ({
      userId: s.userId!,
      name: userNameById[s.userId!] || (s.userId === currentUser?.id ? currentUser?.name || 'Você' : 'Usuário'),
      score: s.overallScorePercentage ?? Math.round(((s.totalCorrect || 0) / (s.totalSolved || 1)) * 100)
    }));

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">

      {/* Ranking Geral — mesmo gráfico do Dashboard admin, sem drill-down aqui */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-2">
        <h2 className="text-sm font-bold text-[#050f41]">Ranking Geral</h2>
        <p className="text-xs text-slate-400">Desempenho geral residentes.</p>
        <RankingChart data={rankingData} />
      </div>

      {/* Overall Accuracy KPI — cartão mais proeminente da página */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {currentUser?.name ? `${currentUser.name} - Desempenho Geral` : 'Desempenho Geral'}
        </p>
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
            <span className="text-slate-500">vs. média dos colegas ({platformAverage}%)</span>
          </div>
        )}
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

      {/* Desempenho por Área — donut da área selecionada no filtro, com o
          detalhamento por subárea logo abaixo, dentro do mesmo card. */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            Desempenho por Área
          </h2>

          {areaPerformanceList.length > 0 && (
            <select
              value={effectiveAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {areaPerformanceList.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        {!selectedArea ? (
          <p className="text-sm text-slate-500 italic">Complete simulados para visualizar a estatística por Área.</p>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
            {/* Donut com o percentual da área filtrada no centro — fica à
                esquerda no desktop, ao lado das subáreas. */}
            <div className="flex flex-col items-center shrink-0 mx-auto lg:mx-0">
              <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'acerto', value: selectedArea.accuracy },
                        { name: 'resto', value: Math.max(0, 100 - selectedArea.accuracy) }
                      ]}
                      dataKey="value"
                      innerRadius="72%"
                      outerRadius="100%"
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                      isAnimationActive
                      animationDuration={500}
                      animationEasing="ease-out"
                    >
                      <Cell fill={scoreColorHex(selectedArea.accuracy)} />
                      <Cell fill="#1e293b" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={effectiveAreaId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="flex flex-col items-center"
                    >
                      <span className={`text-3xl sm:text-4xl font-black ${TIER_STYLES[getTier(selectedArea.accuracy)].text}`}>
                        {selectedArea.accuracy}%
                      </span>
                      <span className="text-[11px] text-slate-500 text-center mt-1 truncate max-w-full">{selectedArea.name}</span>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={effectiveAreaId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex flex-col items-center"
                >
                  <p className="text-center text-xs text-slate-500 mt-3">
                    {selectedArea.correct}/{selectedArea.solved} questões corretas
                  </p>

                  {/* Comparação com a média dos colegas, no mesmo formato do
                      card de Taxa Geral de Acerto no topo da página. */}
                  {selectedAreaDelta !== null && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs">
                      {selectedAreaDelta > 0 && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                      {selectedAreaDelta < 0 && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                      {selectedAreaDelta === 0 && <Minus className="w-3.5 h-3.5 text-slate-500" />}
                      <span className={selectedAreaDelta > 0 ? 'text-emerald-400 font-semibold' : selectedAreaDelta < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                        {selectedAreaDelta > 0 ? '+' : ''}{selectedAreaDelta} pp
                      </span>
                      <span className="text-slate-500">vs. média dos colegas ({selectedArea.peerAverage}%)</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Desempenho por Subárea dentro da área filtrada */}
            {selectedAreaSubAreas.length > 0 && (
              <div className="flex-1 w-full pt-5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-800/80 lg:pl-8">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Desempenho por Subárea</h3>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={effectiveAreaId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
                  >
                    {selectedAreaSubAreas.map(item => {
                      const style = TIER_STYLES[getTier(item.accuracy)];
                      return (
                        <div key={`${item.areaId}::${item.subArea}`} className={`bg-slate-950 border ${style.ring} rounded-xl p-3.5 sm:p-4`}>
                          <p className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate mb-1">{item.subArea}</p>
                          <span className={`text-xl sm:text-2xl font-black ${style.text}`}>{item.accuracy}%</span>
                          <div className="mt-2 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full ${style.bar} transition-all duration-500`} style={{ width: `${Math.min(100, item.accuracy)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desempenho por Tema, dentro da mesma área filtrada acima */}
      {selectedArea && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            Desempenho por Tema · {selectedArea.name}
          </h2>

          {selectedAreaThemes.length === 0 ? (
            <p className="text-sm text-slate-500 italic mt-2">Nenhum tema respondido nesta área ainda.</p>
          ) : selectedAreaThemesBySubArea ? (
            <div className="space-y-5 mt-3">
              {Object.entries(selectedAreaThemesBySubArea).map(([subAreaName, subThemes]) => {
                const subTotal = subThemes.reduce((s, t) => s + t.solved, 0);
                const subCorrect = subThemes.reduce((s, t) => s + t.correct, 0);
                const subAcc = subTotal > 0 ? Math.round((subCorrect / subTotal) * 100) : 0;
                const subStyle = TIER_STYLES[getTier(subAcc)];
                return (
                  <div key={subAreaName}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">{subAreaName}</h4>
                      <span className={`text-xs font-bold ${subStyle.text}`}>{subAcc}%</span>
                    </div>
                    <div className="space-y-3">
                      {subThemes.map(t => {
                        const style = TIER_STYLES[getTier(t.accuracy)];
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {selectedAreaThemes.map(t => {
                const style = TIER_STYLES[getTier(t.accuracy)];
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
      )}

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
                    <span className="text-slate-300 truncate">
                      {t.name}
                      {t.subArea && <span className="text-slate-500 font-normal"> · {t.subArea}</span>}
                    </span>
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

    </div>
  );
};
