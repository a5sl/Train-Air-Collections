import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme, type ResolvedTheme as Theme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(getTheme());
    const handler = () => setTheme(getTheme());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <button
      onClick={handleToggle}
      className="relative w-9 h-9 rounded-lg border border-line bg-surface-card flex items-center justify-center
                 hover:bg-surface-card-alt transition-all group"
      title={theme === 'light' ? '切换至玄夜' : '切换至宣纸'}
    >
      <Sun
        className={`w-4 h-4 absolute transition-all duration-300 ${
          theme === 'light' ? 'opacity-100 rotate-0 scale-100 text-brand' : 'opacity-0 rotate-90 scale-50'
        }`}
      />
      <Moon
        className={`w-4 h-4 absolute transition-all duration-300 ${
          theme === 'dark' ? 'opacity-100 rotate-0 scale-100 text-brand-glow' : 'opacity-0 -rotate-90 scale-50'
        }`}
      />
    </button>
  );
}
