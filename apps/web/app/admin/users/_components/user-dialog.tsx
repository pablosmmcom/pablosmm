"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/admin/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/admin/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { AdminUser } from "./columns";
import { getApiBaseUrl } from "@/lib/config";
import { toast } from "sonner";
import { Loader2, Eye } from "lucide-react";
import { OrdersTable } from "../../orders/_components/orders-table";
import { columns } from "../../orders/_components/columns";

interface ManageUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: AdminUser | null;
    onSuccess: () => void;
    onImpersonate?: (user: AdminUser) => void;
    defaultTab?: "profile" | "wallet";
}

export function ManageUserDialog({ open, onOpenChange, user, onSuccess, onImpersonate, defaultTab = "wallet" }: ManageUserDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Wallet State
    const [amount, setAmount] = useState("");
    const [transactionType, setTransactionType] = useState("credit");

    // Profile State
    const [name, setName] = useState(user?.name || "");
    const [role, setRole] = useState(user?.role || "user");
    const [email, setEmail] = useState(user?.email || "");

    const formatINR = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(value);
    };

    // Transaction History State
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Fetch full user details when dialog opens
    useEffect(() => {
        if (open && user?.id) {
            fetchUserDetails(user.id);
        }
    }, [open, user]);

    const fetchUserDetails = async (id: number) => {
        setIsLoadingData(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/users/${id}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data.transactions || []);
                // Update local state if needed (e.g. balance)
                if (data.user) {
                    // Optionally sync balance here
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleWalletSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/users/${user.id}/wallet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    type: transactionType,
                    description: "Admin manual adjustment"
                }),
            });

            if (!res.ok) throw new Error("Failed to update wallet");

            toast.success("Wallet updated successfully");
            onSuccess();
            fetchUserDetails(user.id); // Refresh history
            setAmount(""); // Clear input
        } catch (error) {
            toast.error("Failed to update wallet");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, role }),
            });

            if (!res.ok) throw new Error("Failed to update profile");

            toast.success("Profile updated successfully");
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to update profile");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <DialogTitle>Manage User: {user.name}</DialogTitle>
                        <DialogDescription>
                            Update user details, manage wallet, or view history.
                        </DialogDescription>
                    </div>
                    {onImpersonate && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 gap-1.5 h-8 font-semibold text-xs"
                            onClick={() => onImpersonate(user)}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Login as User
                        </Button>
                    )}
                </DialogHeader>

                <Tabs defaultValue={defaultTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="wallet">Wallet</TabsTrigger>
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="orders">Orders</TabsTrigger>
                    </TabsList>

                    <TabsContent value="wallet">
                        <form onSubmit={handleWalletSubmit} className="space-y-4 py-4">
                            <div className="flex flex-col gap-4">
                                <div className="space-y-2">
                                    <Label>Current Balance</Label>
                                    <div className="text-2xl font-mono font-bold">{formatINR(user.balance)}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Action</Label>
                                        <Select value={transactionType} onValueChange={setTransactionType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="credit">Add Funds (Credit)</SelectItem>
                                                <SelectItem value="debit">Remove Funds (Debit)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Balance
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="profile">
                        <form onSubmit={handleProfileSubmit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" defaultValue={user.name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" defaultValue={user.email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select defaultValue={user.role} onValueChange={setRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="space-y-4 py-4">
                            {isLoadingData ? (
                                <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                            ) : transactions.length === 0 ? (
                                <p className="text-center text-muted-foreground p-4">No transactions found.</p>
                            ) : (
                                <div className="border rounded-md max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 text-left">Type</th>
                                                <th className="p-2 text-left">Amount</th>
                                                <th className="p-2 text-left">Date</th>
                                                <th className="p-2 text-left">Desc</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((t: any) => (
                                                <tr key={t.id} className="border-t">
                                                    <td className="p-2 uppercase text-xs font-bold">
                                                        <span className={t.type === 'credit' ? 'text-green-500' : 'text-red-500'}>
                                                            {t.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 font-mono">{formatINR(t.amount)}</td>
                                                    <td className="p-2 text-xs text-muted-foreground">
                                                        {new Date(t.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-2 text-xs truncate max-w-[100px]" title={t.description}>
                                                        {t.description}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="orders">
                        <UserOrdersPanel userId={user.id} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function UserOrdersPanel({ userId }: { userId: number }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${getApiBaseUrl()}/admin/orders?user_id=${userId}`);
                if (res.ok) {
                    const json = await res.json();
                    setOrders(json.orders || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [userId]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="py-4">
            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                <OrdersTable columns={columns} data={orders} />
            </div>
        </div>
    );
}
