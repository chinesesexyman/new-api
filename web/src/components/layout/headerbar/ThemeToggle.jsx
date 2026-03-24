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
import { useActualTheme } from '../../../context/Theme';

const ThemeToggle = ({ onThemeToggle, t }) => {
  const actualTheme = useActualTheme();
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
      className='!p-1.5 !text-current focus:!bg-semi-color-fill-1 !rounded-full !bg-semi-color-fill-0 hover:!bg-semi-color-fill-1'
      onClick={() => onThemeToggle(nextTheme)}
    />
  );
};

export default ThemeToggle;
