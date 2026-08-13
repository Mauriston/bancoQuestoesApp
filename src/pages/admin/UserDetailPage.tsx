import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CheckCircle2, Award, ChevronRight, Trash2, Camera, Phone, Check
} from 'lucide-react';
import { getUserById, getUserStats, getUserAttempts, getAreas, deleteAttempt, uploadUserAvatar, updateUserPhone } from '../../services/firebaseService';
import { AppUser, UserStats, Attempt, Area } from '../../types';
import { formatDate, scoreColorClass } from '../../utils/helpers';
import { Avatar } from '../../components/Avatar';

export const UserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AppUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Telefone/WhatsApp editável inline (ver handleSavePhone) — usado pelo
  // botão "Enviar Convite" de cada prova em ExamViewPage.
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const loadUser = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [u, uStats, uAttempts, areaList] = await Promise.all([
        getUserById(userId),
        getUserStats(userId),
        getUserAttempts(userId),
        getAreas()
      ]);
      setUser(u);
      setPhoneInput(u?.phone || '');
      setStats(uStats);
      setAttempts(uAttempts.sort((a, b) => {
        const aT = a.startedAt ? (typeof a.startedAt === 'object' && 'seconds' in a.startedAt ? a.startedAt.seconds : 0) : 0;
        const bT = b.startedAt ? (typeof b.startedAt === 'object' && 'seconds' in b.startedAt ? b.startedAt.seconds : 0) : 0;
        return bT - aT;
      }));
      setAreas(areaList);
    } catch (err) {
      console.error("Erro ao carregar dados do usuário:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleDeleteAttempt = async (attemptId: string) => {
    if (!confirm("Excluir esta tentativa do histórico do residente? A nota e as respostas dela deixam de existir, e a prova volta a ficar disponível para ele refazer.")) return;
    setDeletingId(attemptId);
    try {
      await deleteAttempt(attemptId);
      await loadUser();
    } catch (err: any) {
      alert("Erro ao excluir tentativa: " + (err?.message || "erro desconhecido."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSavePhone = async () => {
    if (!userId || phoneInput === (user?.phone || '')) return;
    setSavingPhone(true);
    try {
      await updateUserPhone(userId, phoneInput);
      setUser(prev => (prev ? { ...prev, phone: phoneInput.trim() || undefined } : prev));
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2000);
    } catch (err) {
      alert("Erro ao salvar telefone.");
    } finally {
      setSavingPhone(false);
    }
  };

  const handlePhotoChange = async (file: File | null) => {
    if (!file || !userId) return;
    setUploadingPhoto(true);
    try {
      await uploadUserAvatar(userId, file);
      await loadUser();
    } catch (err) {
      alert("Erro ao enviar foto de perfil.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Carregando desempenho do usuário...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#05413b]">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Usuários</span>
        </Link>
        <p className="text-sm text-slate-400">Usuário não encontrado.</p>
      </div>
    );
  }

  const totalSolved = stats?.totalSolved || 0;
  const totalCorrect = stats?.totalCorrect || 0;
  const overallAcc = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;
  const completedAttempts = attempts.filter(a => a.status === 'completed');

  const areaPerformanceList = areas.map(area => {
    const areaData = stats?.areas?.[area.id] || { solved: 0, correct: 0 };
    const acc = areaData.solved > 0 ? Math.round((areaData.correct / areaData.solved) * 100) : 0;
    return { id: area.id, name: area.name, solved: areaData.solved, correct: areaData.correct, accuracy: acc };
  }).filter(a => a.solved > 0);

  return (
    <div className="space-y-6 pb-12">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#05413b] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Usuários</span>
      </Link>

      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar name={user.name} photoUrl={user.photoUrl} role={user.role} size="lg" />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            title="Alterar foto de perfil"
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-600 hover:bg-cyan-500 border-2 border-slate-950 flex items-center justify-center text-white disabled:opacity-50"
          >
            <Camera className="w-2.5 h-2.5" />
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-[#05413b] truncate">{user.name}</h1>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onBlur={handleSavePhone}
              placeholder="WhatsApp (ex: 11 91234-5678)"
              title="Usado para enviar convites de prova por WhatsApp"
              className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 text-xs text-slate-300 placeholder-slate-600 focus:outline-none py-0.5 min-w-0 flex-1 transition-colors"
            />
            {savingPhone && <span className="text-[10px] text-slate-500 shrink-0">salvando...</span>}
            {!savingPhone && phoneSaved && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 shrink-0">
                <Check className="w-3 h-3" /> salvo
              </span>
            )}
          </div>
        </div>
        <span className={`ml-auto shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
          user.active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
        }`}>
          {user.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Questões Respondidas</p>
              <p className="text-xl font-black text-[#05413b] mt-0.5">{totalSolved}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Provas Concluídas</p>
              <p className="text-xl font-black text-[#05413b] mt-0.5">{completedAttempts.length}</p>
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
              <p className={`text-xl font-black mt-0.5 ${scoreColorClass(overallAcc)}`}>{overallAcc}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Area Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-[#05413b]">Desempenho por Área</h2>
        {areaPerformanceList.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nenhuma questão respondida ainda.</p>
        ) : (
          <div className="space-y-4">
            {areaPerformanceList.map(item => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{item.name}</span>
                  <span className={`font-bold ${scoreColorClass(item.accuracy)}`}>{item.accuracy}% ({item.correct}/{item.solved})</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${item.accuracy >= 60 ? 'bg-teal-500' : 'bg-amber-500'}`}
                    style={{ width: `${item.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attempts History — grid de cards para não desperdiçar a largura em
          telas largas (mesmo tratamento aplicado em AttemptsPage) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#05413b]">Histórico de Tentativas ({attempts.length})</h2>
        {attempts.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nenhuma tentativa registrada ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {attempts.map((att) => {
              return (
                <div key={att.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        att.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {att.status === 'completed' ? 'Concluída' : 'Em Andamento'}
                      </span>
                      <button
                        onClick={() => handleDeleteAttempt(att.id)}
                        disabled={deletingId === att.id}
                        title="Excluir esta tentativa do histórico"
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h3 className="text-sm font-bold text-[#05413b] line-clamp-2">{att.examName || 'Simulado Ortopedia'}</h3>
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
                      <span className="text-[11px] text-slate-500 italic">Em andamento — aguardando conclusão.</span>
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
