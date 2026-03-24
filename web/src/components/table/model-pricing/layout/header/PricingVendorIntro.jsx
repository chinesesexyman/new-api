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

import React, { memo, useMemo } from 'react';
import { Input, Tag } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { getLobeHubIcon } from '../../../../../helpers';

const UNKNOWN_VENDOR = 'unknown';

const PricingVendorIntro = memo(
  ({
    filterVendor,
    setFilterVendor,
    models = [],
    allModels = [],
    t,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    searchValue = '',
  }) => {
    const vendorItems = useMemo(() => {
      const sourceModels =
        Array.isArray(allModels) && allModels.length > 0 ? allModels : models;
      const vendors = new Map();
      let hasUnknown = false;

      sourceModels.forEach((model) => {
        if (model.vendor_name) {
          if (!vendors.has(model.vendor_name)) {
            vendors.set(model.vendor_name, {
              value: model.vendor_name,
              label: model.vendor_name,
              icon: model.vendor_icon,
            });
          }
        } else {
          hasUnknown = true;
        }
      });

      const items = [
        {
          value: 'all',
          label: t('全部供应商'),
          count: sourceModels.length,
        },
        ...Array.from(vendors.values())
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((item) => ({
            ...item,
            count: sourceModels.filter(
              (model) => model.vendor_name === item.value,
            ).length,
          })),
      ];

      if (hasUnknown) {
        items.push({
          value: UNKNOWN_VENDOR,
          label: t('未知供应商'),
          count: sourceModels.filter((model) => !model.vendor_name).length,
        });
      }

      return items;
    }, [allModels, models, t]);

    return (
      <section className='pricing-hero-shell'>
        <div className='pricing-hero-panel'>
          <div className='pricing-hero-copy'>
            <h1 className='pricing-hero-title'>
              {t('探索模型前沿')}
              <span>{t('优选模型')}</span>
            </h1>
            <p className='pricing-hero-desc'>
              {t(
                '集中浏览平台内可用的 AI 模型，按供应商快速筛选，并用统一视图比较不同模型的能力与价格。',
              )}
            </p>
          </div>
        </div>

        <div className='pricing-toolbar'>
          <div className='pricing-search-wrap'>
            <Input
              prefix={<IconSearch />}
              placeholder={t('按模型名称或供应商搜索')}
              value={searchValue}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onChange={handleChange}
              showClear
              size='default'
            />
          </div>
        </div>

        <div className='pricing-provider-strip'>
          {vendorItems.map((item) => {
            const isActive = filterVendor === item.value;
            return (
              <button
                key={item.value}
                type='button'
                className={`pricing-provider-pill ${isActive ? 'pricing-provider-pill-active' : ''}`}
                onClick={() => setFilterVendor?.(item.value)}
              >
                {item.icon ? (
                  <span className='pricing-provider-pill-icon'>
                    {getLobeHubIcon(item.icon, 16)}
                  </span>
                ) : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  },
);

PricingVendorIntro.displayName = 'PricingVendorIntro';

export default PricingVendorIntro;
