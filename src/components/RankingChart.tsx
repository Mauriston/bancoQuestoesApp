import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts';
import { scoreColorHex } from '../utils/helpers';

export interface RankingEntry {
  userId: string;
  name: string;
  score: number;
}

interface RankingChartProps {
  data: RankingEntry[];
  selectedUserId?: string | null;
  onSelectUser?: (userId: string | null) => void;
  height?: number;
}

// Ranking geral (barras horizontais, ordem decrescente de desempenho) —
// reutilizado no Dashboard admin (com drill-down via onSelectUser) e na
// página de Desempenho do usuário (somente leitura, sem onSelectUser).
export const RankingChart: React.FC<RankingChartProps> = ({ data, selectedUserId, onSelectUser, height }) => {
  const sorted = [...data].sort((a, b) => b.score - a.score);
  // Linha mais alta por usuário (antes 32px) para acomodar barras mais
  // grossas e o rótulo de nome maior, tanto no mobile quanto no desktop.
  const chartHeight = height || Math.max(160, sorted.length * 52);

  if (sorted.length === 0) {
    return <p className="text-xs text-slate-500 italic py-6 text-center">Sem dados suficientes para o ranking ainda.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barCategoryGap="28%">
        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6B7680', fontSize: 11 }} unit="%" />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: '#2C3A47', fontSize: 14, fontWeight: 700 }}
          interval={0}
        />
        <Tooltip
          formatter={(value: any) => [`${value}%`, 'Desempenho']}
          contentStyle={{ background: '#23303B', border: '1px solid #2C3A47', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#D8DBDD' }}
        />
        <Bar
          dataKey="score"
          radius={[0, 6, 6, 0]}
          cursor={onSelectUser ? 'pointer' : 'default'}
          onClick={onSelectUser ? (entry: any) => onSelectUser(selectedUserId === entry.userId ? null : entry.userId) : undefined}
        >
          {sorted.map(entry => (
            <Cell
              key={entry.userId}
              fill={scoreColorHex(entry.score)}
              opacity={!selectedUserId || selectedUserId === entry.userId ? 1 : 0.35}
            />
          ))}
          <LabelList
            dataKey="score"
            position="right"
            formatter={(value: any) => `${value}%`}
            style={{ fill: '#2C3A47', fontSize: 13, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
