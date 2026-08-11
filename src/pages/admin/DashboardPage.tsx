import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, FileCheck, Award, ClipboardCheck, Download, TrendingUp, Trophy, X
} from 'lucide-react';
import {
  AreaChart, Area as RechartsArea, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  BarChart, Bar, Legend
} from 'recharts';
import { getActiveUsers, getUsers, getExams, getAllAttempts, getAreas, getAllUserStats, getThemes } from '../../services/firebaseService';
import { AppUser, Exam, Attempt, Area, UserStats, Theme } from '../../types';
import { exportToCSV, scoreColorClass, scoreColorHex } from '../../utils/helpers';
import { RankingChart, RankingEntry } from '../../components/RankingChart';

// Paleta cíclica para os segmentos de subárea dos gráficos empilhados —
// distinta das cores semânticas de desempenho (scoreColorHex), já que aqui a
// cor identifica a subárea, não uma nota.
const SEGMENT_COLORS = ['#06b6d4', '#FAB932', '#a855f7', '#10b981', '#f472b6', '#6366f1', '#f97316', '#14b8a6'];

export const DashboardPage: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [userStatsList, setUserStatsList] = useState<UserStats[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Usuário selecionado no ranking (Gráfico 1) — filtra os 2 gráficos abaixo.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [uList, allUsers, eList, aList, arList, thList, statsList] = await Promise.all([
          getActiveUsers(),
          getUsers(),
          getExams(),
          getAllAttempts(),
          getAreas(),
          getThemes(),
          getAllUserStats()
        ]);
        setActiveUsers(uList);
        setExams(eList);
        setAttempts(aList);
        setAreas(arList);
        setThemes(thList);
        setUserStatsList(statsList);
        // Tentativas antigas podem ter sido gravadas antes do userName ser
        // desnormalizado no documento — esse mapa cobre esses registros.
        setUserNameById(Object.fromEntries(allUsers.map(u => [u.id, u.name])));
      } catch (err) {
        console.error("Erro ao carregar dashboard admin:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Ranking geral (Gráfico 1): um ponto por usuário com pelo menos 1 questão
  // resolvida, ordenado desc dentro do próprio RankingChart.
  const rankingData: RankingEntry[] = useMemo(() => {
    return userStatsList
      .filter(s => (s.totalSolved || 0) > 0 && s.userId)
      .map(s => ({
        userId: s.userId!,
        name: userNameById[s.userId!] || 'Usuário',
        score: s.overallScorePercentage ?? Math.round(((s.totalCorrect || 0) / (s.totalSolved || 1)) * 100)
      }));
  }, [userStatsList, userNameById]);

  const selectedUserName = selectedUserId ? (userNameById[selectedUserId] || 'Usuário') : null;

  // Evolução (Gráfico 2): desempenho médio por prova, em ordem cronológica,
  // recalculado a partir das tentativas concluídas (de todos os usuários, ou
  // só do usuário selecionado no ranking).
  const evolutionData = useMemo(() => {
    const completed = attempts.filter(a => a.status === 'completed' && (!selectedUserId || a.userId === selectedUserId));
    const byExam: Record<string, { name: string; sum: number; count: number; earliest: number }> = {};
    completed.forEach(a => {
      const ts = a.completedAt && typeof a.completedAt === 'object' && 'seconds' in a.completedAt ? a.completedAt.seconds : 0;
      if (!byExam[a.examId]) {
        byExam[a.examId] = { name: a.examName || 'Prova', sum: 0, count: 0, earliest: ts || Infinity };
      }
      byExam[a.examId].sum += a.scorePercentage || 0;
      byExam[a.examId].count += 1;
      byExam[a.examId].earliest = Math.min(byExam[a.examId].earliest, ts || Infinity);
    });
    return Object.values(byExam)
      .sort((a, b) => a.earliest - b.earliest)
      .map(e => ({ name: e.name, score: Math.round(e.sum / e.count) }));
  }, [attempts, selectedUserId]);

  // Desempenho médio por área com proporção entre subáreas (Gráfico 3):
  // altura da barra = desempenho médio da área; cada segmento de subárea usa
  // sua própria taxa de acerto — como a taxa da área é a média ponderada
  // (por questões resolvidas) das taxas de subárea, os segmentos somam
  // exatamente a altura total da barra.
  const areaChartData = useMemo(() => {
    const sourceStats = selectedUserId
      ? userStatsList.filter(s => s.userId === selectedUserId)
      : userStatsList;

    const themeAgg: Record<string, { solved: number; correct: number }> = {};
    sourceStats.forEach(s => {
      Object.values(s.themes || {}).forEach(t => {
        if (!themeAgg[t.themeId]) themeAgg[t.themeId] = { solved: 0, correct: 0 };
        themeAgg[t.themeId].solved += t.solved;
        themeAgg[t.themeId].correct += t.correct;
      });
    });

    const themeById = new Map(themes.map(t => [t.id, t]));
    const segmentKeysSet = new Set<string>();

    const rows = areas.map(area => {
      const themesInArea = themes.filter(t => t.areaId === area.id);
      const bySubArea: Record<string, { solved: number; correct: number }> = {};
      themesInArea.forEach(t => {
        const agg = themeAgg[t.id];
        if (!agg || agg.solved === 0) return;
        const key = t.subArea || 'Geral';
        if (!bySubArea[key]) bySubArea[key] = { solved: 0, correct: 0 };
        bySubArea[key].solved += agg.solved;
        bySubArea[key].correct += agg.correct;
      });

      const row: Record<string, any> = { name: area.name };
      const totalSolved = Object.values(bySubArea).reduce((s, d) => s + d.solved, 0);
      const totalCorrect = Object.values(bySubArea).reduce((s, d) => s + d.correct, 0);
      const areaScore = totalSolved > 0 ? (totalCorrect / totalSolved) * 100 : 0;

      Object.entries(bySubArea).forEach(([key, data]) => {
        segmentKeysSet.add(key);
        // Altura do segmento = nota da área distribuída proporcionalmente ao
        // peso (nº de questões respondidas) de cada subárea — os segmentos
        // somam exatamente a nota total da barra. A nota própria de cada
        // subárea (não ponderada) fica disponível para o tooltip.
        const weight = totalSolved > 0 ? data.solved / totalSolved : 0;
        row[key] = areaScore * weight;
        row[`${key}__rate`] = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
      });
      row.__total = Math.round(areaScore);
      row.__hasData = totalSolved > 0;
      return row;
    }).filter(r => r.__hasData);

    return { rows, segmentKeys: Array.from(segmentKeysSet), themeById };
  }, [areas, themes, userStatsList, selectedUserId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando painel analítico do administrador...</p>
      </div>
    );
  }

  const completedAttempts = attempts.filter(a => a.status === 'completed');
  const totalCorrectSum = completedAttempts.reduce((sum, a) => sum + (a.correctAnswers || 0), 0);
  const totalQuestionsSum = completedAttempts.reduce((sum, a) => sum + (a.totalQuestions || 0), 0);
  const overallAvgScore = totalQuestionsSum > 0 ? Math.round((totalCorrectSum / totalQuestionsSum) * 100) : 0;

  const handleExportAttemptsCSV = () => {
    const csvData = completedAttempts.map(a => ({
      'ID Tentativa': a.id,
      'Usuário': a.userName || userNameById[a.userId] || 'Usuário removido',
      'Prova': a.examName || a.examId,
      'Total Questões': a.totalQuestions,
      'Acertos': a.correctAnswers || 0,
      'Aproveitamento (%)': a.scorePercentage || 0,
      'Status': a.status
    }));

    exportToCSV(`relatorio_tentativas_teot_${Date.now()}.csv`, csvData);
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header with Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Dashboard Geral de Desempenho
          </h1>
        </div>

        <button
          onClick={handleExportAttemptsCSV}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-[#050f41] px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      {/* Gráfico 1: Ranking geral — clicar numa barra filtra os 2 gráficos abaixo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FAB932]" />
            Ranking Geral de Desempenho
          </h2>
          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId(null)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-lg"
            >
              <X className="w-3 h-3" />
              Filtrando por: {selectedUserName} — limpar
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">Clique em um usuário para filtrar os gráficos de evolução e desempenho por área abaixo.</p>
        <RankingChart data={rankingData} selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 2: Evolução do desempenho médio ao longo das provas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h2 className="text-sm font-bold text-[#050f41]">
            Evolução do Desempenho {selectedUserName ? `— ${selectedUserName}` : '(Média Geral)'}
          </h2>
          {evolutionData.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">Sem provas concluídas suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={evolutionData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <defs>
                  <linearGradient id="evoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Desempenho médio']}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <RechartsArea type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2.5} fill="url(#evoGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico 3: Desempenho médio por área, empilhado por subárea */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h2 className="text-sm font-bold text-[#050f41]">
            Desempenho por Área {selectedUserName ? `— ${selectedUserName}` : '(Média Geral)'}
          </h2>
          {areaChartData.rows.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">Sem questões respondidas suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={areaChartData.rows} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: any, key: any) => [`${Math.round(value)}%`, key]}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                {areaChartData.segmentKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {areaChartData.segmentKeys.map((key, idx) => (
                  <Bar key={key} dataKey={key} name={key} stackId="area" fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} radius={idx === areaChartData.segmentKeys.length - 1 ? [4, 4, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-cyan-500 rounded-2xl p-5 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-shadow">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Usuários Ativos</p>
              <p className="text-2xl font-black text-[#050f41] mt-0.5 leading-none">{activeUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-teal-500 rounded-2xl p-5 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-shadow">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-500/15 text-teal-500 border border-teal-500/30 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Provas Publicadas</p>
              <p className="text-2xl font-black text-[#050f41] mt-0.5 leading-none">
                {exams.filter(e => e.status === 'published').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-shadow">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Média Geral de Acerto</p>
              <p className="text-2xl font-black text-cyan-600 mt-0.5 leading-none">{overallAvgScore}%</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-purple-500 rounded-2xl p-5 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-shadow">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-500 border border-purple-500/30 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Tentativas Concluídas</p>
              <p className="text-2xl font-black text-[#050f41] mt-0.5 leading-none">{completedAttempts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attempts Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-[#050f41] flex items-center justify-between">
          <span>Últimas Tentativas Concluídas ({completedAttempts.length})</span>
        </h2>

        {completedAttempts.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">Nenhuma tentativa concluída até o momento.</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left text-xs text-slate-600 border-separate border-spacing-0">
              <thead className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">
                <tr>
                  <th className="p-3 border-b-2 border-slate-800">Prova</th>
                  <th className="p-3 border-b-2 border-slate-800">Usuário</th>
                  <th className="p-3 border-b-2 border-slate-800">Acertos</th>
                  <th className="p-3 border-b-2 border-slate-800">Aproveitamento</th>
                </tr>
              </thead>
              <tbody>
                {completedAttempts.slice(0, 10).map((att, i) => (
                  <tr key={att.id} className={`hover:bg-cyan-500/5 transition-colors ${i % 2 === 1 ? 'bg-slate-950/60' : ''}`}>
                    <td className="p-3 font-semibold text-[#050f41] border-b border-slate-800/70">{att.examName || 'Simulado'}</td>
                    <td className="p-3 text-slate-500 border-b border-slate-800/70">{att.userName || userNameById[att.userId] || 'Usuário removido'}</td>
                    <td className="p-3 font-bold text-teal-500 border-b border-slate-800/70">{att.correctAnswers} / {att.totalQuestions}</td>
                    <td className="p-3 border-b border-slate-800/70">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] bg-current/10 ${scoreColorClass(att.scorePercentage || 0)}`}>
                        {att.scorePercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
