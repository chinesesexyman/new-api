package service

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"sync"
)

const (
	cryptoMethodEthUSDT    = "eth_usdt"
	cryptoMethodEthUSDC    = "eth_usdc"
	cryptoMethodSolanaUSDT = "solana_usdt"
	cryptoMethodSolanaUSDC = "solana_usdc"
)

const (
	erc20TransferEventTopic   = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
	defaultCryptoMonitorLimit = 200
	solanaTokenProgramID      = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
)

type cryptoPendingOrder struct {
	TopUp         *model.TopUp
	Method        string
	Chain         string
	Token         string
	Address       string
	Expected      string
	ExpectedFloat float64
}

type cryptoTransfer struct {
	Method      string
	Amount      string
	AmountFloat float64
	TxHash      string
	BlockNumber uint64
	Slot        uint64
	BlockTime   int64
}

var (
	cryptoMonitorOnce sync.Once
)

func StartCryptoPaymentMonitorTask() {
	cryptoMonitorOnce.Do(func() {
		go func() {
			logger.LogInfo(context.Background(), "crypto payment monitor task started")
			for {
				runCryptoPaymentMonitorOnce(context.Background())
				interval := operation_setting.GetPaymentSetting().CryptoMonitorInterval
				if interval <= 0 {
					interval = 30
				}
				time.Sleep(time.Duration(interval) * time.Second)
			}
		}()
	})
}

func runCryptoPaymentMonitorOnce(ctx context.Context) {
	pendingOrders, err := model.GetPendingCryptoTopUps(defaultCryptoMonitorLimit)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("load pending crypto topups failed: %v", err))
		return
	}
	if len(pendingOrders) == 0 {
		return
	}

	validPendingOrders := make([]*model.TopUp, 0, len(pendingOrders))
	for _, topup := range pendingOrders {
		if topup == nil {
			continue
		}
		if isCryptoTopUpExpired(topup) {
			if err := model.ExpireCryptoTopUp(topup.TradeNo); err != nil {
				logger.LogError(ctx, fmt.Sprintf("expire crypto topup failed: trade=%s err=%v", topup.TradeNo, err))
			} else {
				logger.LogInfo(ctx, fmt.Sprintf("crypto topup expired: trade=%s", topup.TradeNo))
			}
			continue
		}
		validPendingOrders = append(validPendingOrders, topup)
	}
	if len(validPendingOrders) == 0 {
		return
	}

	ordersByMethod := make(map[string][]*cryptoPendingOrder)
	for _, topup := range validPendingOrders {
		order, ok := buildCryptoPendingOrder(topup)
		if !ok {
			continue
		}
		groupKey := order.Method + "|" + order.Address
		ordersByMethod[groupKey] = append(ordersByMethod[groupKey], order)
	}

	paymentSetting := operation_setting.GetPaymentSetting()
	for _, orders := range ordersByMethod {
		method := orders[0].Method
		sort.Slice(orders, func(i, j int) bool {
			if orders[i].TopUp.CreateTime == orders[j].TopUp.CreateTime {
				return orders[i].TopUp.Id < orders[j].TopUp.Id
			}
			return orders[i].TopUp.CreateTime < orders[j].TopUp.CreateTime
		})

		var transfers []cryptoTransfer
		switch method {
		case cryptoMethodEthUSDT, cryptoMethodEthUSDC:
			if strings.TrimSpace(paymentSetting.EthRPCURL) == "" {
				continue
			}
			transfers, err = fetchEthereumTransfers(ctx, paymentSetting.EthRPCURL, method, orders)
		case cryptoMethodSolanaUSDT, cryptoMethodSolanaUSDC:
			if strings.TrimSpace(paymentSetting.SolanaRPCURL) == "" {
				continue
			}
			transfers, err = fetchSolanaTransfers(ctx, paymentSetting.SolanaRPCURL, method, orders)
		default:
			continue
		}
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("fetch crypto transfers failed for %s: %v", method, err))
			continue
		}
		matchAndCompleteCryptoOrders(ctx, orders, transfers)
	}
}

func isCryptoTopUpExpired(topup *model.TopUp) bool {
	if topup == nil || topup.Status != common.TopUpStatusPending {
		return false
	}
	return common.GetTimestamp() >= getCryptoTopUpExpireAt(topup)
}

