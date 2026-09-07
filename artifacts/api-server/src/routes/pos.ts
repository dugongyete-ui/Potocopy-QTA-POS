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
  CreateTransactionBody,
  GetActivityQueryParams,
  GetTransactionParams,
  ListProductsQueryParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
let seeded = false;

const money = (value: unknown) => Number(value ?? 0);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: "Silakan masuk untuk melanjutkan." });
  }
  return next();
};

async function ensureSeeded() {
  if (seeded) return;
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) {
    const categoryRows = await db
      .insert(categories)
      .values([
        { name: "Fotokopi" },
        { name: "Print" },
        { name: "Finishing" },
        { name: "ATK" },
      ])
      .returning();
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