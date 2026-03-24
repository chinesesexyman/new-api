/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

const ActualThemeContext = createContext(null);
export const useActualTheme = () => useContext(ActualThemeContext);

const SetThemeContext = createContext(null);
export const useSetTheme = () => useContext(SetThemeContext);

const normalizeThemeMode = (themeValue) => {
  if (themeValue === 'dark' || themeValue === 'light') {
    return themeValue;
  }
  if (themeValue === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
  }
  return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, _setTheme] = useState(() => {
    try {
      return normalizeThemeMode(localStorage.getItem('theme-mode'));
    } catch {
      return 'light';
    }
  });
  const actualTheme = theme;

  // 应用主题到DOM
  useEffect(() => {
    const body = document.body;
    if (actualTheme === 'dark') {
      body.setAttribute('theme-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      body.removeAttribute('theme-mode');
      document.documentElement.classList.remove('dark');
    }
  }, [actualTheme]);

  useEffect(() => {
    try {
      localStorage.setItem('theme-mode', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const setTheme = useCallback((newTheme) => {
    let themeValue;

    if (typeof newTheme === 'boolean') {
      themeValue = newTheme ? 'dark' : 'light';
    } else {
      themeValue = normalizeThemeMode(newTheme);
    }

    _setTheme(themeValue);
    localStorage.setItem('theme-mode', themeValue);
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ActualThemeContext.Provider value={actualTheme}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </ActualThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};