func getCryptoTopUpExpireAt(topup *model.TopUp) int64 {
	if topup == nil {
		return 0
	}
	expireAt, err := parseCryptoTopUpExpirePayload(topup.ProviderPayload)
	if err == nil && expireAt > 0 {
		return expireAt
	}
	expireMinutes := operation_setting.GetCryptoOrderExpireMinutes()
	return topup.CreateTime + int64(expireMinutes*60)
}

func parseCryptoTopUpExpirePayload(providerPayload string) (int64, error) {
	if strings.TrimSpace(providerPayload) == "" {
		return 0, nil
	}
	var payload struct {
		ExpireAt int64 `json:"expire_at"`
	}
	if err := common.UnmarshalJsonStr(providerPayload, &payload); err != nil {
		return 0, err
	}
	return payload.ExpireAt, nil
}

func buildCryptoPendingOrder(topup *model.TopUp) (*cryptoPendingOrder, bool) {
	if topup == nil {
		return nil, false
	}
	chain, token := getCryptoMethodInfo(topup.PaymentMethod)
	if chain == "" || token == "" {
		return nil, false
	}
	address := ""
	payload := strings.TrimSpace(topup.ProviderPayload)
	if payload == "" {
		return nil, false
	}
	var data struct {
		Chain          string  `json:"chain"`
		Token          string  `json:"token"`
		Address        string  `json:"address"`
		ExpectedAmount float64 `json:"expected_amount"`
		ExpireAt       int64   `json:"expire_at"`
	}
	if err := common.UnmarshalJsonStr(payload, &data); err != nil {
		return nil, false
	}
	if strings.TrimSpace(data.Address) != "" {
		address = strings.TrimSpace(data.Address)
	}
	if strings.TrimSpace(data.Chain) != "" {
		chain = strings.TrimSpace(data.Chain)
	}
	if strings.TrimSpace(data.Token) != "" {
		token = strings.TrimSpace(data.Token)
	}
	if address == "" || data.ExpectedAmount <= 0 {
		return nil, false
	}
	expectedAmount := normalizeStableAmount(data.ExpectedAmount)
	expectedFloat, _ := strconvFloat(expectedAmount)
	return &cryptoPendingOrder{
		TopUp:         topup,
		Method:        topup.PaymentMethod,
		Chain:         chain,
		Token:         token,
		Address:       address,
		Expected:      expectedAmount,
		ExpectedFloat: expectedFloat,
	}, true
}

func getCryptoMethodInfo(method string) (chain string, token string) {
	switch method {
	case cryptoMethodEthUSDT:
		return "Ethereum", "USDT"
	case cryptoMethodEthUSDC:
		return "Ethereum", "USDC"
	case cryptoMethodSolanaUSDT:
		return "Solana", "USDT"
	case cryptoMethodSolanaUSDC:
		return "Solana", "USDC"
	default:
		return "", ""
	}
}

func normalizeStableAmount(v float64) string {
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.6f", v), "0"), ".")
}

func strconvFloat(s string) (float64, error) {
	f, ok := new(big.Rat).SetString(s)
	if !ok {
		return 0, fmt.Errorf("invalid decimal string: %s", s)
	}
	val, _ := f.Float64()
	return val, nil
}

func matchAndCompleteCryptoOrders(ctx context.Context, orders []*cryptoPendingOrder, transfers []cryptoTransfer) {
	sort.Slice(transfers, func(i, j int) bool {
		if transfers[i].BlockTime == transfers[j].BlockTime {
			return transfers[i].TxHash < transfers[j].TxHash
		}
		return transfers[i].BlockTime < transfers[j].BlockTime
	})

	used := make(map[string]struct{})
	for _, transfer := range transfers {
		for _, order := range orders {
			if order == nil || order.TopUp == nil {
				continue
			}
			if order.TopUp.Status != common.TopUpStatusPending {
				continue
			}
			if _, ok := used[order.TopUp.TradeNo]; ok {
				continue
			}
			if transfer.Amount != order.Expected {
				continue
			}
			if transfer.BlockTime > 0 && order.TopUp.CreateTime > transfer.BlockTime {
				continue
			}

			payload := map[string]any{
				"chain":           order.Chain,
				"token":           order.Token,
				"address":         order.Address,
				"expected_amount": order.ExpectedFloat,
				"tx_hash":         transfer.TxHash,
				"block_number":    transfer.BlockNumber,
				"block_time":      transfer.BlockTime,
				"confirmed":       true,
			}
			if err := model.CompleteCryptoTopUp(order.TopUp.TradeNo, common.GetJsonString(payload)); err != nil {
				logger.LogError(ctx, fmt.Sprintf("complete crypto topup failed: trade=%s err=%v", order.TopUp.TradeNo, err))
				continue
			}
			order.TopUp.Status = common.TopUpStatusSuccess
			used[order.TopUp.TradeNo] = struct{}{}
			logger.LogInfo(ctx, fmt.Sprintf("crypto topup auto completed: trade=%s tx=%s", order.TopUp.TradeNo, transfer.TxHash))
			break
		}
	}
}

