import { useEffect, useRef, useState } from 'react';

/**
 * Detecta a direção do scroll da janela para esconder/mostrar uma barra fixa
 * (ex.: barra de filtros no mobile): some ao rolar para baixo (avançando no
 * conteúdo), reaparece ao rolar para cima. Ignora variações menores que
 * `threshold` para não "tremer" com pequenos scrolls, e sempre mostra a
 * barra quando o topo da página é alcançado.
 */
export function useHideOnScroll(threshold = 8): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const diff = y - lastY.current;

      if (y <= 0) {
        setHidden(false);
        lastY.current = y;
        return;
      }

      if (Math.abs(diff) < threshold) return;

      setHidden(diff > 0);
      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
