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
import { Button, Typography, Card, Tag, Avatar } from '@douyinfe/semi-ui';
import { API, showError, getLobeHubIcon } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { IconGithubLogo, IconPlay, IconFile } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';

const { Text } = Typography;

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [homePageVendors, setHomePageVendors] = useState([]);
  const [recommendedModels, setRecommendedModels] = useState([]);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const isChinese = i18n.language.startsWith('zh');

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      // 如果内容是 URL，则发送主题模式
      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const loadHomePageVendors = async () => {
    try {
      const res = await API.get('/api/pricing');
      const { success, data, vendors } = res.data;

      if (!success) {
        return;
      }

      const usedVendorIds = new Set();
      if (Array.isArray(data)) {
        data.forEach((model) => {
          if (model?.vendor_id) {
            usedVendorIds.add(model.vendor_id);
          }
        });
      }

      const filteredVendors = Array.isArray(vendors)
        ? vendors.filter((vendor) => usedVendorIds.has(vendor.id))
        : [];

      filteredVendors.sort((a, b) => a.name.localeCompare(b.name));
      setHomePageVendors(filteredVendors);
    } catch (error) {
      console.error('获取首页供应商失败:', error);
    }
  };

  const loadRecommendedModels = async () => {
    try {
      const res = await API.get('/api/pricing/recommended');
      const { success, data, vendors } = res.data;
      if (!success || !Array.isArray(data)) {
        setRecommendedModels([]);
        return;
      }
      const vendorMap = {};
      if (Array.isArray(vendors)) {
        vendors.forEach((vendor) => {
          vendorMap[vendor.id] = vendor;
        });
      }
      const formattedModels = data.slice(0, 6).map((model) => {
        const vendor = vendorMap[model.vendor_id];
        return {
          ...model,
          vendor_name: vendor?.name || '',
          vendor_icon: vendor?.icon || '',
        };
      });
      setRecommendedModels(formattedModels);
    } catch (error) {
      console.error('获取推荐模型失败:', error);
      setRecommendedModels([]);
    }
  };

  const renderModelIcon = (model) => {
    if (model?.icon) {
      return getLobeHubIcon(model.icon, 28);
    }
    if (model?.vendor_icon) {
      return getLobeHubIcon(model.vendor_icon, 28);
    }
    return (
      <Avatar
        size='small'
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {model?.model_name?.slice(0, 2)?.toUpperCase() || '?'}
      </Avatar>
    );
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
    loadHomePageVendors().then();
    loadRecommendedModels().then();
  }, []);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          {/* Banner 部分 */}
          <div className='w-full border-b border-semi-color-border min-h-[500px] md:min-h-[600px] lg:min-h-[700px] relative overflow-x-hidden'>
            {/* 背景模糊晕染球 */}
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />
            <div className='flex items-center justify-center h-full px-4 py-20 md:py-24 lg:py-32 mt-10'>
              {/* 居中内容区 */}
              <div className='flex flex-col items-center justify-center text-center max-w-4xl mx-auto'>
                <div className='flex flex-col items-center justify-center mb-6 md:mb-8'>
                  <h1
                    className={`text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-semi-color-text-0 leading-tight ${isChinese ? 'tracking-wide md:tracking-wider' : ''}`}
                  >
                    <>
                      {t('连接全球 AI 模型的')}
                      <br />
                      <span className='shine-text'>{t('一站式服务平台')}</span>
                    </>
                  </h1>
                  <p className='text-base md:text-lg lg:text-xl text-semi-color-text-1 mt-4 md:mt-6 max-w-xl'>
                    {t(
                      '一站式 API 接入， 覆盖 OpenAI、Anthropic、Google 等300 + 顶尖 AI 模型。更低成本、更高稳定、更快响应。',
                    )}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className='flex flex-row gap-4 justify-center items-center'>
                  <Link to='/console/token'>
                    <Button
                      theme='solid'
                      type='primary'
                      size={isMobile ? 'default' : 'large'}
                      className='home-hero-primary-btn !rounded-3xl !w-[190px] md:!w-[220px] !h-[48px] md:!h-[54px] !text-base md:!text-lg !font-semibold'
                      icon={<IconPlay />}
                    >
                      {t('获取API Key')}
                    </Button>
                  </Link>
                  {isDemoSiteMode && statusState?.status?.version ? (
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='flex items-center !rounded-3xl px-6 py-2'
                      icon={<IconGithubLogo />}
                      onClick={() =>
                        window.open(
                          'https://github.com/QuantumNous/new-api',
                          '_blank',
                        )
                      }
                    >
                      {statusState.status.version}
                    </Button>
                  ) : (
                    <Link to='/docs/model-access'>
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='home-hero-secondary-btn flex items-center justify-center !rounded-3xl !w-[190px] md:!w-[220px] !h-[48px] md:!h-[54px] !text-base md:!text-lg !font-semibold'
                        icon={<IconFile />}
                      >
                        {t('API文档')}
                      </Button>
                    </Link>
                  )}
                </div>

                {recommendedModels.length > 0 && (
                  <div className='mt-10 md:mt-12 w-full max-w-6xl'>
                    <div className='flex items-center justify-between gap-4 mb-4 px-1'>
                      <div className='text-left'>
                        <Text className='text-lg md:text-xl font-semibold text-semi-color-text-0'>
                          {t('推荐模型')}
                        </Text>
                      </div>
                      <Link to='/pricing'>
                        <Button
                          theme='borderless'
                          type='primary'
                          className='!rounded-full !text-[#6d28d9] hover:!text-[#5b21b6] hover:!bg-[#f5f3ff] dark:!text-[#c4b5fd] dark:hover:!text-[#ddd6fe] dark:hover:!bg-[#24113f]'
                        >
                          {t('查看全部')}
                        </Button>
                      </Link>
                    </div>
                    <div className='flex gap-4 overflow-x-auto scrollbar-hide px-1 pb-2 snap-x snap-mandatory'>
                      {recommendedModels.map((model) => (
                        <Link
                          key={model.model_name}
                          to='/pricing'
                          className='block shrink-0 w-[280px] md:w-[320px] snap-start'
                        >
                          <Card
                            className='!rounded-3xl border-0 shadow-sm hover:shadow-lg transition-all duration-200 h-full text-left backdrop-blur-sm'
                            bodyStyle={{ padding: 20, height: '100%' }}
                          >
                            <div className='flex flex-col h-full'>
                              <div className='flex items-start justify-between gap-3 mb-4'>
                                <div className='flex items-center gap-3 min-w-0'>
                                  <div className='w-10 h-10 rounded-2xl bg-white/80 dark:bg-black/20 shadow-sm flex items-center justify-center shrink-0'>
                                    {renderModelIcon(model)}
                                  </div>
                                  <div className='min-w-0'>
                                    <div className='text-base font-semibold text-semi-color-text-0 leading-6 min-h-[48px] line-clamp-2 break-words'>
                                      {model.model_name}
                                    </div>
                                    <div className='text-xs text-semi-color-text-2 truncate'>
                                      {model.vendor_name || t('精选模型')}
                                    </div>
                                  </div>
                                </div>
                                {model.tags ? (
                                  <div className='flex flex-wrap justify-end gap-2 shrink-0 max-w-[45%]'>
                                    {model.tags
                                      .split(',')
                                      .filter(Boolean)
                                      .slice(0, 3)
                                      .map((tag) => (
                                        <Tag
                                          key={`${model.model_name}-${tag}`}
                                          size='small'
                                          shape='circle'
                                          className='pricing-model-pill'
                                        >
                                          {tag}
                                        </Tag>
                                      ))}
                                  </div>
                                ) : null}
                              </div>
                              {model.description ? (
                                <div className='text-sm text-semi-color-text-1 leading-6 min-h-[48px] line-clamp-2'>
                                  {model.description}
                                </div>
                              ) : null}
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* 框架兼容性图标 */}
                <div className='mt-12 md:mt-16 lg:mt-20 w-full'>
                  <div className='flex items-center mb-6 md:mb-8 justify-center'>
                    <Text
                      type='tertiary'
                      className='text-lg md:text-xl lg:text-2xl font-light'
                    >
                      {t('支持模型')}
                    </Text>
                  </div>
                  <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 max-w-5xl mx-auto px-4'>
                    {homePageVendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'
                        title={vendor.name}
                      >
                        {vendor.icon ? (
                          getLobeHubIcon(vendor.icon, 40)
                        ) : (
                          <Typography.Text className='!text-sm sm:!text-base md:!text-lg font-semibold'>
                            {vendor.name?.charAt(0)?.toUpperCase() || '?'}
                          </Typography.Text>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
