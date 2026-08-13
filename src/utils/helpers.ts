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

// Fisher-Yates shuffle for arrays
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
