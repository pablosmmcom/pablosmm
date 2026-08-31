"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { MoreHorizontal, ShieldCheck, Mail, Wallet, User as UserIcon, Eye } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/admin/data-table/data-table-column-header";
import { useCurrency } from "@/components/layout/CurrencyProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/admin/ui/avatar";

export type AdminUser = {
    id: number;
    name: string;
    email: string;
    mobile?: string;
    role: string;
    balance: number;
    orderCount: number;
    totalSpend: number;
    createdAt: string;
};

// Component for formatting price
const BalanceCell = ({ amount }: { amount: number }) => {
    // Hardcoded to INR for now as per user request
    const formatINR = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(value);
    };

    const isPositive = amount > 0;

    return (
        <div className={`flex items-center gap-1.5 font-mono font-bold ${isPositive ? "text-emerald-600" : "text-muted-foreground"}`}>
            {formatINR(amount)}
        </div>
    );
};

export const getColumns = (onAction: (action: string, user: AdminUser) => void): ColumnDef<AdminUser>[] => [
    {
        accessorKey: "id",
        header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
        cell: ({ row }) => {
            const user = row.original;
            return (
                <div className="flex items-center gap-3 py-1">
                    <Avatar className="h-9 w-9 border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} alt={user.name} />
                        <AvatarFallback className="text-xs font-bold">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold leading-none text-foreground">{user.name}</span>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-mono text-[10px] opacity-70">#{user.id}</span>
                        </div>
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "email",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
        cell: ({ row }) => {
            const user = row.original;
            return (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Mail className="h-3 w-3 opacity-70" />
                        {user.email}
                    </div>
                    {user.mobile && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                            <span>💬 {user.mobile}</span>
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
        cell: ({ row }) => {
            const isAdmin = row.original.role === "admin";
            return (
                <Badge
                    variant={isAdmin ? "default" : "secondary"}
                    className={`h-5 px-2 py-0 text-[10px] font-bold uppercase tracking-tight ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                    {isAdmin ? <ShieldCheck className="mr-1 h-3 w-3" /> : <UserIcon className="mr-1 h-3 w-3" />}
                    {row.original.role}
                </Badge>
            );
        },
    },
    {
        accessorKey: "balance",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Wallet" />,
        cell: ({ row }) => <BalanceCell amount={row.original.balance} />,
    },
    {
        accessorKey: "orderCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Activity" />,
        cell: ({ row }) => (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{row.original.orderCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">Orders</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <span>Lifetime Spend:</span>
                    <span className="font-mono font-medium text-foreground/80">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(row.original.totalSpend)}
                    </span>
                </div>
            </div>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const user = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(user.email);
                            }}
                        >
                            Copy Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction("view", user); }}>
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction("wallet", user); }}>
                            Manage Wallet
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); onAction("impersonate", user); }}
                            className="text-amber-500 font-semibold focus:text-amber-400 focus:bg-amber-500/10 cursor-pointer"
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            Login as User (Speculate)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
