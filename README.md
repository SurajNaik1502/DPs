# DPs Recipe Costing

DPs is a recipe costing and kitchen operations web app designed for food businesses that need to track raw material purchases, recipe production batches, menu recipes, and costing in one place.

The app is built as a React + TypeScript + Vite frontend with a browser-based local data store by default, and it includes a PostgreSQL-ready schema for backend migration.

## Overview

This project helps a kitchen or production team manage:

- Item master with purchase tracking
- Raw material purchase entries and supplier history
- Component recipe definitions (sub recipes)
- Production batches with timestamp-based records
- Menu item costing with selling price and margin tracking
- Cost calculations based on the latest purchase price
- Recipe cost reports and menu profitability analysis
- Mobile-friendly, installable app experience

The app is branded as DPs and uses a simple admin-driven workflow for kitchen and purchase operations.

## Key business rules implemented

- Latest purchase price is used for cost calculations instead of weighted average.
- Component recipes can have multiple production batches with timestamps.
- Batch records can vary in date, quantity, and cost depending on when the recipe was made.
- Menu recipes and sub recipes are shown as separate navigation sections.
- The latest production and pricing values are surfaced first; deeper history remains expandable.
- The app shell keeps the sidebar fixed while the main content area scrolls.

## Default login users

The app comes with seeded demo users:

- Admin
  - Username: admin
  - Password: admin123
- Kitchen
  - Username: kitchen
  - Password: kitchen123
- Purchase
  - Username: purchase
  - Password: purchase123

## Tech stack

- React 19
- TypeScript
- Vite
- React Router
- LocalStorage persistence
- GitHub Pages deployment support
- PostgreSQL schema for backend readiness

## Project structure

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── database/
│   ├── postgres_schema.sql
│   └── README.md
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── Modal.tsx
│   ├── data/
│   │   ├── ids.ts
│   │   └── seed.ts
│   ├── lib/
│   │   ├── costing.ts
│   │   └── units.ts
│   ├── pages/
│   │   ├── Conversions.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Items.tsx
│   │   ├── Login.tsx
│   │   ├── Menu.tsx
│   │   ├── Purchase.tsx
│   │   ├── Recipes.tsx
│   │   ├── Reports.tsx
│   │   └── Units.tsx
│   └── store/
│       └── db.tsx
└── public/
    └── (PWA assets if added in the app shell)
