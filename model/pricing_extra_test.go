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
	for _, table := range []string{"abilities", "channels", "models", "vendors"} {
		if DB.Migrator().HasTable(table) {
			DB.Exec("DELETE FROM " + table)
		}
	}
	pricingMap = nil
	vendorsList = nil
	supportedEndpointMap = nil
	modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
	modelEnableGroups = make(map[string][]string)
	modelQuotaTypeMap = make(map[string]int)
	lastGetPricingTime = lastGetPricingTime.AddDate(-1, 0, 0)

	t.Cleanup(func() {
		for _, table := range []string{"abilities", "channels", "models", "vendors"} {
			if DB.Migrator().HasTable(table) {
				DB.Exec("DELETE FROM " + table)
			}
		}
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

func TestGetRecommendedPricingReturnsPricingSubset(t *testing.T) {
	truncatePricingTables(t)

	require.NoError(t, DB.AutoMigrate(&Ability{}, &Channel{}, &Model{}, &Vendor{}))

	ch := &Channel{
		Id:     1005,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "pricing-recommended",
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-4o-mini,claude-3-5-sonnet",
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
		Model:     "claude-3-5-sonnet",
		ChannelId: ch.Id,
		Enabled:   true,
	}).Error)

	require.NoError(t, DB.Create(&Model{
		ModelName:   "gpt-4o-mini",
		NameRule:    NameRuleExact,
		Status:      1,
		Recommended: 1,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName:   "claude-3-5-sonnet",
		NameRule:    NameRuleExact,
		Status:      1,
		Recommended: 0,
	}).Error)

	RefreshPricing()

	allPricing := GetPricing()
	recommendedPricing := GetRecommendedPricing()

	require.Len(t, allPricing, 2)
	require.Len(t, recommendedPricing, 1)
	assert.Equal(t, "gpt-4o-mini", recommendedPricing[0].ModelName)
	assert.True(t, recommendedPricing[0].Recommended)

	foundRecommended := false
	foundNonRecommended := false
	for _, item := range allPricing {
		switch item.ModelName {
		case "gpt-4o-mini":
			foundRecommended = true
			assert.True(t, item.Recommended)
		case "claude-3-5-sonnet":
			foundNonRecommended = true
			assert.False(t, item.Recommended)
		}
	}
	assert.True(t, foundRecommended)
	assert.True(t, foundNonRecommended)
}

func TestGetRecommendedPricingExcludesDisabledModels(t *testing.T) {
	truncatePricingTables(t)

	require.NoError(t, DB.AutoMigrate(&Ability{}, &Channel{}, &Model{}, &Vendor{}))

	ch := &Channel{
		Id:     1006,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "pricing-recommended-disabled",
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-4.1",
	}
	require.NoError(t, DB.Create(ch).Error)

	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4.1",
		ChannelId: ch.Id,
		Enabled:   true,
	}).Error)

	require.NoError(t, (&Model{
		ModelName:   "gpt-4.1",
		NameRule:    NameRuleExact,
		Status:      0,
		Recommended: 1,
	}).Insert())

	RefreshPricing()

	assert.Empty(t, GetPricing())
	assert.Empty(t, GetRecommendedPricing())
}

func TestModelInsertAndUpdatePersistRecommendedZeroValue(t *testing.T) {
	truncatePricingTables(t)

	require.NoError(t, DB.AutoMigrate(&Model{}))

	meta := &Model{
		ModelName:    "zero-value-model",
		NameRule:     NameRuleExact,
		Status:       1,
		Recommended:  0,
		SyncOfficial: 0,
	}
	require.NoError(t, meta.Insert())

	var inserted Model
	require.NoError(t, DB.First(&inserted, meta.Id).Error)
	assert.Equal(t, 0, inserted.Recommended)
	assert.Equal(t, 0, inserted.SyncOfficial)

	inserted.Recommended = 1
	inserted.SyncOfficial = 1
	require.NoError(t, inserted.Update())

	var updatedToOne Model
	require.NoError(t, DB.First(&updatedToOne, inserted.Id).Error)
	assert.Equal(t, 1, updatedToOne.Recommended)
	assert.Equal(t, 1, updatedToOne.SyncOfficial)

	updatedToOne.Recommended = 0
	updatedToOne.SyncOfficial = 0
	require.NoError(t, updatedToOne.Update())

	var updatedBackToZero Model
	require.NoError(t, DB.First(&updatedBackToZero, inserted.Id).Error)
	assert.Equal(t, 0, updatedBackToZero.Recommended)
	assert.Equal(t, 0, updatedBackToZero.SyncOfficial)
}
