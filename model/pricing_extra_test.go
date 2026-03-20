package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func truncatePricingTables(t *testing.T) {
	t.Helper()
	DB.Exec("DELETE FROM abilities")
	DB.Exec("DELETE FROM channels")
	DB.Exec("DELETE FROM models")
	DB.Exec("DELETE FROM vendors")
	pricingMap = nil
	vendorsList = nil
	supportedEndpointMap = nil
	modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
	modelEnableGroups = make(map[string][]string)
	modelQuotaTypeMap = make(map[string]int)
	lastGetPricingTime = lastGetPricingTime.AddDate(-1, 0, 0)

	t.Cleanup(func() {
		DB.Exec("DELETE FROM abilities")
		DB.Exec("DELETE FROM channels")
		DB.Exec("DELETE FROM models")
		DB.Exec("DELETE FROM vendors")
		pricingMap = nil
		vendorsList = nil
		supportedEndpointMap = nil
		modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
		modelEnableGroups = make(map[string][]string)
		modelQuotaTypeMap = make(map[string]int)
		lastGetPricingTime = lastGetPricingTime.AddDate(-1, 0, 0)
	})
}

func TestRefreshPricingIncludesParsedExtra(t *testing.T) {
	truncatePricingTables(t)

	require.NoError(t, DB.AutoMigrate(&Ability{}, &Channel{}, &Model{}, &Vendor{}))

	ch := &Channel{
		Id:     1001,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "pricing-extra-openai",
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-4o-mini,gpt-4o-realtime-preview",
	}
	require.NoError(t, DB.Create(ch).Error)

	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4o-mini",
		ChannelId: ch.Id,
		Enabled:   true,
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4o-realtime-preview",
		ChannelId: ch.Id,
		Enabled:   true,
	}).Error)

	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-4o-mini",
		NameRule:  NameRuleExact,
		Status:    1,
		Extra:     `{"tier":"exact","features":["json"]}`,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-4o",
		NameRule:  NameRulePrefix,
		Status:    1,
		Extra:     `{"tier":"prefix","reasoning":true}`,
	}).Error)

	RefreshPricing()
	pricing := GetPricing()

	var exactFound bool
	var prefixFound bool
	for _, item := range pricing {
		switch item.ModelName {
		case "gpt-4o-mini":
			exactFound = true
			extra, ok := item.Extra.(map[string]interface{})
			require.True(t, ok)
			assert.Equal(t, "exact", extra["tier"])
			assert.Equal(t, []interface{}{"json"}, extra["features"])
		case "gpt-4o-realtime-preview":
			prefixFound = true
			extra, ok := item.Extra.(map[string]interface{})
			require.True(t, ok)
			assert.Equal(t, "prefix", extra["tier"])
			assert.Equal(t, true, extra["reasoning"])
		}
	}

	assert.True(t, exactFound)
	assert.True(t, prefixFound)
}

func TestRefreshPricingIgnoresInvalidExtra(t *testing.T) {
	truncatePricingTables(t)

	require.NoError(t, DB.AutoMigrate(&Ability{}, &Channel{}, &Model{}, &Vendor{}))

	ch := &Channel{
		Id:     1002,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "pricing-extra-invalid",
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-4o",
	}
	require.NoError(t, DB.Create(ch).Error)

	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4o",
		ChannelId: ch.Id,
		Enabled:   true,
	}).Error)

	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-4o",
		NameRule:  NameRuleExact,
		Status:    1,
		Extra:     `{"tier":`,
	}).Error)

	RefreshPricing()
	pricing := GetPricing()

	require.NotEmpty(t, pricing)
	for _, item := range pricing {
		if item.ModelName == "gpt-4o" {
			assert.Nil(t, item.Extra)
		}
	}
}

func TestRefreshPricingRegexRulePriorityHigherThanPrefix(t *testing.T) {
	truncatePricingTables(t)

	require.NoError(t, DB.AutoMigrate(&Ability{}, &Channel{}, &Model{}, &Vendor{}))

	ch := &Channel{
		Id:     1004,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "pricing-regex-priority",
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-5-codex",
	}
	require.NoError(t, DB.Create(ch).Error)

	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-5-codex",
		ChannelId: ch.Id,
		Enabled:   true,
	}).Error)

	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-5",
		NameRule:  NameRulePrefix,
		Status:    1,
		Extra:     `{"source":"prefix"}`,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "^gpt-5-.*codex$",
		NameRule:  NameRuleRegex,
		Status:    1,
		Extra:     `{"source":"regex"}`,
	}).Error)

	RefreshPricing()
	pricing := GetPricing()

	require.NotEmpty(t, pricing)
	for _, item := range pricing {
		if item.ModelName != "gpt-5-codex" {
			continue
		}
		extra, ok := item.Extra.(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "regex", extra["source"])
		return
	}

	t.Fatalf("expected pricing entry for gpt-5-codex")
}
