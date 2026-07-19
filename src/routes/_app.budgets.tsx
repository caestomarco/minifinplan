import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet, Car } from "lucide-react";
import { formatRupiah } from "@/lib/format";


export const Route = createFileRoute("/_app/budgets")({
    component: BudgetsPage,
});

type Row = {
    id: string;
    name: string;
    category: string;
    amount: number;
    period: string;
};

type FormState = {
    name: string;
    category: string;
    amount: number;
    period: string;
};

const empty = (): FormState => ({
    name: "",
    category: "Foods & Beverages",
    amount: 0,
    period: "monthly",
});

function periodWindow(b: Row, now: Date): { from: Date; to: Date }
{
    if (b.period === "yearly")
    {
        return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
    }
    if (b.period === "weekly")
    {
        const from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(now.getDate() - now.getDay());
        const to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999);
        return { from, to };
    }
    // monthly
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
}

function BudgetsPage()
{
    const { user } = useAuth();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [deleteBudget, setDeleteBudget] = useState<Row | null>(null);
    const [editing, setEditing] = useState<Row | null>(null);
    const [form, setForm] = useState<FormState>(empty());
    const [detailsBudget, setDetailsBudget] = useState<Row | null>(null);
    const { options: categoryOptions } = useCategories();

    const { data: rows = [] } = useQuery({
        queryKey: ["budgets", user!.id],
        queryFn: async () =>
        {
            const { data, error } = await supabase.from("budgets").select("*").order("created_at");
            if (error) throw error;
            return data as Row[];
        },
    });

    const { data: tx = [] } = useQuery({
        queryKey: ["tx", user!.id],
        queryFn: async () =>
        {
            const { data, error } = await supabase.from("transactions").select("*");
            if (error) throw error;
            return data;
        },
    });

    const upsert = useMutation({
        mutationFn: async () =>
        {
            const payload = {
                name: form.name,
                category: form.category,
                amount: Number(form.amount),
                period: form.period,
                user_id: user!.id,
            };
            if (editing)
            {
                const { error } = await supabase.from("budgets").update(payload).eq("id", editing.id);
                if (error) throw error;
            } else
            {
                const { error } = await supabase.from("budgets").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () =>
        {
            qc.invalidateQueries({ queryKey: ["budgets"] });
            toast.success(editing ? "Updated" : "Budget added");
            setOpen(false);
            setEditing(null);
            setForm(empty());
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const del = useMutation({
        mutationFn: async (id: string) =>
        {
            const { error } = await supabase.from("budgets").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Deleted"); },
    });

    const now = new Date();
    const spentFor = (b: Row) =>
    {
        const { from, to } = periodWindow(b, now);
        return tx.filter((t) => t.type === "expense" && t.category === b.category).filter((t) =>
        {
            const d = new Date(t.date);
            return d >= from && d <= to;
        }).reduce((s, t) => s + Number(t.amount), 0);
    };

    const periodLabel = (b: Row) =>
    {
        return b.period;
    };

    const totalIncome = tx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = tx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const netBalance = totalIncome - totalExpense;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budgets</h1>
                    <p className="text-sm text-muted-foreground">Set your budgets to manage your spending</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full md:w-auto" onClick={() => { setEditing(null); setForm(empty()); }}>
                            <Plus className="h-4 w-4 mr-1" />
                            New budget
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? "Edit budget" : "New budget"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label>
                                    Name
                                </Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Utilities Jan 25 – Feb 25" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>
                                    Category
                                </Label>
                                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{categoryOptions.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>
                                    Period
                                </Label>
                                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="weekly">Weekly (this week)</SelectItem>
                                        <SelectItem value="monthly">Monthly (this month)</SelectItem>
                                        <SelectItem value="yearly">Yearly (this year)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>
                                    Amount (Rp)
                                </Label>
                                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                            </div>
                        </div>
                        <DialogFooter className="gap-y-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button
                                onClick={() => upsert.mutate()}
                                disabled={
                                    !form.name ||
                                    form.amount <= 0 ||
                                    upsert.isPending
                                }
                            >
                                {editing ? "Save" : "Add"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* BUDGET CARDS */}
            <div className="grid gap-4 md:grid-cols-2">
                {rows.length === 0 && <p className="text-sm text-muted-foreground">No budgets yet.</p>}
                {rows.map((b) =>
                {
                    const spent = spentFor(b);
                    const pct = Math.min(100, (spent / Number(b.amount)) * 100);
                    return (
                        <Card
                            key={b.id}
                            className="cursor-pointer transition-colors hover:bg-accent/40"
                            onClick={() => setDetailsBudget(b)}
                        >
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center"><Wallet className="h-5 w-5 text-primary" /></div>
                                    <div>
                                        <CardTitle className="text-base">{b.name}</CardTitle>
                                        <CardDescription>{b.category} · {periodLabel(b)}</CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button size="icon" variant="ghost" onClick={() =>
                                    {
                                        setEditing(b);
                                        setForm({
                                            name: b.name,
                                            category: b.category,
                                            amount: b.amount,
                                            period: b.period,
                                        });
                                        setOpen(true);
                                    }}><Pencil className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteBudget(b) }}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline justify-between mb-2">
                                    <div className="text-xl font-semibold">{formatRupiah(spent)}</div>
                                    <div className="text-sm text-muted-foreground">of {formatRupiah(b.amount)}</div>
                                </div>
                                <Progress value={pct} />
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                    <span>{pct.toFixed(0)}% used</span>
                                    <span>{formatRupiah(Math.max(0, Number(b.amount) - spent))} left</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={!!deleteBudget} onOpenChange={(open) => !open && setDeleteBudget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Delete budget {deleteBudget?.name}?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete this budget? This action cannot be undone.
                    </p>
                    <DialogFooter className="gap-y-2">
                        <Button variant="outline" onClick={() => setDeleteBudget(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() =>
                            {
                                if (deleteBudget)
                                {
                                    del.mutate(deleteBudget.id);
                                    setDeleteBudget(null);
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BudgetDetailsDialog
                budget={detailsBudget}
                tx={tx}
                onClose={() => setDetailsBudget(null)}
            />

            {/* BALANCE LEFT CARD FOR BUDGETS */}
            {rows.length > 0 &&
                <Card>
                    <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">Your final fund estimation if all budgets are used:</div>
                        <div className="text-lg font-semibold text-primary">
                            {formatRupiah(netBalance - rows.reduce((accumulator, currentItem) => accumulator + (Number(currentItem.amount) - spentFor(currentItem)), 0))}
                        </div>
                    </CardContent>
                </Card>
            }
        </div >
    );
}

type Tx = { id: string; date: string; type: string; category: string; platform: string; amount: number; description: string | null };

function BudgetDetailsDialog({ budget, tx, onClose }: { budget: Row | null; tx: Tx[]; onClose: () => void })
{
    const matches = useMemo(() =>
    {
        if (!budget) return [] as Tx[];
        const { from, to } = periodWindow(budget, new Date());
        return tx
            .filter((t) => t.type === "expense" && t.category === budget.category)
            .filter((t) => { const d = new Date(t.date); return d >= from && d <= to; })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [budget, tx]);

    const spent = matches.reduce((s, t) => s + Number(t.amount), 0);
    const remaining = budget ? Math.max(0, Number(budget.amount) - spent) : 0;
    const pct = budget ? Math.min(100, (spent / Number(budget.amount)) * 100) : 0;

    return (
        <Dialog open={!!budget} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-3xl">
                {budget && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{budget.name}</DialogTitle>
                            <DialogDescription>{budget.category} · {budget.period}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground">Budget</div>
                                    <div className="text-lg font-semibold">{formatRupiah(budget.amount)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground">Spent</div>
                                    <div className="text-lg font-semibold text-destructive">{formatRupiah(spent)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground">Remaining</div>
                                    <div className="text-lg font-semibold text-success">{formatRupiah(remaining)}</div>
                                </CardContent>
                            </Card>
                        </div>
                        <Progress value={pct} />
                        <div className="overflow-x-auto rounded border">
                            <div className="max-h-40 overflow-y-auto ">
                                <Table className="min-w-max">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Platform</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {matches.length === 0 &&
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No transactions in this budget's period.</TableCell>
                                            </TableRow>}
                                        {matches.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell>{new Date(t.date).toLocaleDateString("id-ID")}</TableCell>
                                                <TableCell><Badge variant="secondary">{t.platform}</Badge></TableCell>
                                                <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                                                <TableCell className="text-right font-medium text-destructive">{formatRupiah(t.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        {/* <DialogFooter>
                            <Button variant="outline" onClick={onClose}>Close</Button>
                        </DialogFooter> */}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
