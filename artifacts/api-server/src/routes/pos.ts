import { Router, type IRouter, type RequestHandler } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  auditLogs,
  categories,
  db,
  expenses,
  inventoryItems,
  payments,
  products,
  transactionItems,
  transactions,
} from "@workspace/db";
import {
  CancelTransactionBody,
  CancelTransactionParams,
  CreateExpenseBody,
  CreateExpenseResponse,
  CreateTransactionBody,
  DeleteExpenseParams,
  ExportBackupResponse,
  GetActivityQueryParams,
  GetTransactionParams,
  ImportBackupBody,
  ImportBackupResponse,
  ListExpensesResponse,
  ListProductsQueryParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
let seeded = false;

const money = (value: unknown) => Number(value ?? 0);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

type BackupRow = Record<string, unknown>;
type BackupPayload = {
  format: "potocopy-qta-backup";
  version: "1";
  exportedAt: Date;
  categories: BackupRow[];
  products: BackupRow[];
  inventoryItems: BackupRow[];
  transactions: BackupRow[];
  transactionItems: BackupRow[];
  payments: BackupRow[];
  expenses: BackupRow[];
  auditLogs: BackupRow[];
};

const requiredBackupString = (row: BackupRow, key: string) => {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Backup field ${key} must be text.`);
  return value;
};
const requiredBackupNumber = (row: BackupRow, key: string, integer = false) => {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new Error(`Backup field ${key} must be a valid number.`);
  }
  return value;
};
const optionalBackupString = (row: BackupRow, key: string) => {
  const value = row[key];
  if (value == null) return null;
  return requiredBackupString(row, key);
};
const requiredBackupDate = (row: BackupRow, key: string) => {
  const value = requiredBackupString(row, key);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Backup field ${key} must be a valid date.`);
  return date;
};
const optionalBackupDate = (row: BackupRow, key: string) => {
  const value = row[key];
  if (value == null) return null;
  return requiredBackupDate(row, key);
};
const purchasedItems = [
  "HVS A3 75 PPLITE",
  "Laminating F4 Amanda",
  "F100 Vision",
  "Q100 Vision 100",
  "Forte 38",
  "Reyko 38",
  "Boxy One Heart 38/810",
  "Tip x Rol Grillee 124",
  "Tip x Aligator",
  "Tip x Joyko S225",
  "BP Lilinku",
  "BP Evercoss EV1 Trans HTM 816",
  "BP Gel EV 800 Biru",
  "BP Gel EV 800 HTM",
  "BP Marna EV 691",
  "BP Gel EV 811 HTM",
  "BP Kedblue",
  "PS 2B EV 205",
  "PS 2B Squeezy",
  "PS 2B M60",
  "PS 2B Office Animal",
  "Stip/Staple Grebel 40 HTM 840",
  "Serutan DMS 825",
  "Serutan Toples Cat/Pan 700",
  "Serutan Toples 6663 Spuler",
  "Serutan Toples 6663 Hippy",
  "Serutan Toples 6661 BDA1",
  "Stabilo M&G",
  "Stabilo F/Castel Blue",
  "Stabilo F/Castel Green",
  "Stabilo F/Castel Lilac",
  "Stabilo F/Castel Pink",
  "Stabilo F/Castel Red",
  "Stabilo F/Castel Yellow",
  "Cutter B Trans Warna",
  "GI/Gl Orlee 0402",
  "Amp Merpati 104 Polos",
  "Amp Merpati 90 Polos 860",
  "Map Biasa Biru",
  "Map Biasa Merah",
  "Amp 310 AM Tali Kikyoto",
  "D/Tape 1 Wees Tipis",
  "D/Tape 1/2 Wees Tipis",
  "Lakban 1,5\" Wees TBL",
  "Lakban 2\" DSP TPSG72",
  "Solasi PVC Vulcan Rol",
  "Solasi KS Beninu 8640",
  "Solasi Lux 10 Yard",
  "Tinta Blueprini BP003 Black",
  "Tinta Blueprini BP003 Cyan",
  "Tinta Blueprini BP003 Magenta",
  "Tinta Blueprini BP003 Yellow",
  "Jidar 30 cm Besco M300",
  "Spidol Joyko PM 17",
  "Spidol Joyko WM 65",
  "Spidol 12W Agra",
  "Kwitansi Vision K 8560",
  "Kwitansi Vision TG",
  "Nota K1 Forte0320",
  "Glue Stick EV K",
  "HVS A4 75 Ultima",
  "HVS/F4 75 Ultima",
  "Stapler Joyko HD 50 CL",
  "Stapler Combo HD10KEO",
  "Staples SUI B No. 24 6500",
  "Staples SDI 10 K 81000",
  "Sticky Note Fourie 654 Kuning",
  "Memo Stick MMS 2 JK",
  "Index Forte032",
  "Jidar Besi 30 cm Esco",
  "B/Clip Combo 105",
  "B/Clip Combo 107",
  "B/Clip Combo 111",
  "B/Clip Combo 155",
  "B/Clip Combo 200",
  "B/Clip Combo 260",
  "Clip Combo No. 3",
  "SMP Mika Rol 34 cm",
  "Kado GK",
  "Kado LS",
  "Kado Kiki G2RIM",
  "Kado Sidu",
  "Kado Piala",
  "Loose Leaf B5 100 Boss 650",
  "Loose Leaf B5 50 Boss",
] as const;

