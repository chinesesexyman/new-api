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

import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Form,
  Row,
  Col,
  Typography,
  Spin,
  Select,
  Space,
  Switch,
  Input,
  InputNumber,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';
const { Text } = Typography;
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGateway(props) {
  const { t } = useTranslation();
  const cryptoChainOptions = [
    { label: 'Ethereum', value: 'ethereum' },
    { label: 'Solana', value: 'solana' },
  ];
  const cryptoMethodOptions = [
    { label: 'USDT (ETH)', value: 'eth_usdt' },
    { label: 'USDC (ETH)', value: 'eth_usdc' },
    { label: 'USDT (Solana)', value: 'solana_usdt' },
    { label: 'USDC (Solana)', value: 'solana_usdc' },
  ];
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    PayAddress: '',
    EpayId: '',
    EpayKey: '',
    Price: 1,
    MinTopUp: 1,
    TopupGroupRatio: '',
    CustomCallbackAddress: '',
    PayMethods: '',
    AmountOptions: '',
    AmountDiscount: '',
    EthRPCURL: '',
    SolanaRPCURL: '',
    CryptoOrderExpireMinutes: 10,
    CryptoMonitorInterval: 30,
    CryptoMonitorLookback: 5000,
    CryptoMonitorConfirmations: 12,
    CryptoWallets: '',
    CryptoTokenConfigs: '',
  });
  const [cryptoWalletRows, setCryptoWalletRows] = useState([]);
  const [cryptoTokenRows, setCryptoTokenRows] = useState([]);
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  const parseJSONArray = (value, fallback = []) => {
    if (!value || !value.trim()) return fallback;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const toPrettyJSON = (value) => JSON.stringify(value, null, 2);

  const normalizeCryptoWalletRows = (rows) =>
    rows
      .filter((item) => item.chain && item.address && item.enabled !== undefined)
      .map((item) => ({
        chain: item.chain,
        label: item.label || '',
        address: item.address,
        enabled: item.enabled !== false,
      }));

  const normalizeCryptoTokenRows = (rows) =>
    rows
      .filter((item) => item.method && item.contract_address)
      .map((item) => ({
        method: item.method,
        contract_address: item.contract_address,
        decimals: Number(item.decimals ?? 6),
      }));

  const serializeCryptoWalletRows = (rows) =>
    toPrettyJSON(normalizeCryptoWalletRows(rows));

  const serializeCryptoTokenRows = (rows) =>
    toPrettyJSON(normalizeCryptoTokenRows(rows));

  const validateCryptoWalletRows = () => {
    const seen = new Set();
    for (let index = 0; index < cryptoWalletRows.length; index++) {
      const row = cryptoWalletRows[index];
      const chain = (row.chain || '').trim();
      const label = (row.label || '').trim();
      const address = (row.address || '').trim();
      const enabled = row.enabled !== false;
      const hasAnyValue = chain || label || address || enabled;

      if (!hasAnyValue) {
        continue;
      }
      if (!chain || !address) {
        return t('收款钱包池存在未填写完整的行，请填写链和收款地址');
      }

      const key = `${chain}::${address.toLowerCase()}`;
      if (seen.has(key)) {
        return t('收款钱包池中存在重复的钱包地址配置');
      }
      seen.add(key);
    }
    return '';
  };

  const validateCryptoTokenRows = () => {
    const seenMethods = new Set();
    for (let index = 0; index < cryptoTokenRows.length; index++) {
      const row = cryptoTokenRows[index];
      const method = (row.method || '').trim();
      const contractAddress = (row.contract_address || '').trim();
      const decimals = Number(row.decimals);
      const hasAnyValue =
        method || contractAddress || row.decimals !== undefined;

      if (!hasAnyValue) {
        continue;
      }
      if (!method || !contractAddress) {
        return t('代币配置存在未填写完整的行，请填写支付方式和合约地址');
      }
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
        return t('代币配置中的精度必须是 0 到 18 之间的整数');
      }
      if (seenMethods.has(method)) {
        return t('代币配置中存在重复的支付方式');
      }
      seenMethods.add(method);
    }
    return '';
  };

  const syncCryptoWallets = (rows) => {
    setCryptoWalletRows(rows);
    setInputs((prev) => ({
      ...prev,
      CryptoWallets: serializeCryptoWalletRows(rows),
    }));
  };

  const syncCryptoTokens = (rows) => {
    setCryptoTokenRows(rows);
    setInputs((prev) => ({
      ...prev,
      CryptoTokenConfigs: serializeCryptoTokenRows(rows),
    }));
  };

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        PayAddress: props.options.PayAddress || '',
        EpayId: props.options.EpayId || '',
        EpayKey: props.options.EpayKey || '',
        Price:
          props.options.Price !== undefined
            ? parseFloat(props.options.Price)
            : 7.3,
        MinTopUp:
          props.options.MinTopUp !== undefined
            ? parseFloat(props.options.MinTopUp)
            : 1,
        TopupGroupRatio: props.options.TopupGroupRatio || '',
        CustomCallbackAddress: props.options.CustomCallbackAddress || '',
        PayMethods: props.options.PayMethods || '',
        AmountOptions: props.options.AmountOptions || '',
        AmountDiscount: props.options.AmountDiscount || '',
        EthRPCURL: props.options.EthRPCURL || '',
        SolanaRPCURL: props.options.SolanaRPCURL || '',
        CryptoOrderExpireMinutes:
          props.options.CryptoOrderExpireMinutes !== undefined
            ? parseFloat(props.options.CryptoOrderExpireMinutes)
            : 10,
        CryptoMonitorInterval:
          props.options.CryptoMonitorInterval !== undefined
            ? parseFloat(props.options.CryptoMonitorInterval)
            : 30,
        CryptoMonitorLookback:
          props.options.CryptoMonitorLookback !== undefined
            ? parseFloat(props.options.CryptoMonitorLookback)
            : 5000,
        CryptoMonitorConfirmations:
          props.options.CryptoMonitorConfirmations !== undefined
            ? parseFloat(props.options.CryptoMonitorConfirmations)
            : 12,
        CryptoWallets: props.options.CryptoWallets || '',
        CryptoTokenConfigs: props.options.CryptoTokenConfigs || '',
      };

      // 美化 JSON 展示
      try {
        if (currentInputs.AmountOptions) {
          currentInputs.AmountOptions = JSON.stringify(
            JSON.parse(currentInputs.AmountOptions),
            null,
            2,
          );
        }
      } catch {}
      try {
        if (currentInputs.AmountDiscount) {
          currentInputs.AmountDiscount = JSON.stringify(
            JSON.parse(currentInputs.AmountDiscount),
            null,
            2,
          );
        }
      } catch {}
      try {
        if (currentInputs.CryptoWallets) {
          currentInputs.CryptoWallets = JSON.stringify(
            JSON.parse(currentInputs.CryptoWallets),
            null,
            2,
          );
        }
      } catch {}
      try {
        if (currentInputs.CryptoTokenConfigs) {
          currentInputs.CryptoTokenConfigs = JSON.stringify(
            JSON.parse(currentInputs.CryptoTokenConfigs),
            null,
            2,
          );
        }
      } catch {}

      setInputs(currentInputs);
      setCryptoWalletRows(
        parseJSONArray(currentInputs.CryptoWallets, []).map((item) => ({
          chain: item.chain || '',
          label: item.label || '',
          address: item.address || '',
          enabled: item.enabled !== false,
        })),
      );
      setCryptoTokenRows(
        parseJSONArray(currentInputs.CryptoTokenConfigs, []).map((item) => ({
          method: item.method || '',
          contract_address: item.contract_address || '',
          decimals:
            item.decimals !== undefined && item.decimals !== null
              ? Number(item.decimals)
              : 6,
        })),
      );
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs((prev) => ({
      ...prev,
      ...values,
      CryptoWallets:
        values.CryptoWallets !== undefined
          ? values.CryptoWallets
          : prev.CryptoWallets,
      CryptoTokenConfigs:
        values.CryptoTokenConfigs !== undefined
          ? values.CryptoTokenConfigs
          : prev.CryptoTokenConfigs,
    }));
  };

  const updateWalletRow = (index, patch) => {
    const nextRows = cryptoWalletRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    syncCryptoWallets(nextRows);
  };

  const addWalletRow = () => {
    syncCryptoWallets([
      ...cryptoWalletRows,
      {
        chain: 'ethereum',
        label: '',
        address: '',
        enabled: true,
      },
    ]);
  };

  const removeWalletRow = (index) => {
    syncCryptoWallets(cryptoWalletRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const updateTokenRow = (index, patch) => {
    const nextRows = cryptoTokenRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    syncCryptoTokens(nextRows);
  };

  const addTokenRow = () => {
    syncCryptoTokens([
      ...cryptoTokenRows,
      {
        method: 'eth_usdt',
        contract_address: '',
        decimals: 6,
      },
    ]);
  };

  const removeTokenRow = (index) => {
    syncCryptoTokens(cryptoTokenRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const submitPayAddress = async () => {
    if (props.options.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    const walletValidationError = validateCryptoWalletRows();
    if (walletValidationError) {
      showError(walletValidationError);
      return;
    }

    const tokenValidationError = validateCryptoTokenRows();
    if (tokenValidationError) {
      showError(tokenValidationError);
      return;
    }

    const cryptoWalletsValue = serializeCryptoWalletRows(cryptoWalletRows);
    const cryptoTokenConfigsValue = serializeCryptoTokenRows(cryptoTokenRows);

    if (originInputs['TopupGroupRatio'] !== inputs.TopupGroupRatio) {
      if (!verifyJSON(inputs.TopupGroupRatio)) {
        showError(t('充值分组倍率不是合法的 JSON 字符串'));
        return;
      }
    }

    if (originInputs['PayMethods'] !== inputs.PayMethods) {
      if (!verifyJSON(inputs.PayMethods)) {
        showError(t('充值方式设置不是合法的 JSON 字符串'));
        return;
      }
    }

    if (
      originInputs['AmountOptions'] !== inputs.AmountOptions &&
      inputs.AmountOptions.trim() !== ''
    ) {
      if (!verifyJSON(inputs.AmountOptions)) {
        showError(t('自定义充值数量选项不是合法的 JSON 数组'));
        return;
      }
    }

    if (
      originInputs['AmountDiscount'] !== inputs.AmountDiscount &&
      inputs.AmountDiscount.trim() !== ''
    ) {
      if (!verifyJSON(inputs.AmountDiscount)) {
        showError(t('充值金额折扣配置不是合法的 JSON 对象'));
        return;
      }
    }

    setLoading(true);
    try {
      const options = [
        { key: 'PayAddress', value: removeTrailingSlash(inputs.PayAddress) },
      ];

      if (inputs.EpayId !== '') {
        options.push({ key: 'EpayId', value: inputs.EpayId });
      }
      if (inputs.EpayKey !== undefined && inputs.EpayKey !== '') {
        options.push({ key: 'EpayKey', value: inputs.EpayKey });
      }
      if (inputs.Price !== '') {
        options.push({ key: 'Price', value: inputs.Price.toString() });
      }
      if (inputs.MinTopUp !== '') {
        options.push({ key: 'MinTopUp', value: inputs.MinTopUp.toString() });
      }
      if (inputs.CustomCallbackAddress !== '') {
        options.push({
          key: 'CustomCallbackAddress',
          value: inputs.CustomCallbackAddress,
        });
      }
      if (originInputs['TopupGroupRatio'] !== inputs.TopupGroupRatio) {
        options.push({ key: 'TopupGroupRatio', value: inputs.TopupGroupRatio });
      }
      if (originInputs['PayMethods'] !== inputs.PayMethods) {
        options.push({ key: 'PayMethods', value: inputs.PayMethods });
      }
      if (originInputs['AmountOptions'] !== inputs.AmountOptions) {
        options.push({
          key: 'payment_setting.amount_options',
          value: inputs.AmountOptions,
        });
      }
      if (originInputs['AmountDiscount'] !== inputs.AmountDiscount) {
        options.push({
          key: 'payment_setting.amount_discount',
          value: inputs.AmountDiscount,
        });
      }
      if (originInputs['EthRPCURL'] !== inputs.EthRPCURL) {
        options.push({
          key: 'payment_setting.eth_rpc_url',
          value: inputs.EthRPCURL,
        });
      }
      if (originInputs['SolanaRPCURL'] !== inputs.SolanaRPCURL) {
        options.push({
          key: 'payment_setting.solana_rpc_url',
          value: inputs.SolanaRPCURL,
        });
      }
      if (
        originInputs['CryptoOrderExpireMinutes'] !==
        inputs.CryptoOrderExpireMinutes
      ) {
        options.push({
          key: 'payment_setting.crypto_order_expire_minutes',
          value: String(inputs.CryptoOrderExpireMinutes),
        });
      }
      if (
        originInputs['CryptoMonitorInterval'] !== inputs.CryptoMonitorInterval
      ) {
        options.push({
          key: 'payment_setting.crypto_monitor_interval',
          value: String(inputs.CryptoMonitorInterval),
        });
      }
      if (
        originInputs['CryptoMonitorLookback'] !== inputs.CryptoMonitorLookback
      ) {
        options.push({
          key: 'payment_setting.crypto_monitor_lookback',
          value: String(inputs.CryptoMonitorLookback),
        });
      }
      if (
        originInputs['CryptoMonitorConfirmations'] !==
        inputs.CryptoMonitorConfirmations
      ) {
        options.push({
          key: 'payment_setting.crypto_monitor_confirmations',
          value: String(inputs.CryptoMonitorConfirmations),
        });
      }
      options.push({
        key: 'payment_setting.crypto_wallets',
        value: cryptoWalletsValue,
      });
      options.push({
        key: 'payment_setting.crypto_token_configs',
        value: cryptoTokenConfigsValue,
      });
      // 发送请求
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        // 更新本地存储的原始值
        setOriginInputs({
          ...inputs,
          CryptoWallets: cryptoWalletsValue,
          CryptoTokenConfigs: cryptoTokenConfigsValue,
        });
        props.refresh && props.refresh();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('支付设置')}>
          <Text>
            {t(
              '（支持易支付与链上稳定币支付；链上订单会在监听到到账并确认后自动入账。）',
            )}
          </Text>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='PayAddress'
                label={t('支付地址')}
                placeholder={t('例如：https://yourdomain.com')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='EpayId'
                label={t('易支付商户ID')}
                placeholder={t('例如：0001')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='EpayKey'
                label={t('易支付商户密钥')}
                placeholder={t('敏感信息不会发送到前端显示')}
                type='password'
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='CustomCallbackAddress'
                label={t('回调地址')}
                placeholder={t('例如：https://yourdomain.com')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='Price'
                precision={2}
                label={t('充值价格（USD / 额度单位）')}
                placeholder={t('例如：1，就是每 1 美元额度按 1 美元计价')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='MinTopUp'
                label={t('最低充值美元数量')}
                placeholder={t('例如：2，就是最低充值2$')}
              />
            </Col>
          </Row>
          <Form.TextArea
            field='TopupGroupRatio'
            label={t('充值分组倍率')}
            placeholder={t('为一个 JSON 文本，键为组名称，值为倍率')}
            autosize
          />
          <Form.TextArea
            field='PayMethods'
            label={t('充值方式设置')}
            placeholder={t('为一个 JSON 文本')}
            autosize
          />
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='EthRPCURL'
                label={t('ETH RPC 地址')}
                placeholder={t('例如：https://mainnet.infura.io/v3/xxx')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SolanaRPCURL'
                label={t('Solana RPC 地址')}
                placeholder={t('例如：https://api.mainnet-beta.solana.com')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='CryptoOrderExpireMinutes'
                label={t('数字货币订单过期时间（分钟）')}
                min={1}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='CryptoMonitorInterval'
                label={t('监听轮询间隔（秒）')}
                min={5}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='CryptoMonitorLookback'
                label={t('监听回溯范围')}
                min={10}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='CryptoMonitorConfirmations'
                label={t('ETH 确认块数')}
                min={0}
              />
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <div className='flex items-center justify-between mb-3'>
              <Text strong>{t('数字货币收款钱包池')}</Text>
              <Button icon={<IconPlus />} theme='light' onClick={addWalletRow}>
                {t('新增钱包')}
              </Button>
            </div>
            <Text type='secondary'>
              {t(
                '按链配置钱包池，同一链地址同时接收 USDT 和 USDC；Solana 填主地址即可，系统会自动识别对应代币账户。',
              )}
            </Text>
            <div className='space-y-3 mt-3'>
              {cryptoWalletRows.length === 0 ? (
                <div className='text-gray-500 text-sm p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300'>
                  {t('暂无钱包配置，点击右上角新增钱包')}
                </div>
              ) : (
                cryptoWalletRows.map((row, index) => (
                  <div
                    key={`wallet-${index}`}
                    className='rounded-lg border border-gray-200 p-3'
                  >
                    <Row gutter={12} align='middle'>
                      <Col xs={24} md={6}>
                        <Select
                          value={row.chain}
                          optionList={cryptoChainOptions}
                          onChange={(value) =>
                            updateWalletRow(index, { chain: value })
                          }
                          placeholder={t('链')}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col xs={24} md={5}>
                        <Input
                          value={row.label}
                          placeholder={t('钱包标签')}
                          onChange={(value) =>
                            updateWalletRow(index, { label: value })
                          }
                        />
                      </Col>
                      <Col xs={24} md={9}>
                        <Input
                          value={row.address}
                          placeholder={t('收款地址')}
                          onChange={(value) =>
                            updateWalletRow(index, { address: value })
                          }
                        />
                      </Col>
                      <Col xs={12} md={2}>
                        <Space>
                          <Text>{t('启用')}</Text>
                          <Switch
                            checked={row.enabled}
                            onChange={(checked) =>
                              updateWalletRow(index, { enabled: checked })
                            }
                          />
                        </Space>
                      </Col>
                      <Col xs={12} md={2}>
                        <Button
                          icon={<IconDelete />}
                          theme='borderless'
                          type='danger'
                          onClick={() => removeWalletRow(index)}
                        />
                      </Col>
                    </Row>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className='flex items-center justify-between mb-3'>
              <Text strong>{t('数字货币代币配置')}</Text>
              <Button icon={<IconPlus />} theme='light' onClick={addTokenRow}>
                {t('新增代币')}
              </Button>
            </div>
            <Text type='secondary'>
              {t(
                '可自定义 ETH 合约地址或 Solana mint 地址，方便测试网或自定义稳定币环境。',
              )}
            </Text>
            <div className='space-y-3 mt-3'>
              {cryptoTokenRows.length === 0 ? (
                <div className='text-gray-500 text-sm p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300'>
                  {t('暂无代币配置，点击右上角新增代币')}
                </div>
              ) : (
                cryptoTokenRows.map((row, index) => (
                  <div
                    key={`token-${index}`}
                    className='rounded-lg border border-gray-200 p-3'
                  >
                    <Row gutter={12} align='middle'>
                      <Col xs={24} md={6}>
                        <Select
                          value={row.method}
                          optionList={cryptoMethodOptions}
                          onChange={(value) =>
                            updateTokenRow(index, { method: value })
                          }
                          placeholder={t('支付方式')}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col xs={24} md={12}>
                        <Input
                          value={row.contract_address}
                          placeholder={t('合约地址 / Mint 地址')}
                          onChange={(value) =>
                            updateTokenRow(index, { contract_address: value })
                          }
                        />
                      </Col>
                      <Col xs={12} md={4}>
                        <InputNumber
                          value={row.decimals}
                          min={0}
                          max={18}
                          placeholder={t('精度')}
                          onChange={(value) =>
                            updateTokenRow(index, { decimals: Number(value || 0) })
                          }
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col xs={12} md={2}>
                        <Button
                          icon={<IconDelete />}
                          theme='borderless'
                          type='danger'
                          onClick={() => removeTokenRow(index)}
                        />
                      </Col>
                    </Row>
                  </div>
                ))
              )}
            </div>
          </div>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AmountOptions'
                label={t('自定义充值数量选项')}
                placeholder={t(
                  '为一个 JSON 数组，例如：[10, 20, 50, 100, 200, 500]',
                )}
                autosize
                extraText={t(
                  '设置用户可选择的充值数量选项，例如：[10, 20, 50, 100, 200, 500]',
                )}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AmountDiscount'
                label={t('充值金额折扣配置')}
                placeholder={t(
                  '为一个 JSON 对象，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
                autosize
                extraText={t(
                  '设置不同充值金额对应的折扣，键为充值金额，值为折扣率，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
              />
            </Col>
          </Row>

          <Button onClick={submitPayAddress}>{t('更新支付设置')}</Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
