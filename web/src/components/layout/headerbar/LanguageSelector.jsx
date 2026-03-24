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

import React from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { Languages } from 'lucide-react';
import { normalizeAppLanguage } from '../../../i18n/i18n';

const LanguageSelector = ({
  currentLang,
  onLanguageChange,
  t,
  actualTheme,
}) => {
  const normalizedCurrentLang = normalizeAppLanguage(currentLang);
  const menuClassName =
    actualTheme === 'dark'
      ? '!bg-[#111827] !border-[#374151] !shadow-lg !rounded-lg'
      : '!bg-white !border-[#e5e7eb] !shadow-lg !rounded-lg';
  const itemBaseClass =
    actualTheme === 'dark'
      ? '!px-3 !py-1.5 !text-sm !text-slate-200'
      : '!px-3 !py-1.5 !text-sm !text-semi-color-text-0';
  const activeItemClass =
    actualTheme === 'dark'
      ? '!bg-[#6d28d9] !text-white !font-semibold'
      : '!bg-[#ede9fe] !text-[#5b21b6] !font-semibold';
  const hoverItemClass =
    actualTheme === 'dark' ? 'hover:!bg-[#1f2937]' : 'hover:!bg-[#f3f4f6]';
  const triggerClassName =
    actualTheme === 'dark'
      ? '!p-1.5 !text-current !rounded-full !bg-[#1e293b] hover:!bg-[#2b3b53] focus:!bg-[#2b3b53]'
      : '!p-1.5 !text-current !rounded-full !bg-[#f3f4f6] hover:!bg-[#e5e7eb] focus:!bg-[#e5e7eb]';

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu className={menuClassName}>
          <Dropdown.Item
            onClick={() => onLanguageChange('en')}
            className={`${itemBaseClass} ${normalizedCurrentLang === 'en' ? activeItemClass : hoverItemClass}`}
          >
            English
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => onLanguageChange('zh-CN')}
            className={`${itemBaseClass} ${normalizedCurrentLang === 'zh-CN' ? activeItemClass : hoverItemClass}`}
          >
            简体中文
          </Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <Button
        icon={<Languages size={18} />}
        aria-label={t('common.changeLanguage')}
        theme='borderless'
        type='tertiary'
        className={triggerClassName}
      />
    </Dropdown>
  );
};

export default LanguageSelector;
