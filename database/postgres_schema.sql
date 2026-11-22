CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'kitchen', 'purchase'))
);

CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('weight', 'volume', 'count')),
    is_base BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('raw', 'packaging', 'consumable')),
    category VARCHAR(80) NOT NULL,
    base_unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    purchase_unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    min_stock NUMERIC(10,3) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS conversions (
    id VARCHAR(50) PRIMARY KEY,
    from_unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    to_unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    factor NUMERIC(18,8) NOT NULL CHECK (factor > 0),
    item_id VARCHAR(50) REFERENCES items(id),
    notes TEXT,
    CHECK (from_unit_id <> to_unit_id)
);

CREATE TABLE IF NOT EXISTS purchases (
    id VARCHAR(50) PRIMARY KEY,
    batch_no VARCHAR(80) NOT NULL UNIQUE,
    purchase_date DATE NOT NULL,
    supplier VARCHAR(150) NOT NULL,
    item_id VARCHAR(50) NOT NULL REFERENCES items(id),
    qty NUMERIC(18,3) NOT NULL CHECK (qty > 0),
    unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    rate NUMERIC(18,3) NOT NULL CHECK (rate >= 0),
    created_by VARCHAR(50) NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS recipes (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('sub', 'menu')),
    yield_qty NUMERIC(18,3) NOT NULL CHECK (yield_qty > 0),
    yield_unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    notes TEXT,
    selling_price NUMERIC(18,2),
    menu_group VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS recipe_batches (
    id VARCHAR(50) PRIMARY KEY,
    recipe_id VARCHAR(50) NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    made_at TIMESTAMPTZ NOT NULL,
    qty NUMERIC(18,3) NOT NULL CHECK (qty > 0),
    unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS recipe_lines (
    id VARCHAR(50) PRIMARY KEY,
    recipe_id VARCHAR(50) NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('item', 'recipe')),
    item_id VARCHAR(50) REFERENCES items(id),
    component_recipe_id VARCHAR(50) REFERENCES recipes(id),
    qty NUMERIC(18,3) NOT NULL CHECK (qty > 0),
    unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    CHECK (
        (source_type = 'item' AND item_id IS NOT NULL AND component_recipe_id IS NULL)
        OR
        (source_type = 'recipe' AND item_id IS NULL AND component_recipe_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    recipe_id VARCHAR(50) NOT NULL REFERENCES recipes(id),
    portion_qty NUMERIC(18,3) NOT NULL CHECK (portion_qty > 0),
    portion_unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    selling_price NUMERIC(18,2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS menu_price_history (
    id VARCHAR(50) PRIMARY KEY,
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    price NUMERIC(18,2) NOT NULL CHECK (price >= 0),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_purchases_item_id ON purchases(item_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_recipe_batches_recipe_id ON recipe_batches(recipe_id, made_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_recipe_id ON recipe_lines(recipe_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_recipe_id ON menu_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_menu_price_history_menu_item_id ON menu_price_history(menu_item_id, changed_at DESC);

-- Sample seed values closely matching your application data.
INSERT INTO users (id, name, username, password, role)
VALUES
    ('usr-admin', 'Rajesh Naik', 'admin', 'admin123', 'admin'),
    ('usr-kitchen', 'Chef Ramesh', 'kitchen', 'kitchen123', 'kitchen'),
    ('usr-purchase', 'Priya Stores', 'purchase', 'purchase123', 'purchase')
ON CONFLICT (id) DO NOTHING;

INSERT INTO units (id, code, name, kind, is_base)
VALUES
    ('u-kg', 'KG', 'Kilogram', 'weight', TRUE),
    ('u-g', 'G', 'Gram', 'weight', FALSE),
    ('u-l', 'L', 'Litre', 'volume', TRUE),
    ('u-ml', 'ML', 'Millilitre', 'volume', FALSE),
    ('u-pcs', 'PCS', 'Pieces', 'count', TRUE),
    ('u-bunch', 'BNCH', 'Bunch', 'count', FALSE),
    ('u-plate', 'PLT', 'Plate', 'count', TRUE)
ON CONFLICT (id) DO NOTHING;

-- INSERT INTO items (id, code, name, kind, category, base_unit_id, purchase_unit_id, min_stock, active)
-- VALUES
--     ('itm-rice', 'IRM-001', 'Idli rice', 'raw', 'Cereals', 'u-kg', 'u-kg', 0, TRUE),
--     ('itm-urad', 'IRM-002', 'Urad dal (whole)', 'raw', 'Pulses', 'u-kg', 'u-kg', 0, TRUE),
--     ('itm-methi', 'IRM-003', 'Fenugreek seeds', 'raw', 'Spices', 'u-kg', 'u-kg', 0.2, TRUE),
--     ('itm-salt', 'IRM-004', 'Iodised salt', 'raw', 'Seasoning', 'u-kg', 'u-kg', 0, TRUE),
--     ('itm-water', 'IRM-024', 'Potable water', 'consumable', 'Utilities', 'u-l', 'u-l', 0, TRUE)
-- ON CONFLICT (id) DO NOTHING;

INSERT INTO conversions (id, from_unit_id, to_unit_id, factor, item_id, notes)
VALUES
    ('c-kg-g', 'u-kg', 'u-g', 1000, NULL, 'Kilogram to gram'),
    ('c-g-kg', 'u-g', 'u-kg', 0.001, NULL, 'Gram to kilogram'),
    ('c-l-ml', 'u-l', 'u-ml', 1000, NULL, 'Litre to millilitre'),
    ('c-ml-l', 'u-ml', 'u-l', 0.001, NULL, 'Millilitre to litre'),
    ('c-water-l-kg', 'u-l', 'u-kg', 1, 'itm-water', 'Water density conversion')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipes (id, code, name, kind, yield_qty, yield_unit_id, notes)
VALUES
    ('rcp-batter', 'SR-001', 'Idli batter', 'sub', 10, 'u-kg', 'Base batter recipe'),
    ('rcp-idli', 'RC-001', 'Steamed idli', 'menu', 12, 'u-pcs', 'Menu recipe using batter')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipe_batches (id, recipe_id, made_at, qty, unit_id, notes)
VALUES
    ('batch-morning-1', 'rcp-batter', '2026-10-16T06:30:00+05:30', 10, 'u-kg', 'Morning batch'),
    ('batch-evening-1', 'rcp-batter', '2026-10-16T18:15:00+05:30', 7, 'u-kg', 'Evening batch'),
    ('batch-prev-day', 'rcp-batter', '2026-10-15T07:00:00+05:30', 9, 'u-kg', 'Previous day batch')
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipe_lines (id, recipe_id, source_type, item_id, component_recipe_id, qty, unit_id)
VALUES
    ('ln-batter-1', 'rcp-batter', 'item', 'itm-rice', NULL, 4, 'u-kg'),
    ('ln-batter-2', 'rcp-batter', 'item', 'itm-urad', NULL, 1, 'u-kg'),
    ('ln-batter-3', 'rcp-batter', 'item', 'itm-methi', NULL, 20, 'u-g'),
    ('ln-batter-4', 'rcp-batter', 'item', 'itm-salt', NULL, 40, 'u-g'),
    ('ln-batter-5', 'rcp-batter', 'item', 'itm-water', NULL, 5, 'u-l'),
    ('ln-idli-1', 'rcp-idli', 'recipe', NULL, 'rcp-batter', 1, 'u-kg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, code, name, group_name, recipe_id, portion_qty, portion_unit_id, selling_price, active)
VALUES
    ('menu-plate', 'MENU-01', 'Idli sambar chutney', 'South tiffin', 'rcp-idli', 1, 'u-plate', 80, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_price_history (id, menu_item_id, price, changed_at)
VALUES
    ('mh-1', 'menu-plate', 70, '2026-10-10T10:00:00+05:30'),
    ('mh-2', 'menu-plate', 80, '2026-10-20T10:00:00+05:30')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Item master data imported from the provided ingredient list
-- -----------------------------------------------------------------------------
INSERT INTO items (id, code, name, kind, category, base_unit_id, purchase_unit_id, min_stock, active)
VALUES
    ('IRM-001', 'IRM-001', 'Akha Garam Masala', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 10, TRUE),
    ('IRM-002', 'IRM-002', 'Akkha Daniya', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-003', 'IRM-003', 'Amul Butter', 'raw', 'Dairy & Milk Products', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-004', 'IRM-004', 'Baby Corn', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-005', 'IRM-005', 'Bada Elachi', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-006', 'IRM-006', 'Bamboo Shoot', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-007', 'IRM-007', 'Basil', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-008', 'IRM-008', 'BBQ Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-009', 'IRM-009', 'Beans', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-010', 'IRM-010', 'Black Bean', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-011', 'IRM-011', 'Black Pepper', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-012', 'IRM-012', 'Black Pepper Whole', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-013', 'IRM-013', 'Boil Green Vatana', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-014', 'IRM-014', 'Brinjal - Baingan', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-015', 'IRM-015', 'Brocoli', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-016', 'IRM-016', 'Butter during  preparation', 'raw', 'Dairy & Milk Products', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-017', 'IRM-017', 'Butter Topping', 'raw', 'Dairy & Milk Products', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-018', 'IRM-018', 'Capiscum', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-019', 'IRM-019', 'Carrot', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-020', 'IRM-020', 'Cauliflower', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-021', 'IRM-021', 'Celery', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-022', 'IRM-022', 'Chana Dal', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-023', 'IRM-023', 'Chicken Masala', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-024', 'IRM-024', 'Chilly Paste', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-025', 'IRM-025', 'Chilly Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-026', 'IRM-026', 'Chopped Vegetable', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-027', 'IRM-027', 'Coconut', 'raw', 'Nuts & Seeds', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-028', 'IRM-028', 'Coconut Milk', 'raw', 'Coconut Products', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-029', 'IRM-029', 'Coriander Root', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-030', 'IRM-030', 'Curry Leaves (Kadi Patta)', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-031', 'IRM-031', 'Dagad Phool', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-032', 'IRM-032', 'Dalchini', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-033', 'IRM-033', 'Dalda', 'raw', 'Oils & Fats', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-034', 'IRM-034', 'Daliya (Chutney Dal)', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-035', 'IRM-035', 'Elachi', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-036', 'IRM-036', 'Five Spice Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-037', 'IRM-037', 'Fresh Red Chilly', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-038', 'IRM-038', 'Garam Masal Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-039', 'IRM-039', 'Garilic Royal', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-040', 'IRM-040', 'Garlic', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-041', 'IRM-041', 'Ghee', 'raw', 'Dairy & Milk Products', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-042', 'IRM-042', 'Ginger', 'raw', 'Fresh Produce', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-043', 'IRM-043', 'Godrej Groundnut Oil', 'raw', 'Oils & Fats', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-044', 'IRM-044', 'Green Capcicum', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-045', 'IRM-045', 'Green Channa', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-046', 'IRM-046', 'Green Chilly', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-047', 'IRM-047', 'Green Moong', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-048', 'IRM-048', 'Green Paste', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-049', 'IRM-049', 'Green Peas', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-050', 'IRM-050', 'Groundnut (Seng)', 'raw', 'Nuts & Seeds', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-051', 'IRM-051', 'Haldi', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-052', 'IRM-052', 'Hing', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-053', 'IRM-053', 'Hing Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-054', 'IRM-054', 'Idli Rawa', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-055', 'IRM-055', 'Jaggery (GUD)', 'raw', 'Sweeteners', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-056', 'IRM-056', 'Javatry phool', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-057', 'IRM-057', 'Jayfal', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-058', 'IRM-058', 'Jeera', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-059', 'IRM-059', 'Jeera & Dhaniya Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-060', 'IRM-060', 'Kadipatta', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-061', 'IRM-061', 'Kala Elachi', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-062', 'IRM-062', 'Kalamiri', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-063', 'IRM-063', 'Kaman - Dry Coconut', 'raw', 'Nuts & Seeds', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-064', 'IRM-064', 'Kani Rice', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-065', 'IRM-065', 'Kashimiri Chilly', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-066', 'IRM-066', 'Kashmiri Chilly Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-067', 'IRM-067', 'Kikoman', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-068', 'IRM-068', 'Lavang', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-069', 'IRM-069', 'Lemon', 'raw', 'Fruits & Fresh Produce', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-070', 'IRM-070', 'Lemon Grass', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-071', 'IRM-071', 'Lemon Leaf', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-072', 'IRM-072', 'Light Soya', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-073', 'IRM-073', 'Matki', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-074', 'IRM-074', 'Madras Curry Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-075', 'IRM-075', 'Maggi Seasling', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-076', 'IRM-076', 'Masala Bhaji', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-077', 'IRM-077', 'Methi', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-078', 'IRM-078', 'Milk', 'raw', 'Dairy & Milk Products', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-079', 'IRM-079', 'Mirchi Powder', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-080', 'IRM-080', 'Mushroom', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-081', 'IRM-081', 'Oil', 'raw', 'Oils & Fats', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-082', 'IRM-082', 'Oil with Schezwan Pepper', 'raw', 'Oils & Fats', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-083', 'IRM-083', 'Onion', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-084', 'IRM-084', 'Oyester Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-085', 'IRM-085', 'Pau Bhaji Garlic Paste', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-086', 'IRM-086', 'Pau Bhaji Masala', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-087', 'IRM-087', 'Pau Bhaji Masala Red Masala', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-088', 'IRM-088', 'Plum Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-089', 'IRM-089', 'Poha', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-090', 'IRM-090', 'Port Wine', 'raw', 'Beverages & Flavourings', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-091', 'IRM-091', 'Potato', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-092', 'IRM-092', 'Rai', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-093', 'IRM-093', 'Red Channa', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-094', 'IRM-094', 'Red Pumpkin', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-095', 'IRM-095', 'Rice', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-096', 'IRM-096', 'Sabudana', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-097', 'IRM-097', 'Salt', 'raw', 'Seasonings', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-098', 'IRM-098', 'Sambar', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-099', 'IRM-099', 'Scezwan Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-100', 'IRM-100', 'Schezwan Pepper', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-101', 'IRM-101', 'Sesami Seed', 'raw', 'Nuts & Seeds', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-102', 'IRM-102', 'Sez Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-103', 'IRM-103', 'Sheng', 'raw', 'Nuts & Seeds', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-104', 'IRM-104', 'Singapore Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-105', 'IRM-105', 'South Indian Coconut Chutney', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-106', 'IRM-106', 'Soya', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-107', 'IRM-107', 'Spinach', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-108', 'IRM-108', 'Star Phoool', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-109', 'IRM-109', 'Sugar', 'raw', 'Sweeteners', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-110', 'IRM-110', 'Sunflower Oil', 'raw', 'Oils & Fats', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-111', 'IRM-111', 'Tej patta', 'raw', 'Herbs & Leaves', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-112', 'IRM-112', 'Thai Ginger', 'raw', 'Fresh Produce', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-113', 'IRM-113', 'Thai Green Curry', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-114', 'IRM-114', 'Thai Green Curry for packing', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-115', 'IRM-115', 'Thai Red Curry', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-116', 'IRM-116', 'Tomato', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-117', 'IRM-117', 'Tomato Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-118', 'IRM-118', 'Tur Dal', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-119', 'IRM-119', 'Turmeric', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-120', 'IRM-120', 'Udit Dal', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-121', 'IRM-121', 'Ukda Rice', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-122', 'IRM-122', 'Upma Rava', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-123', 'IRM-123', 'Urad Dal', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-124', 'IRM-124', 'Veg Manchow Soup', 'raw', 'Prepared Bases', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-125', 'IRM-125', 'Veg Sez Rice', 'raw', 'Grains & Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-126', 'IRM-126', 'Veg Sez Sauce', 'raw', 'Sauces & Condiments', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-127', 'IRM-127', 'Vegetable', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-128', 'IRM-128', 'Wada Batter', 'raw', 'Prepared Bases', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-129', 'IRM-129', 'Water Chesnut', 'raw', 'Fresh Produce', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-130', 'IRM-130', 'Wet Red Chilly Paste Masala', 'raw', 'Sauces & Pastes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-131', 'IRM-131', 'White Chawali', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-132', 'IRM-132', 'White Vatana', 'raw', 'Pulses & Legumes', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-133', 'IRM-133', 'Whole Kashmiri Chilly', 'raw', 'Spices & Masalas', 'u-kg', 'u-kg', 0, TRUE),
    ('IRM-134', 'IRM-134', 'Zuchuni', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0, TRUE)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    category = EXCLUDED.category,
    base_unit_id = EXCLUDED.base_unit_id,
    purchase_unit_id = EXCLUDED.purchase_unit_id,
    min_stock = EXCLUDED.min_stock,
    active = EXCLUDED.active;
