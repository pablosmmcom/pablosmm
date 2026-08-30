"use client";

import { useState, useCallback, useEffect } from "react";
import { UsersTable } from "./_components/users-table";
import { AdminUser } from "./_components/columns";
import { ManageUserDialog } from "./_components/user-dialog";
import { Input } from "@/components/admin/ui/input";
import { Card } from "@/components/admin/ui/card";
import { getApiBaseUrl } from "@/lib/config";
import { Loader2, Search } from "lucide-react";

import { toast } from "sonner";

export default function UsersPage() {
    const [data, setData] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [defaultTab, setDefaultTab] = useState<"profile" | "wallet">("profile");

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search })
            });

            const res = await fetch(`${getApiBaseUrl()}/admin/users?${params}`);
            if (!res.ok) throw new Error("Failed to fetch users");

            const json = await res.json();

            // Dummy data for visualization if empty
            if (!json.users || json.users.length === 0) {
                const dummyUsers: AdminUser[] = Array.from({ length: 10 }).map((_, i) => ({
                    id: i + 1,
                    name: `User ${i + 1}`,
                    email: `user${i + 1}@example.com`,
                    role: i === 0 ? "admin" : "user",
                    balance: Math.floor(Math.random() * 5000) / 100, // Random balance up to $50
                    orderCount: Math.floor(Math.random() * 50),
                    totalSpend: Math.floor(Math.random() * 200),
                    createdAt: new Date().toISOString()
                }));
                setData(dummyUsers);
            } else {
                setData(json.users || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchUsers]);

    const handleImpersonate = async (user: AdminUser) => {
        try {
            toast.loading(`Switching session to ${user.name || user.email}...`, { id: "impersonate" });
            
            // Backup current admin auth token
            const cookies = document.cookie.split(";");
            let currentToken = "";
            for (const c of cookies) {
                const [k, v] = c.trim().split("=");
                if (k === "auth_token") currentToken = v;
            }
            if (currentToken) {
                localStorage.setItem("pablo_admin_backup_token", currentToken);
            }

            const res = await fetch(`${getApiBaseUrl()}/admin/users/${user.id}/impersonate`, {
                method: "POST",
                credentials: "include",
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to switch user session");
            }

            // Save user details in localStorage for the banner
            localStorage.setItem("pablo_impersonated_user", JSON.stringify({
                id: user.id,
                email: user.email,
                name: user.name,
                username: user.name,
                role: user.role,
                balance: user.balance,
            }));

            toast.success(`Now speculating as ${user.name || user.email}!`, { id: "impersonate" });
            
            // Hard redirect to load user storefront session
            window.location.href = "/order";
        } catch (error: any) {
            console.error("Impersonation error:", error);
            toast.error(error.message || "Failed to login as user", { id: "impersonate" });
        }
    };

    const handleRowClick = (user: AdminUser, tab: "profile" | "wallet" = "profile") => {
        setSelectedUser(user);
        setDefaultTab(tab);
        setDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground">
                        Manage registered users, balances, and roles.
                    </p>
                </div>
            </div>

            <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-md border">
                    {loading ? (
                        <div className="flex h-[400px] items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <UsersTable
                            data={data}
                            onRowClick={(row) => handleRowClick(row.original, "profile")}
                            onAction={(action, user) => {
                                if (action === "impersonate") {
                                    handleImpersonate(user);
                                } else if (action === "wallet") {
                                    handleRowClick(user, "wallet");
                                } else {
                                    handleRowClick(user, "profile");
                                }
                            }}
                        />
                    )}
                </div>
            </Card>

            <ManageUserDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                user={selectedUser}
                onSuccess={fetchUsers}
                onImpersonate={handleImpersonate}
                defaultTab={defaultTab}
            />
        </div>
    );
}
