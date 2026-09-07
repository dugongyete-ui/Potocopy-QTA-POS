import { useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PackageSearch,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  getGetActivityQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetTransactionQueryKey,
  getListInventoryQueryKey,
  getListExpensesQueryKey,
  getListProductsQueryKey,
  getListTransactionsQueryKey,
  exportBackup,
  useCancelTransaction,
  useCreateExpense,
  useCreateTransaction,
  useDeleteExpense,
  useGetActivity,
  useGetDashboardSummary,
  useGetTransaction,
  useImportBackup,
  useListExpenses,
  useListInventory,
  useListProducts,
  useListTransactions,
} from "@workspace/api-client-react";
import type { BackupSnapshot } from "@workspace/api-client-react";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import "@/index.css";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

type ProductLike = {
  id: number; name: string; sku: string; category: string; kind: string;
  price: number; unit: string; stockTracking: boolean; active: boolean;
};
type CartLine = ProductLike & { quantity: number };
type SummaryLike = {
  date: string; revenueToday: number; revenueYesterday: number; transactionCount: number;
  averageTransaction: number; expensesToday: number; netCash: number;
  paymentBreakdown: { method: string; total: number }[];
  hourlyRevenue: { hour: string; total: number }[];
  categorySales: { category: string; total: number }[];
};
type TransactionLike = {
  id: number; number: string; createdAt: string; cashier: string; items: { id: number; productId: number; name: string; quantity: number; unitPrice: number; subtotal: number; unit: string }[];
  total: number; paid: number; change: number; paymentMethod: string; status: string; cancellationReason?: string | null;
};
type InventoryLike = {
  id: number; name: string; sku: string; category: string; unit: string; currentStock: number; minimumStock: number; status: string;
};
type ExpenseLike = {
  id: number; amount: number; category: string; description: string; createdAt: string;
};

