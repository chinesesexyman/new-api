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
import { Card, Tag, Empty, Pagination, Avatar } from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { calculateModelPrice, getLobeHubIcon } from '../../../../../helpers';
import PricingCardSkeleton from './PricingCardSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

const CARD_STYLES = {
  container:
    'pricing-model-icon-box w-14 h-14 rounded-2xl flex items-center justify-center relative',
  icon: 'w-8 h-8 flex items-center justify-center',
  selected: 'pricing-model-card-selected',
  default: 'pricing-model-card-default',
};

const PricingCardView = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  selectedGroup,
  groupRatio,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  tokenUnit,
  displayPrice,
  showRatio,
  t,
  selectedRowKeys = [],
  setSelectedRowKeys,
  openModelDetail,
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedModels = filteredModels.slice(
    startIndex,
    startIndex + pageSize,
  );
  const getModelKey = (model) => model.key ?? model.model_name ?? model.id;
  const isMobile = useIsMobile();

  const formatCardPrice = (value) => {
    const text = String(value ?? '').trim();
    const match = text.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
    if (!match) return text;
    const [, prefix, numberPart, suffix] = match;
    const parsed = Number(numberPart);
    if (Number.isNaN(parsed)) return text;
    return `${prefix}${parsed.toFixed(2)}${suffix}`;
  };

  const getMetricRows = (model, priceData) => {
    const endpointText =
      model.supported_endpoint_types?.slice(0, 2).join(', ') || t('标准');

    if (priceData.isPerToken) {
      return [
        {
          label: t('输入价格'),
          value: `${formatCardPrice(priceData.inputPrice)} / 1${priceData.unitLabel} ${t('令牌')}`,
        },
        {
          label: t('输出价格'),
          value: `${formatCardPrice(priceData.completionPrice)} / 1${priceData.unitLabel} ${t('令牌')}`,
        },
        {
          label: t('可用端点'),
          value: endpointText,
        },
      ];
    }

    return [
      {
        label: t('模型价格'),
        value: formatCardPrice(priceData.price),
      },
      {
        label: t('计费方式'),
        value: t('按次计费'),
      },
      {
        label: t('可用端点'),
        value: endpointText,
      },
    ];
  };

  const handleCheckboxChange = (model, checked) => {
    if (!setSelectedRowKeys) return;
    const modelKey = getModelKey(model);
    const newKeys = checked
      ? Array.from(new Set([...selectedRowKeys, modelKey]))
      : selectedRowKeys.filter((key) => key !== modelKey);
    setSelectedRowKeys(newKeys);
    rowSelection?.onChange?.(newKeys, null);
  };

  // 获取模型图标
  const getModelIcon = (model) => {
    if (!model || !model.model_name) {
      return (
        <div className={CARD_STYLES.container}>
          <Avatar size='large'>?</Avatar>
        </div>
      );
    }
    // 1) 优先使用模型自定义图标
    if (model.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.icon, 32)}
          </div>
        </div>
      );
    }
    // 2) 退化为供应商图标
    if (model.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    // 如果没有供应商图标，使用模型名称生成头像

    const avatarText = model.model_name.slice(0, 2).toUpperCase();
    return (
      <div className={CARD_STYLES.container}>
        <Avatar
          size='large'
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 'bold',
          }}
        >
          {avatarText}
        </Avatar>
      </div>
    );
  };

  // 显示骨架屏
  if (showSkeleton) {
    return (
      <PricingCardSkeleton
        rowSelection={!!rowSelection}
        showRatio={showRatio}
      />
    );
  }

  if (!filteredModels || filteredModels.length === 0) {
    return (
      <div className='flex justify-center items-center py-20'>
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          description={t('搜索无结果')}
        />
      </div>
    );
  }

  return (
    <div className='pricing-card-section'>
      <div className='pricing-model-grid'>
        {paginatedModels.map((model, index) => {
          const modelKey = getModelKey(model);
          const isSelected = selectedRowKeys.includes(modelKey);

          const priceData = calculateModelPrice({
            record: model,
            selectedGroup,
            groupRatio,
            tokenUnit,
            displayPrice,
            currency,
          });
          const metricRows = getMetricRows(model, priceData);
          const allTags = model.tags
            ? model.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [model.quota_type === 0 ? t('按量计费') : t('按次计费')];
          const visibleTags = allTags.slice(0, 3);
          const hiddenTagCount = Math.max(
            allTags.length - visibleTags.length,
            0,
          );

          return (
            <Card
              key={modelKey || index}
              className={`pricing-model-card transition-all duration-200 cursor-pointer ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default}`}
              bodyStyle={{ height: '100%', padding: 0 }}
              onClick={() => openModelDetail && openModelDetail(model)}
            >
              <div className='pricing-model-card-body'>
                <div className='pricing-model-card-header'>
                  <div className='flex items-start gap-4 flex-1 min-w-0'>
                    {getModelIcon(model)}
                    <div className='pricing-model-card-topline'>
                      {visibleTags.map((tag) => (
                        <Tag
                          key={tag}
                          shape='circle'
                          size='small'
                          className='pricing-model-pill'
                        >
                          {tag}
                        </Tag>
                      ))}
                      {hiddenTagCount > 0 && (
                        <Tag
                          shape='circle'
                          size='small'
                          className='pricing-model-pill'
                        >
                          +{hiddenTagCount}
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>

                <div className='pricing-model-title-block'>
                  <h3 className='pricing-model-title'>{model.model_name}</h3>
                </div>

                <div className='pricing-model-metrics'>
                  {metricRows.map((row) => (
                    <div key={row.label} className='pricing-model-metric-row'>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>

                <div className='pricing-model-footer'>
                  {showRatio && (
                    <div className='pricing-model-ratio-inline'>
                      <span>
                        {t('倍率')} {priceData?.usedGroupRatio ?? '-'}
                      </span>
                      <IconHelpCircle
                        className='text-blue-500 cursor-pointer'
                        size='small'
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalImageUrl('/ratio.png');
                          setIsModalOpenurl(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredModels.length > 0 && (
        <div className='pricing-pagination-wrap'>
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            total={filteredModels.length}
            showSizeChanger={true}
            pageSizeOptions={[10, 20, 50, 100]}
            size={isMobile ? 'small' : 'default'}
            showQuickJumper={isMobile}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PricingCardView;
