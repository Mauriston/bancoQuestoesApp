import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, EllipsisVertical, Share, Plus, SquarePlus, X, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isResidentRole } from '../utils/cohort';

const DONE_KEY = 'teot_install_tutorial_done';

type Platform = 'ios' | 'android';

export function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

// No iPhone, Safari mostra o botão Compartilhar na barra inferior; Chrome,
// Edge e Firefox o mostram ao lado do endereço, no topo.
export function iosShareOnTop(): boolean {
  return /CriOS|EdgiOS|FxiOS|OPiOS/i.test(navigator.userAgent || '');
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  } catch {
    return false;
  }
}

export function readDone(): boolean {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}

function markDone() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignora */ }
}

// Anel pulsante que destaca onde tocar na ilustração.
const Ping: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`absolute flex h-9 w-9 ${className}`}>
    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400/60 animate-ping" />
    <span className="relative inline-flex h-full w-full rounded-full border-2 border-amber-400" />
  </span>
);

// Moldura de celular simplificada para as ilustrações.
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mx-auto w-44 h-56 rounded-[1.6rem] border-4 border-slate-700 bg-slate-950 overflow-hidden relative shadow-xl">
    {children}
  </div>
);

interface Step {
  title: string;
  text: string;
  art: React.ReactNode;
}

const iosShareStep = (onTop: boolean): Step => ({
  title: 'Toque em Compartilhar',
  text: onTop
    ? 'Toque no ícone de compartilhar (quadrado com uma seta para cima), ao lado do endereço, no topo do navegador.'
    : 'Toque no ícone de compartilhar (quadrado com uma seta para cima), na barra inferior do Safari.',
  art: onTop ? (
    <PhoneFrame>
      <div className="absolute inset-x-0 top-0 h-9 bg-slate-800 flex items-center px-2 gap-1">
        <div className="h-5 flex-1 rounded-full bg-slate-700 text-[8px] text-slate-300 flex items-center px-2">teot-hma.app</div>
        <span className="relative flex items-center justify-center">
          <Ping className="-left-2.5 -top-2.5 scale-75" />
          <Share className="w-4 h-4 text-sky-400 relative" />
        </span>
      </div>
      <div className="absolute inset-x-3 top-14 h-4 rounded bg-teal-500/30" />
      <div className="absolute inset-x-3 top-22 h-3 rounded bg-slate-800" style={{ top: '5.5rem' }} />
    </PhoneFrame>
  ) : (
    <PhoneFrame>
      <div className="absolute inset-x-3 top-6 h-4 rounded bg-teal-500/30" />
      <div className="absolute inset-x-3 top-14 h-3 rounded bg-slate-800" />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-slate-800 flex items-center justify-around px-3">
        <ArrowLeft className="w-4 h-4 text-slate-500" />
        <ArrowRight className="w-4 h-4 text-slate-500" />
        <span className="relative flex items-center justify-center">
          <Ping className="-left-1.5 -top-1.5" />
          <Share className="w-4 h-4 text-sky-400 relative" />
        </span>
        <SquarePlus className="w-4 h-4 text-slate-500" />
      </div>
    </PhoneFrame>
  ),
});

const iosSteps = (): Step[] => [
  iosShareStep(iosShareOnTop()),
  {
    title: 'Adicionar à Tela de Início',
    text: 'Role a lista de opções para baixo e toque em “Adicionar à Tela de Início”.',
    art: (
      <PhoneFrame>
        <div className="absolute inset-x-0 bottom-0 top-8 rounded-t-2xl bg-slate-800 p-2 space-y-1.5">
          <div className="h-5 rounded-md bg-slate-700/70" />
          <div className="h-5 rounded-md bg-slate-700/70" />
          <div className="relative h-6 rounded-md bg-slate-700 border border-amber-400/70 flex items-center justify-between px-2 text-[8px] text-slate-100">
            <span>Adicionar à Tela de Início</span>
            <Plus className="w-3 h-3" />
            <Ping className="right-0 -top-1.5 scale-75" />
          </div>
          <div className="h-5 rounded-md bg-slate-700/70" />
        </div>
      </PhoneFrame>
    ),
  },
  {
    title: 'Confirme em “Adicionar”',
    text: 'Toque em “Adicionar”, no canto superior direito. O ícone do app aparecerá na tela inicial do seu iPhone.',
    art: (
      <PhoneFrame>
        <div className="absolute inset-x-0 top-0 h-8 bg-slate-800 flex items-center justify-between px-3 text-[8px]">
          <span className="text-slate-400">Cancelar</span>
          <span className="relative text-sky-400 font-bold">
            Adicionar
            <Ping className="-right-3 -top-3 scale-75" />
          </span>
        </div>
        <div className="absolute inset-x-3 top-12 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center text-slate-950 font-black text-xs">T</div>
          <div className="text-[8px] text-slate-200">TEOT HMA 2027</div>
        </div>
      </PhoneFrame>
    ),
  },
];