const money = (value = 0) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const compactMoney = (value = 0) =>
  value >= 1_000_000 ? `Rp ${(value / 1_000_000).toFixed(1)} jt` : value >= 1_000 ? `Rp ${(value / 1_000).toFixed(1)} rb` : money(value);
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const todayLabel = () => new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" />;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Box; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Icon size={20} /></div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function ErrorState({ onRetry, label = "Could not load this view." }: { onRetry?: () => void; label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
      <div><AlertCircle className="mx-auto mb-2 text-destructive" size={22} /><p className="text-sm text-destructive">{label}</p>
        {onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">Try again</button>}
      </div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replace(/\s+/g, "-")}`} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{children}</button>;
}

function StatCard({ label, value, helper, icon: Icon, tone = "orange", trend }: { label: string; value: string; helper?: string; icon: typeof Box; tone?: string; trend?: "up" | "down" }) {
  return (
    <div className="animate-rise-in rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p data-testid={`text-stat-${label.toLowerCase().replace(/\s+/g, "-")}`} className="mt-2 font-mono text-[clamp(1.3rem,2.4vw,1.85rem)] font-bold tracking-tight text-foreground">{value}</p></div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone === "teal" ? "bg-secondary text-secondary-foreground" : tone === "yellow" ? "bg-accent/35 text-accent-foreground" : "bg-primary/10 text-primary")}><Icon size={18} /></span>
      </div>
      {helper && <div className={cn("mt-3 flex items-center gap-1 text-xs", trend === "down" ? "text-destructive" : "text-muted-foreground")}>{trend === "up" ? <ArrowUpRight size={13} /> : trend === "down" ? <ArrowDownRight size={13} /> : null}{helper}</div>}
    </div>
  );
}

function LogoMark({ onDark = false }: { onDark?: boolean }) {
  return <div className="flex items-center gap-3"><div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Printer size={20} strokeWidth={2.5} /><span className={cn("absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 bg-accent", onDark ? "border-sidebar" : "border-card")} /></div><div><p className={cn("font-mono text-[15px] font-bold tracking-tight", onDark ? "text-sidebar-foreground" : "text-foreground")}>POTOCOPY</p><p className={cn("text-[10px] font-semibold uppercase tracking-[.22em]", onDark ? "text-sidebar-foreground/55" : "text-muted-foreground")}>QTA / counter</p></div></div>;
}

const navGroups = [
  { label: "Counter", items: [{ href: "/", label: "Overview", icon: LayoutDashboard }, { href: "/cashier", label: "Cashier", icon: ShoppingCart }] },
  { label: "Shop floor", items: [{ href: "/transactions", label: "Transactions", icon: Receipt }, { href: "/inventory", label: "Inventory", icon: Box }, { href: "/catalog", label: "Catalog", icon: Tag }] },
  { label: "Owner view", items: [{ href: "/reports", label: "Reports", icon: BarChart3 }, { href: "/expenses", label: "Expenses", icon: CircleDollarSign }] },
];

function Sidebar({ mobileOpen, close }: { mobileOpen: boolean; close: () => void }) {
  const [location] = useLocation();
  return (
    <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl transition-transform duration-300 md:static md:translate-x-0 md:border-r-0 md:shadow-none", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between px-2">
        <LogoMark onDark />
        <button type="button" aria-label="Close menu" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden">
          <X size={18} />
        </button>
      </div>
      <div className="mt-9 flex-1 space-y-6 overflow-y-auto">
        {navGroups.map(group => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/40">{group.label}</p><nav className="space-y-1">{group.items.map(item => { const Icon = item.icon; const active = item.href === "/" ? location === "/" : location.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={close} data-testid={`link-${item.label.toLowerCase()}`} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}><Icon size={17} /><span>{item.label}</span>{active && <ChevronRight className="ml-auto opacity-60" size={15} />}</Link>; })}</nav></div>)}
        <div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace</p><Link href="/settings" onClick={close} data-testid="link-settings" className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", location.startsWith("/settings") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}><Settings size={17} /><span>Settings</span></Link></div>
      </div>
      <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/70 p-3"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">AR</div><div className="min-w-0"><p className="truncate text-xs font-semibold">Ari Rahman</p><p className="truncate text-[10px] text-sidebar-foreground/50">Owner · QTA branch</p></div><MoreHorizontal size={15} className="ml-auto text-sidebar-foreground/50" /></div></div>
    </aside>
  );
}

function Topbar({ onMenu, title, eyebrow }: { onMenu: () => void; title: string; eyebrow: string }) {
  const { signOut } = useClerk();
  return <header className="flex h-[76px] items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><IconButton label="open menu" onClick={onMenu}><Menu size={20} /></IconButton><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h1 className="font-mono text-lg font-bold tracking-tight text-foreground">{title}</h1></div></div><div className="flex items-center gap-1 sm:gap-3"><div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:flex"><CalendarDays size={14} />{todayLabel()}</div><IconButton label="notifications"><Bell size={17} /></IconButton><button type="button" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || "/" })} className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:flex"><LogOut size={14} />Sign out</button></div></header>;
}

function Shell({ children, title, eyebrow = "Potocopy QTA" }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="min-h-[100dvh] bg-background"><div className="flex min-h-[100dvh]"><Sidebar mobileOpen={mobileOpen} close={() => setMobileOpen(false)} />{mobileOpen && <button type="button" aria-label="Close menu overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-foreground/45 backdrop-blur-[2px] md:hidden" />}<div className="min-w-0 flex-1"><Topbar onMenu={() => setMobileOpen(v => !v)} title={title} eyebrow={eyebrow} /><main className="mx-auto max-w-[1600px] p-4 sm:p-7">{children}</main></div></div></div>;
}

function PageIntro({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-primary">QTA shop desk</p><h2 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{action}</div>;
}

function DashboardPage() {
  const summaryQuery = useGetDashboardSummary();
  const activityQuery = useGetActivity({ limit: 7 });
  const summary = summaryQuery.data as SummaryLike | undefined;
  const bars = summary?.hourlyRevenue ?? [];
  const maxBar = Math.max(...bars.map(b => b.total), 1);
  if (summaryQuery.isLoading) return <DashboardSkeleton />;
  if (summaryQuery.isError || !summary) return <ErrorState onRetry={() => summaryQuery.refetch()} />;
  return <Shell title="Overview"><PageIntro title="Good morning, Ari." subtitle={`Here is the counter pulse for ${todayLabel()}.`} action={<Link href="/cashier" data-testid="link-start-sale" className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus size={17} />Start a sale</Link>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Revenue today" value={compactMoney(summary.revenueToday)} helper={`${summary.revenueYesterday ? Math.round((summary.revenueToday / summary.revenueYesterday - 1) * 100) : 0}% vs yesterday`} icon={CircleDollarSign} trend={summary.revenueToday >= summary.revenueYesterday ? "up" : "down"} />
      <StatCard label="Transactions" value={summary.transactionCount.toString()} helper={`Avg. ${money(summary.averageTransaction)} per ticket`} icon={Receipt} tone="teal" />
      <StatCard label="Expenses today" value={compactMoney(summary.expensesToday)} helper="Recorded outflow" icon={ClipboardList} tone="yellow" />
      <StatCard label="Net cash" value={compactMoney(summary.netCash)} helper="Sales less expenses" icon={Zap} tone="teal" />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="flex items-start justify-between"><div><h3 className="font-semibold">Counter revenue</h3><p className="mt-1 text-xs text-muted-foreground">Hourly paid transactions</p></div><span className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px] font-bold text-secondary-foreground">TODAY</span></div><div className="mt-7 flex h-48 items-end gap-1.5 sm:gap-3">{(bars.length ? bars : [{ hour: "08", total: 0 }, { hour: "10", total: 0 }, { hour: "12", total: 0 }, { hour: "14", total: 0 }, { hour: "16", total: 0 }, { hour: "18", total: 0 }]).map((bar, index) => <div key={`${bar.hour}-${index}`} className="group flex min-w-0 flex-1 flex-col items-center gap-2"><div className="relative flex h-40 w-full items-end"><div className="w-full rounded-t-md bg-primary/80 transition-all duration-300 group-hover:bg-primary" style={{ height: `${Math.max(5, (bar.total / maxBar) * 100)}%` }} title={money(bar.total)} /></div><span className="font-mono text-[10px] text-muted-foreground">{bar.hour}</span></div>)}</div><div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">Peak hours are highlighted by the bars you see above. Keep the front counter clear before the next rush.</div></section>
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="flex items-start justify-between"><div><h3 className="font-semibold">Payment mix</h3><p className="mt-1 text-xs text-muted-foreground">Collected by method</p></div><CircleDollarSign className="text-primary" size={18} /></div><div className="mt-6 space-y-4">{summary.paymentBreakdown.map(payment => { const total = summary.paymentBreakdown.reduce((acc, item) => acc + item.total, 0) || 1; return <div key={payment.method}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{payment.method}</span><span className="font-mono text-muted-foreground">{money(payment.total)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", payment.method === "CASH" ? "bg-primary" : payment.method === "QRIS" ? "bg-secondary-foreground" : "bg-accent")} style={{ width: `${(payment.total / total) * 100}%` }} /></div></div> })}</div><div className="mt-7 rounded-lg bg-muted/65 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total collected</p><p className="mt-1 font-mono text-xl font-bold">{money(summary.revenueToday)}</p></div></section>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Sales by category</h3><p className="mt-1 text-xs text-muted-foreground">Where today’s rupiah came from</p></div><Link href="/reports" data-testid="link-view-report" className="text-xs font-bold text-primary hover:underline">Open report</Link></div>{summary.categorySales.length ? <div className="space-y-3">{summary.categorySales.map((category, index) => { const max = Math.max(...summary.categorySales.map(item => item.total), 1); return <div key={category.category} className="flex items-center gap-3"><span className="w-24 truncate text-xs font-semibold text-muted-foreground">{category.category}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className={cn("h-full rounded-full", ["bg-primary", "bg-secondary-foreground", "bg-accent", "bg-chart-4"][index % 4])} style={{ width: `${category.total / max * 100}%` }} /></div><span className="w-20 text-right font-mono text-xs font-bold">{compactMoney(category.total)}</span></div> })}</div> : <EmptyState icon={Tag} title="No category sales yet" description="Sales will appear here after the first paid ticket." />}</section>
      <ActivityPanel query={activityQuery} />
    </div>
  </Shell>;
}

function ActivityPanel({ query }: { query: ReturnType<typeof useGetActivity> }) {
  const activity = (query.data ?? []) as Array<{ id: number; createdAt: string; actor: string; action: string; object: string; detail: string }>;
  return <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Recent activity</h3><p className="mt-1 text-xs text-muted-foreground">A quiet audit trail for the desk</p></div><History size={18} className="text-muted-foreground" /></div>{query.isLoading ? <div className="space-y-4"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div> : query.isError ? <ErrorState onRetry={() => query.refetch()} label="Activity could not be loaded." /> : activity.length ? <div className="space-y-4">{activity.map(item => <div key={item.id} className="flex gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="text-xs leading-relaxed"><span className="font-semibold">{item.actor}</span> {item.action} <span className="font-semibold text-primary">{item.object}</span></p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail} · {dateTime(item.createdAt)}</p></div></div>)}</div> : <EmptyState icon={History} title="Nothing recorded yet" description="Corrections and changes will leave a trace here." />}</section>;
}

function DashboardSkeleton() {
  return <Shell title="Overview"><div className="mb-6"><Skeleton className="h-8 w-56" /><Skeleton className="mt-2 h-4 w-80" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></Shell>;
}

function CashierPage() {
  const productsQuery = useListProducts();
  const createTransaction = useCreateTransaction();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [notice, setNotice] = useState("");
  const products = (productsQuery.data ?? []) as ProductLike[];
  const categories = [...new Set(products.map(product => product.category))];
  const filtered = products.filter(product => product.active && (category === "ALL" || product.category === category) && `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase()));
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const addProduct = (product: ProductLike) => setCart(lines => { const existing = lines.find(line => line.id === product.id); return existing ? lines.map(line => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...lines, { ...product, quantity: 1 }]; });
  const changeQuantity = (id: number, delta: number) => setCart(lines => lines.map(line => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0));
  const submit = () => {
    if (!cart.length) return;
    const paidValue = paymentMethod === "CASH" ? Number(paid || 0) : total;
    if (paymentMethod === "CASH" && paidValue < total) { setNotice("Payment is below the ticket total."); return; }
    createTransaction.mutate({ data: { items: cart.map(line => ({ productId: line.id, quantity: line.quantity })), paymentMethod: paymentMethod as "CASH" | "QRIS" | "TRANSFER", paid: paidValue } }, { onSuccess: result => { setNotice(`Ticket ${(result as TransactionLike).number} saved.`); setCart([]); setPaid(""); queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetActivityQueryKey({ limit: 7 }) }); queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() }); } });
  };
  return <Shell title="Cashier" eyebrow="Counter / active till"><PageIntro title="New ticket" subtitle="Add a service, take payment, and keep the line moving." action={<div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"><Zap size={15} />Fast counter mode</div>} />
    {notice && <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"><span>{notice}</span><IconButton label="dismiss notice" onClick={() => setNotice("")}><X size={15} /></IconButton></div>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
       <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><input data-testid="input-product-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search service or SKU" className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><button type="button" data-testid="button-scan-sku" onClick={() => setNotice("Scanner input is ready — type a SKU above.")} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted"><SlidersHorizontal size={16} />Scan / quick add</button></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{["ALL", ...categories].map(item => <button key={item} type="button" data-testid={`button-category-${item.toLowerCase()}`} onClick={() => setCategory(item)} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors", category === item ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}>{item === "ALL" ? "All services" : item}</button>)}</div>{productsQuery.isLoading ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton className="h-28" key={i} />)}</div> : productsQuery.isError ? <div className="mt-5"><ErrorState onRetry={() => productsQuery.refetch()} /></div> : filtered.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(product => <button type="button" key={product.id} data-testid={`card-product-${product.id}`} disabled={product.price <= 0} onClick={() => product.price > 0 ? addProduct(product) : setNotice("Set a selling price in Catalog before adding this item.")} className="group relative rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"><div className="flex items-start justify-between gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", product.kind === "SERVICE" ? "bg-secondary text-secondary-foreground" : "bg-accent/40 text-accent-foreground")}>{product.kind === "SERVICE" ? "Service" : "Item"}</span><Plus size={16} className="text-muted-foreground transition-colors group-hover:text-primary" /></div><p className="mt-4 line-clamp-2 text-sm font-bold text-foreground">{product.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku} · {product.unit}</p><p className="mt-3 font-mono text-sm font-bold text-primary">{product.price > 0 ? money(product.price) : "Harga belum diatur"}</p></button>)}</div> : <div className="mt-5"><EmptyState icon={PackageSearch} title="No matching items" description="Try another service name, SKU, or category." /></div>}</section>
      <aside className="sticky top-4 rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]"><div className="flex items-center justify-between border-b border-border p-5"><div><h3 className="font-mono font-bold">Current ticket</h3><p className="mt-1 text-xs text-muted-foreground">{cart.length ? `${cart.length} line${cart.length > 1 ? "s" : ""}` : "Ready for a new customer"}</p></div><span className="rounded-md bg-muted px-2 py-1 font-mono text-[10px] font-bold text-muted-foreground">DRAFT</span></div><div className="max-h-[330px] min-h-[180px] overflow-auto p-5">{cart.length ? <div className="space-y-4">{cart.map(line => <div key={line.id} className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><FileText size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{line.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{money(line.price)} / {line.unit}</p><div className="mt-2 flex items-center justify-between"><div className="flex items-center rounded-md border border-border"><button type="button" data-testid={`button-decrease-${line.id}`} onClick={() => changeQuantity(line.id, -1)} className="px-2 py-1 text-muted-foreground hover:bg-muted">−</button><span className="min-w-7 text-center font-mono text-xs font-bold">{line.quantity}</span><button type="button" data-testid={`button-increase-${line.id}`} onClick={() => changeQuantity(line.id, 1)} className="px-2 py-1 text-muted-foreground hover:bg-muted">+</button></div><span className="font-mono text-sm font-bold">{money(line.price * line.quantity)}</span></div></div></div>)}</div> : <div className="flex h-40 flex-col items-center justify-center text-center"><ShoppingCart className="mb-3 text-muted-foreground/50" size={28} /><p className="text-sm font-semibold text-muted-foreground">Nothing on the ticket</p><p className="mt-1 text-xs text-muted-foreground/75">Choose a service to begin.</p></div>}</div><div className="border-t border-border p-5"><div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="font-mono">{money(total)}</span></div><div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span className="font-mono text-primary">{money(total)}</span></div><div className="mt-5"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment</p><div className="grid grid-cols-3 gap-2">{["CASH", "QRIS", "TRANSFER"].map(method => <button type="button" key={method} data-testid={`button-payment-${method.toLowerCase()}`} onClick={() => { setPaymentMethod(method); if (method !== "CASH") setPaid(total.toString()); }} className={cn("rounded-md border py-2 text-[11px] font-bold transition-colors", paymentMethod === method ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>{method}</button>)}</div>{paymentMethod === "CASH" && <div className="mt-3"><label className="mb-1 block text-xs font-semibold text-muted-foreground">Cash received</label><input data-testid="input-cash-received" type="number" min="0" value={paid} onChange={e => setPaid(e.target.value)} placeholder="Rp 0" className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none focus:border-primary" /></div>}<button type="button" data-testid="button-charge-ticket" disabled={!cart.length || createTransaction.isPending} onClick={submit} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{createTransaction.isPending ? "Saving ticket..." : <>Charge {money(total)} <ChevronRight size={16} /></>}</button></div></div></aside>
    </div>
  </Shell>;
}

function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<number | null>(null);
  const params = { search: search || undefined, status: status === "ALL" ? undefined : status as "PAID" | "CANCELLED", limit: 50 };
  const query = useListTransactions(params);
  const transactions = (query.data ?? []) as TransactionLike[];
  return <Shell title="Transactions"><PageIntro title="Transaction history" subtitle="Search every ticket, payment, and correction from the counter." action={<button type="button" data-testid="button-export-transactions" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-muted"><FileText size={16} />Print view</button>} /><section className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input data-testid="input-transaction-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticket number or cashier" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><div className="flex gap-2"><Filter size={17} className="mt-2 text-muted-foreground" />{["ALL", "PAID", "CANCELLED"].map(item => <button type="button" key={item} data-testid={`button-status-${item.toLowerCase()}`} onClick={() => setStatus(item)} className={cn("rounded-md px-3 py-2 text-xs font-bold", status === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{item === "ALL" ? "All" : item === "CANCELLED" ? "Cancelled" : "Paid"}</button>)}</div></div>{query.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14" />)}</div> : query.isError ? <div className="p-5"><ErrorState onRetry={() => query.refetch()} /></div> : transactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border bg-muted/45 text-[10px] uppercase tracking-[.14em] text-muted-foreground"><th className="px-5 py-3 font-bold">Ticket</th><th className="px-4 py-3 font-bold">Time / cashier</th><th className="px-4 py-3 font-bold">Items</th><th className="px-4 py-3 font-bold">Payment</th><th className="px-4 py-3 text-right font-bold">Total</th><th className="px-5 py-3" /></tr></thead><tbody>{transactions.map(tx => <tr key={tx.id} data-testid={`row-transaction-${tx.id}`} className="border-b border-border/70 transition-colors hover:bg-muted/30"><td className="px-5 py-4"><button type="button" data-testid={`button-detail-${tx.id}`} onClick={() => setSelected(tx.id)} className="font-mono text-sm font-bold text-primary hover:underline">{tx.number}</button><span className={cn("ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold", tx.status === "CANCELLED" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground")}>{tx.status}</span></td><td className="px-4 py-4"><p className="text-xs font-semibold">{dateTime(tx.createdAt)}</p><p className="mt-1 text-[11px] text-muted-foreground">{tx.cashier}</p></td><td className="px-4 py-4 text-xs text-muted-foreground">{tx.items.length} line{tx.items.length !== 1 ? "s" : ""}</td><td className="px-4 py-4 font-mono text-xs">{tx.paymentMethod}</td><td className="px-4 py-4 text-right font-mono text-sm font-bold">{money(tx.total)}</td><td className="px-5 py-4 text-right"><IconButton label={`open ticket ${tx.id}`} onClick={() => setSelected(tx.id)}><ChevronRight size={16} /></IconButton></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState icon={Receipt} title="No transactions found" description="Try widening your search or record the first ticket from Cashier." action={<Link href="/cashier" data-testid="link-go-cashier" className="mt-4 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Open cashier</Link>} /></div>}</section>{selected !== null && <TransactionDetail id={selected} close={() => setSelected(null)} />}</Shell>;
}

