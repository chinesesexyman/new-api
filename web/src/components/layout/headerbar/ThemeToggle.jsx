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

import React, { useMemo } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { Sun, Moon } from 'lucide-react';
const ThemeToggle = ({ onThemeToggle, t, actualTheme }) => {
  const isDark = actualTheme === 'dark';

  const nextTheme = isDark ? 'light' : 'dark';

  const buttonIcon = useMemo(
    () => (isDark ? <Sun size={18} /> : <Moon size={18} />),
    [isDark],
  );

  return (
    <Button
      icon={buttonIcon}
      aria-label={t('切换主题')}
      theme='borderless'
      type='tertiary'
      className={`!p-1.5 !rounded-full !text-current transition-colors ${
        actualTheme === 'dark'
          ? '!bg-[#1e293b] hover:!bg-[#2b3b53] focus:!bg-[#2b3b53]'
          : '!bg-[#f3f4f6] hover:!bg-[#e5e7eb] focus:!bg-[#e5e7eb]'
      }`}
      onClick={() => onThemeToggle(nextTheme)}
    />
  );
};

export default ThemeToggle;