const internalItemNames = new Set([
  "HVS A3 75 PPLITE",
  "Laminating F4 Amanda",
  "HVS A4 75 Ultima",
  "HVS/F4 75 Ultima",
  "Lakban 1,5\" Wees TBL",
  "Lakban 2\" DSP TPSG72",
  "Solasi PVC Vulcan Rol",
  "Solasi KS Beninu 8640",
  "Solasi Lux 10 Yard",
  "Tinta Blueprini BP003 Black",
  "Tinta Blueprini BP003 Cyan",
  "Tinta Blueprini BP003 Magenta",
  "Tinta Blueprini BP003 Yellow",
]);

const purchasedSkuByName: Map<string, string> = new Map(
  purchasedItems.map((name, index) => [
    name,
    `BELI-${String(index + 1).padStart(3, "0")}`,
  ]),
);
const internalProductSkus = [...internalItemNames]
  .map((name) => purchasedSkuByName.get(name))
  .filter((sku): sku is string => Boolean(sku));

const internalInventoryItems = [
  { name: "HVS A3 75 PPLITE", sku: "BAHAN-001", category: "Bahan Internal", unit: "rim", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Laminating F4 Amanda", sku: "BAHAN-002", category: "Bahan Internal", unit: "pack", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "HVS A4 75 Ultima", sku: "BAHAN-003", category: "Bahan Internal", unit: "rim", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "HVS/F4 75 Ultima", sku: "BAHAN-004", category: "Bahan Internal", unit: "rim", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Lakban 1,5\" Wees TBL", sku: "BAHAN-005", category: "Bahan Internal", unit: "roll", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Lakban 2\" DSP TPSG72", sku: "BAHAN-006", category: "Bahan Internal", unit: "roll", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Solasi PVC Vulcan Rol", sku: "BAHAN-007", category: "Bahan Internal", unit: "roll", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Solasi KS Beninu 8640", sku: "BAHAN-008", category: "Bahan Internal", unit: "roll", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Solasi Lux 10 Yard", sku: "BAHAN-009", category: "Bahan Internal", unit: "roll", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Tinta Blueprini BP003 Black", sku: "BAHAN-010", category: "Bahan Internal", unit: "botol", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Tinta Blueprini BP003 Cyan", sku: "BAHAN-011", category: "Bahan Internal", unit: "botol", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Tinta Blueprini BP003 Magenta", sku: "BAHAN-012", category: "Bahan Internal", unit: "botol", currentStock: "0", minimumStock: "1", status: "OUT" },
  { name: "Tinta Blueprini BP003 Yellow", sku: "BAHAN-013", category: "Bahan Internal", unit: "botol", currentStock: "0", minimumStock: "1", status: "OUT" },
];