function TransactionDetail({ id, close }: { id: number; close: () => void }) {
  const query = useGetTransaction(id, { query: { enabled: true, queryKey: getGetTransactionQueryKey(id) } });
  const cancel = useCancelTransaction();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const tx = query.data as TransactionLike | undefined;
  const submitCancel = () => { if (!reason.trim() || reason.trim().length < 3) return; cancel.mutate({ id, data: { reason } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetTransactionQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); setConfirming(false); } }); };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-5"><div className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Ticket detail</p><h3 className="mt-1 font-mono text-lg font-bold">{tx?.number ?? "Loading..."}</h3></div><IconButton label="close ticket detail" onClick={close}><X size={18} /></IconButton></div>{query.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : query.isError || !tx ? <div className="p-5"><ErrorState label="Ticket detail is unavailable." /></div> : <div className="p-5"><div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/55 p-3 text-xs"><div><p className="text-muted-foreground">Created</p><p className="mt-1 font-semibold">{dateTime(tx.createdAt)}</p></div><div><p className="text-muted-foreground">Cashier</p><p className="mt-1 font-semibold">{tx.cashier}</p></div><div><p className="text-muted-foreground">Payment</p><p className="mt-1 font-mono font-semibold">{tx.paymentMethod}</p></div><div><p className="text-muted-foreground">Status</p><p className={cn("mt-1 font-bold", tx.status === "CANCELLED" ? "text-destructive" : "text-secondary-foreground")}>{tx.status}</p></div></div><div className="my-5 space-y-3">{tx.items.map(item => <div key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.name} <span className="text-muted-foreground">× {item.quantity}</span></span><span className="font-mono font-semibold">{money(item.subtotal)}</span></div>)}</div><div className="border-t border-border pt-4"><div className="flex justify-between text-sm text-muted-foreground"><span>Paid</span><span className="font-mono">{money(tx.paid)}</span></div><div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span className="font-mono text-primary">{money(tx.total)}</span></div></div>{tx.cancellationReason && <div className="mt-4 rounded-lg bg-destructive/5 p-3 text-xs text-destructive"><p className="font-bold">Cancellation reason</p><p className="mt-1">{tx.cancellationReason}</p></div>}{tx.status !== "CANCELLED" && <>{confirming ? <div className="mt-5 rounded-lg border border-destructive/25 bg-destructive/5 p-4"><label className="text-xs font-bold text-destructive">Why is this ticket being cancelled?</label><textarea data-testid="input-cancellation-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="At least 3 characters" className="mt-2 w-full rounded-md border border-destructive/25 bg-card p-2 text-sm outline-none focus:border-destructive" /><div className="mt-3 flex justify-end gap-2"><button type="button" data-testid="button-keep-ticket" onClick={() => setConfirming(false)} className="rounded-md px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">Keep ticket</button><button type="button" data-testid="button-confirm-cancellation" disabled={cancel.isPending || reason.trim().length < 3} onClick={submitCancel} className="rounded-md bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50">{cancel.isPending ? "Cancelling..." : "Confirm cancellation"}</button></div></div> : <button type="button" data-testid="button-cancel-ticket" onClick={() => setConfirming(true)} className="mt-5 w-full rounded-lg border border-destructive/30 py-2.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/5">Cancel this ticket</button>}</>}</div>}</div></div>;
}

function InventoryPage() {
  const query = useListInventory();
  const [search, setSearch] = useState("");
  const inventory = ((query.data ?? []) as InventoryLike[]).filter(item => `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const counts = { OUT: inventory.filter(i => i.status === "OUT").length, LOW: inventory.filter(i => i.status === "LOW").length, HEALTHY: inventory.filter(i => i.status === "HEALTHY").length };
  return <Shell title="Inventory"><PageIntro title="Stock on the shelf" subtitle="Catch the low points before they become a counter interruption." action={<button type="button" data-testid="button-stock-note" onClick={() => alert("Stock adjustments are recorded from the inventory service.")} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-muted"><ClipboardList size={16} />Stock note</button>} /><div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-destructive">Out of stock</p><p className="mt-2 font-mono text-2xl font-bold">{counts.OUT}</p></div><div className="rounded-xl border border-accent/50 bg-accent/15 p-4"><p className="text-xs font-bold uppercase tracking-wider text-accent-foreground">Running low</p><p className="mt-2 font-mono text-2xl font-bold">{counts.LOW}</p></div><div className="rounded-xl border border-secondary bg-secondary/35 p-4"><p className="text-xs font-bold uppercase tracking-wider text-secondary-foreground">Healthy</p><p className="mt-2 font-mono text-2xl font-bold">{counts.HEALTHY}</p></div></div><section className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]"><div className="border-b border-border p-4"><label className="relative block max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input data-testid="input-inventory-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stock item or SKU" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></label></div>{query.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map(i => <Skeleton className="h-14" key={i} />)}</div> : query.isError ? <div className="p-5"><ErrorState onRetry={() => query.refetch()} /></div> : inventory.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-border bg-muted/45 text-[10px] uppercase tracking-[.14em] text-muted-foreground"><th className="px-5 py-3">Item</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Minimum</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{inventory.map(item => <tr key={item.id} data-testid={`row-inventory-${item.id}`} className="border-b border-border/70 hover:bg-muted/30"><td className="px-5 py-4"><p className="text-sm font-bold">{item.name}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.sku}</p></td><td className="px-4 py-4 text-xs text-muted-foreground">{item.category}</td><td className="px-4 py-4 font-mono text-sm font-bold">{item.currentStock} <span className="font-sans text-xs font-normal text-muted-foreground">{item.unit}</span></td><td className="px-4 py-4 font-mono text-sm text-muted-foreground">{item.minimumStock}</td><td className="px-5 py-4"><span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", item.status === "OUT" ? "bg-destructive/10 text-destructive" : item.status === "LOW" ? "bg-accent/45 text-accent-foreground" : "bg-secondary text-secondary-foreground")}>{item.status === "OUT" ? "Out of stock" : item.status === "LOW" ? "Running low" : "Healthy"}</span></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState icon={Box} title="No stock items found" description="Tracked products will appear here when the catalog is connected." /></div>}</section></Shell>;
}

function CatalogPage() {
  const query = useListProducts();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [notice, setNotice] = useState("");
  const products = ((query.data ?? []) as ProductLike[]).filter(product => (kind === "ALL" || product.kind === kind) && `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase()));
  return <Shell title="Catalog"><PageIntro title="Catalog & services" subtitle="The names and prices your team reaches for at the counter." action={<button type="button" data-testid="button-add-catalog-item" onClick={() => setNotice("Use this catalog as the checklist for the goods you already purchased. Selling prices still need to be entered.")} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={17} />Add item</button>} />{notice && <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"><span>{notice}</span><IconButton label="dismiss catalog notice" onClick={() => setNotice("")}><X size={15} /></IconButton></div>}<div className="mb-4 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input data-testid="input-catalog-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, or category" className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><div className="flex rounded-lg border border-border bg-card p-1">{["ALL", "SERVICE", "PRODUCT"].map(item => <button type="button" key={item} data-testid={`button-kind-${item.toLowerCase()}`} onClick={() => setKind(item)} className={cn("rounded-md px-3 py-1.5 text-xs font-bold", kind === item ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted")}>{item === "ALL" ? "Everything" : item === "SERVICE" ? "Services" : "Products"}</button>)}</div></div>{query.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40" />)}</div> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : products.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <article key={product.id} data-testid={`card-catalog-${product.id}`} className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/40"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">{product.kind === "SERVICE" ? <Printer size={19} /> : <PackageSearch size={19} />}</div><span className={cn("rounded px-2 py-1 text-[10px] font-bold", product.active ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>{product.active ? "Active" : "Inactive"}</span></div><h3 className="mt-5 text-sm font-bold">{product.name}</h3><p className="mt-1 font-mono text-[11px] text-muted-foreground">{product.sku} · {product.category}</p><div className="mt-5 flex items-end justify-between border-t border-border pt-3"><span className="font-mono text-lg font-bold text-primary">{product.price > 0 ? money(product.price) : "Harga belum diatur"}</span><span className="text-xs text-muted-foreground">per {product.unit}</span></div></article>)}</div> : <EmptyState icon={Tag} title="Catalog is empty" description="Add a service or product when the catalog service is connected." />}</Shell>;
}

function ReportsPage() {
  const summaryQuery = useGetDashboardSummary();
  const txQuery = useListTransactions({ limit: 100 });
  const summary = summaryQuery.data as SummaryLike | undefined;
  const transactions = (txQuery.data ?? []) as TransactionLike[];
  if (summaryQuery.isLoading) return <DashboardSkeleton />;
  if (summaryQuery.isError || !summary) return <Shell title="Reports"><ErrorState onRetry={() => summaryQuery.refetch()} /></Shell>;
  const paid = transactions.filter(tx => tx.status === "PAID");
  return <Shell title="Reports"><PageIntro title="Owner report" subtitle="A quick read on today’s health, without losing the details." action={<button type="button" data-testid="button-print-report" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-muted"><FileText size={16} />Print report</button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Gross revenue" value={money(summary.revenueToday)} helper="Paid tickets only" icon={CircleDollarSign} /><StatCard label="Net cash" value={money(summary.netCash)} helper={`${money(summary.expensesToday)} expenses`} icon={ArrowUpRight} tone="teal" /><StatCard label="Avg. ticket" value={money(summary.averageTransaction)} helper={`${summary.transactionCount} tickets`} icon={Receipt} tone="yellow" /><StatCard label="Paid tickets" value={`${paid.length}`} helper="Current report period" icon={ClipboardList} tone="teal" /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="mb-5"><h3 className="font-semibold">Category performance</h3><p className="mt-1 text-xs text-muted-foreground">Revenue share by work type</p></div><div className="space-y-5">{summary.categorySales.map((item, index) => { const max = Math.max(...summary.categorySales.map(i => i.total), 1); return <div key={item.category}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{item.category}</span><span className="font-mono font-bold">{money(item.total)}</span></div><div className="h-3 rounded-full bg-muted"><div className={cn("h-full rounded-full", ["bg-primary", "bg-secondary-foreground", "bg-accent", "bg-chart-4"][index % 4])} style={{ width: `${item.total / max * 100}%` }} /></div></div> })}</div></section><section className="paper-grid rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"><h3 className="font-semibold">Owner’s note</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">Keep an eye on paper and finishing supplies during the late afternoon rush. A healthy ticket average with low stock is still a correction waiting to happen.</p><div className="mt-6 border-t border-border pt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Report generated</p><p className="mt-1 font-mono text-sm">{new Date().toLocaleString("id-ID")}</p></div></section></div></Shell>;
}

function ExpensesPage() {
  const summaryQuery = useGetDashboardSummary();
  const expensesQuery = useListExpenses();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const queryClient = useQueryClient();
  const summary = summaryQuery.data as SummaryLike | undefined;
  const expenses = (expensesQuery.data ?? []) as ExpenseLike[];
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Operasional");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");

  const refreshExpenses = () => {
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActivityQueryKey({ limit: 7 }) });
  };
  const submitExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !description.trim()) {
      setNotice("Enter a valid amount and description.");
      return;
    }
    createExpense.mutate({ data: { amount: numericAmount, category, description: description.trim() } }, {
      onSuccess: () => {
        setAmount("");
        setDescription("");
        setFormOpen(false);
        setNotice("Expense recorded.");
        refreshExpenses();
      },
      onError: (error) => setNotice(error instanceof Error ? error.message : "Expense could not be recorded."),
    });
  };
  const removeExpense = (expense: ExpenseLike) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    deleteExpense.mutate({ id: expense.id }, {
      onSuccess: () => {
        setNotice("Expense deleted.");
        refreshExpenses();
      },
      onError: (error) => setNotice(error instanceof Error ? error.message : "Expense could not be deleted."),
    });
  };

  return <Shell title="Expenses">
    <PageIntro title="Expenses" subtitle="Keep the cash-out side of the shop visible and accountable." action={<button type="button" data-testid="button-add-expense" onClick={() => setFormOpen(value => !value)} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={17} />Record expense</button>} />
    {notice && <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"><span>{notice}</span><IconButton label="dismiss expense notice" onClick={() => setNotice("")}><X size={15} /></IconButton></div>}
    {formOpen && <form onSubmit={submitExpense} className="mb-6 rounded-xl border border-primary/25 bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4"><h3 className="font-semibold">Record an expense</h3><p className="mt-1 text-xs text-muted-foreground">This will immediately update today’s net cash.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold"><span>Amount (IDR)</span><input data-testid="input-expense-amount" required min="1" step="100" type="number" value={amount} onChange={event => setAmount(event.target.value)} placeholder="25000" className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
        <label className="text-xs font-semibold"><span>Category</span><select data-testid="select-expense-category" value={category} onChange={event => setCategory(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"><option>Operasional</option><option>Bahan toko</option><option>Listrik & internet</option><option>Transport</option><option>Lainnya</option></select></label>
      </div>
      <label className="mt-4 block text-xs font-semibold"><span>Description</span><input data-testid="input-expense-description" required value={description} onChange={event => setDescription(event.target.value)} placeholder="Beli tinta printer" className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">Cancel</button><button type="submit" disabled={createExpense.isPending} data-testid="button-save-expense" className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">{createExpense.isPending ? "Saving..." : "Save expense"}</button></div>
    </form>}
    <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Today’s expenses" value={summary ? money(summary.expensesToday) : "—"} helper="From saved expense records" icon={CircleDollarSign} tone="yellow" /><StatCard label="Net after expenses" value={summary ? money(summary.netCash) : "—"} helper="Revenue less expenses" icon={ArrowUpRight} tone="teal" /></div>
    <section className="mt-6 rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="border-b border-border p-5"><h3 className="font-semibold">Expense history</h3><p className="mt-1 text-xs text-muted-foreground">Saved in the shop database and included in reports.</p></div>
      {expensesQuery.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : expensesQuery.isError ? <div className="p-5"><ErrorState onRetry={() => expensesQuery.refetch()} label="Expenses could not be loaded." /></div> : expenses.length ? <div className="divide-y divide-border">{expenses.map(expense => <div key={expense.id} data-testid={`row-expense-${expense.id}`} className="flex items-center justify-between gap-4 p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{expense.description}</p><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{expense.category}</span></div><p className="mt-1 text-xs text-muted-foreground">{dateTime(expense.createdAt)}</p></div><div className="flex items-center gap-3"><p className="font-mono text-sm font-bold text-destructive">−{money(expense.amount)}</p><button type="button" aria-label={`Delete expense ${expense.id}`} data-testid={`button-delete-expense-${expense.id}`} onClick={() => removeExpense(expense)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} /></button></div></div>)}</div> : <div className="p-5"><EmptyState icon={ClipboardList} title="No expense entries yet" description="Record your first shop expense to keep net cash accurate." /></div>}
    </section>
  </Shell>;
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const importBackupMutation = useImportBackup();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupNotice, setBackupNotice] = useState("");
  const [backupBusy, setBackupBusy] = useState<"export" | "import" | null>(null);
  const downloadBackup = async () => {
    setBackupBusy("export");
    setBackupNotice("");
    try {
      const snapshot = await exportBackup();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `potocopy-qta-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBackupNotice("Backup JSON berhasil diunduh ke perangkat.");
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : "Backup tidak dapat dibuat.");
    } finally {
      setBackupBusy(null);
    }
  };
  const importBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const snapshot = JSON.parse(await file.text()) as BackupSnapshot;
      if (!window.confirm("Restore akan mengganti data toko saat ini dengan isi file backup. Lanjutkan?")) return;
      setBackupBusy("import");
      setBackupNotice("");
      importBackupMutation.mutate({ data: snapshot }, {
        onSuccess: (result) => {
          setBackupBusy(null);
          setBackupNotice(`Restore berhasil: ${result.counts.transactions ?? 0} transaksi dan ${result.counts.expenses ?? 0} pengeluaran dipulihkan.`);
          queryClient.invalidateQueries();
        },
        onError: (error) => {
          setBackupBusy(null);
          setBackupNotice(error instanceof Error ? error.message : "File backup tidak dapat dipulihkan.");
        },
      });
    } catch {
      setBackupNotice("File bukan JSON backup Potocopy QTA yang valid.");
    }
  };
  return <Shell title="Settings"><PageIntro title="Shop settings" subtitle="A small, clear home for the people and preferences behind QTA." />
    {backupNotice && <div className="mb-4 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">{backupNotice}</div>}
    <section className="rounded-xl border border-primary/20 bg-card p-6 shadow-[var(--shadow-soft)]"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Download size={19} /></div><h3 className="mt-5 text-lg font-bold">Backup & restore</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Simpan salinan seluruh catalog, inventory, transaksi, pembayaran, pengeluaran, dan activity log ke penyimpanan HP sebagai file JSON.</p><div className="mt-5 rounded-lg border border-accent/40 bg-accent/10 p-4 text-xs leading-5 text-accent-foreground"><strong>Penting:</strong> Restore akan mengganti data toko yang sedang tersimpan. Download backup terbaru sebelum melakukan restore.</div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" data-testid="button-download-backup" disabled={backupBusy !== null} onClick={downloadBackup} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"><Download size={16} />{backupBusy === "export" ? "Preparing..." : "Download backup JSON"}</button><button type="button" data-testid="button-restore-backup" disabled={backupBusy !== null} onClick={() => backupInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-60"><Upload size={16} />{backupBusy === "import" ? "Restoring..." : "Restore from JSON"}</button><input ref={backupInputRef} data-testid="input-restore-backup" type="file" accept="application/json,.json" onChange={importBackupFile} className="hidden" /></div></section>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Store size={19} /></div><h3 className="mt-5 text-lg font-bold">Shop profile</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Branch name, address, receipt footer, and operating hours will live here.</p><div className="mt-5 rounded-lg border border-dashed border-border bg-muted/35 p-4 text-xs text-muted-foreground">Settings surface is ready. Connect the shop profile service to begin editing.</div></section><section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/35 text-accent-foreground"><Users size={19} /></div><h3 className="mt-5 text-lg font-bold">Team access</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Cashier roles, owner permissions, and activity visibility will be managed here.</p><div className="mt-5 rounded-lg border border-dashed border-border bg-muted/35 p-4 text-xs text-muted-foreground">Team management is not connected yet. Clerk owns sign-in and session security.</div></section></div>
  </Shell>;
}

function PublicAccess() {
  return <div className="paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] sm:p-9"><LogoMark /><div className="mt-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">The trusted counter desk</p><h1 className="mt-3 font-mono text-3xl font-bold tracking-tight">Every ticket,<br />right on paper.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Potocopy QTA keeps busy photocopy counters fast, visible, and easy to correct.</p></div><div className="mt-8 grid gap-3"><Link href="/sign-in" data-testid="link-sign-in" className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">Sign in to QTA</Link><Link href="/sign-up" data-testid="link-sign-up" className="flex h-11 items-center justify-center rounded-lg border border-border text-sm font-bold hover:bg-muted">Create an account</Link></div><p className="mt-7 text-center text-[11px] text-muted-foreground">Built for the rush at the neighborhood print counter.</p></div></div>;
}

function SignInPage() {
  return clerkPubKey ? <div className="paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div> : <PublicAccess />;
}
function SignUpPage() {
  return clerkPubKey ? <div className="paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div> : <PublicAccess />;
}

function AppRoutes({ signedIn }: { signedIn: boolean }) {
  return <Switch><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} />{signedIn ? <><Route path="/" component={DashboardPage} /><Route path="/cashier" component={CashierPage} /><Route path="/transactions" component={TransactionsPage} /><Route path="/inventory" component={InventoryPage} /><Route path="/catalog" component={CatalogPage} /><Route path="/reports" component={ReportsPage} /><Route path="/expenses" component={ExpensesPage} /><Route path="/settings" component={SettingsPage} /></> : <Route path="/" component={PublicAccess} />}<Route component={NotFound} /></Switch>;
}

function ClerkApp() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="w-56"><Skeleton className="h-10" /><Skeleton className="mt-3 h-4" /><Skeleton className="mt-8 h-40" /></div></div>;
  return <AppRoutes signedIn={Boolean(isSignedIn)} />;
}

function NoClerkApp() {
  return <AppRoutes signedIn={false} />;
}

function ClerkWrappedApp() {
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={{ variables: { colorPrimary: "#d95b38", colorBackground: "#fffdf8", colorForeground: "#243a3e", colorMutedForeground: "#667579", fontFamily: "DM Sans, sans-serif", borderRadius: "10px" }, elements: { cardBox: "bg-[#fffdf8] rounded-2xl border border-[#eadfd3] shadow-xl", formButtonPrimary: "bg-[#d95b38] hover:bg-[#bf482a]", headerTitle: "font-mono", footerActionLink: "text-[#d95b38]" } }} localization={{ signIn: { start: { title: "Welcome back", subtitle: "Sign in to open the QTA counter" } }, signUp: { start: { title: "Open your QTA desk", subtitle: "Create an account for your shop" } } }}><ClerkApp /></ClerkProvider>;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><RoutedErrorBoundary>{clerkPubKey ? <ClerkWrappedApp /> : <NoClerkApp />}</RoutedErrorBoundary></WouterRouter></QueryClientProvider>;
}

export default App;