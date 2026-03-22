"use client";

import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';

export function PwaInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if user already dismissed
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !('MSStream' in window);
    const inStandaloneMode = ('standalone' in navigator) && (navigator as Navigator & { standalone?: boolean }).standalone;

    if (ios && !inStandaloneMode) {
      setIsIos(true);
      setShow(true);
      return;
    }

    // Listen for Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-500 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">התקן את BScale AI</p>
              <p className="text-xs text-gray-500 mt-0.5">גישה מהירה מהמסך הראשי</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIos ? (
          <div className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 leading-relaxed">
            <span className="flex items-center gap-1.5 font-semibold text-gray-800 mb-1">
              <Share className="w-3.5 h-3.5 text-blue-500" />
              כיצד להתקין:
            </span>
            לחץ על{' '}
            <Share className="inline w-3.5 h-3.5 text-blue-500 mx-0.5" />
            {' '}ואז בחר <strong>"הוסף למסך הבית"</strong>
          </div>
        ) : (
          <button
            onClick={install}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            התקן עכשיו
          </button>
        )}
      </div>
    </div>
  );
}