func fetchEthereumTransfers(ctx context.Context, rpcURL string, method string, orders []*cryptoPendingOrder) ([]cryptoTransfer, error) {
	latestBlockHex, err := ethRPCString(rpcURL, "eth_blockNumber", []any{})
	if err != nil {
		return nil, err
	}
	latestBlock, err := parseHexUint64(latestBlockHex)
	if err != nil {
		return nil, err
	}

	confirmations := uint64(operation_setting.GetPaymentSetting().CryptoMonitorConfirmations)
	if confirmations == 0 {
		confirmations = 12
	}
	if latestBlock <= confirmations {
		return nil, nil
	}
	toBlock := latestBlock - confirmations
	lookback := uint64(operation_setting.GetPaymentSetting().CryptoMonitorLookback)
	if lookback == 0 {
		lookback = 5000
	}

	fromBlock := uint64(0)
	if lookback > 0 && toBlock+1 > lookback {
		fromBlock = toBlock - lookback + 1
	}
	if fromBlock > toBlock {
		return nil, nil
	}

	tokenContract, recipient, decimals := ethMethodContractAndAddress(method, orders)
	if tokenContract == "" || recipient == "" {
		return nil, nil
	}
	lastScannedBlock, err := getLastScannedHeight("ethereum", recipient, tokenContract)
	if err != nil {
		return nil, err
	}
	if lastScannedBlock > 0 {
		nextBlock := lastScannedBlock + 1
		if nextBlock > fromBlock {
			fromBlock = nextBlock
		}
	}
	if fromBlock > toBlock {
		return nil, nil
	}

	params := []any{map[string]any{
		"address":   tokenContract,
		"fromBlock": fmt.Sprintf("0x%x", fromBlock),
		"toBlock":   fmt.Sprintf("0x%x", toBlock),
		"topics": []any{
			erc20TransferEventTopic,
			nil,
			padETHAddressTopic(recipient),
		},
	}}
	requestLog, err := common.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "eth_getLogs",
		"params":  params,
	})
	if err == nil {
		logger.LogDebug(ctx, "eth_getLogs request: %s", string(requestLog))
	}

	var logs []struct {
		TxHash      string   `json:"transactionHash"`
		BlockNumber string   `json:"blockNumber"`
		Data        string   `json:"data"`
		Topics      []string `json:"topics"`
	}
	if err := rpcCall(rpcURL, "eth_getLogs", params, &logs); err != nil {
		return nil, err
	}

	blockTimeCache := make(map[uint64]int64)
	transfers := make([]cryptoTransfer, 0, len(logs))
	maxSeenBlock := lastScannedBlock
	for _, item := range logs {
		blockNumber, err := parseHexUint64(item.BlockNumber)
		if err != nil {
			continue
		}
		if blockNumber > maxSeenBlock {
			maxSeenBlock = blockNumber
		}
		amount, err := parseERC20Amount(item.Data, int(decimals))
		if err != nil || amount == "" {
			continue
		}
		blockTime, ok := blockTimeCache[blockNumber]
		if !ok {
			blockTime, err = ethBlockTime(rpcURL, blockNumber)
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("load eth block time failed: block=%d err=%v", blockNumber, err))
				continue
			}
			blockTimeCache[blockNumber] = blockTime
		}
		amountFloat, _ := strconvFloat(amount)
		transfers = append(transfers, cryptoTransfer{
			Method:      method,
			Amount:      amount,
			AmountFloat: amountFloat,
			TxHash:      item.TxHash,
			BlockNumber: blockNumber,
			BlockTime:   blockTime,
		})
	}
	if maxSeenBlock < toBlock {
		maxSeenBlock = toBlock
	}
	if maxSeenBlock > lastScannedBlock {
		if err := advanceLastScannedHeight("ethereum", recipient, tokenContract, maxSeenBlock); err != nil {
			return nil, err
		}
	}
	return transfers, nil
}