// Retail benchmark refreshed September 2026 from Indonesian stationery,
// printing, and marketplace listings. Values are selling prices per catalog
// unit. Internal supplies are tracked in Inventory and are not sold through
// the customer catalog.
const catalogPrices: Record<string, string> = {
  "FC-A4": "500",
  "FC-F4": "750",
  "PR-A4-BW": "1000",
  "PR-A4-COLOR": "4000",
  "LAM-A4": "5000",
  "JLD-SPR": "8000",
  "ATK-PEN": "3500",
  "ATK-MAP": "2500",
  "BELI-003": "3000",
  "BELI-004": "3000",
  "BELI-005": "2500",
  "BELI-006": "2500",
  "BELI-007": "7000",
  "BELI-008": "5000",
  "BELI-009": "5500",
  "BELI-010": "5000",
  "BELI-011": "2000",
  "BELI-012": "2500",
  "BELI-013": "2000",
  "BELI-014": "2000",
  "BELI-015": "2500",
  "BELI-016": "2500",
  "BELI-017": "3000",
  "BELI-018": "2500",
  "BELI-019": "2500",
  "BELI-020": "2500",
  "BELI-021": "3000",
  "BELI-022": "10000",
  "BELI-023": "5000",
  "BELI-024": "6500",
  "BELI-025": "6500",
  "BELI-026": "6500",
  "BELI-027": "6500",
  "BELI-028": "5000",
  "BELI-029": "6000",
  "BELI-030": "6000",
  "BELI-031": "6000",
  "BELI-032": "6000",
  "BELI-033": "6000",
  "BELI-034": "6000",
  "BELI-035": "5000",
  "BELI-036": "5000",
  "BELI-037": "150",
  "BELI-038": "150",
  "BELI-039": "1500",
  "BELI-040": "1500",
  "BELI-041": "2500",
  "BELI-042": "4000",
  "BELI-043": "3500",
  "BELI-053": "3000",
  "BELI-054": "5000",
  "BELI-055": "5000",
  "BELI-056": "5000",
  "BELI-057": "6000",
  "BELI-058": "8000",
  "BELI-059": "5000",
  "BELI-060": "3500",
  "BELI-063": "28500",
  "BELI-064": "12000",
  "BELI-065": "8000",
  "BELI-066": "10000",
  "BELI-067": "10000",
  "BELI-068": "10000",
  "BELI-069": "8000",
  "BELI-070": "8000",
  "BELI-071": "500",
  "BELI-072": "700",
  "BELI-073": "1000",
  "BELI-074": "1200",
  "BELI-075": "1500",
  "BELI-076": "2000",
  "BELI-077": "4000",
  "BELI-078": "12000",
  "BELI-079": "5000",
  "BELI-080": "6000",
  "BELI-081": "7500",
  "BELI-082": "6000",
  "BELI-083": "10000",
  "BELI-084": "200",
  "BELI-085": "150",
};

const catalogUnits: Record<string, string> = {
  "FC-A4": "lembar",
  "FC-F4": "lembar",
  "PR-A4-BW": "lembar",
  "PR-A4-COLOR": "lembar",
  "LAM-A4": "lembar",
  "JLD-SPR": "pcs",
  "ATK-PEN": "pcs",
  "ATK-MAP": "pcs",
  "BELI-041": "pcs",
  "BELI-037": "pcs",
  "BELI-038": "pcs",
  "BELI-071": "pcs",
  "BELI-072": "pcs",
  "BELI-073": "pcs",
  "BELI-074": "pcs",
  "BELI-075": "pcs",
  "BELI-076": "pcs",
  "BELI-077": "pcs",
  "BELI-084": "lembar",
  "BELI-085": "lembar",
};

async function applyCatalogPrices() {
  await Promise.all(
    Object.entries(catalogPrices).map(([sku, price]) =>
      db.update(products)
        .set({
          price,
          ...(catalogUnits[sku] ? { unit: catalogUnits[sku] } : {}),
        })
        .where(eq(products.sku, sku)),
    ),
  );
}

async function archiveInternalProducts() {
  await Promise.all(
    internalProductSkus.map((sku) =>
      db.update(products).set({ active: false }).where(eq(products.sku, sku)),
    ),
  );
}

const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: "Silakan masuk untuk melanjutkan." });
  }
  return next();
};

