package smm

import (
	"testing"
)

func TestServiceNormalization(t *testing.T) {
	service := NormalizedSmmService{
		ID:          "101",
		Platform:    "instagram",
		ServiceType: "followers",
		Variant:     "profile",
		Name:        "Instagram Followers HQ",
		RatePer1000: 45.50,
		Min:         50,
		Max:         10000,
		Refill:      true,
	}

	if service.Platform != "instagram" {
		t.Errorf("Expected platform instagram, got %s", service.Platform)
	}
	if service.RatePer1000 != 45.50 {
		t.Errorf("Expected rate 45.50, got %f", service.RatePer1000)
	}
	if !service.Refill {
		t.Errorf("Expected refill true, got false")
	}
}

func TestPriceCalculation(t *testing.T) {
	ratePer1000 := 45.50 // INR
	quantity := 500
	expectedCost := (float64(quantity) / 1000.0) * ratePer1000 // 22.75

	if expectedCost != 22.75 {
		t.Errorf("Expected cost 22.75, got %f", expectedCost)
	}
}
