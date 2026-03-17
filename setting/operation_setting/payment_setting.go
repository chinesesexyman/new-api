package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type CryptoWalletConfig struct {
	Chain   string `json:"chain"`
	Label   string `json:"label"`
	Address string `json:"address"`
	Enabled bool   `json:"enabled"`
}

type CryptoTokenConfig struct {
	Method          string `json:"method"`
	ContractAddress string `json:"contract_address"`
	Decimals        int32  `json:"decimals"`
}

func defaultCryptoTokenConfigs() []CryptoTokenConfig {
	return []CryptoTokenConfig{
		{Method: "eth_usdt", ContractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7", Decimals: 6},
		{Method: "eth_usdc", ContractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", Decimals: 6},
		{Method: "solana_usdt", ContractAddress: "Es9vMFrzaCERmJfrF4H2Z1LkNnPEnTzNoKGdzRbM8h3", Decimals: 6},
		{Method: "solana_usdc", ContractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", Decimals: 6},
	}
}

type PaymentSetting struct {
	AmountOptions              []int                `json:"amount_options"`
	AmountDiscount             map[int]float64      `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	EthRPCURL                  string               `json:"eth_rpc_url"`
	SolanaRPCURL               string               `json:"solana_rpc_url"`
	CryptoOrderExpireMinutes   int                  `json:"crypto_order_expire_minutes"`
	CryptoMonitorInterval      int                  `json:"crypto_monitor_interval"`
	CryptoMonitorLookback      int                  `json:"crypto_monitor_lookback"`
	CryptoMonitorConfirmations int                  `json:"crypto_monitor_confirmations"`
	CryptoWallets              []CryptoWalletConfig `json:"crypto_wallets"`
	CryptoTokenConfigs         []CryptoTokenConfig  `json:"crypto_token_configs"`
	CryptoPaymentInstruction   string               `json:"crypto_payment_instruction"`
}

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:              []int{10, 20, 50, 100, 200, 500},
	AmountDiscount:             map[int]float64{},
	CryptoOrderExpireMinutes:   10,
	CryptoMonitorInterval:      30,
	CryptoMonitorLookback:      5000,
	CryptoMonitorConfirmations: 12,
	CryptoTokenConfigs:         defaultCryptoTokenConfigs(),
	CryptoPaymentInstruction:   "链上支付创建后，请按订单信息转账，系统将在监听到到账并确认后自动入账。",
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

func GetCryptoOrderExpireMinutes() int {
	expireMinutes := paymentSetting.CryptoOrderExpireMinutes
	if expireMinutes <= 0 {
		return 10
	}
	return expireMinutes
}

func normalizeCryptoChain(chain string) string {
	switch strings.ToLower(strings.TrimSpace(chain)) {
	case "eth", "ethereum":
		return "ethereum"
	case "sol", "solana":
		return "solana"
	default:
		return ""
	}
}

func GetCryptoChainByMethod(method string) string {
	switch strings.TrimSpace(method) {
	case "eth_usdt", "eth_usdc":
		return "ethereum"
	case "solana_usdt", "solana_usdc":
		return "solana"
	default:
		return ""
	}
}

func GetCryptoWallets() []CryptoWalletConfig {
	result := make([]CryptoWalletConfig, 0, len(paymentSetting.CryptoWallets))
	for _, item := range paymentSetting.CryptoWallets {
		item.Chain = normalizeCryptoChain(item.Chain)
		item.Label = strings.TrimSpace(item.Label)
		item.Address = strings.TrimSpace(item.Address)
		if item.Chain == "" || item.Address == "" {
			continue
		}
		if item.Label == "" {
			item.Label = item.Chain
		}
		if !item.Enabled {
			continue
		}
		result = append(result, item)
	}
	return result
}

func GetCryptoWalletsByChain(chain string) []CryptoWalletConfig {
	chain = normalizeCryptoChain(chain)
	if chain == "" {
		return nil
	}
	wallets := GetCryptoWallets()
	result := make([]CryptoWalletConfig, 0, len(wallets))
	for _, item := range wallets {
		if item.Chain == chain {
			result = append(result, item)
		}
	}
	return result
}

func GetCryptoTokenConfig(method string) *CryptoTokenConfig {
	method = strings.TrimSpace(method)
	if method == "" {
		return nil
	}
	configs := paymentSetting.CryptoTokenConfigs
	if len(configs) == 0 {
		configs = defaultCryptoTokenConfigs()
	}
	for _, item := range configs {
		if strings.TrimSpace(item.Method) != method {
			continue
		}
		cfg := item
		cfg.ContractAddress = strings.TrimSpace(cfg.ContractAddress)
		if cfg.ContractAddress == "" {
			continue
		}
		if cfg.Decimals <= 0 {
			cfg.Decimals = 6
		}
		return &cfg
	}
	for _, item := range configs {
		if strings.TrimSpace(item.Method) == method {
			cfg := item
			cfg.Decimals = 6
			return &cfg
		}
	}
	return nil
}
