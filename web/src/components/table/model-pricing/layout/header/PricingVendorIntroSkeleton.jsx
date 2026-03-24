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

import React, { memo } from 'react';
import { Skeleton } from '@douyinfe/semi-ui';

const PricingVendorIntroSkeleton = memo(() => {
  return (
    <div className='pricing-hero-shell'>
      <div className='pricing-hero-panel'>
        <Skeleton.Title style={{ width: 96, height: 28, marginBottom: 16 }} />
        <Skeleton.Title
          style={{ width: 'min(520px, 100%)', height: 52, marginBottom: 18 }}
        />
        <Skeleton.Paragraph
          rows={2}
          title={false}
          style={{ width: 'min(680px, 100%)', marginBottom: 18 }}
        />
      </div>

      <div className='pricing-toolbar'>
        <Skeleton.Button
          style={{ width: '100%', height: 64, borderRadius: 22, flex: 1 }}
        />
        <Skeleton.Button style={{ width: 150, height: 64, borderRadius: 20 }} />
      </div>

      <div className='pricing-provider-strip'>
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton.Button
            key={index}
            style={{
              width: 120 + (index % 3) * 12,
              height: 46,
              borderRadius: 999,
            }}
          />
        ))}
      </div>
    </div>
  );
});

PricingVendorIntroSkeleton.displayName = 'PricingVendorIntroSkeleton';

export default PricingVendorIntroSkeleton;
