import React, { useState } from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { addQuestionImage } from '../services/firebaseService';

interface AddQuestionImageModalProps {
  questionId: string;
  onClose: () => void;
  onSaved: (imageUrl: string) => void;
}

// Modal exclusivo para anexar a imagem de uma questão que ainda não tem
// nenhuma, sem precisar abrir o modal completo de edição. Aceita tanto
// escolher um arquivo do dispositivo quanto colar (Ctrl+V) uma imagem
// copiada — nos dois casos a pré-visualização é exibida antes do botão OK
// aparecer, para o admin confirmar visualmente antes de salvar.
export const AddQuestionImageModal: React.FC<AddQuestionImageModalProps> = ({ questionId, onClose, onSaved }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) applyFile(f);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) {
          e.preventDefault();
          applyFile(f);
        }
        break;
      }
    }
  };

  const handleOk = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const url = await addQuestionImage(questionId, file);
      onSaved(url);
      onClose();
    } catch (err: any) {
      setError("Erro ao salvar imagem: " + err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050f41]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">

        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-[#050f41] flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            Adicionar Imagem
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[#050f41]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Buscar no dispositivo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Ou cole a imagem aqui (Ctrl+V)</label>
            <div
              tabIndex={0}
              onPaste={handlePaste}
              className="min-h-[5.5rem] flex items-center justify-center bg-slate-950 border border-dashed border-slate-700 rounded-xl px-3 py-4 text-slate-500 text-center focus:outline-none focus:border-cyan-500"
            >
              {!previewUrl && 'Clique aqui e cole (Ctrl+V) uma imagem copiada'}
            </div>
          </div>

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Pré-visualização da imagem"
              className="max-h-52 w-full object-contain rounded-xl border border-slate-800 bg-slate-950"
            />
          )}

          {error && <p className="text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-xs"
          >
            Cancelar
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleOk}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 text-xs disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Salvando...' : 'OK'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
