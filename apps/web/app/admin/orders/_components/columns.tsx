"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/admin/ui/badge";

export type AdminOrder = {
    id: number;
    serviceId: string;
    displayId: string;
    sourceServiceId?: string;
    serviceName: string;
    userEmail: string;
    charge: number;
    quantity: number;
    status: string;
    date: string;
    link: string;
    refundedAmount?: number;
    providerOrderId?: string;
    refillsRemaining?: number;
    serviceRefillLimit?: number;
    serviceRefillEnabled?: boolean;
};

export const columns: ColumnDef<AdminOrder>[] = [
    {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-mono text-xs font-bold">#{row.original.id}</span>
                {row.original.providerOrderId && (
                    <span className="text-[10px] text-muted-foreground font-mono">Prov: #{row.original.providerOrderId}</span>
                )}
            </div>
        ),
        size: 80,
    },
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{format(new Date(row.original.date), "dd/MM/yy")}</span>,
        size: 80,
    },
    {
        accessorKey: "userEmail",
        header: "User",
        cell: ({ row }) => <span className="text-xs truncate max-w-[120px]" title={row.original.userEmail}>{row.original.userEmail.split('@')[0]}</span>,
        size: 100,
    },
    {
        accessorKey: "service",
        header: "Service",
        cell: ({ row }) => (
            <div className="flex flex-col max-w-[150px]">
                <span className="font-medium text-xs truncate" title={row.original.serviceName}>{row.original.serviceName}</span>
                <span className="text-[10px] text-muted-foreground">ID: {row.original.displayId}</span>
            </div>
        )
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.status;
            let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";

            if (status === "completed") variant = "default";
            if (status === "active" || status === "processing" || status === "submitted") variant = "secondary";
            if (status === "canceled" || status === "failed") variant = "destructive";
            if (status === "pending") variant = "outline";

            return <Badge variant={variant} className="h-5 px-1.5 text-[10px] capitalize">{status}</Badge>
        },
        size: 80,
    },
    {
        accessorKey: "charge",
        header: "Amt",
        cell: ({ row }) => <span className="font-medium text-xs">₹{Math.round(row.original.charge)}</span>,
        size: 60,
    },
    {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => <span className="text-xs">{row.original.quantity}</span>,
        size: 60,
    },
];
