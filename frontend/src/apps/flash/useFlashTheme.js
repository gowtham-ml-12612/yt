import { useEffect, useState } from 'react';

export default function useFlashTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('fc-theme') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-fc-theme', theme);
    localStorage.setItem('fc-theme', theme);
  }, [theme]);

  function toggle() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  return [theme, toggle];
}
