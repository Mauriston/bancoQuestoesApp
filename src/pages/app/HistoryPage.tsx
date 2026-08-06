import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserAttempts } from '../../services/firebaseService';
import { Attempt } from '../../types';
import { formatDate } from '../../utils/helpers';

export const HistoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      getUserAttempts(currentUser.id)
        .then(res => setAttempts(res.sort((a, b) => {
          const aT = a.startedAt ? (typeof a.startedAt === 'object' && 'seconds' in a.startedAt ? a.startedAt.seconds : 0) : 0;
          const bT = b.startedAt ? (typeof b.startedAt === 'object' && 'seconds' in b.startedAt ? b.startedAt.seconds : 0) : 0;
          return bT - aT;
        })))
        .catch(err => console.error("Erro ao carregar histórico:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const filtered = attempts.filter(a => 
    (a.examName || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando seu histórico de tentativas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-[#050f41] flex items-center gap-2">
          <History className="w-5 h-5 text-teal-400" />
          Histórico de Simulados
        </h1>
      </div>

      {/* Filter bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Buscar por nome do simulado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#050f41] placeholder-slate-500 focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* History table list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma tentativa registrada encontrada.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((att) => {
              const isPassed = (att.scorePercentage || 0) >= 60;
              return (
                <div key={att.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        att.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {att.status === 'completed' ? 'Concluída' : 'Em Andamento'}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(att.completedAt || att.startedAt)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#050f41]">
                      {att.examName || 'Simulado Ortopedia'}
                    </h3>

                    <div className="text-xs text-slate-400 flex items-center gap-3 pt-1">
                      <span>Acertos: <strong className="text-teal-400">{att.correctAnswers || 0}</strong> / {att.totalQuestions}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                    {att.status === 'completed' && (
                      <div className="text-left sm:text-right">
                        <span className={`text-xl font-black ${isPassed ? 'text-teal-400' : 'text-amber-400'}`}>
                          {att.scorePercentage}%
                        </span>
                        <p className="text-xs text-slate-500">Aproveitamento</p>
                      </div>
                    )}

                    {att.status === 'completed' ? (
                      <Link
                        to={`/app/attempts/${att.id}/result`}
                        className="flex items-center gap-1 text-sm font-bold text-teal-400 hover:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-3.5 py-2.5 min-h-11 rounded-xl"
                      >
                        <span>Ver Relatório</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        to={`/app/exams/${att.assignmentId}`}
                        className="flex items-center gap-1 text-sm font-bold text-amber-400 hover:text-[#734900] bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 min-h-11 rounded-xl"
                      >
                        <span>Continuar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
