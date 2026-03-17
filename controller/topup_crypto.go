package controller

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	PaymentMethodEthUSDT    = "eth_usdt"
	PaymentMethodEthUSDC    = "eth_usdc"
	PaymentMethodSolanaUSDT = "solana_usdt"
	PaymentMethodSolanaUSDC = "solana_usdc"
)

type CryptoPaymentMethod struct {
	Type      string
	Name      string
	ChainKey  string
	Chain     string
	Token     string
	Color     string
	MinTopUp  int64
	Precision int32
}

type CryptoTopUpPayload struct {
	Chain          string  `json:"chain"`
	Token          string  `json:"token"`
	Address        string  `json:"address"`
	BaseAmount     float64 `json:"base_amount,omitempty"`
	UniqueSuffix   float64 `json:"unique_suffix,omitempty"`
	ExpectedAmount float64 `json:"expected_amount"`
	ExpireAt       int64   `json:"expire_at,omitempty"`
	TxHash         string  `json:"tx_hash,omitempty"`
	BlockNumber    uint64  `json:"block_number,omitempty"`
	BlockTime      int64   `json:"block_time,omitempty"`
	Confirmed      bool    `json:"confirmed,omitempty"`
}

func getCryptoPaymentMethods() []CryptoPaymentMethod {
	minTopUp := getMinTopup()
	return []CryptoPaymentMethod{
		{
			Type:      PaymentMethodEthUSDT,
			Name:      "USDT (ETH)",
			ChainKey:  "ethereum",
			Chain:     "Ethereum",
			Token:     "USDT",
			Color:     "rgba(16, 185, 129, 1)",
			MinTopUp:  minTopUp,
			Precision: 6,
		},
		{
			Type:      PaymentMethodEthUSDC,
			Name:      "USDC (ETH)",
			ChainKey:  "ethereum",
			Chain:     "Ethereum",
			Token:     "USDC",
			Color:     "rgba(59, 130, 246, 1)",
			MinTopUp:  minTopUp,
			Precision: 6,
		},
		{
			Type:      PaymentMethodSolanaUSDT,
			Name:      "USDT (Solana)",
			ChainKey:  "solana",
			Chain:     "Solana",
			Token:     "USDT",
			Color:     "rgba(20, 184, 166, 1)",
			MinTopUp:  minTopUp,
			Precision: 6,
		},
		{
			Type:      PaymentMethodSolanaUSDC,
			Name:      "USDC (Solana)",
			ChainKey:  "solana",
			Chain:     "Solana",
			Token:     "USDC",
			Color:     "rgba(37, 99, 235, 1)",
			MinTopUp:  minTopUp,
			Precision: 6,
		},
	}
}

func getEnabledCryptoPaymentMethods() []CryptoPaymentMethod {
	methods := getCryptoPaymentMethods()
	enabled := make([]CryptoPaymentMethod, 0, len(methods))
	for _, method := range methods {
		if len(operation_setting.GetCryptoWalletsByChain(method.ChainKey)) > 0 && operation_setting.GetCryptoTokenConfig(method.Type) != nil {
			enabled = append(enabled, method)
		}
	}
	return enabled
}

func findCryptoPaymentMethod(methodType string) (*CryptoPaymentMethod, bool) {
	for _, method := range getEnabledCryptoPaymentMethods() {
		if method.Type == methodType {
			m := method
			return &m, true
		}
	}
	return nil, false
}

func appendCryptoPayMethods(payMethods []map[string]string) []map[string]string {
	for _, cryptoMethod := range getEnabledCryptoPaymentMethods() {
		exists := false
		for _, method := range payMethods {
			if method["type"] == cryptoMethod.Type {
				exists = true
				break
			}
		}
		if exists {
			continue
		}
		payMethods = append(payMethods, map[string]string{
			"name":      cryptoMethod.Name,
			"type":      cryptoMethod.Type,
			"color":     cryptoMethod.Color,
			"min_topup": fmt.Sprintf("%d", cryptoMethod.MinTopUp),
		})
	}
	return payMethods
}

func getCryptoPayAmountByTopupAmount(amount int64, group string, method *CryptoPaymentMethod) (float64, error) {
	if method == nil {
		return 0, fmt.Errorf("crypto payment method is nil")
	}

	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		dAmount = dAmount.Div(dQuotaPerUnit)
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}

	cryptoAmount := dAmount.
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount)).
		Round(method.Precision)
	if !cryptoAmount.IsPositive() {
		return 0, fmt.Errorf("invalid crypto amount")
	}
	value, _ := cryptoAmount.Float64()
	return value, nil
}

