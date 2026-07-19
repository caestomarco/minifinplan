export function formatRupiah(n: number | string | null | undefined): string
{
    const num = Number(n ?? 0);
    if (!isFinite(num)) return "Rp0";
    return "Rp" + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(num);
}

export const TX_CATEGORIES = [
    "Foods & Beverages",
    "Clothings",
    "Accessories",
    "Transport",
    "Utilities",
    "Entertainment",
    "Shopping",
    "Salary",
    "Other",
];

export const PLATFORMS = ["Cash", "Seabank", "GoPay", "DANA", "ShopeePay", "BRI"];
