import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, UserCheck, UserX, AlertCircle, X, Trash2, MessageCircle
} from 'lucide-react';
import { getUsers, saveUser, updateUserActiveStatus, updateUserRole, deleteUserAccount } from '../../services/firebaseService';
import { createNewUserWithAuth, INITIAL_PASSWORD } from '../../services/authService';
import { AppUser, UserRole } from '../../types';
import { Avatar } from '../../components/Avatar';
import { maskPhoneInput, buildWhatsAppLink } from '../../utils/helpers';
import { isResidentRole } from '../../utils/cohort';

// Grupos de linhas da tabela: residentes HMA ('user'), residentes HNMD
// ('user_hnmd') e os demais perfis (admin e leitor).
const USER_GROUPS: { key: string; label: string; roles: UserRole[] }[] = [
  { key: 'hma', label: 'Residentes HMA', roles: ['user'] },
  { key: 'hnmd', label: 'Residentes HNMD', roles: ['user_hnmd'] },
  { key: 'others', label: 'Administradores e Leitores', roles: ['admin', 'reader'] }
];

// Convite para o app enviado pelo WhatsApp (botão em cada residente).
function buildAppInviteMessage(user: AppUser): string {
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const appUrl = `${window.location.origin}/`;
  return `Olá *${firstName}!* Como o titio aqui não esquece das crias, acesse esse appweb para treinar as provas teóricas e orais do TEOT. As provas teóricas estão montadas de acordo com a especialidade e, uma vez respondida até o fim, você terá acesso a todas as questões comentadas e com opção de download em PDF. Além disso você pode consultar várias provas orais simuladas para treinamento entre vocês. Forte Abraço! CT (Md) Mauriston. ${appUrl}`;
}

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [loading, setLoading] = useState(true);

  // Modal create user
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await getUsers();
      setUsers(list);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (user: AppUser) => {
    try {
      await updateUserActiveStatus(user.id, !user.active);
      await fetchUsers();
    } catch (err) {
      alert("Erro ao alterar status do usuário.");
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (!confirm(`Excluir definitivamente o usuário "${user.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteUserAccount(user.id);
      await fetchUsers();
    } catch (err) {
      alert("Erro ao excluir usuário.");
    }
  };

  const handleSendAppInvite = (user: AppUser) => {
    if (!user.phone) return;
    window.open(buildWhatsAppLink(user.phone, buildAppInviteMessage(user)), '_blank', 'noopener,noreferrer');
  };

  const handleChangeRole = async (user: AppUser, newRole: UserRole) => {
    try {
      await updateUserRole(user.id, newRole);
      await fetchUsers();
    } catch (err) {
      alert("Erro ao alterar perfil do usuário.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      if (!name || !name.trim()) {
        throw new Error("Por favor, informe o nome completo do usuário.");
      }
      if (!email || !email.trim()) {
        throw new Error("Por favor, informe um endereço de e-mail válido.");
      }

      await createNewUserWithAuth(name, email, role, INITIAL_PASSWORD, { phone });

      setModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setRole('user');
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao cadastrar usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Gerenciamento de Usuários
          </h1>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Usuário</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">Todos os Perfis</option>
          <option value="user">Residente HMA</option>
          <option value="user_hnmd">Residente HNMD</option>
          <option value="admin">Administrador</option>
          <option value="reader">Leitor (somente leitura)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Carregando lista de usuários...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Nome / Identificação</th>
                  <th className="p-3.5">E-mail</th>
                  <th className="p-3.5">Perfil</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              {USER_GROUPS.map(group => {
                const groupUsers = filtered.filter(u => group.roles.includes(u.role));
                if (groupUsers.length === 0) return null;
                return (
              <tbody key={group.key} className="divide-y divide-slate-800/80 border-b border-slate-800">
                <tr className="bg-slate-950/60">
                  <td colSpan={5} className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-cyan-500">
                    {group.label} <span className="text-slate-500 font-semibold">({groupUsers.length})</span>
                  </td>
                </tr>
                {groupUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    title="Clique para ver histórico e desempenho"
                  >
                    <td className="p-3.5 font-semibold text-slate-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={u.name} photoUrl={u.photoUrl} role={u.role} size="sm" />
                        <span className="truncate">{u.name}</span>
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-400 max-w-[220px] truncate">{u.email}</td>

                    <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as any)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="user">Residente HMA</option>
                        <option value="user_hnmd">Residente HNMD</option>
                        <option value="admin">Administrador</option>
                        <option value="reader">Leitor</option>
                      </select>
                    </td>

                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        u.active
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/30'
                      }`}>
                        {u.active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="p-3.5 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isResidentRole(u.role) && (
                        <button
                          onClick={() => handleSendAppInvite(u)}
                          disabled={!u.phone}
                          title={u.phone ? 'Convidar para o app pelo WhatsApp' : 'Cadastre o telefone/WhatsApp do usuário para enviar o convite'}
                          aria-label="Convidar para o app pelo WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 hover:text-emerald-400 transition-colors border border-emerald-500/30 align-middle disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                          u.active
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {u.active ? 'Inativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        title="Excluir usuário"
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/30 align-middle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
                );
              })}
            </table>
          </div>
        )}
      </div>

      {/* Modal Create User */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-100/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                Cadastrar Novo Usuário
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Roberto Alcantara"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="roberto@ortopedia.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / WhatsApp (opcional)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Perfil do Usuário</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="user">Residente HMA</option>
                  <option value="user_hnmd">Residente HNMD (Hospital Naval Marcílio Dias)</option>
                  <option value="admin">Administrador (Acesso ao Painel)</option>
                  <option value="reader">Leitor (somente leitura)</option>
                </select>
              </div>

              <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5">
                <p className="text-[11px] text-slate-300">
                  Senha inicial: <strong className="font-mono text-slate-100">{INITIAL_PASSWORD}</strong>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  O usuário faz login na página inicial com este e-mail e esta senha e será lembrado de trocá-la.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20"
                >
                  {submitting ? 'Salvando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
