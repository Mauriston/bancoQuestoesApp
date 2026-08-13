import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, FileCheck, Award, ClipboardCheck, Download, TrendingUp, Trophy, X
} from 'lucide-react';
import {
  AreaChart, Area as RechartsArea, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  BarChart, Bar, Cell
} from 'recharts';
import { getActiveUsers, getUsers, getExams, getAreas, getGroups, getThemes, subscribeAllAttempts, subscribeAllUserStats } from '../../services/firebaseService';
import { AppUser, Exam, Attempt, Area, Group, UserStats, Theme } from '../../types';
import { exportToCSV, scoreColorClass, scoreColorHex } from '../../utils/helpers';
import { RankingChart, RankingEntry } from '../../components/RankingChart';

export const DashboardPage: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [userStatsList, setUserStatsList] = useState<UserStats[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Usuário selecionado no ranking (Gráfico 1) — filtra os 2 gráficos abaixo.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Dados de referência (usuários, provas, áreas/temas) mudam raramente
  // enquanto o Dashboard está aberto — busca única. Tentativas e estatísticas
  // dos usuários, que são o que realmente muda ao vivo conforme provas são
  // corrigidas, usam assinatura contínua (onSnapshot) abaixo.
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [uList, allUsers, eList, arList, grList, thList] = await Promise.all([
          getActiveUsers(),
          getUsers(),
          getExams(),
          getAreas(),
          getGroups(),
          getThemes()
        ]);
        setActiveUsers(uList);
        setExams(eList);
        setAreas(arList);
        setGroups(grList);
        setThemes(thList);
        // Tentativas antigas podem ter sido gravadas antes do userName ser
        // desnormalizado no documento — esse mapa cobre esses registros.
        setUserNameById(Object.fromEntries(allUsers.map(u => [u.id, u.name])));
      } catch (err) {
        console.error("Erro ao carregar dados de referência do dashboard:", err);
      }
    }

    loadReferenceData();
  }, []);

  // Tentativas e estatísticas de desempenho ao vivo — os dois gráficos e a
  // tabela de últimas tentativas atualizam sozinhos, sem precisar recarregar
  // a página, assim que um residente termina uma prova.
  useEffect(() => {
    setLoading(true);
    let attemptsLoaded = false;
    let statsLoaded = false;
    const maybeStopLoading = () => {
      if (attemptsLoaded && statsLoaded) setLoading(false);
    };

    const unsubAttempts = subscribeAllAttempts((data) => {
      setAttempts(data);
      attemptsLoaded = true;
      maybeStopLoading();
    });
    const unsubStats = subscribeAllUserStats((data) => {
      setUserStatsList(data);
      statsLoaded = true;
      maybeStopLoading();
    });

    return () => {
      unsubAttempts();
      unsubStats();
    };
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

  // Agregado de solved/correct por tema (todos os usuários, ou só o
  // selecionado no ranking) — insumo comum dos dois gráficos por área e por
  // grupo abaixo.
  const themeAgg = useMemo(() => {
    const sourceStats = selectedUserId
      ? userStatsList.filter(s => s.userId === selectedUserId)
      : userStatsList;

    const agg: Record<string, { solved: number; correct: number }> = {};
    sourceStats.forEach(s => {
      Object.values(s.themes || {}).forEach(t => {
        if (!agg[t.themeId]) agg[t.themeId] = { solved: 0, correct: 0 };
        agg[t.themeId].solved += t.solved;
        agg[t.themeId].correct += t.correct;
      });
    });
    return agg;
  }, [userStatsList, selectedUserId]);

  // Desempenho médio por Área (Gráfico 3) — 1 barra por área, sem
  // subdivisão (a Área é hoje uma unidade "achatada": os temas de uma mesma
  // área podem pertencer a Grupos TEOT diferentes, ver Gráfico 4 abaixo).
  const areaChartData = useMemo(() => {
    return areas.map(area => {
      const themesInArea = themes.filter(t => t.areaId === area.id);
      let solved = 0, correct = 0;
      themesInArea.forEach(t => {
        const agg = themeAgg[t.id];
        if (!agg) return;
        solved += agg.solved;
        correct += agg.correct;
      });
      return {
        name: area.name,
        accuracy: solved > 0 ? Math.round((correct / solved) * 100) : 0,
        solved
      };
    }).filter(r => r.solved > 0);
  }, [areas, themes, themeAgg]);

  // Desempenho médio por Grupo TEOT (Gráfico 4) — cruza Áreas (ex.: "Trauma
  // Adulto" reúne temas de Mão, Joelho, Ombro e Cotovelo etc.), por isso é
  // um gráfico independente do de Área, usado só para estatística.
  const groupChartData = useMemo(() => {
    return groups.map(group => {
      const themesInGroup = themes.filter(t => t.groupId === group.id);
      let solved = 0, correct = 0;
      themesInGroup.forEach(t => {
        const agg = themeAgg[t.id];
        if (!agg) return;
        solved += agg.solved;
        correct += agg.correct;
      });
      return {
        name: group.name,
        accuracy: solved > 0 ? Math.round((correct / solved) * 100) : 0,
        solved
      };
    }).filter(r => r.solved > 0);
  }, [groups, themes, themeAgg]);

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
          <h1 className="text-xl font-bold text-[#05413b] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Dashboard Geral de Desempenho
          </h1>
        </div>

        <button
          onClick={handleExportAttemptsCSV}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-[#05413b] px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      {/* Gráfico 1: Ranking geral — clicar numa barra filtra os 2 gráficos abaixo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-[#05413b] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FFCB70]" />
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
          <h2 className="text-sm font-bold text-[#05413b]">
            Evolução do Desempenho {selectedUserName ? `— ${selectedUserName}` : '(Média Geral)'}
          </h2>
          {evolutionData.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">Sem provas concluídas suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={evolutionData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <defs>
                  <linearGradient id="evoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#418f87" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#418f87" stopOpacity={0.02} />
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
                <RechartsArea type="monotone" dataKey="score" stroke="#418f87" strokeWidth={2.5} fill="url(#evoGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico 3: Desempenho médio por Área — continua servindo também
            de filtro de questões no banco/provas; aqui é só a estatística. */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h2 className="text-sm font-bold text-[#05413b]">
            Desempenho por Área {selectedUserName ? `— ${selectedUserName}` : '(Média Geral)'}
          </h2>
          {areaChartData.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">Sem questões respondidas suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={areaChartData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: any) => [`${Math.round(value)}%`, 'Aproveitamento']}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                  {areaChartData.map(row => <Cell key={row.name} fill={scoreColorHex(row.accuracy)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico 4: Desempenho médio por Grupo (TEOT) — Anatomia, Ciência
          Básica, Ortopedia Adulto, Ortopedia Infantil, Trauma Adulto, Trauma
          Infantil, Oncologia Ortopédica. Cruza várias Áreas por grupo, por
          isso é um gráfico independente do de Área acima; usado só para
          estatística de desempenho, nunca como filtro de questões. */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <h2 className="text-sm font-bold text-[#05413b]">
          Desempenho por Grupo (TEOT) {selectedUserName ? `— ${selectedUserName}` : '(Média Geral)'}
        </h2>
        {groupChartData.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">Sem questões respondidas suficientes ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={groupChartData} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(value: any) => [`${Math.round(value)}%`, 'Aproveitamento']}
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                {groupChartData.map(row => <Cell key={row.name} fill={scoreColorHex(row.accuracy)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
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
              <p className="text-2xl font-black text-[#05413b] mt-0.5 leading-none">{activeUsers.length}</p>
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
              <p className="text-2xl font-black text-[#05413b] mt-0.5 leading-none">
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
              <p className="text-2xl font-black text-[#05413b] mt-0.5 leading-none">{completedAttempts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attempts Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-[#05413b] flex items-center justify-between">
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
                    <td className="p-3 font-semibold text-[#05413b] border-b border-slate-800/70">{att.examName || 'Simulado'}</td>
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