func ethMethodContractAndAddress(method string, orders []*cryptoPendingOrder) (string, string, int32) {
	var recipient string
	if len(orders) > 0 {
		recipient = strings.TrimSpace(orders[0].Address)
	}
	cfg := operation_setting.GetCryptoTokenConfig(method)
	if cfg == nil {
		return "", recipient, 6
	}
	return strings.TrimSpace(cfg.ContractAddress), recipient, cfg.Decimals
}

func padETHAddressTopic(address string) string {
	trimmed := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(address)), "0x")
	if len(trimmed) > 64 {
		trimmed = trimmed[len(trimmed)-64:]
	}
	return "0x" + strings.Repeat("0", 64-len(trimmed)) + trimmed
}

func parseERC20Amount(data string, decimals int) (string, error) {
	value, err := parseBigIntHex(data)
	if err != nil {
		return "", err
	}
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	rat := new(big.Rat).SetFrac(value, divisor)
	f, _ := rat.Float64()
	return normalizeStableAmount(f), nil
}

func ethBlockTime(rpcURL string, blockNumber uint64) (int64, error) {
	var block struct {
		Timestamp string `json:"timestamp"`
	}
	if err := rpcCall(rpcURL, "eth_getBlockByNumber", []any{fmt.Sprintf("0x%x", blockNumber), false}, &block); err != nil {
		return 0, err
	}
	ts, err := parseHexUint64(block.Timestamp)
	if err != nil {
		return 0, err
	}
	return int64(ts), nil
}

func fetchSolanaTransfers(ctx context.Context, rpcURL string, method string, orders []*cryptoPendingOrder) ([]cryptoTransfer, error) {
	if len(orders) == 0 {
		return nil, nil
	}
	ownerAddress := strings.TrimSpace(orders[0].Address)
	mint := solanaMethodMint(method)
	if ownerAddress == "" || mint == "" {
		return nil, nil
	}
	tokenAccounts, err := getSolanaTokenAccountsByOwner(rpcURL, ownerAddress, mint)
	if err != nil {
		return nil, err
	}
	if len(tokenAccounts) == 0 {
		return nil, nil
	}
	lastScannedSlot, err := getLastScannedHeight("solana", ownerAddress, mint)
	if err != nil {
		return nil, err
	}

	oldestCreateTime := orders[0].TopUp.CreateTime
	limit := operation_setting.GetPaymentSetting().CryptoMonitorLookback
	if limit <= 0 || limit > 1000 {
		limit = 200
	}

	signatureMap := make(map[string]*int64)
	maxSeenSlot := lastScannedSlot
	for tokenAccount := range tokenAccounts {
		var signatures []struct {
			Signature string `json:"signature"`
			BlockTime *int64 `json:"blockTime"`
			Slot      uint64 `json:"slot"`
			Err       any    `json:"err"`
		}
		params := []any{tokenAccount, map[string]any{"limit": limit}}
		logSolanaRPCRequest(ctx, "getSignaturesForAddress", params)
		if err := rpcCall(rpcURL, "getSignaturesForAddress", params, &signatures); err != nil {
			return nil, err
		}
		for _, sig := range signatures {
			if sig.Signature == "" || sig.Err != nil {
				continue
			}
			if sig.Slot > maxSeenSlot {
				maxSeenSlot = sig.Slot
			}
			if lastScannedSlot > 0 && sig.Slot <= lastScannedSlot {
				continue
			}
			if sig.BlockTime != nil && *sig.BlockTime < oldestCreateTime {
				continue
			}
			if existing, ok := signatureMap[sig.Signature]; ok {
				if existing == nil && sig.BlockTime != nil {
					signatureMap[sig.Signature] = sig.BlockTime
				}
				continue
			}
			signatureMap[sig.Signature] = sig.BlockTime
		}
	}

	transfers := make([]cryptoTransfer, 0, len(signatureMap))
	for signature, blockTime := range signatureMap {
		transfer, ok := fetchSolanaTransactionTransfer(ctx, rpcURL, method, mint, tokenAccounts, signature)
		if !ok {
			continue
		}
		if blockTime != nil && transfer.BlockTime == 0 {
			transfer.BlockTime = *blockTime
		}
		transfers = append(transfers, transfer)
	}
	if maxSeenSlot > lastScannedSlot {
		if err := advanceLastScannedHeight("solana", ownerAddress, mint, maxSeenSlot); err != nil {
			return nil, err
		}
	}
	return transfers, nil
}

