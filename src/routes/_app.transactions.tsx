import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Upload, Trash, Search, X } from "lucide-react";
import { formatRupiah, PLATFORMS } from "@/lib/format";
import { useCategories } from "@/hooks/use-categories";

// Parse a single CSV line respecting quoted fields
function parseCsvLine(line: string): string[]
{
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++)
    {
        const c = line[i];
        if (inQ)
        {
            if (c === '"')
            {
                if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
            } else cur += c;
        } else
        {
            if (c === '"') inQ = true;
            else if (c === ",") { out.push(cur); cur = ""; }
            else cur += c;
        }
    }
    out.push(cur);
    return out;
}

function parseRupiah(s: string): number
{
    return Number(String(s).replace(/[^\d.-]/g, "")) || 0;
}

function parseCsvDate(s: string): string | null
{
    // "Friday, 9 January 2026" -> "2026-01-09"
    const cleaned = s.replace(/^[A-Za-z]+,\s*/, "").trim();
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

type ParsedRow = { date: string; type: string; category: string; platform: string; amount: number; description: string };

function parseTransactionsCsv(text: string): { rows: ParsedRow[]; errors: string[] }
{
    const errors: string[] = [];
    const rows: ParsedRow[] = [];
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { rows, errors: ["File is empty"] };
    // Skip header
    for (let i = 1; i < lines.length; i++)
    {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 8) { errors.push(`Row ${i + 1}: expected 8 columns, got ${cols.length}`); continue; }
        const [dateRaw, typeRaw, category, platform, , amountRaw, , description] = cols;
        const date = parseCsvDate(dateRaw);
        if (!date) { errors.push(`Row ${i + 1}: invalid date "${dateRaw}"`); continue; }
        const type = typeRaw.trim().toLowerCase();
        if (type !== "income" && type !== "expense") { errors.push(`Row ${i + 1}: invalid type "${typeRaw}"`); continue; }
        const amount = parseRupiah(amountRaw);
        if (amount <= 0) { errors.push(`Row ${i + 1}: invalid amount "${amountRaw}"`); continue; }
        rows.push({ date, type, category: category.trim() || "Other", platform: platform.trim() || "Other", amount, description: (description ?? "").trim() });
    }
    return { rows, errors };
}

export const Route = createFileRoute("/_app/transactions")({
    component: TransactionsPage,
});

type TxRow = {
    id: string;
    date: string;
    type: string;
    category: string;
    platform: string;
    amount: number;
    description: string | null;
    created_at?: string;
};

const empty = (): Omit<TxRow, "id"> => ({
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Foods & Beverages",
    platform: "Cash",
    amount: 0,
    description: "",
});

