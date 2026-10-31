"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isModuleAllowed } from "@/lib/data/role-permissions-types";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ScanLine,
  FolderKanban,
  Receipt,
  FileSpreadsheet,
  Award,
  Settings,
  ShieldAlert,
  Globe,
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
      { label: "Project Center", href: "/project-center", icon: FolderKanban },
      { label: "QR Check-in", href: "/events", icon: ScanLine },
      { label: "GC Broadcasts", href: "/broadcasts", icon: Megaphone, badge: "AI" },
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

const NAV_ITEM_MODULE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/members": "members",
  "/recruitment": "recruitment",
  "/retention-alerts": "retention",
  "/project-center": "project-center",
  "/events": "events",
  "/broadcasts": "broadcasts",
  "/treasury": "treasury",
  "/budgets": "budgets",
  "/partnerships": "partnerships",
  "/resources": "resources",
  "/certificates": "certificates",
  "/settings": "settings",
};

export interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  userFullName?: string;
  userEmail?: string;
  roleLabel?: string;
  allowedPages?: string[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  className = "",
  onNavigate,
  userFullName = "Sara",
  userEmail,
  roleLabel,
  allowedPages,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  const visibleSections = NAV_SECTIONS.map((section) => {
    const items = section.items.filter((item) => {
      if (!allowedPages) return true;
      const mod = NAV_ITEM_MODULE_MAP[item.href];
      if (!mod) return true;
      return isModuleAllowed(allowedPages, mod);
    });
    return { ...section, items };
  }).filter((section) => section.items.length > 0);

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } border-r border-[#EDEDF2] dark:border-slate-800/80 bg-white dark:bg-[#0E121B] flex flex-col shrink-0 select-none transition-all duration-300 ease-in-out ${className}`}
    >
      {/* Brand Header */}
      <div
        className={`h-16 flex items-center ${
          collapsed ? "justify-center gap-1.5 px-2" : "justify-between px-5"
        } border-b border-[#EDEDF2] dark:border-slate-800/80 transition-all`}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={() => onNavigate?.()}
          title="Racspeed Dashboard"
        >
          <div className="w-7 h-7 rounded-full bg-[#111625] dark:bg-white flex items-center justify-center text-white dark:text-[#111625] font-black text-xs tracking-tighter shadow-xs shrink-0">
            R
          </div>
          {!collapsed && (
            <span className="font-bold text-base tracking-tight text-[#111625] dark:text-white">
              Racspeed
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => onToggleCollapse?.()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {visibleSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              !collapsed ? (
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-[#8E95A5] uppercase">
                  {section.title}
                </p>
              ) : (
                <div className="border-t border-[#EDEDF2] dark:border-slate-800/80 my-2 mx-2" />
              )
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    title={item.label}
                    className={`group flex items-center ${
                      collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                    } rounded-xl text-[13.5px] transition ${
                      isActive
                        ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white font-semibold shadow-xs border border-[#EDEDF2] dark:border-slate-700/80"
                        : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 border border-transparent font-medium"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive
                          ? "text-[#111625] dark:text-white"
                          : "text-[#8E95A5] group-hover:text-slate-700 dark:group-hover:text-slate-200"
                      }`}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#E2EBFF] text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50">
                            {item.badge}
                          </span>
                        )}
                      </>
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
          href="/help"
          onClick={() => onNavigate?.()}
          title="Help & Operations Center"
          className={`flex items-center ${
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
          } rounded-xl text-[13px] text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition font-medium`}
        >
          <HelpCircle className="w-4 h-4 text-[#8E95A5] shrink-0" />
          {!collapsed && <span>Help</span>}
        </Link>
        {(!allowedPages || allowedPages.includes("settings")) && (
          <Link
            href="/settings"
            onClick={() => onNavigate?.()}
            title="Club Settings"
            className={`flex items-center ${
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
            } rounded-xl text-[13px] text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition font-medium`}
          >
            <Settings className="w-4 h-4 text-[#8E95A5] shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
        )}

        {/* User Profile Component */}
        <div className="pt-2">
          <div
            title={`${userFullName} (${userEmail || "Member"})`}
            className={`flex items-center ${
              collapsed ? "justify-center p-2" : "justify-between p-2"
            } rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition cursor-pointer`}
          >
            <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"} min-w-0`}>
              <div className="w-7 h-7 rounded-full bg-[#0D3594] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                {userFullName.charAt(0)}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111625] dark:text-white truncate">
                    {userFullName}
                  </p>
                  <p className="text-[11px] text-[#8E95A5] truncate">
                    {roleLabel || userEmail}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />}
          </div>
        </div>
      </div>
    </aside>
  );
}