async function ensureSeeded() {
  if (seeded) return;
  await db.insert(categories).values([
    { name: "Fotokopi" },
    { name: "Print" },
    { name: "Finishing" },
    { name: "ATK" },
  ]).onConflictDoNothing();
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) {
    const categoryRows = await db.select().from(categories);
    const categoryId = Object.fromEntries(categoryRows.map((row) => [row.name, row.id]));
    await db.insert(products).values([
      { name: "Fotokopi A4", sku: "FC-A4", categoryId: categoryId.Fotokopi, kind: "SERVICE", price: "500", unit: "lembar", stockTracking: true },
      { name: "Fotokopi F4", sku: "FC-F4", categoryId: categoryId.Fotokopi, kind: "SERVICE", price: "750", unit: "lembar", stockTracking: true },
      { name: "Print A4 BW", sku: "PR-A4-BW", categoryId: categoryId.Print, kind: "SERVICE", price: "1000", unit: "lembar", stockTracking: true },
      { name: "Print A4 Color", sku: "PR-A4-COLOR", categoryId: categoryId.Print, kind: "SERVICE", price: "2500", unit: "lembar", stockTracking: true },
      { name: "Laminasi A4", sku: "LAM-A4", categoryId: categoryId.Finishing, kind: "SERVICE", price: "5000", unit: "lembar", stockTracking: false },
      { name: "Jilid Spiral", sku: "JLD-SPR", categoryId: categoryId.Finishing, kind: "SERVICE", price: "8000", unit: "pcs", stockTracking: false },
      { name: "Pulpen Standard", sku: "ATK-PEN", categoryId: categoryId.ATK, kind: "PRODUCT", price: "3500", unit: "pcs", stockTracking: true },
      { name: "Map Plastik", sku: "ATK-MAP", categoryId: categoryId.ATK, kind: "PRODUCT", price: "2500", unit: "pcs", stockTracking: true },
    ]);
    await db.insert(inventoryItems).values([
      { name: "HVS A4", sku: "HVS-A4", category: "Kertas", unit: "rim", currentStock: "18", minimumStock: "5", status: "HEALTHY" },
      { name: "HVS F4", sku: "HVS-F4", category: "Kertas", unit: "rim", currentStock: "3", minimumStock: "5", status: "LOW" },
      { name: "Plastik Laminasi A4", sku: "LAM-A4-MAT", category: "Finishing", unit: "pcs", currentStock: "42", minimumStock: "20", status: "HEALTHY" },
      { name: "Spiral 10mm", sku: "SPR-10", category: "Finishing", unit: "pcs", currentStock: "8", minimumStock: "10", status: "LOW" },
      { name: "Tinta Hitam", sku: "INK-BLK", category: "Bahan", unit: "botol", currentStock: "4", minimumStock: "2", status: "HEALTHY" },
    ]);
  }
  const categoryRows = await db.select().from(categories);
  const categoryId = Object.fromEntries(categoryRows.map((row) => [row.name, row.id]));
  await db.insert(products).values(purchasedItems.filter((name) => !internalItemNames.has(name)).map((name) => ({
    name,
    sku: purchasedSkuByName.get(name)!,
    categoryId: categoryId.ATK,
    kind: "PRODUCT",
    price: "0",
    unit: "pcs",
    stockTracking: true,
    active: true,
  }))).onConflictDoNothing({ target: products.sku });
  await db.insert(inventoryItems).values(internalInventoryItems).onConflictDoNothing({ target: inventoryItems.sku });
  await archiveInternalProducts();
  await applyCatalogPrices();
  seeded = true;
}

async function transactionDto(id: number) {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  const transaction = rows[0];
  if (!transaction) return null;
  const items = await db
    .select()
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, id))
    .orderBy(asc(transactionItems.id));
  return {
    id: transaction.id,
    number: transaction.number,
    createdAt: transaction.createdAt.toISOString(),
    cashier: transaction.cashier,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      subtotal: money(item.subtotal),
      unit: item.unit,
    })),
    total: money(transaction.total),
    paid: money(transaction.paid),
    change: money(transaction.change),
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    cancellationReason: transaction.cancellationReason,
  };
}

function expenseDto(expense: typeof expenses.$inferSelect) {
  return {
    id: expense.id,
    amount: money(expense.amount),
    category: expense.category,
    description: expense.description,
    createdAt: expense.createdAt.toISOString(),
  };
}

