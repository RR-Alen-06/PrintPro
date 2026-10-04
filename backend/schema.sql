-- PrintPro Database Schema
-- All monetary values are in Indian Rupees (INR)

CREATE TABLE IF NOT EXISTS business_profile (
  id INT PRIMARY KEY DEFAULT 1,
  shop_name VARCHAR(100) DEFAULT '',
  owner_name VARCHAR(100) DEFAULT '',
  phone VARCHAR(15) DEFAULT '',
  address TEXT,
  gstin VARCHAR(20) DEFAULT '',
  logo_path VARCHAR(255) DEFAULT '',
  upi_id VARCHAR(100) DEFAULT '',
  CONSTRAINT chk_single_profile CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(20) PRIMARY KEY,
  type ENUM('regular','random') NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) DEFAULT '',
  email VARCHAR(100) DEFAULT '',
  address TEXT,
  credit_balance DECIMAL(10,2) DEFAULT 0.00,
  credit_limit DECIMAL(10,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_customer_type (type),
  INDEX idx_customer_name (name),
  INDEX idx_customer_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  color_single DECIMAL(10,2) DEFAULT 0.00,
  color_double DECIMAL(10,2) DEFAULT 0.00,
  bw_single DECIMAL(10,2) DEFAULT 0.00,
  bw_double DECIMAL(10,2) DEFAULT 0.00,
  stock INT DEFAULT 0,
  low_stock_alert INT DEFAULT 50,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_item_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(20) PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  due_date DATE DEFAULT NULL,
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  discount_type ENUM('percent','flat') DEFAULT 'flat',
  discount_value DECIMAL(10,2) DEFAULT 0.00,
  gst_percent DECIMAL(5,2) DEFAULT 0.00,
  gst_amount DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  amount_paid DECIMAL(10,2) DEFAULT 0.00,
  balance DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  notes TEXT,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_bill_customer (customer_id),
  INDEX idx_bill_status (status),
  INDEX idx_bill_date (date),
  INDEX idx_bill_deleted (deleted_at),
  CONSTRAINT fk_bill_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bill_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id VARCHAR(20) NOT NULL,
  item_name VARCHAR(50) NOT NULL,
  print_type ENUM('color','bw') NOT NULL,
  sides ENUM('single','double') NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  INDEX idx_billitem_bill (bill_id),
  CONSTRAINT fk_billitem_bill FOREIGN KEY (bill_id) REFERENCES bills(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id VARCHAR(20) NOT NULL,
  customer_id VARCHAR(20) NOT NULL,
  date DATETIME DEFAULT NOW(),
  cash_amount DECIMAL(10,2) DEFAULT 0.00,
  upi_amount DECIMAL(10,2) DEFAULT 0.00,
  total_paid DECIMAL(10,2) NOT NULL,
  payment_type ENUM('full','partial') NOT NULL,
  notes VARCHAR(255) DEFAULT '',
  INDEX idx_payment_bill (bill_id),
  INDEX idx_payment_customer (customer_id),
  INDEX idx_payment_date (date),
  CONSTRAINT fk_payment_bill FOREIGN KEY (bill_id) REFERENCES bills(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  qty INT DEFAULT 0,
  unit_cost DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  notes TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_purchase_date (date),
  INDEX idx_purchase_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(30) NOT NULL,
  old_value JSON DEFAULT NULL,
  new_value JSON DEFAULT NULL,
  timestamp DATETIME DEFAULT NOW(),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default business profile
INSERT IGNORE INTO business_profile (id, shop_name, owner_name, phone, address, gstin, logo_path, upi_id)
VALUES (1, '', '', '', '', '', '', '');

-- Seed default inventory items (prices in INR)
INSERT IGNORE INTO inventory_items (name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert) VALUES
('A4', 10.00, 18.00, 3.00, 5.00, 5000, 50),
('A5', 7.00, 12.00, 2.00, 3.50, 3000, 50),
('Letter', 12.00, 20.00, 4.00, 7.00, 2000, 50),
('Legal', 15.00, 25.00, 5.00, 8.00, 1000, 50);
