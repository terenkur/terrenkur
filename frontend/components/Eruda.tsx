'use client';
import { useEffect } from 'react';

export default function Eruda() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!/Android/i.test(navigator.userAgent)) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    document.body.appendChild(script);
    script.onload = () => {
      // @ts-ignore
      eruda.init();
    };
  }, []);
  return null;
}
