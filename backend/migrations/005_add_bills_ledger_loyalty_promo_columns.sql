-- Migration 005: Add missing optional fields to bills table
-- (advance_used, promo_code, promo_discount, loyalty_points_earned, loyalty_points_redeemed, loyalty_discount)
-- Completely safe, non-destructive, with default values.

ALTER TABLE bills ADD COLUMN IF NOT EXISTS advance_used DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50) DEFAULT NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS promo_discount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_points_earned INT DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INT DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS loyalty_discount DECIMAL(10,2) DEFAULT 0.00;

