import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'dps_recipe',
});

app.get('/api/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.get('/api/items', async (_req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        id,
        code,
        name,
        kind,
        category,
        base_unit_id AS "baseUnitId",
        purchase_unit_id AS "purchaseUnitId",
        min_stock AS "minStock",
        active
      FROM items
      ORDER BY
        CASE
          WHEN code ~ '^IRM-[0-9]+$' THEN CAST(REGEXP_REPLACE(code, '^IRM-', '') AS INTEGER)
          ELSE 2147483647
        END ASC,
        code ASC
    `);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
      SELECT
        id,
        code,
        name,
        kind,
        category,
        base_unit_id AS "baseUnitId",
        purchase_unit_id AS "purchaseUnitId",
        min_stock AS "minStock",
        active
      FROM items
      WHERE id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/items', async (req, res) => {
    try {
        const item = req.body;
        const id = item.id || `itm-${Date.now()}`;
        const code = item.code || `IRM-${Date.now()}`;
        const payload = {
            id,
            code,
            name: item.name || '',
            kind: item.kind || 'raw',
            category: item.category || 'General',
            baseUnitId: item.baseUnitId || 'u-kg',
            purchaseUnitId: item.purchaseUnitId || 'u-kg',
            minStock: Number(item.minStock ?? 0),
            active: item.active !== false,
        };

        const result = await pool.query(`
      INSERT INTO items (id, code, name, kind, category, base_unit_id, purchase_unit_id, min_stock, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        code,
        name,
        kind,
        category,
        base_unit_id AS "baseUnitId",
        purchase_unit_id AS "purchaseUnitId",
        min_stock AS "minStock",
        active
    `, [payload.id, payload.code, payload.name, payload.kind, payload.category, payload.baseUnitId, payload.purchaseUnitId, payload.minStock, payload.active]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = req.body;

        const result = await pool.query(`
      UPDATE items
      SET
        code = $2,
        name = $3,
        kind = $4,
        category = $5,
        base_unit_id = $6,
        purchase_unit_id = $7,
        min_stock = $8,
        active = $9
      WHERE id = $1
      RETURNING
        id,
        code,
        name,
        kind,
        category,
        base_unit_id AS "baseUnitId",
        purchase_unit_id AS "purchaseUnitId",
        min_stock AS "minStock",
        active
    `, [
            id,
            item.code || '',
            item.name || '',
            item.kind || 'raw',
            item.category || 'General',
            item.baseUnitId || 'u-kg',
            item.purchaseUnitId || 'u-kg',
            Number(item.minStock ?? 0),
            item.active !== false,
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ deleted: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/units', async (_req, res) => {
    try {
        const result = await pool.query(`
      SELECT id, code, name, kind, is_base AS "isBase"
      FROM units
      ORDER BY code ASC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/state', async (_req, res) => {
    try {
        const [users, units, items, conversions, purchases] = await Promise.all([
            pool.query(`SELECT id, name, username, password, role FROM users ORDER BY name ASC`),
            pool.query(`SELECT id, code, name, kind, is_base AS "isBase" FROM units ORDER BY code ASC`),
            pool.query(`
        SELECT
          id,
          code,
          name,
          kind,
          category,
          base_unit_id AS "baseUnitId",
          purchase_unit_id AS "purchaseUnitId",
          min_stock AS "minStock",
          active
        FROM items
        ORDER BY
          CASE
            WHEN code ~ '^IRM-[0-9]+$' THEN CAST(REGEXP_REPLACE(code, '^IRM-', '') AS INTEGER)
            ELSE 2147483647
          END ASC,
          code ASC
      `),
            pool.query(`
        SELECT
          id,
          from_unit_id AS "fromUnitId",
          to_unit_id AS "toUnitId",
          factor,
          item_id AS "itemId",
          notes
        FROM conversions
      `),
            pool.query(`
        SELECT
          id,
          batch_no AS "batchNo",
          purchase_date AS date,
          supplier,
          item_id AS "itemId",
          qty,
          unit_id AS "unitId",
          rate,
          tax_pct AS "taxPct",
          freight,
          created_by AS "createdBy"
        FROM purchases
        ORDER BY purchase_date DESC, batch_no DESC
      `),
        ]);

        const payload = {
            users: users.rows,
            units: units.rows,
            items: items.rows,
            conversions: conversions.rows,
            purchases: purchases.rows,
            recipes: [],
            menu: [],
        };

        res.json(payload);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/purchases', async (_req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        id,
        batch_no AS "batchNo",
        purchase_date AS date,
        supplier,
        item_id AS "itemId",
        qty,
        unit_id AS "unitId",
        rate,
        tax_pct AS "taxPct",
        freight,
        created_by AS "createdBy"
      FROM purchases
      ORDER BY purchase_date DESC, batch_no DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/purchases', async (req, res) => {
    try {
        const purchase = req.body;
        const id = purchase.id || `p-${Date.now()}`;
        const batchNo = purchase.batchNo || `BTH-${Date.now().toString().slice(-4)}`;
        const createdBy = purchase.createdBy || 'usr-purchase';

        const result = await pool.query(`
      INSERT INTO purchases (
        id, batch_no, purchase_date, supplier, item_id, qty,
        unit_id, rate, tax_pct, freight, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        batch_no AS "batchNo",
        purchase_date AS date,
        supplier,
        item_id AS "itemId",
        qty,
        unit_id AS "unitId",
        rate,
        tax_pct AS "taxPct",
        freight,
        created_by AS "createdBy"
    `, [
            id,
            batchNo,
            purchase.date,
            purchase.supplier,
            purchase.itemId,
            Number(purchase.qty),
            purchase.unitId,
            Number(purchase.rate),
            Number(purchase.taxPct ?? 0),
            Number(purchase.freight ?? 0),
            createdBy,
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/purchases/:id', async (req, res) => {
    try {
        const purchase = req.body;
        const result = await pool.query(`
      UPDATE purchases SET
        batch_no = $2,
        purchase_date = $3,
        supplier = $4,
        item_id = $5,
        qty = $6,
        unit_id = $7,
        rate = $8,
        tax_pct = $9,
        freight = $10
      WHERE id = $1
      RETURNING
        id,
        batch_no AS "batchNo",
        purchase_date AS date,
        supplier,
        item_id AS "itemId",
        qty,
        unit_id AS "unitId",
        rate,
        tax_pct AS "taxPct",
        freight,
        created_by AS "createdBy"
    `, [
            req.params.id,
            purchase.batchNo,
            purchase.date,
            purchase.supplier,
            purchase.itemId,
            Number(purchase.qty),
            purchase.unitId,
            Number(purchase.rate),
            Number(purchase.taxPct ?? 0),
            Number(purchase.freight ?? 0),
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/purchases/bulk', async (req, res) => {
    const client = await pool.connect();
    try {
        const purchases = Array.isArray(req.body) ? req.body : req.body.purchases;
        if (!Array.isArray(purchases) || purchases.length === 0) {
            return res.status(400).json({ error: 'No purchase rows provided' });
        }

        await client.query('BEGIN');
        const inserted = [];

        for (let index = 0; index < purchases.length; index += 1) {
            const purchase = purchases[index];

            const unitAliases = {
                LTR: 'u-l', LITRE: 'u-l', LITER: 'u-l', L: 'u-l',
                KG: 'u-kg', KGS: 'u-kg', KILOGRAM: 'u-kg',
                G: 'u-g', GRAM: 'u-g', GRAMS: 'u-g',
                ML: 'u-ml', PCS: 'u-pcs', PIECES: 'u-pcs',
                BNCH: 'u-bunch', BUNCH: 'u-bunch'
            };

            let unitId = purchase.unitId;
            if (!unitId) {
                const unitCode = String(purchase.unitCode || '').trim().toUpperCase();
                unitId = unitAliases[unitCode];
                if (!unitId) {
                    const unitResult = await client.query(`
            SELECT id FROM units
            WHERE UPPER(code) = $1 OR UPPER(name) = $1 OR id = $2
            LIMIT 1
          `, [unitCode, unitCode]);
                    unitId = unitResult.rows[0]?.id;
                }
            }

            let itemId = purchase.itemId;
            if (!itemId) {
                const itemCode = String(purchase.itemCode || '').trim();
                const itemName = String(purchase.itemName || '').trim();
                if (!itemName) {
                    throw new Error(`Row ${index + 2}: item is required`);
                }

                const existing = await client.query(`
          SELECT id FROM items
          WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
          LIMIT 1
        `, [itemName]);

                if (existing.rows[0]) {
                    itemId = existing.rows[0].id;
                } else {
                    let newCode = itemCode || `IRM-${Date.now()}-${index + 1}`;
                    const codeCheck = await client.query('SELECT 1 FROM items WHERE code = $1', [newCode]);
                    if (codeCheck.rows.length > 0) {
                        newCode = `${newCode}-X${index + 1}-${Date.now()}`;
                    }
                    const itemResult = await client.query(`
            INSERT INTO items (
              id, code, name, kind, category,
              base_unit_id, purchase_unit_id, min_stock, active
            ) VALUES ($1, $2, $3, 'raw', 'General', $4, $4, 0, TRUE)
            RETURNING id
          `, [newCode, newCode, itemName, unitId || 'u-kg']);
                    itemId = itemResult.rows[0].id;
                }
            }

            if (!itemId || !unitId) {
                throw new Error(`Row ${index + 2}: item and unit are required`);
            }

            const id = purchase.id || `p-${Date.now()}-${index}`;
            const batchNo = purchase.batchNo || `BTH-${Date.now().toString().slice(-4)}-${index + 1}`;
            const result = await client.query(`
        INSERT INTO purchases (
          id, batch_no, purchase_date, supplier, item_id, qty,
          unit_id, rate, tax_pct, freight, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (batch_no) DO UPDATE SET
          purchase_date = EXCLUDED.purchase_date,
          supplier = EXCLUDED.supplier,
          item_id = EXCLUDED.item_id,
          qty = EXCLUDED.qty,
          unit_id = EXCLUDED.unit_id,
          rate = EXCLUDED.rate,
          tax_pct = EXCLUDED.tax_pct,
          freight = EXCLUDED.freight
        RETURNING
          id,
          batch_no AS "batchNo",
          purchase_date AS date,
          supplier,
          item_id AS "itemId",
          qty,
          unit_id AS "unitId",
          rate,
          tax_pct AS "taxPct",
          freight,
          created_by AS "createdBy"
      `, [
                id,
                batchNo,
                purchase.date,
                purchase.supplier || '',
                purchase.itemId,
                Number(purchase.qty),
                unitId,
                Number(purchase.rate ?? 0),
                Number(purchase.taxPct ?? 0),
                Number(purchase.freight ?? 0),
                purchase.createdBy || 'usr-purchase',
            ]);
            inserted.push(result.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ imported: inserted.length, purchases: inserted });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.listen(port, () => {
    console.log(`Recipe API listening on http://localhost:${port}`);
});
