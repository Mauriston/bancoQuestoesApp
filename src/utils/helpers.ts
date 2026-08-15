// Text normalization helper for search and indexing
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Normalize a stored question image URL/path before rendering
export function formatImageUrl(src: string): string {
  return src.trim();
}

// Generate unique clean ID
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Limpa o telefone digitado pelo admin (qualquer formatação: espaços,
// parênteses, hífen, "+") e completa o DDI 55 (Brasil) quando o número tem
// só DDD + número (até 11 dígitos) — caso mais comum de cadastro. Números já
// digitados com DDI (mais de 11 dígitos) são mantidos como estão.
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
}

// Monta o link de mensagem direta do WhatsApp (wa.me) usado pelo botão
// "Enviar Convite" de cada candidato em ExamViewPage.
export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
}

// Máscara aplicada ao digitar o telefone/WhatsApp em SettingsPage: aceita
// qualquer entrada (colar com pontuação, etc.), descarta o que não for
// dígito e formata progressivamente como "(00) 00000-0000", limitado a 11
// dígitos (DDD + celular de 9 dígitos).
export function maskPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Gerador pseudoaleatório determinístico a partir de uma string (hash FNV-1a
// + mulberry32). A mesma semente sempre produz a mesma sequência — é o que
// permite embaralhar a ordem das questões de uma prova por tentativa (semente
// = attemptId) mantendo essa ordem estável: o residente que sai no meio e
// volta reencontra exatamente a mesma sequência, e o relatório final pode
// reproduzi-la sem precisar persistir a ordem no Firestore.
function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  let state = h >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates determinístico: embaralha sempre da mesma forma para uma dada
// semente. Ver seededRandom acima para o porquê de não usar Math.random().
export function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  const random = seededRandom(seed);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Format date nicely in Portuguese
export function formatDate(dateInput: any): string {
  if (!dateInput) return '-';
  try {
    let date: Date;
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return '-';
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '-';
  }
}

// Format date only (no time) in Portuguese
export function formatDateOnly(dateInput: any): string {
  if (!dateInput) return '-';
  try {
    let date: Date;
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return '-';
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return '-';
  }
}

// Format duration in minutes and seconds
export function formatTimeSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Regra de cor institucional para qualquer valor numérico percentual de
// desempenho exibido no app (usuário ou admin), e para as barras/fatias de
// gráficos de desempenho por área/tema: <50% vermelho, 50–59% amarelo,
// >=60% verde. Cores exatas pedidas (distintas dos tokens emerald/amber/red
// já usados em outros contextos do design system).
export function scoreColorHex(score: number): string {
  if (score < 50) return '#E20018';
  if (score < 60) return '#FFCB70';
  return '#079551';
}

export function scoreColorClass(score: number): string {
  if (score < 50) return 'text-[#E20018]';
  if (score < 60) return 'text-[#FFCB70]';
  return 'text-[#079551]';
}

// Export data array as CSV file download
export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => 
      headers.map(field => {
        const val = row[field] === null || row[field] === undefined ? '' : String(row[field]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(';')
    )
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
