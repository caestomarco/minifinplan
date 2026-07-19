import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PiggyBank, Plus as PlusIcon } from "lucide-react";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_app/goals")({
    component: GoalsPage,
});

type Row = { id: string; name: string; target_amount: number; current_amount: number; deadline: string | null };
const empty = () => ({ name: "", target_amount: 0, current_amount: 0, deadline: "" });

function GoalsPage()
{
    const { user } = useAuth();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [deleteGoal, setDeleteGoal] = useState<Row | null>(null);
    const [editing, setEditing] = useState<Row | null>(null);
    const [form, setForm] = useState(empty());
    const [contribOpen, setContribOpen] = useState<Row | null>(null);
    const [contribAmt, setContribAmt] = useState(0);

    const { data: rows = [] } = useQuery({
        queryKey: ["goals", user!.id],
        queryFn: async () =>
        {
            const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
            if (error) throw error;
            return data as Row[];
        },
    });

    const upsert = useMutation({
        mutationFn: async () =>
        {
            const payload = {
                name: form.name,
                target_amount: Number(form.target_amount),
                current_amount: Number(form.current_amount),
                deadline: form.deadline || null,
                user_id: user!.id,
            };
            if (editing)
            {
                const { error } = await supabase.from("goals").update(payload).eq("id", editing.id);
                if (error) throw error;
            } else
            {
                const { error } = await supabase.from("goals").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () =>
        {
            qc.invalidateQueries({ queryKey: ["goals"] });
            toast.success(editing ? "Updated" : "Goal added");
            setOpen(false); setEditing(null); setForm(empty());
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const del = useMutation({
        mutationFn: async (id: string) =>
        {
            const { error } = await supabase.from("goals").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Deleted"); },
    });

    const contrib = useMutation({
        mutationFn: async () =>
        {
            if (!contribOpen) return;
            const newAmt = Number(contribOpen.current_amount) + Number(contribAmt);
            const { error } = await supabase.from("goals").update({ current_amount: newAmt }).eq("id", contribOpen.id);
            if (error) throw error;
        },
        onSuccess: () =>
        {
            qc.invalidateQueries({ queryKey: ["goals"] });
            toast.success("Contribution added");
            setContribOpen(null); setContribAmt(0);
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Goals</h1>
                    <p className="text-sm text-muted-foreground">Track your savings progress</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="w-full md:w-auto" onClick={() => { setEditing(null); setForm(empty()); }}><Plus className="h-4 w-4 mr-1" /> New goal</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editing ? "Edit goal" : "New goal"}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emergency Fund" /></div>
                            <div className="space-y-1.5"><Label>Target amount (Rp)</Label><Input type="number" min={0} value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) })} /></div>
                            <div className="space-y-1.5"><Label>Current saved (Rp)</Label><Input type="number" min={0} value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: Number(e.target.value) })} /></div>
                            <div className="space-y-1.5"><Label>Deadline (optional)</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button onClick={() => upsert.mutate()} disabled={!form.name || form.target_amount <= 0 || upsert.isPending}>{editing ? "Save" : "Add"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {rows.length === 0 && <p className="text-sm text-muted-foreground">No goals yet.</p>}
                {rows.map((g) =>
                {
                    const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
                    const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));
                    return (
                        <Card key={g.id}>
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center"><PiggyBank className="h-5 w-5 text-primary" /></div>
                                    <div>
                                        <CardTitle className="text-base">{g.name}</CardTitle>
                                        <CardDescription>{g.deadline ? `Due ${new Date(g.deadline).toLocaleDateString("id-ID")}` : "No deadline"}</CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => setContribOpen(g)}><PlusIcon className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => { setEditing(g); setForm({ name: g.name, target_amount: g.target_amount, current_amount: g.current_amount, deadline: g.deadline ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => { setDeleteGoal(g); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline justify-between mb-2">
                                    <div className="text-xl font-semibold">{formatRupiah(g.current_amount)}</div>
                                    <div className="text-sm text-muted-foreground">of {formatRupiah(g.target_amount)}</div>
                                </div>
                                <Progress value={pct} />
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                    <span>{pct.toFixed(0)}% reached</span>
                                    <span>{formatRupiah(remaining)} to go</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={!!contribOpen} onOpenChange={(o) => !o && setContribOpen(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add contribution to {contribOpen?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-1.5"><Label>Amount (Rp)</Label><Input type="number" min={0} value={contribAmt} onChange={(e) => setContribAmt(Number(e.target.value))} /></div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setContribOpen(null)}>Cancel</Button>
                        <Button onClick={() => contrib.mutate()} disabled={contribAmt <= 0 || contrib.isPending}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteGoal} onOpenChange={(open) => !open && setDeleteGoal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Delete goal {deleteGoal?.name}?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete this goal? This action cannot be undone.
                    </p>
                    <DialogFooter className="gap-y-2">
                        <Button variant="outline" onClick={() => setDeleteGoal(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() =>
                            {
                                if (deleteGoal)
                                {
                                    del.mutate(deleteGoal.id);
                                    setDeleteGoal(null);
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
