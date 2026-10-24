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
  Globe,
  CheckSquare,
  Megaphone,
  HelpCircle,
  ChevronDown,
  Menu,
  Bookmark,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Connections",
    items: [
      { label: "Members", href: "/members", icon: Users },
      { label: "Recruitment CRM", href: "/recruitment", icon: UserPlus },
      { label: "Retention Alerts", href: "/retention-alerts", icon: ShieldAlert },
    ],
  },
  {
    title: "Activities",
    items: [
      { label: "Events & Check-in", href: "/events", icon: Calendar },
      { label: "GC Broadcasts", href: "/broadcasts", icon: Megaphone, badge: "AI" },
      { label: "Projects & Reports", href: "/projects", icon: FolderKanban },
      { label: "Task Center", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Treasury & Dues", href: "/treasury", icon: Receipt },
      { label: "Budget & Liquidation", href: "/budgets", icon: FileSpreadsheet },
      { label: "Sister Clubs & Partners", href: "/partnerships", icon: Globe },
    ],
  },
  {
    title: "Misc",
    items: [
      { label: "Resources & Links", href: "/resources", icon: Bookmark },
      { label: "Certificates", href: "/certificates", icon: Award },
      { label: "Club Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  className = "",
  onNavigate,
  userFullName = "Sara",
  userEmail,
}: {
  className?: string;
  onNavigate?: () => void;
  userFullName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`w-64 border-r border-[#EDEDF2] dark:border-slate-800/80 bg-white dark:bg-[#0E121B] flex flex-col shrink-0 select-none ${className}`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#EDEDF2] dark:border-slate-800/80">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={() => onNavigate?.()}
        >
          <div className="w-7 h-7 rounded-full bg-[#111625] dark:bg-white flex items-center justify-center text-white dark:text-[#111625] font-black text-xs tracking-tighter shadow-xs">
            R
          </div>
          <span className="font-bold text-base tracking-tight text-[#111625] dark:text-white">
            Racspeed
          </span>
        </Link>
        <button
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
          aria-label="Navigation drawer menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-[#8E95A5] uppercase">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] transition ${
                      isActive
                        ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white font-semibold shadow-xs border border-[#EDEDF2] dark:border-slate-700/80"
                        : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 border border-transparent font-medium"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition ${
                        isActive
                          ? "text-[#111625] dark:text-white"
                          : "text-[#8E95A5] group-hover:text-slate-700 dark:group-hover:text-slate-200"
                      }`}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#E2EBFF] text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer Utilities & User Card */}
      <div className="p-3 border-t border-[#EDEDF2] dark:border-slate-800/80 space-y-1">
        <Link
          href="/settings"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition font-medium"
        >
          <HelpCircle className="w-4 h-4 text-[#8E95A5]" />
          <span>Help</span>
        </Link>
        <Link
          href="/settings"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition font-medium"
        >
          <Settings className="w-4 h-4 text-[#8E95A5]" />
          <span>Settings</span>
        </Link>

        {/* User Profile Component (Matching reference) */}
        <div className="pt-2">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition cursor-pointer">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#0D3594] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                {userFullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#111625] dark:text-white truncate">
                  {userFullName}
                </p>
                {userEmail && (
                  <p className="text-[11px] text-[#8E95A5] truncate">{userEmail}</p>
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
          </div>
        </div>
      </div>
    </aside>
  );
}

