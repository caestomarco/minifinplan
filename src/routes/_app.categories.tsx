import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { TX_CATEGORIES } from "@/lib/format";

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesPage,
});

type Row = { id: string; name: string };

function CategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const upsert = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      if (editing) {
        const { error } = await supabase
          .from("categories")
          .update({ name: trimmed })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ name: trimmed, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Category updated" : "Category added");
      setOpen(false);
      setEditing(null);
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const existing = new Set(categories.map((c) => c.name));
      const payload = TX_CATEGORIES.filter((n) => !existing.has(n)).map((n) => ({
        name: n,
        user_id: user!.id,
      }));
      if (payload.length === 0) return 0;
      const { error } = await supabase.from("categories").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      invalidate();
      toast.success(n ? `Added ${n} default categories` : "Defaults already present");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage the categories used across transactions & budgets</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
          <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
            Add defaults
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setName(""); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setName(""); }}>
                <Plus className="h-4 w-4 mr-1" /> New category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Groceries"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !name.trim()}>
                  {editing ? "Save" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your categories</CardTitle>
          <CardDescription>
            {categories.length === 0
              ? "No custom categories yet — defaults are used until you add some."
              : `${categories.length} categories`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                    Click "Add defaults" to populate the built-in list, or create your own.
                  </TableCell>
                </TableRow>
              )}
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" /> {c.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setName(c.name);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete category "${c.name}"? Existing transactions keep their category text.`))
                            del.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