```

## Installation

From the project root:

```bash
npm install
```

## Run locally

```bash
npm run dev
```

The Vite dev server will usually start on:

```text
http://localhost:5173
```

## Production build

```bash
npm run build
```

This generates the production build in the `dist` folder.

## Deploy to GitHub Pages

The project is configured for GitHub Pages deployment.

Commands:

```bash
npm run deploy
```

This runs the production build first and then publishes the `dist` folder to GitHub Pages using `gh-pages`.

Note: the app is configured with a repository-aware base path so it works correctly when served from a GitHub Pages subpath.

## App behaviour and modules

### Dashboard

The kitchen board is the default landing screen and provides a summary view for operational activity.

### Item master

Used to manage raw ingredients and consumables. Each item tracks:

- item code
- category
- base unit
- purchase unit
- minimum stock level
- active/inactive status

### Purchase

Purchase entries are used to record:

- supplier
- item
- quantity
- unit
- rate
- tax and freight
- created by
- purchase date

### Component recipes

Component recipes are sub recipes such as batter, gravy, chutney, etc.

Each component recipe can include:

- code and name
- yield quantity and unit
- ingredient lines
- multiple production batches with timestamps
- notes

### Menu recipes

Menu recipes are separate from component recipes. This split keeps menu items and production recipes independently managed.

### Reports

The costing reports view helps review:

- menu cost vs selling price
- margin percentage
- recipe cost breakdown
- per-kg costing

## Costing logic

The application cost model uses the latest purchase rate as the primary pricing mechanism for ingredients.

This is implemented in the costing layer:

- `latestPurchaseRate()` picks the last purchase entry for an item
- `costForItemQty()` applies that latest rate for cost calculations
- `recipeCost()` totals ingredient usage for a recipe
- `menuCosting()` calculates menu cost, margin, and margin percentage

The weighted average function is retained as a fallback/reference option, but the app uses the latest purchase logic as the active behavior.

## Batches and timestamps

A key requirement for the app was the ability to track multiple batches for the same recipe over time.

For example:

- Idli batter made in the morning
- Idli batter made in the evening
- Idli batter made the previous day

Each batch can carry a different:

- timestamp
- quantity
- yield
- unit

The latest batch is favored in the summary UI.

## LocalStorage data model

The frontend stores the app state in browser localStorage using a single app state object.

Key data entities:

- `users`
- `units`
- `conversions`
- `items`
- `purchases`
- `recipes`
- `menu`

The default seeded dataset includes sample items and example recipes such as Idli batter and menu dishes.

## PostgreSQL support

The project includes a PostgreSQL schema in:

- `database/postgres_schema.sql`

The schema includes:

- `users`
- `units`
- `items`
- `conversions`
- `purchases`
- `recipes`
- `recipe_batches`
- `recipe_lines`
- `menu_items`
- `menu_price_history`

This is designed to mirror the app’s domain model and make it easier to move from local browser data to a real backend database.

Detailed PostgreSQL usage and example insert/update/query flows are documented in:

- `database/README.md`

## Example PostgreSQL flow

### Create database

```bash
createdb dps_recipe
```

### Load schema

```bash
psql -U postgres -d dps_recipe -f database/postgres_schema.sql
```

### Insert a new item

```sql
INSERT INTO items (id, code, name, kind, category, base_unit_id, purchase_unit_id, min_stock, active)
VALUES
  ('itm-tomato', 'IRM-025', 'Tomato', 'raw', 'Vegetables', 'u-kg', 'u-kg', 0.5, TRUE);
```

### Insert a purchase

```sql
INSERT INTO purchases (
  id, batch_no, purchase_date, supplier, item_id, qty, unit_id, rate, tax_pct, freight, created_by
)
VALUES (
  'pur-1001', 'BTH-2450', '2026-10-25', 'Fresh Mart', 'itm-tomato', 15, 'u-kg', 35, 0, 0, 'usr-purchase'
);
```

### Insert a recipe batch

```sql
INSERT INTO recipe_batches (id, recipe_id, made_at, qty, unit_id, notes)
VALUES
  ('batch-sambar-1', 'rcp-sambar', '2026-10-25T07:00:00+05:30', 4, 'u-kg', 'First batch');
```

### Query recipe batches

```sql
SELECT r.id, r.name, rb.made_at, rb.qty, u.code AS unit_code
FROM recipes r
LEFT JOIN recipe_batches rb ON rb.recipe_id = r.id
LEFT JOIN units u ON u.id = rb.unit_id
ORDER BY r.name, rb.made_at DESC;
```

### Update menu price

```sql
UPDATE menu_items
SET selling_price = 75
WHERE id = 'menu-sambar';
```

### Add price history

```sql
INSERT INTO menu_price_history (id, menu_item_id, price, changed_at)
VALUES
  ('mh-4', 'menu-sambar', 75, NOW());
```

## Useful commands

```bash
npm install
npm run dev
npm run build
npm run deploy
```

## Notes for future development

- The app is already structured to support a backend service integration.
- The PostgreSQL schema makes it easier to replace browser localStorage with a real database.
- The project is suitable for a kitchen, canteen, cloud kitchen, or food production costing workflow.
- The frontend can be extended with authentication, API integration, reporting exports, and inventory stock management.

## License

This project is intended for internal business workflow use and is not published as a generic open-source package unless explicitly licensed otherwise.

## Summary

DPs Recipe Costing is a practical kitchen costing application built for real-world production and pricing operations. It combines ingredient purchase tracking, recipe production batches, menu costing, and profitability analysis in a workflow-friendly interface designed for business use.
