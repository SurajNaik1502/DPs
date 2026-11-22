import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Modal } from "../components/Modal";
import { landedCost } from "../lib/costing";
import { fmtMoney, unitCode } from "../lib/units";
import { importPurchasesToDb, savePurchaseToDb, useStore } from "../store/db";
import type { Purchase } from "../types";

export function PurchasePage() {
  const { state, refreshFromDb, user } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Purchase | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingImport, setPendingImport] = useState<
    Array<{
      batchNo: string;
      date: string;
      supplier: string;
      itemId: string;
      qty: number;
      unitId: string;
      rate: number;
      taxPct: number;
      freight: number;
      createdBy: string;
    }>
  >([]);
  const [inputMode, setInputMode] = useState<"manual" | "excel" | null>(
    "manual",
  );
  const rows = useMemo(() => {
    return [...state.purchases]
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.batchNo.localeCompare(a.batchNo),
      )
      .filter((p) => {
        const item = state.items.find((i) => i.id === p.itemId);
        const blob =
          `${p.batchNo} ${p.supplier} ${item?.name ?? ""}`.toLowerCase();
        return blob.includes(q.toLowerCase());
      });
  }, [state, q]);

  const persist = async (p: Purchase) => {
    try {
      if (!p.id) {
        if (pendingImport.length === 0) {
          throw new Error("Add at least one purchase row");
        }

        for (let index = 0; index < pendingImport.length; index += 1) {
          const row = pendingImport[index];
          if (!row.batchNo && pendingImport.length > 1) {
            row.batchNo = `BTH-${Date.now().toString().slice(-4)}-${index + 1}`;
          }
          if (!row.batchNo) {
            row.batchNo = `BTH-${Date.now().toString().slice(-4)}`;
          }
          if (!row.date) throw new Error(`Row ${index + 1}: Date is required`);
          if (!row.itemId)
            throw new Error(`Row ${index + 1}: Item is required`);
          if (!row.unitId)
            throw new Error(`Row ${index + 1}: Unit is required`);
          if (!(row.qty > 0))
            throw new Error(
              `Row ${index + 1}: Quantity must be greater than zero`,
            );
        }

        const result = await importPurchasesToDb(
          pendingImport.map((row) => ({
            ...row,
            createdBy: user?.id ?? "usr-purchase",
          })),
        );
        await refreshFromDb();
        setPendingImport([]);
        setInputMode("manual");
        setEdit(null);
        setUploadStatus(
          `Imported ${result.imported} purchase row(s) successfully`,
        );
        return;
      }

      await savePurchaseToDb(p);
      await refreshFromDb();
      setEdit(null);
      setUploadStatus("");
    } catch (error) {
      setUploadStatus(
        error instanceof Error ? error.message : "Failed to save purchase",
      );
    }
  };

  const uploadExcel = (file: File) => {
    setUploading(true);
    setUploadStatus("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bytes = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error("The Excel file has no worksheets");

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
        if (rows.length === 0) throw new Error("The Excel worksheet is empty");

        const normalizedKey = (value: unknown) =>
          String(value ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const getValue = (row: Record<string, unknown>, names: string[]) => {
          const wanted = names.map(normalizedKey);
          const entry = Object.entries(row).find(([key]) =>
            wanted.includes(normalizedKey(key)),
          );
          return entry?.[1] ?? "";
        };

        const numberValue = (value: unknown) => {
          if (typeof value === "number") return value;
          const parsed = Number(String(value).replace(/,/g, ""));
          return Number.isFinite(parsed) ? parsed : 0;
        };

        const dateValue = (value: unknown) => {
          if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
          }
          if (typeof value === "number") {
            const parsed = XLSX.SSF.parse_date_code(value);
            if (parsed) {
              return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
            }
          }
          const text = String(value).trim();
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
            const [year, month, day] = text.split("-");
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          const parsed = new Date(text);
          return Number.isNaN(parsed.getTime())
            ? ""
            : parsed.toISOString().slice(0, 10);
        };

        const purchases: Array<{
          batchNo: string;
          date: string;
          supplier: string;
          itemId: string;
          itemCode?: string;
          itemName?: string;
          qty: number;
          unitId: string;
          rate: number;
          taxPct: number;
          freight: number;
          createdBy: string;
        }> = [];
        const errors: string[] = [];

        rows.forEach((row, index) => {
          const itemValue = String(
            getValue(row, ["Item", "Item Name", "Item Code"]),
          ).trim();
          const unitValue = String(
            getValue(row, ["Unit", "Unit Code", "Purchase Unit"]),
          ).trim();

          const itemCodeMatch = itemValue.match(
            /^([A-Za-z]+[- ]?\d+)(?:\s+|$)/,
          );
          const extractedItemCode = itemCodeMatch
            ? itemCodeMatch[1].replace(/\s/g, "-").toUpperCase()
            : "";
          const extractedItemName = extractedItemCode
            ? itemValue.slice(itemCodeMatch![0].length).trim()
            : itemValue;

          const itemKey = normalizedKey(extractedItemName || itemValue);
          const item = state.items.find(
            (candidate) =>
              normalizedKey(candidate.name) === itemKey ||
              normalizedKey(candidate.code) === normalizedKey(itemValue) ||
              (extractedItemCode &&
                normalizedKey(candidate.code) ===
                  normalizedKey(extractedItemCode)),
          );

          const unitAlias: Record<string, string> = {
            ltr: "u-l",
            litre: "u-l",
            liter: "u-l",
            kgs: "u-kg",
            kilogram: "u-kg",
            kg: "u-kg",
            grams: "u-g",
            gram: "u-g",
            g: "u-g",
            ml: "u-ml",
            pcs: "u-pcs",
            pieces: "u-pcs",
            bnch: "u-bunch",
            bunch: "u-bunch",
          };
          const unitKey = normalizedKey(unitValue);
          const aliasedUnitId = unitAlias[unitKey];
          const unit = state.units.find(
            (candidate) =>
              aliasedUnitId === candidate.id ||
              normalizedKey(candidate.code) === unitKey ||
              normalizedKey(candidate.name) === unitKey ||
              normalizedKey(candidate.id) === unitKey,
          );

          const date = dateValue(getValue(row, ["Date", "Purchase Date"]));
          const qty = numberValue(getValue(row, ["Qty", "Quantity"]));

          if (!item && !extractedItemName && !itemValue)
            errors.push(`Row ${index + 2}: item is required`);
          if (!unit)
            errors.push(`Row ${index + 2}: unknown unit "${unitValue}"`);
          if (!date)
            errors.push(
              `Row ${index + 2}: invalid date "${getValue(row, ["Date", "Purchase Date"])}"`,
            );
          if (qty <= 0)
            errors.push(`Row ${index + 2}: quantity must be greater than zero`);

          if (
            unit &&
            date &&
            qty > 0 &&
            (item || extractedItemName || itemValue)
          ) {
            purchases.push({
              batchNo: String(
                getValue(row, ["Batch No", "Batch", "Batch Number"]),
              ).trim(),
              date,
              supplier: String(getValue(row, ["Supplier", "Vendor"])).trim(),
              itemId: item?.id ?? "",
              itemCode: extractedItemCode || (item?.code ?? ""),
              itemName: item?.name ?? (extractedItemName || itemValue),
              qty,
              unitId: unit.id,
              rate: numberValue(getValue(row, ["Rate", "Unit Rate", "Price"])),
              taxPct: numberValue(
                getValue(row, ["Tax %", "Tax", "Tax Percent"]),
              ),
              freight: numberValue(
                getValue(row, ["Freight", "Freight Charge"]),
              ),
              createdBy: user?.id ?? "usr-purchase",
            });
          }
        });

        if (errors.length > 0) {
          throw new Error(errors.slice(0, 5).join(" • "));
        }

        setPendingImport(purchases);
        setInputMode("excel");
        setUploadStatus(
          `Parsed ${purchases.length} purchase row(s). Review below, then save.`,
        );
      } catch (error) {
        setUploadStatus(
          error instanceof Error
            ? error.message
            : "Failed to import Excel file",
        );
      } finally {
        setUploading(false);
        event.target &&
          ((
            document.querySelector<HTMLInputElement>(
              "input[type=file]",
            ) as HTMLInputElement
          ).value = "");
      }
    };
    reader.onerror = () => {
      setUploading(false);
      setUploadStatus("Could not read the selected Excel file");
    };
    reader.readAsArrayBuffer(file);
  };

  const blankPurchaseRow = () => ({
    batchNo: "",
    date: new Date().toISOString().slice(0, 10),
    supplier: "",
    itemId: state.items[0]?.id ?? "",
    qty: 1,
    unitId: state.items[0]?.purchaseUnitId ?? "u-kg",
    rate: 0,
    taxPct: 5,
    freight: 0,
    createdBy: user?.id ?? "usr-purchase",
  });

  const updatePendingRow = (
    index: number,
    field: keyof (typeof pendingImport)[number],
    value: string | number,
  ) => {
    setPendingImport((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addPendingRow = () => {
    setPendingImport((current) => [...current, blankPurchaseRow()]);
  };

  const removePendingRow = (index: number) => {
    setPendingImport((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const downloadPurchaseTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const purchaseSheet = XLSX.utils.aoa_to_sheet([
      [
        "Batch No",
        "Date",
        "Supplier",
        "Item",
        "Qty",
        "Unit",
        "Rate",
        "Tax %",
        "Freight",
      ],
    ]);

    purchaseSheet["!cols"] = [
      { wch: 16 },
      { wch: 12 },
      { wch: 20 },
      { wch: 32 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
    ];

    const itemRows = state.items.map((item) => [item.code, item.name]);
    const itemSheet = XLSX.utils.aoa_to_sheet([
      ["Item Code", "Item Name"],
      ...itemRows,
    ]);
    itemSheet["!cols"] = [{ wch: 16 }, { wch: 36 }];

    const unitRows = state.units.map((unit) => [unit.code, unit.name]);
    const unitSheet = XLSX.utils.aoa_to_sheet([
      ["Unit Code", "Unit Name"],
      ...unitRows,
    ]);
    unitSheet["!cols"] = [{ wch: 12 }, { wch: 24 }];

    XLSX.utils.book_append_sheet(workbook, purchaseSheet, "Purchase Template");
    XLSX.utils.book_append_sheet(workbook, itemSheet, "Items Reference");
    XLSX.utils.book_append_sheet(workbook, unitSheet, "Units Reference");
    XLSX.writeFile(workbook, "purchase-import-template.xlsx");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Purchase</h2>
          <p className="muted">
            Batch-wise inward. Landed cost = qty × rate + tax + freight.
          </p>
        </div>
        <button
          className="btn"
          onClick={() => {
            setPendingImport([]);
            setInputMode(null);
            setUploadStatus("");
            setEdit({
              id: "",
              batchNo: "",
              date: new Date().toISOString().slice(0, 10),
              supplier: "",
              itemId: state.items[0]?.id ?? "",
              qty: 1,
              unitId: state.items[0]?.purchaseUnitId ?? "u-kg",
              rate: 0,
              taxPct: 5,
              freight: 0,
              createdBy: user?.id ?? "",
            });
          }}
        >
          New purchase
        </button>
      </div>
      <div className="card">
        <div className="toolbar">
          <input
            placeholder="Search batch, supplier, item"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="purchase-list-wrap">
          <table className="purchase-list-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Date</th>
                <th>Item</th>
                <th>Supplier</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Landed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const item = state.items.find((i) => i.id === p.itemId);
                return (
                  <tr key={p.id}>
                    <td data-label="Batch">{p.batchNo}</td>
                    <td data-label="Date">{p.date}</td>
                    <td data-label="Item">{item?.name}</td>
                    <td data-label="Supplier">{p.supplier}</td>
                    <td data-label="Qty" className="num">
                      {p.qty} {unitCode(state, p.unitId)}
                    </td>
                    <td data-label="Rate" className="num">{fmtMoney(p.rate)}</td>
                    <td data-label="Landed" className="num">{fmtMoney(landedCost(p))}</td>
                    <td data-label="Action">
                      <button
                        className="btn ghost small"
                        onClick={() => setEdit(p)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {edit && (
        <Modal
          title={
            edit.id
              ? "Edit purchase"
              : "New purchase — review data before saving"
          }
          onClose={() => {
            setPendingImport([]);
            setInputMode(null);
            setUploadStatus("");
            setEdit(null);
          }}
        >
          {edit.id ? (
            <>
              <div className="form-grid">
                <div>
                  <label>Batch no</label>
                  <input
                    value={edit.batchNo}
                    onChange={(e) =>
                      setEdit({ ...edit, batchNo: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Date</label>
                  <input
                    type="date"
                    value={edit.date}
                    onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                  />
                </div>
                <div>
                  <label>Supplier</label>
                  <input
                    value={edit.supplier}
                    onChange={(e) =>
                      setEdit({ ...edit, supplier: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Item</label>
                  <select
                    value={edit.itemId}
                    onChange={(e) => {
                      const item = state.items.find(
                        (i) => i.id === e.target.value,
                      );
                      setEdit({
                        ...edit,
                        itemId: e.target.value,
                        unitId: item?.purchaseUnitId ?? edit.unitId,
                      });
                    }}
                  >
                    {state.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Qty</label>
                  <input
                    type="number"
                    step="any"
                    value={edit.qty}
                    onChange={(e) =>
                      setEdit({ ...edit, qty: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label>Unit</label>
                  <select
                    value={edit.unitId}
                    onChange={(e) =>
                      setEdit({ ...edit, unitId: e.target.value })
                    }
                  >
                    {state.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Rate</label>
                  <input
                    type="number"
                    step="any"
                    value={edit.rate}
                    onChange={(e) =>
                      setEdit({ ...edit, rate: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label>Tax %</label>
                  <input
                    type="number"
                    step="any"
                    value={edit.taxPct}
                    onChange={(e) =>
                      setEdit({ ...edit, taxPct: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label>Freight</label>
                  <input
                    type="number"
                    step="any"
                    value={edit.freight}
                    onChange={(e) =>
                      setEdit({ ...edit, freight: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <p className="muted">Landed: {fmtMoney(landedCost(edit))}</p>
            </>
          ) : (
            <>
              <div className="purchase-input-options">
                <button
                  type="button"
                  className={`purchase-option ${inputMode === "manual" ? "active" : ""}`}
                  onClick={() => {
                    setInputMode("manual");
                    if (pendingImport.length === 0)
                      setPendingImport([blankPurchaseRow()]);
                  }}
                  disabled={inputMode === "excel"}
                >
                  <strong>Enter manually</strong>
                  <span>Add rows directly in the grid</span>
                </button>
                <button
                  type="button"
                  className={`purchase-option ${inputMode === "excel" ? "active" : ""}`}
                  onClick={() => setInputMode("excel")}
                  disabled={inputMode === "manual"}
                >
                  <strong>Upload Excel</strong>
                  <span>Import and review spreadsheet rows</span>
                </button>
              </div>

              {inputMode === "excel" && (
                <div className="excel-upload-panel">
                  <div>
                    <strong>Excel purchase file</strong>
                    <p className="muted">
                      Columns: Batch No, Date, Supplier, Item, Qty, Unit, Rate,
                      Tax %, Freight
                    </p>
                  </div>
                  <div className="excel-upload-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={downloadPurchaseTemplate}
                    >
                      Download template
                    </button>
                    <label className="btn file-upload">
                      {uploading ? "Uploading..." : "Choose Excel file"}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadExcel(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {inputMode === "manual" && (
                <div className="purchase-grid-wrap">
                  <div className="purchase-grid-actions">
                    <strong>Manual purchase grid</strong>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={addPendingRow}
                    >
                      + Add row
                    </button>
                  </div>
                  <table className="purchase-grid">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>Tax %</th>
                        <th>Freight</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingImport.map((row, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              value={row.batchNo}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "batchNo",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) =>
                                updatePendingRow(index, "date", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.supplier}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "supplier",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={row.itemId}
                              onChange={(e) => {
                                const item = state.items.find(
                                  (i) => i.id === e.target.value,
                                );
                                setPendingImport((current) =>
                                  current.map((itemRow, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...itemRow,
                                          itemId: e.target.value,
                                          unitId:
                                            item?.purchaseUnitId ??
                                            itemRow.unitId,
                                        }
                                      : itemRow,
                                  ),
                                );
                              }}
                            >
                              {state.items.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.code} {item.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              value={row.qty}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "qty",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={row.unitId}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "unitId",
                                  e.target.value,
                                )
                              }
                            >
                              {state.units.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              value={row.rate}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "rate",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              value={row.taxPct}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "taxPct",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              value={row.freight}
                              onChange={(e) =>
                                updatePendingRow(
                                  index,
                                  "freight",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => removePendingRow(index)}
                              disabled={pendingImport.length === 1}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {inputMode === "excel" && pendingImport.length > 0 && (
                <div className="purchase-grid-wrap">
                  <div className="purchase-grid-actions">
                    <strong>Excel review grid</strong>
                    <span className="muted">{pendingImport.length} row(s)</span>
                  </div>
                  <table className="purchase-grid">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>Tax %</th>
                        <th>Freight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingImport.map((row, index) => {
                        const item = state.items.find(
                          (candidate) => candidate.id === row.itemId,
                        );
                        const unit = state.units.find(
                          (candidate) => candidate.id === row.unitId,
                        );
                        return (
                          <tr key={index}>
                            <td>{row.batchNo}</td>
                            <td>{row.date}</td>
                            <td>{row.supplier}</td>
                            <td>{item?.name}</td>
                            <td className="num">{row.qty}</td>
                            <td>{unit?.code}</td>
                            <td className="num">{fmtMoney(row.rate)}</td>
                            <td className="num">{row.taxPct}%</td>
                            <td className="num">{fmtMoney(row.freight)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {uploadStatus && <p className="upload-status">{uploadStatus}</p>}
          <div className="modal-actions">
            <button
              className="btn ghost"
              onClick={() => {
                setPendingImport([]);
                setInputMode("manual");
                setUploadStatus("");
                setEdit(null);
              }}
            >
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save purchase
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
