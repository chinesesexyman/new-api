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

import React, { useContext, useEffect, useState } from 'react';
import { Card, Empty, Typography } from '@douyinfe/semi-ui';
import { StatusContext } from '../../context/Status';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const DOC_PATH = '/docs/model-access.md';

const ModelAccess = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const serverAddress =
    statusState?.status?.server_address || window.location.origin;
  const sdkBaseURL = `${serverAddress}/v1`;

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        const response = await fetch(DOC_PATH, { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`failed to load ${DOC_PATH}`);
        }
        const raw = await response.text();
        const parsed = raw
          .replaceAll('{{SERVER_ADDRESS}}', serverAddress)
          .replaceAll('{{SDK_BASE_URL}}', sdkBaseURL);
        setContent(parsed);
      } catch (error) {
        console.error('加载模型接入文档失败:', error);
        setContent('');
      } finally {
        setLoaded(true);
      }
    };

    loadMarkdown().then();
  }, [sdkBaseURL, serverAddress]);

  return (
    <div className='mt-[60px] px-4 py-6 md:px-8 lg:px-12'>
      <div className='mx-auto max-w-5xl'>
        <Card className='overflow-hidden'>
          <div className='mb-6 border-b border-semi-color-border pb-5'>
            <Title heading={2} style={{ marginBottom: 8 }}>
              模型接入文档
            </Title>
            <Text type='secondary'>
              文档内容读取自 `web/public/docs/model-access.md`，修改该文件后刷新页面即可生效。
            </Text>
          </div>
          {loaded && content ? (
            <MarkdownRenderer content={content} />
          ) : loaded ? (
            <Empty description={t('文档内容不存在或加载失败')} />
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default ModelAccess;
