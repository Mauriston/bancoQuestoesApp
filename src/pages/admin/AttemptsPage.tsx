import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, ChevronRight, User, Trash2 } from 'lucide-react';
import { getAllAttempts, getUsers, deleteAttempt } from '../../services/firebaseService';
import { Attempt } from '../../types';
import { formatDate } from '../../utils/helpers';

export const AttemptsPage: React.FC = () => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAttempts = () => {
    setLoading(true);
    return Promise.all([getAllAttempts(), getUsers()])
      .then(([res, users]) => {
        setAttempts(res.sort((a, b) => {
          const aT = a.startedAt ? (typeof a.startedAt === 'object' && 'seconds' in a.startedAt ? a.startedAt.seconds : 0) : 0;
          const bT = b.startedAt ? (typeof b.startedAt === 'object' && 'seconds' in b.startedAt ? b.startedAt.seconds : 0) : 0;
          return bT - aT;
        }));
        // Tentativas antigas podem ter sido gravadas antes do userName ser
        // desnormalizado no documento — esse mapa cobre esses registros.
        setUserNameById(Object.fromEntries(users.map(u => [u.id, u.name])));
      })
      .catch(err => console.error("Erro ao carregar tentativas:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleDelete = async (attemptId: string) => {
    if (!confirm("Excluir esta tentativa do histórico do residente? A nota e as respostas dela deixam de existir, e a prova volta a ficar disponível para ele refazer.")) return;
    setDeletingId(attemptId);
    try {
      await deleteAttempt(attemptId);
      await fetchAttempts();
    } catch (err: any) {
      alert("Erro ao excluir tentativa: " + (err?.message || "erro desconhecido."));
    } finally {
      setDeletingId(null);
    }
  };

  const nameOf = (a: Attempt) => a.userName || userNameById[a.userId] || 'Usuário removido';

  const filtered = attempts.filter(a =>
    (a.examName || '').toLowerCase().includes(search.toLowerCase()) ||
    nameOf(a).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      
      <div>
        <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-400" />
          Monitoramento de Tentativas e Resultados
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Acompanhe o desempenho de todos os alunos e residentes em tempo real.
        </p>
      </div>

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Buscar por nome do residente ou da prova..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Carregando registro de tentativas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Nenhuma tentativa encontrada.</div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((att) => {
              const isPassed = (att.scorePercentage || 0) >= 60;
              return (
                <div key={att.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {nameOf(att)}
                      </span>
                      <span className="text-[11px] text-slate-500">•</span>
                      <span className="text-[11px] text-slate-500">{formatDate(att.completedAt || att.startedAt)}</span>
                    </div>

                    <h3 className="text-sm font-bold text-[#050f41]">
                      {att.examName || 'Simulado Ortopedia'}
                    </h3>

                    <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                      <span>Acertos: <strong className="text-teal-400">{att.correctAnswers || 0}</strong> / {att.totalQuestions}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                    {att.status === 'completed' && (
                      <div className="text-left sm:text-right">
                        <span className={`text-lg font-black ${isPassed ? 'text-teal-400' : 'text-amber-400'}`}>
                          {att.scorePercentage}%
                        </span>
                        <p className="text-[10px] text-slate-500">Aproveitamento</p>
                      </div>
                    )}

                    {att.status === 'completed' && (
                      <Link
                        to={`/app/attempts/${att.id}/result`}
                        className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl"
                      >
                        <span>Ver Relatório</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    <button
                      onClick={() => handleDelete(att.id)}
                      disabled={deletingId === att.id}
                      title="Excluir esta tentativa do histórico"
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