function backupSnapshot(
  rows: {
    categoryRows: Array<typeof categories.$inferSelect>;
    productRows: Array<typeof products.$inferSelect>;
    inventoryRows: Array<typeof inventoryItems.$inferSelect>;
    transactionRows: Array<typeof transactions.$inferSelect>;
    transactionItemRows: Array<typeof transactionItems.$inferSelect>;
    paymentRows: Array<typeof payments.$inferSelect>;
    expenseRows: Array<typeof expenses.$inferSelect>;
    auditRows: Array<typeof auditLogs.$inferSelect>;
  },
): Omit<BackupPayload, "exportedAt"> & { exportedAt: string } {
  return {
    format: "potocopy-qta-backup",
    version: "1",
    exportedAt: new Date().toISOString(),
    categories: rows.categoryRows.map((row) => ({ id: row.id, name: row.name })),
    products: rows.productRows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      categoryId: row.categoryId,
      kind: row.kind,
      price: money(row.price),
      unit: row.unit,
      stockTracking: row.stockTracking,
      active: row.active,
    })),
    inventoryItems: rows.inventoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      unit: row.unit,
      currentStock: money(row.currentStock),
      minimumStock: money(row.minimumStock),
      status: row.status,
    })),
    transactions: rows.transactionRows.map((row) => ({
      id: row.id,
      number: row.number,
      createdAt: row.createdAt.toISOString(),
      cashier: row.cashier,
      total: money(row.total),
      paid: money(row.paid),
      change: money(row.change),
      paymentMethod: row.paymentMethod,
      status: row.status,
      cancellationReason: row.cancellationReason,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancelledBy: row.cancelledBy,
    })),
    transactionItems: rows.transactionItemRows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      productId: row.productId,
      name: row.name,
      quantity: money(row.quantity),
      unitPrice: money(row.unitPrice),
      subtotal: money(row.subtotal),
      unit: row.unit,
    })),
    payments: rows.paymentRows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      method: row.method,
      amount: money(row.amount),
    })),
    expenses: rows.expenseRows.map((row) => ({
      id: row.id,
      amount: money(row.amount),
      category: row.category,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    })),
    auditLogs: rows.auditRows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor,
      action: row.action,
      object: row.object,
      detail: row.detail,
    })),
  };
}

