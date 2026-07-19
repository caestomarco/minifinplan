import * as React from "react";

type Theme = "light" | "dark";

const ThemeContext = React.createContext<
    { theme: Theme; toggleTheme: () => void } | null
>(null);

function getStoredTheme(): Theme
{
    if (typeof window === "undefined") return "dark";
    const value = window.localStorage.getItem("theme") as Theme | null;
    return value === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode })
{
    const [theme, setTheme] = React.useState<Theme>("dark");

    React.useEffect(() =>
    {
        setTheme(getStoredTheme());
    }, []);

    React.useEffect(() =>
    {
        window.localStorage.setItem("theme", theme);
        if (theme === "dark")
        {
            document.documentElement.classList.add("dark");
        }
        else
        {
            document.documentElement.classList.remove("dark");
        }
    }, [theme]);

    const toggleTheme = React.useCallback(() =>
    {
        setTheme((t) => (t === "dark" ? "light" : "dark"));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme()
{
    const ctx = React.useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