const ANDROID_STEPS: Step[] = [
  {
    title: 'Abra no navegador',
    text: 'Abra o app no navegador do celular (o Chrome é o mais indicado) e siga os passos abaixo.',
    art: (
      <PhoneFrame>
        <div className="absolute inset-x-0 top-0 h-9 bg-slate-800 flex items-center px-2 gap-1">
          <div className="h-5 flex-1 rounded-full bg-slate-700 text-[8px] text-slate-300 flex items-center px-2">teot-hma.app</div>
          <EllipsisVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="absolute inset-x-3 top-14 h-4 rounded bg-teal-500/30" />
        <div className="absolute inset-x-3 top-22 h-3 rounded bg-slate-800" style={{ top: '5.5rem' }} />
      </PhoneFrame>
    ),
  },
  {
    title: 'Toque no menu ⋮',
    text: 'Toque nos três pontinhos, no canto superior direito do Chrome.',
    art: (
      <PhoneFrame>
        <div className="absolute inset-x-0 top-0 h-9 bg-slate-800 flex items-center px-2 gap-1">
          <div className="h-5 flex-1 rounded-full bg-slate-700" />
          <span className="relative flex items-center justify-center">
            <Ping className="-left-2.5 -top-2.5 scale-75" />
            <EllipsisVertical className="w-4 h-4 text-slate-100 relative" />
          </span>
        </div>
        <div className="absolute inset-x-3 top-14 h-4 rounded bg-teal-500/30" />
      </PhoneFrame>
    ),
  },
  {
    title: 'Instalar app',
    text: 'Toque em “Instalar app” (ou “Adicionar à tela inicial”).',
    art: (
      <PhoneFrame>
        <div className="absolute right-2 top-9 w-32 rounded-lg bg-slate-800 border border-slate-700 p-1.5 space-y-1">
          <div className="h-4 rounded bg-slate-700/70" />
          <div className="relative h-5 rounded bg-slate-700 border border-amber-400/70 text-[8px] text-slate-100 flex items-center px-1.5">
            Instalar app
            <Ping className="right-0 -top-2 scale-75" />
          </div>
          <div className="h-4 rounded bg-slate-700/70" />
        </div>
      </PhoneFrame>
    ),
  },
  {
    title: 'Confirme em “Instalar”',
    text: 'Confirme tocando em “Instalar” (ou “Adicionar”). O ícone do app aparecerá na tela inicial do seu celular.',
    art: (
      <PhoneFrame>
        <div className="absolute inset-x-3 top-16 rounded-xl bg-slate-800 border border-slate-700 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center text-slate-950 font-black text-xs">T</div>
            <div className="text-[8px] text-slate-200">Instalar TEOT HMA 2027?</div>
          </div>
          <div className="flex justify-end gap-3 text-[8px]">
            <span className="text-slate-400">Cancelar</span>
            <span className="relative text-sky-400 font-bold">
              Instalar
              <Ping className="-left-2 -top-3 scale-75" />
            </span>
          </div>
        </div>
      </PhoneFrame>
    ),
  },
];

// Mini-tutorial passo a passo para criar o ícone do app na tela inicial do
// celular. Aparece só em celular (iOS/Android), fora do app já instalado, até
// o usuário concluir o tutorial uma vez neste aparelho ("Concluir" grava a
// flag em localStorage). "Mais tarde" fecha só até a próxima abertura do app.
export const InstallAppTutorial: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const platform = detectPlatform();
  const steps = platform === 'android' ? ANDROID_STEPS : iosSteps();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const finish = () => {
    markDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 pr-6">
          <Smartphone className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-bold text-slate-100">Crie o ícone do app na tela inicial</h2>
        </div>

        {step.art}

        <div className="text-center space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-400">
            Passo {index + 1} de {steps.length}
          </p>
          <h3 className="text-sm font-bold text-slate-100">{step.title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{step.text}</p>
        </div>

        <div className="flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-teal-400' : 'w-1.5 bg-slate-700'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {index === 0 ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Mais tarde
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setIndex(index + 1))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors"
          >
            {isLast ? <><Check className="w-3.5 h-3.5" /> Concluir</> : <>Próximo <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

// Decide se o tutorial deve aparecer: usuário comum/leitor, celular, app ainda
// não instalado e tutorial ainda não concluído neste aparelho.
export function shouldShowInstallTutorial(role: string | undefined): boolean {
  if (!isResidentRole(role) && role !== 'reader') return false;
  if (!detectPlatform()) return false;
  if (isStandalone()) return false;
  return !readDone();
}

export const useInstallTutorialEligible = (): boolean => {
  const { currentUser } = useAuth();
  return shouldShowInstallTutorial(currentUser?.role);
};