func solanaMethodMint(method string) string {
	cfg := operation_setting.GetCryptoTokenConfig(method)
	if cfg == nil {
		return ""
	}
	return strings.TrimSpace(cfg.ContractAddress)
}

func getSolanaTokenAccountsByOwner(rpcURL string, ownerAddress string, mint string) (map[string]struct{}, error) {
	var result struct {
		Value []struct {
			Pubkey  string `json:"pubkey"`
			Account struct {
				Data struct {
					Parsed struct {
						Info struct {
							Mint        string `json:"mint"`
							TokenAmount struct {
								Decimals int `json:"decimals"`
							} `json:"tokenAmount"`
						} `json:"info"`
					} `json:"parsed"`
				} `json:"data"`
			} `json:"account"`
		} `json:"value"`
	}
	params := []any{
		ownerAddress,
		map[string]any{"programId": solanaTokenProgramID},
		map[string]any{
			"commitment": "finalized",
			"encoding":   "jsonParsed",
		},
	}
	logSolanaRPCRequest(context.Background(), "getTokenAccountsByOwner", params)
	err := rpcCall(rpcURL, "getTokenAccountsByOwner", params, &result)
	if err != nil {
		return nil, err
	}
	tokenAccounts := make(map[string]struct{}, len(result.Value))
	for _, item := range result.Value {
		pubkey := strings.TrimSpace(item.Pubkey)
		if pubkey == "" {
			continue
		}
		if infoMint := strings.TrimSpace(item.Account.Data.Parsed.Info.Mint); infoMint != "" && infoMint != mint {
			continue
		}
		tokenAccounts[pubkey] = struct{}{}
	}
	return tokenAccounts, nil
}

func logSolanaRPCRequest(ctx context.Context, method string, params []any) {
	requestLog, err := common.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	})
	if err == nil {
		logger.LogDebug(ctx, "solana rpc request: %s", string(requestLog))
	}
}

func fetchSolanaTransactionTransfer(ctx context.Context, rpcURL string, method string, mint string, tokenAccounts map[string]struct{}, signature string) (cryptoTransfer, bool) {
	var result struct {
		BlockTime *int64 `json:"blockTime"`
		Slot      uint64 `json:"slot"`
		Meta      struct {
			Err              any `json:"err"`
			PreTokenBalances []struct {
				AccountIndex  int    `json:"accountIndex"`
				Mint          string `json:"mint"`
				UITokenAmount struct {
					UIAmountString string `json:"uiAmountString"`
				} `json:"uiTokenAmount"`
			} `json:"preTokenBalances"`
			PostTokenBalances []struct {
				AccountIndex  int    `json:"accountIndex"`
				Mint          string `json:"mint"`
				UITokenAmount struct {
					UIAmountString string `json:"uiAmountString"`
				} `json:"uiTokenAmount"`
			} `json:"postTokenBalances"`
		} `json:"meta"`
		Transaction struct {
			Message struct {
				AccountKeys []struct {
					Pubkey string `json:"pubkey"`
				} `json:"accountKeys"`
			} `json:"message"`
		} `json:"transaction"`
	}

	params := []any{signature, map[string]any{
		"encoding":                       "jsonParsed",
		"commitment":                     "finalized",
		"maxSupportedTransactionVersion": 0,
	}}
	logSolanaRPCRequest(ctx, "getTransaction", params)
	if err := rpcCall(rpcURL, "getTransaction", params, &result); err != nil {
		logger.LogError(ctx, fmt.Sprintf("get solana transaction failed: sig=%s err=%v", signature, err))
		return cryptoTransfer{}, false
	}
	if result.Meta.Err != nil {
		return cryptoTransfer{}, false
	}

	accountKeys := make(map[int]string, len(result.Transaction.Message.AccountKeys))
	for idx, key := range result.Transaction.Message.AccountKeys {
		accountKeys[idx] = key.Pubkey
	}

	preAmount := "0"
	postAmount := "0"
	for _, item := range result.Meta.PreTokenBalances {
		if item.Mint == mint && hasSolanaTokenAccount(tokenAccounts, accountKeys[item.AccountIndex]) {
			preAmount = item.UITokenAmount.UIAmountString
			break
		}
	}
	for _, item := range result.Meta.PostTokenBalances {
		if item.Mint == mint && hasSolanaTokenAccount(tokenAccounts, accountKeys[item.AccountIndex]) {
			postAmount = item.UITokenAmount.UIAmountString
			break
		}
	}
	delta, err := subtractDecimalString(postAmount, preAmount)
	if err != nil || delta == "" || delta == "0" {
		return cryptoTransfer{}, false
	}
	amountFloat, _ := strconvFloat(delta)
	blockTime := int64(0)
	if result.BlockTime != nil {
		blockTime = *result.BlockTime
	}
	return cryptoTransfer{
		Method:      method,
		Amount:      delta,
		AmountFloat: amountFloat,
		TxHash:      signature,
		Slot:        result.Slot,
		BlockTime:   blockTime,
	}, true
}

