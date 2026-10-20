"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Calendar,
  FolderKanban,
  Receipt,
  FileSpreadsheet,
  Award,
  Settings,
  ShieldAlert,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
  { label: "Recruitment CRM", href: "/recruitment", icon: UserPlus },
  { label: "Events & Check-in", href: "/events", icon: Calendar },
  { label: "Projects & Reports", href: "/projects", icon: FolderKanban },
  { label: "Treasury & Dues", href: "/treasury", icon: Receipt },
  { label: "Budget & Liquidation", href: "/budgets", icon: FileSpreadsheet },
  { label: "Certificates", href: "/certificates", icon: Award },
  { label: "Retention Alerts", href: "/retention-alerts", icon: ShieldAlert },
  { label: "Club Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={`w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 ${className}`}
    >
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
            R
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Rotaract San Pedro East
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              District 3820 · RY 2026-27
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"
                }`}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 text-center">
        v1.0.0 · Mobile PWA Ready
      </div>
    </aside>
  );
}
