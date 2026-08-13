import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, ChevronRight, User, Trash2 } from 'lucide-react';
import { getAllAttempts, getUsers, deleteAttempt } from '../../services/firebaseService';
import { Attempt } from '../../types';
import { formatDate, scoreColorClass } from '../../utils/helpers';

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
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-400" />
          Monitoramento de Tentativas e Resultados
        </h1>
      </div>

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Buscar por nome do residente ou da prova..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* List — grid de cards para não desperdiçar a largura da tela em telas
          largas (cada tentativa fica compacta em vez de ocupar 1 linha inteira) */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">Carregando registro de tentativas...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">Nenhuma tentativa encontrada.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((att) => {
            return (
              <div key={att.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">

                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1 min-w-0">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{nameOf(att)}</span>
                    </span>
                    <button
                      onClick={() => handleDelete(att.id)}
                      disabled={deletingId === att.id}
                      title="Excluir esta tentativa do histórico"
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2">
                    {att.examName || 'Simulado Ortopedia'}
                  </h3>

                  <p className="text-[11px] text-slate-500 mt-1">{formatDate(att.completedAt || att.startedAt)}</p>

                  <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                    <span>Acertos: <strong className="text-teal-400">{att.correctAnswers || 0}</strong> / {att.totalQuestions}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  {att.status === 'completed' ? (
                    <>
                      <div>
                        <span className={`text-lg font-black ${scoreColorClass(att.scorePercentage || 0)}`}>
                          {att.scorePercentage}%
                        </span>
                        <p className="text-[10px] text-slate-500">Aproveitamento</p>
                      </div>
                      <Link
                        to={`/app/attempts/${att.id}/result`}
                        className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl shrink-0"
                      >
                        <span>Ver Relatório</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </>
                  ) : (
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Em Andamento
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
