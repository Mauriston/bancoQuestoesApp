import React, { useEffect, useState } from 'react';
import {
  Users, FileCheck, Award, ClipboardCheck, Download, TrendingUp
} from 'lucide-react';
import { getActiveUsers, getUsers, getExams, getAllAttempts, getAreas } from '../../services/firebaseService';
import { AppUser, Exam, Attempt, Area } from '../../types';
import { exportToCSV } from '../../utils/helpers';

export const DashboardPage: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [uList, allUsers, eList, aList, arList] = await Promise.all([
          getActiveUsers(),
          getUsers(),
          getExams(),
          getAllAttempts(),
          getAreas()
        ]);
        setActiveUsers(uList);
        setExams(eList);
        setAttempts(aList);
        setAreas(arList);
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        (att.scorePercentage || 0) >= 60
                          ? 'bg-teal-500/10 text-teal-500'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
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
