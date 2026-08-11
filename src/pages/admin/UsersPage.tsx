import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, UserCheck, UserX, AlertCircle, X, Trash2
} from 'lucide-react';
import { getUsers, saveUser, updateUserActiveStatus, updateUserRole, deleteUserAccount } from '../../services/firebaseService';
import { createNewUserWithAuth } from '../../services/authService';
import { AppUser } from '../../types';
import { Avatar } from '../../components/Avatar';

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [loading, setLoading] = useState(true);

  // Modal create user
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [password, setPassword] = useState('');
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

  const handleChangeRole = async (user: AppUser, newRole: 'user' | 'admin') => {
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

      await createNewUserWithAuth(name, email, role, password);

      setModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
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
          <h1 className="text-xl font-bold text-[#050f41] flex items-center gap-2">
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
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-[#050f41] placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">Todos os Perfis</option>
          <option value="user">Usuário Comum (Residente)</option>
          <option value="admin">Administrador</option>
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
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    title="Clique para ver histórico e desempenho"
                  >
                    <td className="p-3.5 font-semibold text-[#050f41]">
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
                        <option value="user">Usuário Comum</option>
                        <option value="admin">Administrador</option>
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

                    <td className="p-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
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
            </table>
          </div>
        )}
      </div>

      {/* Modal Create User */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                Cadastrar Novo Usuário
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-[#050f41]">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-cyan-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Perfil do Usuário</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="user">Usuário Comum (Residente / Aluno)</option>
                  <option value="admin">Administrador (Acesso ao Painel)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {role === 'admin' ? 'Senha do Administrador (opcional)' : 'Senha de Acesso'}
                </label>
                <input
                  type="password"
                  required={role === 'user'}
                  placeholder="Mínimo 6 caracteres (ex: 123456)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-[#050f41] focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {role === 'admin'
                    ? 'Se informada, cria conta segura no Firebase Auth para login com senha.'
                    : 'O usuário fará login na página inicial com este e-mail e esta senha.'}
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
