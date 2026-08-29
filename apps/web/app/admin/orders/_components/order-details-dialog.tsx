"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/admin/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { AdminOrder } from "../../orders/_components/columns";
import { useState } from "react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/config";

interface OrderDetailsDialogProps {
    order: AdminOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function OrderDetailsDialog({ order, open, onOpenChange, onSuccess }: OrderDetailsDialogProps) {
    const [refunding, setRefunding] = useState(false);
    const [showRefundDialog, setShowRefundDialog] = useState(false);
    const [refundAmount, setRefundAmount] = useState("");
    
    // Refills editing state
    const [isEditingRefills, setIsEditingRefills] = useState(false);
    const [refillsValue, setRefillsValue] = useState("");
    const [updatingRefills, setUpdatingRefills] = useState(false);

    if (!order) return null;

    const maxRefundable = (order.charge || 0) - (order.refundedAmount || 0);

    const handleRefundClick = () => {
        setRefundAmount(maxRefundable.toFixed(2));
        setShowRefundDialog(true);
    };

    const handleRefundConfirm = async () => {
        const amount = parseFloat(refundAmount);

        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid refund amount");
            return;
        }

        if (amount > maxRefundable) {
            toast.error(`Refund amount cannot exceed ₹${maxRefundable.toFixed(2)}`);
            return;
        }

        setRefunding(true);
        setShowRefundDialog(false);

        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/orders/${order.id}/refund`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to refund order");
            }

            const isPartial = amount < maxRefundable;
            toast.success(
                isPartial
                    ? `Partial refund of ₹${amount.toFixed(2)} processed successfully`
                    : "Full refund processed successfully"
            );
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setRefunding(false);
        }
    };

    const handleSaveRefills = async () => {
        const val = parseInt(refillsValue);
        if (isNaN(val) || val < 0) {
            toast.error("Please enter a valid number of refills");
            return;
        }

        setUpdatingRefills(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/admin/orders/${order.id}/refills`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refills_remaining: val })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to update refills");
            }

            toast.success("Refills remaining updated successfully");
            setIsEditingRefills(false);
            onSuccess();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUpdatingRefills(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Order #{order.id}</DialogTitle>
                        <DialogDescription>
                            Placed on {new Date(order.date).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4 text-sm">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <span className="font-semibold">User:</span>
                            <span className="col-span-2 truncate">{order.userEmail}</span>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <span className="font-semibold">Service:</span>
                            <div className="col-span-2 flex flex-col">
                                <span>{order.serviceName}</span>
                                <span className="text-muted-foreground text-xs">Display ID: {order.displayId}</span>
                                <span className="text-muted-foreground text-xs">Provider Order ID: #{order.providerOrderId || 'N/A'}</span>
                                <span className="text-muted-foreground text-xs">Source Service ID: {order.sourceServiceId || order.serviceId}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <span className="font-semibold">Status:</span>
                            <span className="col-span-2 uppercase font-bold">{order.status}</span>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <span className="font-semibold">Quantity:</span>
                            <span className="col-span-2">{order.quantity}</span>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <span className="font-semibold">Charge:</span>
                            <span className="col-span-2 font-mono">₹{(order.charge || 0).toFixed(2)}</span>
                        </div>
                        {order.link && (
                            <div className="grid grid-cols-3 items-center gap-4">
                                <span className="font-semibold">Link:</span>
                                <a href={order.link} target="_blank" className="col-span-2 text-blue-500 hover:underline truncate">{order.link}</a>
                            </div>
                        )}
                        {order.serviceRefillEnabled && (
                            <div className="grid grid-cols-3 items-center gap-4">
                                <span className="font-semibold">Refills Left:</span>
                                <div className="col-span-2 flex items-center gap-2">
                                    {isEditingRefills ? (
                                        <>
                                            <Input
                                                type="number"
                                                className="w-20 h-8"
                                                value={refillsValue}
                                                onChange={(e) => setRefillsValue(e.target.value)}
                                                min={0}
                                            />
                                            <Button size="sm" onClick={handleSaveRefills} disabled={updatingRefills}>
                                                {updatingRefills ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setIsEditingRefills(false)} disabled={updatingRefills}>
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-mono">{order.refillsRemaining ?? 0}</span>
                                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => {
                                                setRefillsValue((order.refillsRemaining ?? 0).toString());
                                                setIsEditingRefills(true);
                                            }}>
                                                Edit
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex-col sm:justify-between sm:flex-row gap-2">
                        {(maxRefundable > 0) && (
                            <Button
                                variant="destructive"
                                onClick={handleRefundClick}
                                disabled={refunding}
                                className="w-full sm:w-auto"
                            >
                                {refunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Refund Order
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Refund Amount Dialog */}
            <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Refund Order #{order.id}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter the amount to refund. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="refund-amount">Refund Amount</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                                    ₹
                                </span>
                                <Input
                                    id="refund-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={maxRefundable}
                                    value={refundAmount}
                                    onChange={(e) => setRefundAmount(e.target.value)}
                                    className="pl-8 font-mono text-lg"
                                    placeholder="0.00"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Maximum refundable: <span className="font-bold">₹{maxRefundable.toFixed(2)}</span>
                            </p>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRefundConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Confirm Refund
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
