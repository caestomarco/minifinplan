import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth")({
    component: AuthPage,
});

function AuthPage()
{
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() =>
    {
        if (!loading && user) navigate({ to: "/" });
    }, [user, loading, navigate]);

    const signIn = async () =>
    {
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) toast.error(error.message);
        else navigate({ to: "/" });
    };

    const signUp = async () =>
    {
        setBusy(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/` },
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("You've successfully signed up!");
    };

    const google = async () =>
    {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin },
        });
        if (error) toast.error(error.message ?? "Google sign-in failed");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-accent/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl">MiniFinPlan</CardTitle>
                    <CardDescription>Plan your finances with ease.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="signin">
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="signin">Sign in</TabsTrigger>
                            <TabsTrigger value="signup">Sign up</TabsTrigger>
                        </TabsList>
                        <TabsContent value="signin" className="space-y-3 pt-4">
                            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                            <Button className="w-full" onClick={signIn} disabled={busy}>Sign in</Button>
                        </TabsContent>
                        <TabsContent value="signup" className="space-y-3 pt-4">
                            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                            <Button className="w-full" onClick={signUp} disabled={busy}>Create account</Button>
                        </TabsContent>
                    </Tabs>
                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
                </CardContent>
            </Card>
        </div>
    );
}
