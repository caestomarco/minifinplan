import
{
    createFileRoute,
    Outlet,
    Link,
    useNavigate,
    useLocation,
    redirect,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import
{
    LayoutDashboard,
    ListOrdered,
    Wallet,
    Target,
    Tag,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
    Sun,
    Moon,
    User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import
{
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app")({
    beforeLoad: async () =>
    {
        if (typeof window === "undefined") return;
        const { data } = await supabase.auth.getSession();
        if (!data.session)
        {
            throw redirect({ to: "/auth" });
        }
    },
    component: AppLayout,
});

function AppLayout()
{
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [signOutOpen, setSignOutOpen] = useState(false);

    useEffect(() =>
    {
        if (!loading && !user) navigate({ to: "/auth" });
    }, [user, loading, navigate]);

    if (loading || !user)
    {
        return (
            <div className="min-h-screen flex items-center justify-center text-muted-foreground">
                Loading…
            </div>
        );
    }

    const displayName = user.user_metadata?.name ?? (user.email?.split("@")[0] ?? "User");
    const initial = displayName.charAt(0).toUpperCase();

    const links = [
        { to: "/", label: "Dashboard", icon: LayoutDashboard },
        { to: "/transactions", label: "Transactions", icon: ListOrdered },
        { to: "/budgets", label: "Budgets", icon: Wallet },
        { to: "/goals", label: "Goals", icon: Target },
        { to: "/categories", label: "Categories", icon: Tag },
    ] as const;

    return (
        <div className="min-h-screen bg-background flex flex-col md:flex-row">
            <aside
                className={cn(
                    "md:min-h-screen border-b md:border-b-0 md:border-r bg-card md:overflow-hidden transition-[width] duration-300 ease-in-out",
                    sidebarOpen ? "md:w-64" : "md:w-16",
                )}
            >
                {/* SIDEBAR CONTAINER */}
                <div className="md:w-64">
                    {/* ACTION BUTTONS SMALL SCREEN */}
                    <div className="p-3 flex items-center gap-2.5">
                        {/* USER PROFILE */}
                        <Link
                            to="/profile"
                            title="View profile"
                            className="flex items-center gap-2.5 min-w-0 flex-1 rounded-lg hover:bg-accent hover:text-accent-foreground px-2 py-1 -m-1 transition-colors"
                        >
                            {user.user_metadata?.picture ? (
                                <img className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-semibold" src={user.user_metadata?.picture} alt="user_avatar" />
                            ) : (
                                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-semibold">
                                    {initial}
                                </div>
                            )}
                            <div
                                className={cn(
                                    "min-w-0 transition-opacity duration-200",
                                    sidebarOpen ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none",
                                )}
                            >
                                <div className="font-semibold leading-tight truncate md:max-w-40">{displayName}</div>
                                <div className="text-xs text-muted-foreground truncate md:max-w-40">{user.email}</div>
                            </div>
                        </Link>

                        {/* THEME TOGGLE */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden text-muted-foreground shrink-0"
                            onClick={toggleTheme}
                            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        >
                            {theme === "dark" ? (
                                <Sun className="h-4 w-4" />
                            ) : (
                                <Moon className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle theme</span>
                        </Button>

                        {/* SIGN OUT */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto md:hidden text-destructive shrink-0"
                            onClick={() => setSignOutOpen(true)}
                            title="Sign out"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="sr-only">Sign out</span>
                        </Button>
                    </div>

                    {/* NAVIGATION LINKS */}
                    <nav className="p-3 md:pb-5 grid grid-cols-5 md:grid-cols-1 gap-1">
                        {links.map((l) =>
                        {
                            const active = location.pathname === l.to;
                            return (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    title={l.label}
                                    className={cn(
                                        "flex md:flex-row flex-col items-center md:gap-3 gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                    )}
                                >
                                    <l.icon className="h-4 w-4 shrink-0" />
                                    <span className={cn("text-xs md:text-sm whitespace-nowrap transition-opacity duration-200", !sidebarOpen && "md:opacity-0",)}>
                                        {l.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* ACTION BUTTONS LARGE SCREEN */}
                    <div className="hidden md:flex flex-col gap-1 p-3 md:pt-5 min-h-screen">
                        {/* SIDEBAR TOGGLE */}
                        <Button
                            variant="ghost"
                            className="gap-3 text-muted-foreground w-full justify-start px-3"
                            onClick={() => setSidebarOpen((v) => !v)}
                            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                        >
                            {sidebarOpen ? (
                                <PanelLeftClose className="h-4 w-4 shrink-0" />
                            ) : (
                                <PanelLeftOpen className="h-4 w-4 shrink-0" />
                            )}
                            <span
                                className={cn(
                                    "whitespace-nowrap transition-opacity duration-200",
                                    !sidebarOpen && "opacity-0",
                                )}
                            >
                                Collapse
                            </span>
                        </Button>

                        {/* SIGN OUT */}
                        <Button
                            variant="ghost"
                            className="gap-3 text-destructive w-full justify-start px-3"
                            onClick={() => setSignOutOpen(true)}
                            title="Sign out"
                        >
                            <LogOut className="h-4 w-4 shrink-0" />
                            <span
                                className={cn(
                                    "whitespace-nowrap transition-opacity duration-200",
                                    !sidebarOpen && "opacity-0",
                                )}
                            >
                                Sign out
                            </span>
                        </Button>

                        {/* THEME TOGGLE */}
                        <Button
                            variant="ghost"
                            className="gap-3 text-muted-foreground w-full justify-start px-3"
                            onClick={toggleTheme}
                            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        >
                            {theme === "dark" ? (
                                <Sun className="h-4 w-4 shrink-0" />
                            ) : (
                                <Moon className="h-4 w-4 shrink-0" />
                            )}
                            <span
                                className={cn(
                                    "whitespace-nowrap transition-opacity duration-200",
                                    !sidebarOpen && "opacity-0",
                                )}
                            >
                                {theme === "dark" ? "Light mode" : "Dark mode"}
                            </span>
                        </Button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="p-3 md:p-8 max-w-6xl mx-auto w-full">
                <Outlet />
            </main>

            {/* SIGN OUT MODAL */}
            <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sign out?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You'll need to sign in again to access your data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => supabase.auth.signOut()}>
                            Sign out
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