func getUniqueCryptoPayAmount(baseAmount float64, paymentMethod string, method *CryptoPaymentMethod) (float64, float64, error) {
	if method == nil {
		return 0, 0, fmt.Errorf("crypto payment method is nil")
	}
	base := decimal.NewFromFloat(baseAmount).Round(method.Precision)
	if !base.IsPositive() {
		return 0, 0, fmt.Errorf("invalid crypto base amount")
	}

	pendingTopups, err := model.GetPendingCryptoTopUps(0)
	if err != nil {
		return 0, 0, err
	}
	used := make(map[string]struct{}, len(pendingTopups))
	for _, topup := range pendingTopups {
		if topup == nil || topup.PaymentMethod != paymentMethod {
			continue
		}
		if isCryptoTopUpExpiredForAllocation(topup) {
			continue
		}
		payload, err := ParseCryptoTopUpPayload(topup.ProviderPayload)
		if err != nil || payload == nil || payload.ExpectedAmount <= 0 {
			continue
		}
		used[decimal.NewFromFloat(payload.ExpectedAmount).Round(method.Precision).StringFixed(method.Precision)] = struct{}{}
	}

	for range 128 {
		suffixUnits := common.GetRandomInt(9999) + 1
		suffix := decimal.NewFromInt(int64(suffixUnits)).Div(decimal.NewFromInt(1000000))
		total := base.Add(suffix).Round(method.Precision)
		key := total.StringFixed(method.Precision)
		if _, ok := used[key]; ok {
			continue
		}
		totalValue, _ := total.Float64()
		suffixValue, _ := suffix.Float64()
		return totalValue, suffixValue, nil
	}
	return 0, 0, fmt.Errorf("failed to allocate unique crypto amount")
}

func chooseCryptoWallet(paymentMethod string) (*operation_setting.CryptoWalletConfig, error) {
	chain := operation_setting.GetCryptoChainByMethod(paymentMethod)
	if chain == "" {
		return nil, fmt.Errorf("invalid crypto chain")
	}
	wallets := operation_setting.GetCryptoWalletsByChain(chain)
	if len(wallets) == 0 {
		return nil, fmt.Errorf("no crypto wallet configured")
	}

	pendingTopups, err := model.GetPendingCryptoTopUps(0)
	if err != nil {
		return nil, err
	}
	pendingCount := make(map[string]int, len(wallets))
	for _, wallet := range wallets {
		pendingCount[wallet.Address] = 0
	}
	for _, topup := range pendingTopups {
		if topup == nil {
			continue
		}
		if isCryptoTopUpExpiredForAllocation(topup) {
			continue
		}
		payload, err := ParseCryptoTopUpPayload(topup.ProviderPayload)
		if err != nil || payload == nil {
			continue
		}
		if operation_setting.GetCryptoChainByMethod(topup.PaymentMethod) != chain {
			continue
		}
		address := strings.TrimSpace(payload.Address)
		if _, ok := pendingCount[address]; ok {
			pendingCount[address]++
		}
	}

	selected := wallets[0]
	selectedCount := pendingCount[selected.Address]
	for _, wallet := range wallets[1:] {
		if count := pendingCount[wallet.Address]; count < selectedCount {
			selected = wallet
			selectedCount = count
		}
	}
	return &selected, nil
}

func isCryptoTopUpExpiredForAllocation(topup *model.TopUp) bool {
	if topup == nil || topup.Status != common.TopUpStatusPending {
		return false
	}
	payload, err := ParseCryptoTopUpPayload(topup.ProviderPayload)
	if err == nil && payload != nil && payload.ExpireAt > 0 {
		return time.Now().Unix() >= payload.ExpireAt
	}
	expireMinutes := operation_setting.GetCryptoOrderExpireMinutes()
	return time.Now().Unix() >= topup.CreateTime+int64(expireMinutes*60)
}

