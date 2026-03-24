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
import { Card, Skeleton } from '@douyinfe/semi-ui';

const PricingCardSkeleton = ({
  skeletonCount = 12,
  rowSelection = false,
  showRatio = false,
}) => {
  const placeholder = (
    <div className='pricing-card-section'>
      <div className='pricing-model-grid'>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Card
            key={index}
            className='pricing-model-card pricing-model-card-default'
            bodyStyle={{ padding: 0 }}
          >
            <div className='pricing-model-card-body'>
              <div className='pricing-model-card-header'>
                <div className='pricing-model-icon-box'>
                  <Skeleton.Avatar
                    size='large'
                    style={{ width: 48, height: 48, borderRadius: 16 }}
                  />
                </div>
                <div className='flex items-center gap-2'>
                  <Skeleton.Button
                    size='small'
                    style={{ width: 16, height: 16, borderRadius: 4 }}
                  />
                  {rowSelection && (
                    <Skeleton.Button
                      size='small'
                      style={{ width: 16, height: 16, borderRadius: 2 }}
                    />
                  )}
                </div>
              </div>

              <Skeleton.Button
                style={{
                  width: 88,
                  height: 24,
                  borderRadius: 999,
                  marginBottom: 18,
                }}
              />

              <Skeleton.Title
                style={{ width: '70%', height: 28, marginBottom: 10 }}
              />
              <Skeleton.Title
                style={{ width: '38%', height: 18, marginBottom: 14 }}
              />
              <Skeleton.Paragraph rows={2} title={false} />

              <div className='pricing-model-metrics'>
                {Array.from({ length: 3 }).map((_, metricIndex) => (
                  <div
                    key={metricIndex}
                    className='pricing-model-metric-row'
                    style={{ alignItems: 'center' }}
                  >
                    <Skeleton.Title
                      style={{ width: 88, height: 14, marginBottom: 0 }}
                    />
                    <Skeleton.Title
                      style={{ width: 128, height: 14, marginBottom: 0 }}
                    />
                  </div>
                ))}
              </div>

              <div className='pricing-model-footer'>
                {showRatio ? (
                  <Skeleton.Title
                    style={{ width: 84, height: 14, marginBottom: 0 }}
                  />
                ) : (
                  <div />
                )}
                <Skeleton.Button
                  style={{ width: '100%', height: 52, borderRadius: 18 }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className='pricing-pagination-wrap'>
        <Skeleton.Button style={{ width: 300, height: 32 }} />
      </div>
    </div>
  );

  return <Skeleton loading={true} active placeholder={placeholder}></Skeleton>;
};

export default PricingCardSkeleton;
