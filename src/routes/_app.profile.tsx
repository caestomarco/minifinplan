import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
    component: ProfilePage,
});

function ProfilePage()
{
    const { user } = useAuth();
    const [name, setName] = useState<string>(user?.user_metadata?.name ?? "");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busyProfile, setBusyProfile] = useState(false);
    const [busyPwd, setBusyPwd] = useState(false);

    if (!user) return null;

    const displayName = user.user_metadata?.name ?? (user.email?.split("@")[0] ?? "User");
    const initial = displayName.charAt(0).toUpperCase();

    const saveProfile = async () =>
    {
        setBusyProfile(true);
        const { error } = await supabase.auth.updateUser({ data: { name } });
        setBusyProfile(false);
        if (error) toast.error(error.message);
        else toast.success("Profile updated");
    };

    const changePassword = async () =>
    {
        if (password.length < 6) return toast.error("Password must be at least 6 characters");
        if (password !== confirm) return toast.error("Passwords do not match");
        setBusyPwd(true);
        const { error } = await supabase.auth.updateUser({ password });
        setBusyPwd(false);
        if (error) toast.error(error.message);
        else
        {
            toast.success("Password changed");
            setPassword("");
            setConfirm("");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                {user.user_metadata?.picture ? (
                    <img className="h-16 w-16 rounded-full flex items-center justify-center shrink-0 font-semibold" src={user.user_metadata?.picture} alt="user_avatar" />
                ) : (
                    <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-semibold">
                        {initial}
                    </div>
                )}
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold truncate">{displayName}</h1>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Update your display name.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col">
                    <div className="space-y-1.5 max-w-md">
                        <Label>Email</Label>
                        <Input value={user.email ?? ""} disabled />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                    </div>
                    <Button onClick={saveProfile} disabled={busyProfile} className="self-end">
                        {busyProfile ? "Saving…" : "Save changes"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change password</CardTitle>
                    <CardDescription>Choose a new password for your account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col">
                    <div className="space-y-1.5 max-w-md">
                        <Label>New password</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                        <Label>Confirm password</Label>
                        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    </div>
                    <Button onClick={changePassword} disabled={busyPwd} className="self-end">
                        {busyPwd ? "Updating…" : "Update password"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