async function restoreBackup(snapshot: BackupPayload) {
  const categoryRows = snapshot.categories.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    name: requiredBackupString(row, "name"),
  }));
  const productRows = snapshot.products.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    name: requiredBackupString(row, "name"),
    sku: requiredBackupString(row, "sku"),
    categoryId: row.categoryId == null ? null : requiredBackupNumber(row, "categoryId", true),
    kind: requiredBackupString(row, "kind"),
    price: requiredBackupNumber(row, "price").toFixed(2),
    unit: requiredBackupString(row, "unit"),
    stockTracking: row.stockTracking === true,
    active: row.active !== false,
  }));
  const inventoryRows = snapshot.inventoryItems.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    name: requiredBackupString(row, "name"),
    sku: requiredBackupString(row, "sku"),
    category: requiredBackupString(row, "category"),
    unit: requiredBackupString(row, "unit"),
    currentStock: requiredBackupNumber(row, "currentStock").toFixed(2),
    minimumStock: requiredBackupNumber(row, "minimumStock").toFixed(2),
    status: requiredBackupString(row, "status"),
  }));
  const transactionRows = snapshot.transactions.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    number: requiredBackupString(row, "number"),
    createdAt: requiredBackupDate(row, "createdAt"),
    cashier: requiredBackupString(row, "cashier"),
    total: requiredBackupNumber(row, "total").toFixed(2),
    paid: requiredBackupNumber(row, "paid").toFixed(2),
    change: requiredBackupNumber(row, "change").toFixed(2),
    paymentMethod: requiredBackupString(row, "paymentMethod"),
    status: requiredBackupString(row, "status"),
    cancellationReason: optionalBackupString(row, "cancellationReason"),
    cancelledAt: optionalBackupDate(row, "cancelledAt"),
    cancelledBy: optionalBackupString(row, "cancelledBy"),
  }));
  const transactionItemRows = snapshot.transactionItems.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    transactionId: requiredBackupNumber(row, "transactionId", true),
    productId: requiredBackupNumber(row, "productId", true),
    name: requiredBackupString(row, "name"),
    quantity: requiredBackupNumber(row, "quantity").toFixed(2),
    unitPrice: requiredBackupNumber(row, "unitPrice").toFixed(2),
    subtotal: requiredBackupNumber(row, "subtotal").toFixed(2),
    unit: requiredBackupString(row, "unit"),
  }));
  const paymentRows = snapshot.payments.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    transactionId: requiredBackupNumber(row, "transactionId", true),
    method: requiredBackupString(row, "method"),
    amount: requiredBackupNumber(row, "amount").toFixed(2),
  }));
  const expenseRows = snapshot.expenses.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    amount: requiredBackupNumber(row, "amount").toFixed(2),
    category: requiredBackupString(row, "category"),
    description: requiredBackupString(row, "description"),
    createdAt: requiredBackupDate(row, "createdAt"),
  }));
  const auditRows = snapshot.auditLogs.map((row) => ({
    id: requiredBackupNumber(row, "id", true),
    createdAt: requiredBackupDate(row, "createdAt"),
    actor: requiredBackupString(row, "actor"),
    action: requiredBackupString(row, "action"),
    object: requiredBackupString(row, "object"),
    detail: requiredBackupString(row, "detail"),
  }));

  await db.transaction(async (tx) => {
    await tx.delete(payments);
    await tx.delete(transactionItems);
    await tx.delete(transactions);
    await tx.delete(expenses);
    await tx.delete(inventoryItems);
    await tx.delete(products);
    await tx.delete(categories);
    await tx.delete(auditLogs);

    if (categoryRows.length) await tx.insert(categories).values(categoryRows);
    if (productRows.length) await tx.insert(products).values(productRows);
    if (inventoryRows.length) await tx.insert(inventoryItems).values(inventoryRows);
    if (transactionRows.length) await tx.insert(transactions).values(transactionRows);
    if (transactionItemRows.length) await tx.insert(transactionItems).values(transactionItemRows);
    if (paymentRows.length) await tx.insert(payments).values(paymentRows);
    if (expenseRows.length) await tx.insert(expenses).values(expenseRows);
    if (auditRows.length) await tx.insert(auditLogs).values(auditRows);

    for (const table of ["categories", "products", "inventory_items", "transactions", "transaction_items", "payments", "expenses", "audit_logs"]) {
      await tx.execute(sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), COALESCE((SELECT MAX(id) FROM ${sql.identifier(table)}), 1), (SELECT MAX(id) IS NOT NULL FROM ${sql.identifier(table)}))`);
    }
  });
}

router.get("/dashboard/summary", async (_req, res) => {
  await ensureSeeded();
  const allTransactions = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  const paidTransactions = allTransactions.filter((transaction) => transaction.status === "PAID");
  const today = isoDate(new Date());
  const todayTransactions = paidTransactions.filter((transaction) => isoDate(transaction.createdAt) === today);
  const revenueToday = todayTransactions.reduce((sum, transaction) => sum + money(transaction.total), 0);
  const paymentBreakdown = ["CASH", "QRIS", "TRANSFER"].map((method) => ({
    method,
    total: todayTransactions.filter((transaction) => transaction.paymentMethod === method).reduce((sum, transaction) => sum + money(transaction.total), 0),
  }));
  const hourlyRevenue = Array.from({ length: 9 }, (_, index) => {
    const hour = index + 9;
    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      total: todayTransactions.filter((transaction) => transaction.createdAt.getHours() === hour).reduce((sum, transaction) => sum + money(transaction.total), 0),
    };
  });
  const items = await db.select().from(transactionItems);
  const categoryRows = await db.select({ category: categories.name, productId: products.id }).from(products).leftJoin(categories, eq(products.categoryId, categories.id));
  const categoryByProduct = new Map(categoryRows.map((row) => [row.productId, row.category ?? "Lainnya"]));
  const categoryTotals = new Map<string, number>();
  for (const item of items) {
    const category = categoryByProduct.get(item.productId) ?? "Lainnya";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + money(item.subtotal));
  }
  const expenseRows = await db.select().from(expenses);
  const expensesToday = expenseRows.filter((expense) => isoDate(expense.createdAt) === today).reduce((sum, expense) => sum + money(expense.amount), 0);
  return res.json({
    date: today,
    revenueToday,
    revenueYesterday: 0,
    transactionCount: todayTransactions.length,
    averageTransaction: todayTransactions.length ? revenueToday / todayTransactions.length : 0,
    expensesToday,
    netCash: revenueToday - expensesToday,
    paymentBreakdown,
    hourlyRevenue,
    categorySales: Array.from(categoryTotals.entries()).map(([category, total]) => ({ category, total })),
  });
});

router.get("/activity", async (req, res) => {
  const query = GetActivityQueryParams.parse(req.query);
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(query.limit ?? 8);
  return res.json(rows.map((row) => ({ id: row.id, createdAt: row.createdAt.toISOString(), actor: row.actor, action: row.action, object: row.object, detail: row.detail })));
});

router.get("/expenses", async (_req, res) => {
  await ensureSeeded();
  const rows = await db.select().from(expenses).orderBy(desc(expenses.createdAt));
  return res.json(ListExpensesResponse.parse(rows.map(expenseDto)));
});

router.post("/expenses", requireAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const body = CreateExpenseBody.parse(req.body);
    const category = body.category.trim();
    const description = body.description.trim();
    if (!category || !description) {
      return res.status(400).json({ error: "Kategori dan deskripsi pengeluaran wajib diisi." });
    }
    const expense = await db.transaction(async (tx) => {
      const [created] = await tx.insert(expenses).values({
        amount: body.amount.toFixed(2),
        category,
        description,
      }).returning();
      await tx.insert(auditLogs).values({
        actor: "Owner Aktif",
        action: "MENCATAT PENGELUARAN",
        object: created.category,
        detail: `${created.description} • Rp${money(created.amount).toLocaleString("id-ID")}`,
      });
      return created;
    });
    return res.status(201).json(CreateExpenseResponse.parse(expenseDto(expense)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data pengeluaran tidak valid.";
    return res.status(400).json({ error: message });
  }
});

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const params = DeleteExpenseParams.parse({ id: Number(req.params.id) });
    const expense = await db.transaction(async (tx) => {
      const [deleted] = await tx.delete(expenses).where(eq(expenses.id, params.id)).returning();
      if (!deleted) return null;
      await tx.insert(auditLogs).values({
        actor: "Owner Aktif",
        action: "MENGHAPUS PENGELUARAN",
        object: deleted.category,
        detail: `${deleted.description} • Rp${money(deleted.amount).toLocaleString("id-ID")}`,
      });
      return deleted;
    });
    if (!expense) {
      return res.status(404).json({ error: "Pengeluaran tidak ditemukan." });
    }
    return res.sendStatus(204);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ID pengeluaran tidak valid.";
    return res.status(400).json({ error: message });
  }
});

router.get("/backup/export", requireAuth, async (_req, res) => {
  await ensureSeeded();
  const [categoryRows, productRows, inventoryRows, transactionRows, transactionItemRows, paymentRows, expenseRows, auditRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(products),
    db.select().from(inventoryItems),
    db.select().from(transactions),
    db.select().from(transactionItems),
    db.select().from(payments),
    db.select().from(expenses),
    db.select().from(auditLogs),
  ]);
  return res.json(ExportBackupResponse.parse(backupSnapshot({
    categoryRows,
    productRows,
    inventoryRows,
    transactionRows,
    transactionItemRows,
    paymentRows,
    expenseRows,
    auditRows,
  })));
});

router.post("/backup/import", requireAuth, async (req, res) => {
  try {
    const snapshot = ImportBackupBody.parse(req.body) as unknown as BackupPayload;
    await restoreBackup(snapshot);
    seeded = true;
    return res.json(ImportBackupResponse.parse({
      restoredAt: new Date().toISOString(),
      counts: {
        categories: snapshot.categories.length,
        products: snapshot.products.length,
        inventoryItems: snapshot.inventoryItems.length,
        transactions: snapshot.transactions.length,
        expenses: snapshot.expenses.length,
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "File backup tidak valid.";
    return res.status(400).json({ error: message });
  }
});

router.get("/products", async (req, res) => {
  await ensureSeeded();
  const query = ListProductsQueryParams.parse(req.query);
  const filters = [eq(products.active, true)];
  if (query.search) filters.push(or(ilike(products.name, `%${query.search}%`), ilike(products.sku, `%${query.search}%`)) as never);
  const rows = await db.select({ product: products, category: categories.name }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(and(...filters)).orderBy(asc(products.name));
  return res.json(rows.filter((row) => !query.category || row.category === query.category).map(({ product, category }) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: category ?? "Lainnya",
    kind: product.kind,
    price: money(product.price),
    unit: product.unit,
    stockTracking: product.stockTracking,
    active: product.active,
  })));
});

router.get("/inventory", async (_req, res) => {
  await ensureSeeded();
  const rows = await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name));
  return res.json(rows.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    category: item.category,
    unit: item.unit,
    currentStock: money(item.currentStock),
    minimumStock: money(item.minimumStock),
    status: item.status,
  })));
});

router.get("/transactions", async (req, res) => {
  await ensureSeeded();
  const query = ListTransactionsQueryParams.parse(req.query);
  const rows = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(query.limit ?? 20);
  const filtered = rows.filter((row) => (!query.status || row.status === query.status) && (!query.search || row.number.toLowerCase().includes(query.search.toLowerCase()) || row.cashier.toLowerCase().includes(query.search.toLowerCase())));
  return res.json(await Promise.all(filtered.map((row) => transactionDto(row.id))));
});

router.get("/transactions/:id", async (req, res) => {
  const params = GetTransactionParams.parse({ id: Number(req.params.id) });
  const result = await transactionDto(params.id);
  if (!result) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
  return res.json(result);
});

router.post("/transactions", requireAuth, async (req, res) => {
  await ensureSeeded();
  const body = CreateTransactionBody.parse(req.body);
  const requestedProducts = await Promise.all(body.items.map((item) => db.select().from(products).where(and(eq(products.id, item.productId), eq(products.active, true))).limit(1)));
  if (requestedProducts.some((rows) => !rows[0])) return res.status(400).json({ error: "Produk atau layanan tidak tersedia." });
  const productRows = requestedProducts.map((rows) => rows[0]!);
  const lineItems = body.items.map((item, index) => {
    const product = productRows[index];
    const quantity = Number(item.quantity);
    const subtotal = money(product.price) * quantity;
    return { product, quantity, subtotal };
  });
  const total = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (body.paid < total) return res.status(400).json({ error: "Nominal pembayaran masih kurang." });
  const now = new Date();
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = String(Date.now()).slice(-5);
  const cashier = getAuth(req).userId ? "Kasir Aktif" : "Kasir Utama";
  const inserted = await db.insert(transactions).values({
    number: `TRX-${day}-${suffix}`,
    cashier,
    total: total.toFixed(2),
    paid: body.paid.toFixed(2),
    change: (body.paid - total).toFixed(2),
    paymentMethod: body.paymentMethod,
    status: "PAID",
  }).returning();
  const transaction = inserted[0];
  await db.insert(transactionItems).values(lineItems.map(({ product, quantity, subtotal }) => ({
    transactionId: transaction.id,
    productId: product.id,
    name: product.name,
    quantity: quantity.toFixed(2),
    unitPrice: String(product.price),
    subtotal: subtotal.toFixed(2),
    unit: product.unit,
  })));
  await db.insert(payments).values({ transactionId: transaction.id, method: body.paymentMethod, amount: total.toFixed(2) });
  await db.insert(auditLogs).values({ actor: cashier, action: "MEMBUAT TRANSAKSI", object: transaction.number, detail: `${lineItems.length} item • Rp${total.toLocaleString("id-ID")}` });
  return res.status(201).json(await transactionDto(transaction.id));
});

router.post("/transactions/:id/cancel", requireAuth, async (req, res) => {
  const params = CancelTransactionParams.parse({ id: Number(req.params.id) });
  const body = CancelTransactionBody.parse(req.body);
  const existing = await transactionDto(params.id);
  if (!existing) return res.status(404).json({ error: "Transaksi tidak ditemukan." });
  if (existing.status === "CANCELLED") return res.status(400).json({ error: "Transaksi sudah dibatalkan." });
  await db.update(transactions).set({
    status: "CANCELLED",
    cancellationReason: body.reason,
    cancelledAt: new Date(),
    cancelledBy: getAuth(req).userId ?? "Kasir Aktif",
  }).where(eq(transactions.id, params.id));
  await db.insert(auditLogs).values({ actor: "Kasir Aktif", action: "MEMBATALKAN TRANSAKSI", object: existing.number, detail: body.reason });
  return res.json(await transactionDto(params.id));
});

export default router;