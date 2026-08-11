// Extrai o ID de vídeo de uma URL do YouTube (watch, youtu.be, embed,
// shorts) — mesma cobertura de padrões usada em CommentMedia.tsx.
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, '');

    if (host === 'youtu.be') return parsed.pathname.slice(1) || null;
    if (host === 'youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null;
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || null;
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
