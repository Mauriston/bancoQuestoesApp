import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold text-slate-100 mb-2">Acesso Não Autorizado</h1>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        Sua conta não possui privilégios de administrador para visualizar esta página.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#050f41] hover:bg-[#0e1748] text-xs font-semibold text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Início</span>
      </Link>
    </div>
  );
};

export const InactivePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/30 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold text-slate-100 mb-2">Usuário Inativo</h1>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        Seu cadastro está temporariamente inativo na plataforma. Solicite a reativação junto ao administrador do sistema.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#050f41] hover:bg-[#0e1748] text-xs font-semibold text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Início</span>
      </Link>
    </div>
  );
};

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-extrabold text-slate-700 mb-2">404</h1>
      <h2 className="text-base font-bold text-slate-100 mb-2">Página Não Encontrada</h2>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        O endereço informado não existe ou foi movido.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Início</span>
      </Link>
    </div>
  );
};
