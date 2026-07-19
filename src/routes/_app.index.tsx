import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { formatRupiah } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/")({
    component: Dashboard,
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Dashboard()
{
    const { user } = useAuth();
    const userId = user!.id;

    const { data: transactions = [] } = useQuery({
        queryKey: ["tx", userId],
        queryFn: async () =>
        {
            const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const now = new Date();
    const monthTx = transactions.filter((t) =>
    {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const netBalance = totalIncome - totalExpense;

    const [chartMonth, setChartMonth] = useState<number>(now.getMonth());
    const [chartYear, setChartYear] = useState<number>(now.getFullYear());
    const [trendYear, setTrendYear] = useState<number>(now.getFullYear());
    const [monthlyYear, setMonthlyYear] = useState<number>(now.getFullYear());

    const yearOptions = useMemo(() =>
    {
        const years = new Set<number>([now.getFullYear()]);
        transactions.forEach((t) => years.add(new Date(t.date).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [transactions, now]);

    const chartData = useMemo(() =>
    {
        const daysInChartMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
        const filtered = transactions.filter((t) =>
        {
            const d = new Date(t.date);
            return d.getMonth() === chartMonth && d.getFullYear() === chartYear;
        });
        return Array.from({ length: daysInChartMonth }, (_, i) =>
        {
            const day = i + 1;
            const dayTx = filtered.filter((t) => new Date(t.date).getDate() === day);
            const inc = dayTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
            const exp = dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
            return { day: String(day), income: inc, expense: exp };
        });
    }, [transactions, chartMonth, chartYear]);

    // Top 5 categories by total expense for the selected year, trended monthly
    const { categoryTrend, topCategories } = useMemo(() =>
    {
        const yearExpense = transactions.filter(
            (t) => t.type === "expense" && new Date(t.date).getFullYear() === trendYear,
        );
        const totals = new Map<string, number>();
        yearExpense.forEach((t) =>
        {
            totals.set(t.category, (totals.get(t.category) ?? 0) + Number(t.amount));
        });
        const top = Array.from(totals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([c]) => c);

        const data = MONTHS_SHORT.map((label, m) =>
        {
            const row: Record<string, string | number> = { month: label };
            top.forEach((cat) =>
            {
                row[cat] = yearExpense
                    .filter((t) => new Date(t.date).getMonth() === m && t.category === cat)
                    .reduce((s, t) => s + Number(t.amount), 0);
            });
            return row;
        });
        return { categoryTrend: data, topCategories: top };
    }, [transactions, trendYear]);

    const monthlyIncomeExpense = useMemo(() =>
    {
        return MONTHS_SHORT.map((label, m) =>
        {
            const monthTx = transactions.filter((t) =>
            {
                const d = new Date(t.date);
                return d.getFullYear() === monthlyYear && d.getMonth() === m;
            });
            const inc = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
            const exp = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
            return { month: label, income: inc, expense: exp };
        });
    }, [transactions, monthlyYear]);

    const LINE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Overview for {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    title="Net Balance"
                    value={formatRupiah(netBalance)}
                    icon={<Wallet className="h-4 w-4" />}
                    accent
                    hideable
                />
                <StatCard title="Income (this month)" value={formatRupiah(income)} icon={<ArrowUpRight className="h-4 w-4 text-success" />} hideable />
                <StatCard title="Expense (this month)" value={formatRupiah(expense)} icon={<ArrowDownRight className="h-4 w-4 text-destructive" />} hideable />
            </div>

            {/* DAILY INCOME VS EXPENSE CHART */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                    <div>
                        <CardTitle>Daily Income vs Expense</CardTitle>
                        <CardDescription>Compare your daily income and expense for {MONTHS[chartMonth]} {chartYear}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Select value={String(chartMonth)} onValueChange={(v) => setChartMonth(Number(v))}>
                            <SelectTrigger className="w-35 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={String(chartYear)} onValueChange={(v) => setChartYear(Number(v))}>
                            <SelectTrigger className="w-35 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(v: number) => formatRupiah(v)}
                                    labelFormatter={(l) => `Day ${l}`}
                                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                                />
                                <Bar dataKey="income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* MONTHLY INCOME VS EXPENSE CHART */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                    <div>
                        <CardTitle>Monthly Income vs Expense</CardTitle>
                        <CardDescription>Compare your total monthly income and expense for {monthlyYear}</CardDescription>
                    </div>
                    <Select value={String(monthlyYear)} onValueChange={(v) => setMonthlyYear(Number(v))}>
                        <SelectTrigger className="w-35 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyIncomeExpense} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(v: number) => formatRupiah(v)}
                                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* TOP 5 SPENDING CATEGORIES TREND */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                    <div>
                        <CardTitle>Top 5 Spending Categories</CardTitle>
                        <CardDescription>Overview of your 5 most-used categories in {trendYear}</CardDescription>
                    </div>
                    <Select value={String(trendYear)} onValueChange={(v) => setTrendYear(Number(v))}>
                        <SelectTrigger className="w-35 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {topCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No expense data for {trendYear}.</p>
                    ) : (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={categoryTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        formatter={(v: number) => formatRupiah(v)}
                                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    {topCategories.map((cat, i) => (
                                        <Line key={cat} type="monotone" dataKey={cat} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ title, value, icon, accent, hideable }: { title: string; value: string; icon: React.ReactNode; accent?: boolean; hideable?: boolean })
{
    const [hidden, setHidden] = useState(true);
    const showToggle = hideable;
    const displayValue = hideable && hidden ? "Rp ••••••" : value;

    return (
        <Card className={accent ? "bg-primary text-primary-foreground border-primary" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium opacity-90">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent className="flex items-center">
                <div className="text-xl leading-none font-bold align-middle translate-y-[-1.5px]">{displayValue}</div>
                {showToggle && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={accent ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" : "text-foreground hover:bg-primary-foreground/10"}
                        onClick={() => setHidden((v) => !v)}
                        title={hidden ? "Show balance" : "Hide balance"}
                    >
                        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