func getLastScannedHeight(chain string, address string, assetContract string) (uint64, error) {
	state, err := model.GetCryptoScanState(chain, address, assetContract)
	if err != nil || state == nil || state.LastScannedHeight <= 0 {
		return 0, err
	}
	return uint64(state.LastScannedHeight), nil
}

func advanceLastScannedHeight(chain string, address string, assetContract string, height uint64) error {
	return model.AdvanceCryptoScanState(chain, address, assetContract, int64(height), common.GetTimestamp())
}

func hasSolanaTokenAccount(tokenAccounts map[string]struct{}, address string) bool {
	_, ok := tokenAccounts[strings.TrimSpace(address)]
	return ok
}

func subtractDecimalString(a string, b string) (string, error) {
	ar, ok := new(big.Rat).SetString(strings.TrimSpace(a))
	if !ok {
		return "", fmt.Errorf("invalid decimal: %s", a)
	}
	br, ok := new(big.Rat).SetString(strings.TrimSpace(b))
	if !ok {
		return "", fmt.Errorf("invalid decimal: %s", b)
	}
	diff := new(big.Rat).Sub(ar, br)
	f, _ := diff.Float64()
	if f <= 0 {
		return "0", nil
	}
	return normalizeStableAmount(f), nil
}

func rpcCall(rpcURL string, method string, params []any, out any) error {
	requestBody := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}
	body, err := common.Marshal(requestBody)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, rpcURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return err
	}
	defer CloseResponseBodyGracefully(resp)
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	logSolanaRPCResponse(context.Background(), method, raw)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("rpc status %d: %s", resp.StatusCode, string(raw))
	}
	var envelope struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := common.Unmarshal(raw, &envelope); err != nil {
		return err
	}
	if envelope.Error != nil {
		return fmt.Errorf("rpc error %d: %s", envelope.Error.Code, envelope.Error.Message)
	}
	if out == nil {
		return nil
	}
	return common.Unmarshal(envelope.Result, out)
}

func logSolanaRPCResponse(ctx context.Context, method string, raw []byte) {
	switch method {
	case "getTokenAccountsByOwner", "getSignaturesForAddress", "getTransaction":
		logger.LogDebug(ctx, "solana rpc response: method=%s body=%s", method, string(raw))
	}
}

func ethRPCString(rpcURL string, method string, params []any) (string, error) {
	var result string
	if err := rpcCall(rpcURL, method, params, &result); err != nil {
		return "", err
	}
	return result, nil
}

func parseHexUint64(s string) (uint64, error) {
	value := strings.TrimPrefix(strings.TrimSpace(s), "0x")
	if value == "" {
		return 0, nil
	}
	n := new(big.Int)
	if _, ok := n.SetString(value, 16); !ok {
		return 0, fmt.Errorf("invalid hex uint64: %s", s)
	}
	return n.Uint64(), nil
}

func parseBigIntHex(s string) (*big.Int, error) {
	value := strings.TrimPrefix(strings.TrimSpace(s), "0x")
	if value == "" {
		return big.NewInt(0), nil
	}
	bytesVal, err := hex.DecodeString(leftPadEven(value))
	if err != nil {
		return nil, err
	}
	return new(big.Int).SetBytes(bytesVal), nil
}

func leftPadEven(s string) string {
	if len(s)%2 == 1 {
		return "0" + s
	}
	return s
}
