package model

import (
	"strings"

	"gorm.io/gorm"
)

type CryptoScanState struct {
	Id               int    `json:"id"`
	Chain            string `json:"chain" gorm:"type:varchar(32);uniqueIndex:ux_crypto_scan_state,priority:1"`
	Address          string `json:"address" gorm:"type:varchar(255);uniqueIndex:ux_crypto_scan_state,priority:2"`
	AssetContract    string `json:"asset_contract" gorm:"type:varchar(255);uniqueIndex:ux_crypto_scan_state,priority:3"`
	LastScannedHeight int64 `json:"last_scanned_height" gorm:"type:bigint;default:0"`
	UpdatedAt        int64  `json:"updated_at" gorm:"type:bigint"`
}

func normalizeCryptoScanStateValue(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func GetCryptoScanState(chain string, address string, assetContract string) (*CryptoScanState, error) {
	state := &CryptoScanState{}
	err := DB.Where("chain = ? AND address = ? AND asset_contract = ?",
		normalizeCryptoScanStateValue(chain),
		normalizeCryptoScanStateValue(address),
		normalizeCryptoScanStateValue(assetContract),
	).First(state).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return state, nil
}

func AdvanceCryptoScanState(chain string, address string, assetContract string, height int64, updatedAt int64) error {
	if height <= 0 {
		return nil
	}
	chain = normalizeCryptoScanStateValue(chain)
	address = normalizeCryptoScanStateValue(address)
	assetContract = normalizeCryptoScanStateValue(assetContract)

	return DB.Transaction(func(tx *gorm.DB) error {
		state := &CryptoScanState{}
		err := tx.Where("chain = ? AND address = ? AND asset_contract = ?", chain, address, assetContract).
			First(state).Error
		if err != nil {
			if err != gorm.ErrRecordNotFound {
				return err
			}
			state = &CryptoScanState{
				Chain:             chain,
				Address:           address,
				AssetContract:     assetContract,
				LastScannedHeight: height,
				UpdatedAt:         updatedAt,
			}
			return tx.Create(state).Error
		}
		if state.LastScannedHeight >= height {
			if updatedAt > state.UpdatedAt {
				state.UpdatedAt = updatedAt
				return tx.Save(state).Error
			}
			return nil
		}
		state.LastScannedHeight = height
		state.UpdatedAt = updatedAt
		return tx.Save(state).Error
	})
}
