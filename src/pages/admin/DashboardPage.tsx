import React, { useEffect, useState } from 'react';
import { 
  Users, FileCheck, History, Award, Clock, Download, TrendingUp, AlertTriangle, ArrowUpRight 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getActiveUsers, getExams, getAllAttempts, getAreas } from '../../services/firebaseService';
import { AppUser, Exam, Attempt, Area } from '../../types';
import { exportToCSV, formatTimeSeconds } from '../../utils/helpers';

export const DashboardPage: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [uList, eList, aList, arList] = await Promise.all([
          getActiveUsers(),
          getExams(),
          getAllAttempts(),
          getAreas()
        ]);
        setActiveUsers(uList);
        setExams(eList);
        setAttempts(aList);
        setAreas(arList);
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

  const totalTimeSum = completedAttempts.reduce((sum, a) => sum + (a.elapsedSeconds || 0), 0);
  const avgDurationSeconds = completedAttempts.length > 0 ? Math.round(totalTimeSum / completedAttempts.length) : 0;

  const handleExportAttemptsCSV = () => {
    const csvData = completedAttempts.map(a => ({
      'ID Tentativa': a.id,
      'Usuário': a.userName || a.userId,
      'Prova': a.examName || a.examId,
      'Total Questões': a.totalQuestions,
      'Acertos': a.correctAnswers || 0,
      'Aproveitamento (%)': a.scorePercentage || 0,
      'Tempo (segundos)': a.elapsedSeconds || 0,
      'Status': a.status
    }));

    exportToCSV(`relatorio_tentativas_teot_${Date.now()}.csv`, csvData);
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header with Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Dashboard Geral de Desempenho
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Métricas de engajamento, provas ativas e taxas globais de acerto.
          </p>
        </div>

        <button
          onClick={handleExportAttemptsCSV}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Usuários Ativos</p>
              <p className="text-xl font-black text-white mt-0.5">{activeUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Provas Publicadas</p>
              <p className="text-xl font-black text-white mt-0.5">
                {exams.filter(e => e.status === 'published').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Média Geral de Acerto</p>
              <p className="text-xl font-black text-cyan-400 mt-0.5">{overallAvgScore}%</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Tempo Médio / Prova</p>
              <p className="text-xl font-black text-white mt-0.5">{formatTimeSeconds(avgDurationSeconds)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attempts Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center justify-between">
          <span>Últimas Tentativas Concluídas ({completedAttempts.length})</span>
        </h2>

        {completedAttempts.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">Nenhuma tentativa concluída até o momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Prova</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Acertos</th>
                  <th className="p-3">Aproveitamento</th>
                  <th className="p-3">Tempo Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {completedAttempts.slice(0, 10).map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{att.examName || 'Simulado'}</td>
                    <td className="p-3 text-slate-300">{att.userName || att.userId}</td>
                    <td className="p-3 font-bold text-teal-400">{att.correctAnswers} / {att.totalQuestions}</td>
                    <td className="p-3">
                      <span className={`font-bold ${
                        (att.scorePercentage || 0) >= 60 ? 'text-teal-400' : 'text-amber-400'
                      }`}>
                        {att.scorePercentage}%
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{formatTimeSeconds(att.elapsedSeconds || 0)}</td>
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
