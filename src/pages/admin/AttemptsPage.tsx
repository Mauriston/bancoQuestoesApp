import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, ChevronRight, User, Trash2, CheckCheck } from 'lucide-react';
import { getAllAttempts, getUsers, deleteAttempt } from '../../services/firebaseService';
import { finishAndGradeAttempt } from '../../services/gradingService';
import { Attempt } from '../../types';
import { formatDateOnly, scoreColorClass } from '../../utils/helpers';

// Data-hora de realização em segundos: conclusão, ou início se a tentativa
// ainda está em andamento (mesma data exibida na tabela).
const attemptTime = (a: Attempt): number => {
  const t: any = a.completedAt || a.startedAt;
  if (!t) return 0;
  if (typeof t === 'object' && 'seconds' in t) return t.seconds;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? 0 : ms / 1000;
};

export const AttemptsPage: React.FC = () => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);

  const fetchAttempts = () => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([getAllAttempts(), getUsers()])
      .then(([res, users]) => {
        setAttempts(res.sort((a, b) => attemptTime(b) - attemptTime(a)));
        // Tentativas antigas podem ter sido gravadas antes do userName ser
        // desnormalizado no documento — esse mapa cobre esses registros.
        setUserNameById(Object.fromEntries(users.map(u => [u.id, u.name])));
      })
      .catch(err => {
        console.error("Erro ao carregar tentativas:", err);
        setLoadError(err?.code === 'permission-denied'
          ? "Sem permissão para ler as tentativas — sua sessão pode ter expirado. Saia e entre novamente."
          : "Erro ao carregar tentativas: " + (err?.message || "erro desconhecido."));
      })
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

  // Tentativa presa em 'em andamento'/'corrigindo' (ex.: a correção foi
  // interrompida no meio): finaliza e corrige a partir das respostas já
  // gravadas, sem o residente precisar refazer a prova.
  const handleFinalize = async (att: Attempt) => {
    if (!confirm(`Finalizar e corrigir a tentativa de ${nameOf(att)} em "${att.examName || 'Simulado'}" com as respostas já registradas? Questões sem resposta contam como não respondidas.`)) return;
    setGradingId(att.id);
    try {
      await finishAndGradeAttempt(att.id, { force: true });
      await fetchAttempts();
    } catch (err: any) {
      alert("Erro ao finalizar tentativa: " + (err?.message || "erro desconhecido."));
    } finally {
      setGradingId(null);
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

      {/* Tabela única, da mais recente para a mais antiga pela data-hora de
          realização (conclusão; para tentativas em andamento, o início). */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">Carregando registro de tentativas...</div>
      ) : loadError ? (
        <div className="p-8 text-center text-xs text-rose-400 bg-slate-900 border border-rose-500/30 rounded-2xl">{loadError}</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">Nenhuma tentativa encontrada.</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Prova</th>
                <th className="p-3">Residente</th>
                <th className="p-3 text-center">Desempenho</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((att) => (
                <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-semibold text-slate-100">{att.examName || 'Simulado Ortopedia'}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 min-w-0 font-bold text-cyan-400">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{nameOf(att)}</span>
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                      {formatDateOnly(att.completedAt || att.startedAt)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {att.status === 'completed' ? (
                      <span className={`text-sm font-black ${scoreColorClass(att.scorePercentage || 0)}`}>
                        {att.scorePercentage}%
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                        Em Andamento
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      {att.status === 'completed' && (
                        <Link
                          to={`/admin/attempts/${att.id}/result`}
                          className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl shrink-0"
                        >
                          <span>Ver Relatório</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {att.status !== 'completed' && (
                        <button
                          onClick={() => handleFinalize(att)}
                          disabled={gradingId === att.id}
                          title="Finalizar e corrigir esta tentativa com as respostas já registradas"
                          className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 hover:text-teal-400 transition-colors disabled:opacity-40 shrink-0"
                        >
                          <CheckCheck className={`w-3.5 h-3.5 ${gradingId === att.id ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(att.id)}
                        disabled={deletingId === att.id}
                        title="Excluir esta tentativa do histórico"
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
