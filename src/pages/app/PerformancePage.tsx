import React, { useEffect, useState } from 'react';
import { 
  BarChart3, Award, Target, CheckCircle2, AlertTriangle, BookOpen, TrendingUp 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { getUserStats, getAreas, getThemes } from '../../services/firebaseService';
import { UserStats, Area, Theme } from '../../types';

export const PerformancePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const [uStats, areaList, themeList] = await Promise.all([
          getUserStats(currentUser.id),
          getAreas(),
          getThemes()
        ]);
        setStats(uStats);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Calculando indicadores de desempenho...</p>
      </div>
    );
  }

  const totalSolved = stats?.totalSolved || 0;
  const totalCorrect = stats?.totalCorrect || 0;
  const overallAcc = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

  // Prepare area performance list
  const areaPerformanceList = areas.map(area => {
    const areaData = stats?.areas?.[area.id] || { solved: 0, correct: 0 };
    const acc = areaData.solved > 0 ? Math.round((areaData.correct / areaData.solved) * 100) : 0;
    return {
      id: area.id,
      name: area.name,
      solved: areaData.solved,
      correct: areaData.correct,
      accuracy: acc
    };
  }).filter(a => a.solved > 0);

  // Prepare chart data
  const chartData = areaPerformanceList.slice(0, 8).map(a => ({
    name: a.name.length > 15 ? a.name.substring(0, 15) + '...' : a.name,
    Taxa: a.accuracy
  }));

  // Topics needing review (< 60% accuracy)
  const weakAreas = areaPerformanceList.filter(a => a.accuracy < 60);

  return (
    <div className="space-y-8 pb-12">
      
      <div>
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-400" />
          Análise Individual de Desempenho
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Estatísticas consolidadas por Área e Tema do Exame de Título em Ortopedia.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total de Questões Respondidas</p>
              <p className="text-xl font-black text-[#050f41] mt-0.5">{totalSolved}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Acertos Totais</p>
              <p className="text-xl font-black text-[#050f41] mt-0.5">{totalCorrect}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Taxa Geral de Acerto</p>
              <p className="text-xl font-black text-cyan-400 mt-0.5">{overallAcc}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart Section */}
      {chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-sm font-bold text-[#050f41] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            Aproveitamento por Área (%)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="Taxa" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Taxa >= 60 ? '#14b8a6' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weak Areas Warning */}
      {weakAreas.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Áreas Recomendadas para Revisão (Aproveitamento &lt; 60%)</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {weakAreas.map(a => (
              <span key={a.id} className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-[11px] font-medium text-amber-200">
                {a.name} ({a.accuracy}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Area Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-[#050f41]">Desempenho Detalhado por Área</h2>

        {areaPerformanceList.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Complete simulados para visualizar a estatística por Área.</p>
        ) : (
          <div className="space-y-4">
            {areaPerformanceList.map(item => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{item.name}</span>
                  <span className="font-bold text-teal-400">{item.accuracy}% ({item.correct}/{item.solved})</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      item.accuracy >= 60 ? 'bg-teal-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${item.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
