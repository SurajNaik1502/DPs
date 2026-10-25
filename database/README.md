# PostgreSQL setup for DPs Recipe Costing

This project can be backed by PostgreSQL instead of the browser `localStorage` app state.

## 1) Install PostgreSQL

### macOS with Homebrew

```bash
brew install postgresql
brew services start postgresql
```

### Create database

```bash
createdb dps_recipe
```

### Connect to it

```bash
psql -U postgres -d dps_recipe
```

### Load schema

```bash
psql -U postgres -d dps_recipe -f database/postgres_schema.sql
```

## 2) Useful commands

### View all tables

```sql
\dt
```

### View rows in a table

```sql
SELECT * FROM users;
SELECT * FROM items;
SELECT * FROM purchases;
SELECT * FROM recipes;
SELECT * FROM recipe_batches;
SELECT * FROM recipe_lines;
SELECT * FROM menu_items;
SELECT * FROM menu_price_history;
```

### Insert data

```sql
INSERT INTO items (id, code, name, kind, category, base_unit_id, purchase_unit_id, min_stock, active)
VALUES
  ('itm-tomato', 'IRM-025', 'Tomato', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0.5, TRUE);
```

```sql
INSERT INTO purchases (
  id, batch_no, purchase_date, supplier, item_id, qty, unit_id, rate, tax_pct, freight, created_by
)
VALUES (
  'pur-1001', 'BTH-2450', '2026-10-25', 'Fresh Mart', 'itm-tomato', 15, 'u-kg', 35, 0, 0, 'usr-purchase'
);
```

```sql
INSERT INTO recipes (id, code, name, kind, yield_qty, yield_unit_id, notes)
VALUES
  ('rcp-sambar', 'SR-002', 'Hotel sambar', 'sub', 4, 'u-kg', 'Sambar base recipe');
```

```sql
INSERT INTO recipe_batches (id, recipe_id, made_at, qty, unit_id, notes)
VALUES
  ('batch-sambar-1', 'rcp-sambar', '2026-10-25T07:00:00+05:30', 4, 'u-kg', 'First batch');
```

```sql
INSERT INTO recipe_lines (id, recipe_id, source_type, item_id, component_recipe_id, qty, unit_id)
VALUES
  ('ln-sambar-1', 'rcp-sambar', 'item', 'itm-tomato', NULL, 500, 'u-g');
```

```sql
INSERT INTO menu_items (id, code, name, group_name, recipe_id, portion_qty, portion_unit_id, selling_price, active)
VALUES
  ('menu-sambar', 'MENU-03', 'Sambar bowl', 'South tiffin', 'rcp-sambar', 1, 'u-plate', 60, TRUE);
```

```sql
INSERT INTO menu_price_history (id, menu_item_id, price, changed_at)
VALUES
  ('mh-3', 'menu-sambar', 60, NOW());
```

## 3) Update data

```sql
UPDATE items
SET name = 'Tomato (fresh)', category = 'Vegetables', active = TRUE
WHERE id = 'itm-tomato';
```

```sql
UPDATE menu_items
SET selling_price = 75
WHERE id = 'menu-sambar';
```

```sql
INSERT INTO menu_price_history (id, menu_item_id, price, changed_at)
VALUES
  ('mh-4', 'menu-sambar', 75, NOW());
```

## 4) Delete data

```sql
DELETE FROM menu_price_history WHERE id = 'mh-4';
DELETE FROM menu_items WHERE id = 'menu-sambar';
```

## 5) View relationships

```sql
SELECT r.id, r.name, rb.made_at, rb.qty, u.code AS unit_code
FROM recipes r
LEFT JOIN recipe_batches rb ON rb.recipe_id = r.id
LEFT JOIN units u ON u.id = rb.unit_id
ORDER BY r.name, rb.made_at DESC;
```

```sql
SELECT m.id, m.name, m.selling_price, h.price, h.changed_at
FROM menu_items m
LEFT JOIN menu_price_history h ON h.menu_item_id = m.id
ORDER BY m.name, h.changed_at DESC;
```

## 6) Useful checks

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

```sql
SELECT * FROM recipes WHERE kind = 'sub';
SELECT * FROM menu_items WHERE active = TRUE;
```
