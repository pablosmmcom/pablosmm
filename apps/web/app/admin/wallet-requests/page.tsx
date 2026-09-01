"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/config";
import { Card } from "@/components/admin/ui/card";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/admin/ui/table";

interface WalletRequest {
    id: number;
    user_id: number;
    user_email: string;
    amount: number;
    method: string;
    transaction_id: string;
    status: string;
    created_at: string;
}

export default function WalletRequestsPage() {
    const [requests, setRequests] = useState<WalletRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<number | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/wallet-requests`);
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        setProcessing(id);
        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/wallet-requests/${id}/${action}`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Action failed");

            toast.success(`Request ${action}d successfully`);
            fetchRequests(); // Refresh list
        } catch (error) {
            toast.error(`Failed to ${action} request`);
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Wallet Requests</h2>
                <p className="text-muted-foreground">Manage manual deposit requests (UPI/USDT).</p>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Transaction ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No pending requests found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.map((req) => (
                                <TableRow key={req.id}>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(req.created_at).toLocaleString()}
                                    </TableCell>
                                    <TableCell>{req.user_email}</TableCell>
                                    <TableCell className="font-mono font-bold">
                                        ₹{req.amount.toFixed(2)}
                                        {req.amount >= 100 && (
                                            <span className="ml-1.5 inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                                +10% Bonus (₹{(req.amount * 1.1).toFixed(0)})
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{req.method}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{req.transaction_id}</TableCell>
                                    <TableCell>
                                        <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                                            {req.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {req.status === 'pending' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    disabled={processing === req.id}
                                                    onClick={() => handleAction(req.id, 'approve')}
                                                >
                                                    <CheckCircle size={16} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    disabled={processing === req.id}
                                                    onClick={() => handleAction(req.id, 'reject')}
                                                >
                                                    <XCircle size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
