import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, Award, Flame, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { UserStats, AreaTema } from '../types';

interface StatsViewProps {
  stats: UserStats;
  arvoreData: AreaTema[];
}

export const StatsView: React.FC<StatsViewProps> = ({ stats, arvoreData }) => {
  const accuracy = stats.totalSolved > 0 
    ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) 
    : 0;

  // Chart data per area
  const chartData = arvoreData.map((areaObj) => {
    const areaStat = stats.areaStats?.[areaObj.Área] || { solved: 0, correct: 0 };
    const areaAcc = areaStat.solved > 0 ? Math.round((areaStat.correct / areaStat.solved) * 100) : 0;
    
    return {
      name: areaObj.Área.replace('Cirurgia do ', '').replace('Cirurgia da ', ''),
      fullName: areaObj.Área,
      solved: areaStat.solved,
      correct: areaStat.correct,
      accuracy: areaAcc
    };
  });

  // Weak areas (solved > 0 and accuracy < 70)
  const weakAreas = chartData.filter(d => d.solved > 0 && d.accuracy < 70);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Top Banner & KPI Cards */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center space-x-3 mb-6">
          <BarChart3 className="w-6 h-6 text-teal-400" />
          <div>
            <h1 className="text-2xl font-extrabold text-white font-outfit">
              Painel de Desempenho TEOT
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Acompanhe sua taxa de acerto por especialidade e monitore sua evolução para a prova.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Total Resolvidas</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-outfit mt-1 block">
              {stats.totalSolved}
            </span>
            <span className="text-[11px] text-teal-400 mt-1 block">
              {stats.totalCorrect} acertos totais
            </span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Precisão Geral</span>
            <span className={`text-2xl sm:text-3xl font-extrabold font-outfit mt-1 block ${
              accuracy >= 70 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-slate-200'
            }`}>
              {accuracy}%
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Corte TEOT: ~60% a 70%
            </span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Sequência Diária</span>
            <div className="flex items-center space-x-2 mt-1">
              <Flame className="w-6 h-6 text-amber-400" />
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-outfit">
                {stats.streakDays}d
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Estudo contínuo
            </span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Diagnóstico</span>
            <span className="text-base font-bold text-teal-300 mt-1 block">
              {stats.totalSolved === 0 
                ? 'Sem dados' 
                : accuracy >= 70 
                ? 'Zona de Aprovação 🏆' 
                : accuracy >= 50 
                ? 'Nível Intermediário' 
                : 'Foco em Revisão'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {stats.totalSolved} questões simuladas
            </span>
          </div>
        </div>
      </div>

      {/* Chart Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h3 className="text-lg font-bold text-white font-outfit">
          Taxa de Acerto (%) por Grande Área Ortopédica
        </h3>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={10} 
                interval={0} 
                angle={-35} 
                textAnchor="end"
              />
              <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                formatter={(value: any) => [`${value}% acerto`, 'Precisão']}
              />
              <Bar dataKey="accuracy" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.solved === 0 ? '#334155' : entry.accuracy >= 70 ? '#10b981' : entry.accuracy >= 50 ? '#f59e0b' : '#ef4444'
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Specialty Breakdown List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white font-outfit border-b border-slate-800 pb-3">
          Detalhamento por Área
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {chartData.map((item) => (
            <div 
              key={item.fullName}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-bold text-white">{item.fullName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.solved > 0 ? `${item.correct} de ${item.solved} acertos` : 'Nenhuma questão respondida ainda'}
                </p>
              </div>

              <div className="text-right">
                <span className={`text-lg font-extrabold font-outfit ${
                  item.solved === 0 ? 'text-slate-500' : item.accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {item.solved > 0 ? `${item.accuracy}%` : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
