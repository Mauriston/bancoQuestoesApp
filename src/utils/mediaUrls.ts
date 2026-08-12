// Extrai o ID de vídeo de uma URL do YouTube (watch, youtu.be, embed,
// shorts, live — inclusive lives já encerradas, que continuam em /live/{id}
// mesmo depois de terminarem).
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, '');

    if (host === 'youtu.be') return parsed.pathname.slice(1) || null;
    if (host === 'youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null;
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || null;
      if (parsed.pathname.startsWith('/live/')) return parsed.pathname.split('/')[2] || null;
    }
  } catch {
    return null;
  }
  return null;
}

// Thumbnail pública do YouTube — sem custo, sem autenticação.
export function youTubeThumbnailUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function youTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

// Aceita tanto uma URL simples quanto um código de incorporação em HTML
// (ex.: o snippet <iframe ...> que o Canva oferece em "Compartilhar >
// Incorporar") colado no campo de URL das Aulas — extrai o `src` do
// primeiro <iframe> encontrado; se não houver HTML, devolve a string como
// veio (assumindo que já é uma URL).
export function extractEmbedSrc(input: string): string {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return match ? match[1] : trimmed;
}

// Converte um link de edição/cópia do Canva ou Google Slides para o modo de
// apresentação embedável, quando reconhecível — senão devolve a URL como veio
// (o admin já é orientado a colar o link no modo "Apresentar/Present").
export function toPresentEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/presentation/')) {
      // .../edit -> .../embed (Google Slides aceita embed diretamente)
      return url.replace(/\/(edit|present)([/?].*)?$/, '/embed');
    }
    return url;
  } catch {
    return url;
  }
}

// ID da apresentação a partir de qualquer URL do Google Slides
// (.../presentation/d/{ID}/edit, /present, /pub, /embed...).
export function extractGoogleSlidesId(url: string): string | null {
  const match = (url || '').match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Endpoint oficial do Google Slides para exportar a apresentação como PDF —
// abrir/navegar para essa URL já dispara o download no navegador (o próprio
// Google define o cabeçalho Content-Disposition: attachment).
export function googleSlidesPdfExportUrl(url: string): string | null {
  const id = extractGoogleSlidesId(url);
  return id ? `https://docs.google.com/presentation/d/${id}/export/pdf` : null;
}
