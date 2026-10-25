-- Run this in PostgreSQL
-- 1) Create database
--    createdb dps_recipe
-- 2) Connect
--    psql -U postgres -d dps_recipe
-- 3) Run schema
--    \i database/postgres_schema.sql

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
    tax_pct NUMERIC(8,2) NOT NULL DEFAULT 0,
    freight NUMERIC(18,3) NOT NULL DEFAULT 0,
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

INSERT INTO items (id, code, name, kind, category, base_unit_id, purchase_unit_id, min_stock, active)
VALUES
    ('itm-rice', 'IRM-001', 'Idli rice', 'raw', 'Cereals', 'u-kg', 'u-kg', 0, TRUE),
    ('itm-urad', 'IRM-002', 'Urad dal (whole)', 'raw', 'Pulses', 'u-kg', 'u-kg', 0, TRUE),
    ('itm-methi', 'IRM-003', 'Fenugreek seeds', 'raw', 'Spices', 'u-kg', 'u-kg', 0.2, TRUE),
    ('itm-salt', 'IRM-004', 'Iodised salt', 'raw', 'Seasoning', 'u-kg', 'u-kg', 0, TRUE),
    ('itm-water', 'IRM-024', 'Potable water', 'consumable', 'Utilities', 'u-l', 'u-l', 0, TRUE)
ON CONFLICT (id) DO NOTHING;

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
