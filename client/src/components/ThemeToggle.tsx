import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme, type Theme } from '../lib/theme';

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
      title={theme === 'light' ? '\u5207\u6362\u81f3\u7384\u591c' : '\u5207\u6362\u81f3\u5ba3\u7eb8'}
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
