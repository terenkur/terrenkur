'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    eruda?: {
      init: () => void;
      destroy: () => void;
    };
    __ERUDA_INITIALIZED__?: boolean;
  }
}

const ERUDA_SCRIPT_ID = 'eruda-debugger-script';
const ERUDA_SRC = 'https://cdn.jsdelivr.net/npm/eruda';
const DISABLED_PATHS = ['/music-queue/player'];

export default function Eruda() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const shouldDisable = DISABLED_PATHS.some((path) => pathname?.startsWith(path));

    if (shouldDisable) {
      if (window.eruda && typeof window.eruda.destroy === 'function') {
        window.eruda.destroy();
      }

      const existingScript = document.getElementById(ERUDA_SCRIPT_ID);
      if (existingScript) {
        existingScript.remove();
      }

      window.eruda = undefined;
      window.__ERUDA_INITIALIZED__ = false;

      return;
    }

    if (window.__ERUDA_INITIALIZED__) {
      return;
    }

    const ensureInit = () => {
      if (window.__ERUDA_INITIALIZED__) return;
      window.eruda?.init();
      window.__ERUDA_INITIALIZED__ = true;
    };

    const existingScript = document.getElementById(ERUDA_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.eruda) {
        ensureInit();
      } else {
        existingScript.addEventListener('load', ensureInit, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = ERUDA_SCRIPT_ID;
    script.src = ERUDA_SRC;
    script.async = true;
    script.addEventListener('load', ensureInit, { once: true });
    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', ensureInit);
    };
  }, [pathname]);

  return null;
}
