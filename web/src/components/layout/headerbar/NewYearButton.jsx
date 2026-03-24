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
import fireworks from 'react-fireworks';

const NewYearButton = ({ isNewYear, actualTheme }) => {
  if (!isNewYear) {
    return null;
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
    }, 3000);
  };

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu
          className={`!shadow-lg !rounded-lg ${
            actualTheme === 'dark'
              ? '!bg-[#111827] !border-[#374151]'
              : '!bg-white !border-[#e5e7eb]'
          }`}
        >
          <Dropdown.Item
            onClick={handleNewYearClick}
            className={
              actualTheme === 'dark'
                ? '!text-slate-200 hover:!bg-[#1f2937]'
                : '!text-slate-900 hover:!bg-[#f3f4f6]'
            }
          >
            Happy New Year!!! 🎉
          </Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <Button
        theme='borderless'
        type='tertiary'
        icon={<span className='text-xl'>🎉</span>}
        aria-label='New Year'
        className={`!p-1.5 !text-current rounded-full transition-colors ${
          actualTheme === 'dark'
            ? 'hover:!bg-[#1e293b] focus:!bg-[#1e293b]'
            : 'hover:!bg-[#f3f4f6] focus:!bg-[#f3f4f6]'
        }`}
      />
    </Dropdown>
  );
};

export default NewYearButton;