function TransactionsPage()
{
    const { user } = useAuth();
    const qc = useQueryClient();
    const { options: categoryOptions } = useCategories();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<TxRow | null>(null);
    const [deleteTransaction, setDeleteTransaction] = useState<TxRow | null>(null);
    const [isClearAll, setIsClearAll] = useState(false);
    const [form, setForm] = useState(empty());
    const [importOpen, setImportOpen] = useState(false);
    const [importPreview, setImportPreview] = useState<{ rows: ParsedRow[]; errors: string[]; fileName: string } | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterPlatform, setFilterPlatform] = useState<string>("all");
    const [filterType, setFilterType] = useState<string>("all");

    const importMut = useMutation({
        mutationFn: async (rows: ParsedRow[]) =>
        {
            const payload = rows.map((r) => ({ ...r, user_id: user!.id }));
            // Insert in chunks to avoid payload limits
            const chunkSize = 200;
            for (let i = 0; i < payload.length; i += chunkSize)
            {
                const { error } = await supabase.from("transactions").insert(payload.slice(i, i + chunkSize));
                if (error) throw error;
            }
        },
        onSuccess: (_d, vars) =>
        {
            qc.invalidateQueries({ queryKey: ["tx"] });
            toast.success(`Imported ${vars.length} transactions`);
            setImportOpen(false);
            setImportPreview(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleFile = async (file: File) =>
    {
        const text = await file.text();
        const { rows, errors } = parseTransactionsCsv(text);
        setImportPreview({ rows, errors, fileName: file.name });
    };

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ["tx", user!.id],
        queryFn: async () =>
        {
            const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
            if (error) throw error;
            return data as TxRow[];
        },
    });

    const upsert = useMutation({
        mutationFn: async () =>
        {
            const payload = { ...form, amount: Number(form.amount), user_id: user!.id };
            if (editing)
            {
                const { error } = await supabase.from("transactions").update(payload).eq("id", editing.id);
                if (error) throw error;
            } else
            {
                const { error } = await supabase.from("transactions").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () =>
        {
            qc.invalidateQueries({ queryKey: ["tx"] });
            toast.success(editing ? "Transaction updated" : "Transaction added");
            setOpen(false);
            setEditing(null);
            setForm(empty());
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const del = useMutation({
        mutationFn: async (id: string) =>
        {
            const { error } = await supabase.from("transactions").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () =>
        {
            qc.invalidateQueries({ queryKey: ["tx"] });
            toast.success("Deleted");
        },
    });

    const clearAll = useMutation({
        mutationFn: async () =>
        {
            const { error } = await supabase.from("transactions").delete().eq("user_id", user!.id);
            if (error) throw error;
        },
        onSuccess: () =>
        {
            qc.invalidateQueries({ queryKey: ["tx"] });
            toast.success("All transactions cleared");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const openEdit = (r: TxRow) =>
    {
        setEditing(r);
        setForm({ date: r.date, type: r.type, category: r.category, platform: r.platform, amount: r.amount, description: r.description ?? "" });
        setOpen(true);
    };

    const openNew = () =>
    {
        setEditing(null);
        setForm(empty());
        setOpen(true);
    };

    const rowsWithBalance = useMemo(() =>
    {
        const asc = [...rows].sort((a, b) =>
        {
            const d = a.date.localeCompare(b.date);
            if (d !== 0) return d;
            return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        });
        let bal = 0;
        const enriched = asc.map((r) =>
        {
            bal += r.type === "income" ? Number(r.amount) : -Number(r.amount);
            return { ...r, balance: bal };
        });
        return enriched.reverse();
    }, [rows]);

    const filteredRows = useMemo(() =>
    {
        const q = search.trim().toLowerCase();
        return rowsWithBalance.filter((r) =>
        {
            if (filterType !== "all" && r.type !== filterType) return false;
            if (filterCategory !== "all" && r.category !== filterCategory) return false;
            if (filterPlatform !== "all" && r.platform !== filterPlatform) return false;
            if (q)
            {
                const hay = `${r.description ?? ""} ${r.category} ${r.platform} ${r.type}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [rowsWithBalance, search, filterType, filterCategory, filterPlatform]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const activeFilterCount = (filterType !== "all" ? 1 : 0) + (filterCategory !== "all" ? 1 : 0) + (filterPlatform !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);
    const clearFilters = () =>
    {
        setSearch("");
        setFilterType("all");
        setFilterCategory("all");
        setFilterPlatform("all");
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-sm text-muted-foreground">All your income and expense records</p>
                </div>
                <div className="flex justify-stretch gap-2 md:justify-end">
                    <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive w-full"
                        disabled={rows.length === 0 || clearAll.isPending}
                        onClick={() => { setIsClearAll(true); setDeleteTransaction(null); }}
                    >
                        <Trash className="h-4 w-4 mr-1" /> Clear all
                    </Button>

                    {/* IMPORT TRANSACTION CSV */}
                    <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportPreview(null); }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Upload className="h-4 w-4 mr-1" />
                                Import CSV
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Import transactions from CSV</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Expected columns: <code>Date, Transaction Type, Transaction Category, Platform, Initial Fund, Transaction Amount, Final Fund, Description</code>
                                </p>
                                <Input
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                                />
                                {importPreview && (
                                    <div className="space-y-2 text-sm">
                                        <div className="text-muted-foreground">{importPreview.fileName} — {importPreview.rows.length} valid rows, {importPreview.errors.length} errors</div>
                                        {importPreview.errors.length > 0 && (
                                            <div className="max-h-32 overflow-auto rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                                                {importPreview.errors.slice(0, 20).map((e, i) => <div key={i}>{e}</div>)}
                                                {importPreview.errors.length > 20 && <div>…and {importPreview.errors.length - 20} more</div>}
                                            </div>
                                        )}
                                        {importPreview.rows.length > 0 && (
                                            <div className="max-h-60 overflow-auto rounded border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Platform</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {importPreview.rows.slice(0, 50).map((r, i) => (
                                                            <TableRow key={i}>
                                                                <TableCell>{r.date}</TableCell>
                                                                <TableCell>{r.type}</TableCell>
                                                                <TableCell>{r.category}</TableCell>
                                                                <TableCell>{r.platform}</TableCell>
                                                                <TableCell className="text-right">{formatRupiah(r.amount)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                {importPreview.rows.length > 50 && <div className="p-2 text-xs text-muted-foreground">Preview of first 50 rows. All {importPreview.rows.length} will be imported.</div>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="gap-y-2">
                                <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview(null); }}>Cancel</Button>
                                <Button
                                    onClick={() => importPreview && importMut.mutate(importPreview.rows)}
                                    disabled={!importPreview || importPreview.rows.length === 0 || importMut.isPending}
                                >
                                    {importMut.isPending ? "Importing…" : `Import ${importPreview?.rows.length ?? 0} rows`}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* ADD NEW & EDIT TRANSACTION DIALOG */}
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openNew} variant="default" className="w-full">
                                <Plus className="h-4 w-4 mr-1" />
                                New
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{editing ? "Edit transaction" : "New transaction"}</DialogTitle></DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Date</Label>
                                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Type</Label>
                                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="income">Income</SelectItem>
                                            <SelectItem value="expense">Expense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Category</Label>
                                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Platform</Label>
                                    <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PLATFORMS.map((p) => <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label>Amount (Rp)</Label>
                                    <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label>Description</Label>
                                    <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter className="gap-y-2">
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || form.amount <= 0}>{editing ? "Save changes" : "Add"}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* TRANSACTION TABLE */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <CardTitle>All records</CardTitle>
                                <CardDescription>
                                    {filteredRows.length === rows.length
                                        ? `${rows.length} transactions`
                                        : `${filteredRows.length} of ${rows.length} transactions`}
                                </CardDescription>
                            </div>
                            {activeFilterCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="h-4 w-4 mr-1" /> Clear filters
                                </Button>
                            )}
                        </div>
                        <div className="grid gap-2 md:grid-cols-4">
                            <div className="relative md:col-span-1">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8"
                                    placeholder="Search description, category…"
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                />
                            </div>
                            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All types</SelectItem>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All categories</SelectItem>
                                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterPlatform} onValueChange={(v) => { setFilterPlatform(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All platforms</SelectItem>
                                    {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Platform</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Net Balance</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-25" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
                            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No transactions yet.</TableCell></TableRow>}
                            {!isLoading && rows.length > 0 && filteredRows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No transactions match your filters.</TableCell></TableRow>}
                            {pagedRows.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{new Date(r.date).toLocaleDateString("id-ID")}</TableCell>
                                    <TableCell>
                                        <Badge variant={r.type === "income" ? "default" : "destructive"} className={r.type === "income" ? "bg-success" : ""}>{r.type}</Badge>
                                    </TableCell>
                                    <TableCell>{r.category}</TableCell>
                                    <TableCell>{r.platform}</TableCell>
                                    <TableCell className={`text-right font-medium ${r.type === "income" ? "text-success" : "text-destructive"}`}>{formatRupiah(r.amount)}</TableCell>
                                    <TableCell className={`text-right font-medium ${r.balance < 0 ? "text-destructive" : ""}`}>{formatRupiah(r.balance)}</TableCell>
                                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-1 justify-end">
                                            <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteTransaction(r) }}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredRows.length > 0 && (
                        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2 text-sm">
                                <span>Rows per page</span>
                                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                                    <SelectTrigger className="h-9 w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <span>
                                    showing {(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(1)}>
                                    First
                                </Button>
                                <Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                                    Previous
                                </Button>
                                <span className="text-sm">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                                    Next
                                </Button>
                                <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)}>
                                    Last
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DELETE TRANSACTION DIALOG */}
            <Dialog open={!!deleteTransaction || isClearAll} onOpenChange={(open) => 
            {
                if (!open)
                {
                    setDeleteTransaction(null);
                    setIsClearAll(false);
                }
            }
            }>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isClearAll ? "Clear all transactions" : "Delete transaction"}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {isClearAll
                            ? "Are you sure you want to clear all transactions? This action cannot be undone."
                            : "Are you sure you want to delete this transaction? This action cannot be undone."
                        }
                    </p>
                    <DialogFooter className="gap-y-2">
                        <Button variant="outline" onClick={() =>
                        {
                            setDeleteTransaction(null);
                            setIsClearAll(false);
                        }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() =>
                            {
                                if (deleteTransaction)
                                {
                                    del.mutate(deleteTransaction.id);
                                    setDeleteTransaction(null);
                                } else
                                {
                                    clearAll.mutate();
                                    setDeleteTransaction(null);
                                    setIsClearAll(false);
                                }
                            }}
                        >
                            {isClearAll ? "Clear all" : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