func requestCryptoPay(c *gin.Context, req *EpayRequest, payMoney float64, group string) {
	cryptoMethod, ok := findCryptoPaymentMethod(req.PaymentMethod)
	if !ok {
		c.JSON(200, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	baseCryptoAmount, err := getCryptoPayAmountByTopupAmount(req.Amount, group, cryptoMethod)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "数字货币支付配置错误"})
		return
	}
	selectedWallet, err := chooseCryptoWallet(req.PaymentMethod)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "数字货币收款地址未配置"})
		return
	}
	cryptoAmount, uniqueSuffix, err := getUniqueCryptoPayAmount(baseCryptoAmount, req.PaymentMethod, cryptoMethod)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "生成唯一支付金额失败"})
		return
	}

	id := c.GetInt("id")
	tradeNo := fmt.Sprintf("CRYPTO-UID%d-%d-%s", id, time.Now().Unix(), common.GetRandomString(6))
	expireAt := time.Now().Unix() + int64(operation_setting.GetCryptoOrderExpireMinutes()*60)

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(req.Amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   req.PaymentMethod,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		ProviderPayload: buildCryptoTopUpPayload(cryptoMethod, selectedWallet, baseCryptoAmount, uniqueSuffix, cryptoAmount, expireAt),
	}
	if err = topUp.Insert(); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	instruction := strings.TrimSpace(operation_setting.GetPaymentSetting().CryptoPaymentInstruction)
	if instruction == "" {
		instruction = "链上支付创建后，请按订单信息转账，系统将在监听到到账并确认后自动入账。"
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data":    buildCryptoPaymentResponse(cryptoMethod, selectedWallet.Label, tradeNo, selectedWallet.Address, cryptoAmount, baseCryptoAmount, uniqueSuffix, expireAt, payMoney, instruction),
	})
}

func resumeCryptoTopUp(c *gin.Context, topUp *model.TopUp) {
	if topUp == nil {
		c.JSON(200, gin.H{"message": "error", "data": "订单不存在"})
		return
	}

	cryptoMethod, ok := findCryptoPaymentMethod(topUp.PaymentMethod)
	if !ok {
		c.JSON(200, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	payload, err := ParseCryptoTopUpPayload(topUp.ProviderPayload)
	if err != nil || payload == nil {
		c.JSON(200, gin.H{"message": "error", "data": "订单支付信息缺失"})
		return
	}

	if isCryptoTopUpExpiredForAllocation(topUp) {
		_ = model.ExpireCryptoTopUp(topUp.TradeNo)
		c.JSON(200, gin.H{"message": "error", "data": "订单已过期，请重新创建支付订单"})
		return
	}

	addressLabel := ""
	for _, wallet := range operation_setting.GetCryptoWalletsByChain(cryptoMethod.ChainKey) {
		if strings.EqualFold(strings.TrimSpace(wallet.Address), strings.TrimSpace(payload.Address)) {
			addressLabel = wallet.Label
			break
		}
	}

	instruction := strings.TrimSpace(operation_setting.GetPaymentSetting().CryptoPaymentInstruction)
	if instruction == "" {
		instruction = "链上支付创建后，请按订单信息转账，系统将在监听到到账并确认后自动入账。"
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data": buildCryptoPaymentResponse(
			cryptoMethod,
			addressLabel,
			topUp.TradeNo,
			payload.Address,
			payload.ExpectedAmount,
			payload.BaseAmount,
			payload.UniqueSuffix,
			payload.ExpireAt,
			topUp.Money,
			instruction,
		),
	})
}

func buildCryptoPaymentResponse(method *CryptoPaymentMethod, addressLabel string, tradeNo string, address string, amount float64, baseAmount float64, uniqueSuffix float64, expireAt int64, payMoney float64, instruction string) gin.H {
	return gin.H{
		"payment_type":  "crypto",
		"trade_no":      tradeNo,
		"chain":         method.Chain,
		"token":         method.Token,
		"address":       address,
		"address_label": addressLabel,
		"amount":        amount,
		"base_amount":   baseAmount,
		"unique_suffix": uniqueSuffix,
		"expire_at":     expireAt,
		"amount_fiat":   payMoney,
		"instruction":   instruction,
	}
}

func buildCryptoTopUpPayload(method *CryptoPaymentMethod, wallet *operation_setting.CryptoWalletConfig, baseAmount float64, uniqueSuffix float64, cryptoAmount float64, expireAt int64) string {
	if method == nil || wallet == nil {
		return ""
	}
	payload := CryptoTopUpPayload{
		Chain:          method.Chain,
		Token:          method.Token,
		Address:        wallet.Address,
		BaseAmount:     baseAmount,
		UniqueSuffix:   uniqueSuffix,
		ExpectedAmount: cryptoAmount,
		ExpireAt:       expireAt,
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return ""
	}
	return string(data)
}

func ParseCryptoTopUpPayload(payload string) (*CryptoTopUpPayload, error) {
	if strings.TrimSpace(payload) == "" {
		return nil, nil
	}
	var info CryptoTopUpPayload
	if err := common.UnmarshalJsonStr(payload, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func (p *CryptoTopUpPayload) MarshalString() string {
	if p == nil {
		return ""
	}
	data, err := common.Marshal(p)
	if err != nil {
		return ""
	}
	return string(data)
}
