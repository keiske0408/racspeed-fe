"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  LogOut,
  Sun,
  Moon,
  Plus,
  Calendar,
  ChevronDown,
  FolderKanban,
  UserPlus,
  Bookmark,
  Receipt,
  CheckSquare,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isModuleAllowed } from "@/lib/data/role-permissions-types";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useRouter } from "next/navigation";

export interface HeaderProps {
  userId?: string;
  userEmail?: string;
  userFullName?: string;
  onMobileMenuToggle?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  allowedPages?: string[];
  permissions?: string[];
  isPlatformAdmin?: boolean;
}

export function Header({
  userId,
  userEmail,
  userFullName = "Member",
  onMobileMenuToggle,
  onToggleSidebar,
  isSidebarCollapsed = false,
  allowedPages = [],
  permissions = [],
  isPlatformAdmin = false,
}: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const permSet = new Set(permissions);
  const hasPage = (page: string) =>
    isPlatformAdmin || isModuleAllowed(allowedPages, page);
  const hasPerm = (perm: string) => isPlatformAdmin || permSet.has(perm);

  const canCreateEvent = hasPage("project-center") && hasPerm("EVENT_CREATE");
  const canCreateProject =
    hasPage("project-center") && hasPerm("PROJECT_CREATE");
  const canAddProspect =
    hasPage("recruitment") &&
    (hasPerm("RECRUITMENT_MANAGE") || hasPerm("MEMBER_CREATE"));
  const canAddResource = hasPage("resources") && hasPerm("SETTINGS_MANAGE");
  const canRecordPayment =
    hasPage("treasury") &&
    (hasPerm("PAYMENT_SUBMIT") ||
      hasPerm("TREASURY_VIEW") ||
      hasPerm("LEDGER_ADJUST"));
  const canAssignTask = hasPage("project-center") && hasPerm("ROLE_ASSIGN");

  const hasAnyCreateAction =
    canCreateEvent ||
    canCreateProject ||
    canAddProspect ||
    canAddResource ||
    canRecordPayment ||
    canAssignTask;

  function toggleTheme() {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    if (isCurrentlyDark) {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      setIsDark(true);
    }
  }

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Fallback
    }
    router.push("/login");
  }

  function handleNavigate(path: string) {
    setCreateMenuOpen(false);
    router.push(path);
  }

  return (
    <header className="h-16 border-b border-[#EDEDF2] dark:border-slate-800/80 bg-white dark:bg-[#0E121B] px-4 md:px-8 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (onToggleSidebar) {
              onToggleSidebar();
            } else if (onMobileMenuToggle) {
              onMobileMenuToggle();
            }
          }}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label="Toggle navigation menu"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E2EBFF] text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50">
            District 3820
          </span>
          <span className="text-[12.5px] font-medium text-[#6B7280] dark:text-slate-400">
            San Pedro East · Operations
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date / Rotary Year Selector */}
        <button
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-[12.5px] font-semibold text-[#111625] dark:text-white bg-white dark:bg-[#161B26] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition shadow-xs cursor-pointer"
          aria-label="Filter period"
        >
          <Calendar className="w-3.5 h-3.5 text-[#8E95A5]" />
          <span>RY 2026-27</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5]" />
        </button>

        {/* Primary Functional CTA with Quick-Create Popover */}
        {hasAnyCreateAction && (
          <div className="relative">
            <button
              onClick={() => {
                setCreateMenuOpen(!createMenuOpen);
                setDropdownOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-[12.5px] font-semibold shadow-xs transition cursor-pointer"
              aria-expanded={createMenuOpen}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
              <ChevronDown className="w-3 h-3 opacity-75" />
            </button>

            {createMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover py-1.5 z-50">
                <p className="px-3.5 py-1 text-[10px] font-bold tracking-wider text-[#8E95A5] uppercase">
                  Quick Operations
                </p>
                {canCreateEvent && (
                  <button
                    onClick={() =>
                      handleNavigate("/project-center/new?kind=MEETING")
                    }
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                  >
                    <Calendar className="w-4 h-4 text-[#0D3594] dark:text-blue-400" />
                    <span>New Meeting / Event</span>
                  </button>
                )}
                {canCreateProject && (
                  <button
                    onClick={() =>
                      handleNavigate("/project-center/new?kind=SERVICE_PROJECT")
                    }
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                  >
                    <FolderKanban className="w-4 h-4 text-[#17A863]" />
                    <span>New Service Project</span>
                  </button>
                )}
                {canAddProspect && (
                  <button
                    onClick={() => handleNavigate("/recruitment?action=new")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                  >
                    <UserPlus className="w-4 h-4 text-[#8244E8]" />
                    <span>Add Prospect Member</span>
                  </button>
                )}
                {canAddResource && (
                  <button
                    onClick={() => handleNavigate("/resources")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                  >
                    <Bookmark className="w-4 h-4 text-[#D97706]" />
                    <span>Add Resource Link</span>
                  </button>
                )}
                {canRecordPayment && (
                  <button
                    onClick={() => handleNavigate("/treasury")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                  >
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Record Dues Payment</span>
                  </button>
                )}
                {canAssignTask && (
                  <button
                    onClick={() => handleNavigate("/project-center?view=tasks")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                  >
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                    <span>Assign Club Task</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="h-5 w-px bg-[#EDEDF2] dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        <NotificationBell />

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="User profile menu"
            aria-expanded={dropdownOpen}
          >
            <div className="w-8 h-8 rounded-full bg-[#0D3594] text-white flex items-center justify-center font-bold text-xs">
              {userFullName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden md:block pr-1">
              <p className="text-xs font-semibold text-[#111625] dark:text-white leading-tight">
                {userFullName}
              </p>
              <p className="text-[11px] text-[#8E95A5] leading-tight truncate max-w-[120px]">
                {userEmail}
              </p>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover py-1.5 z-50">
              <div className="px-4 py-2 border-b border-[#EDEDF2] dark:border-slate-800 md:hidden">
                <p className="text-xs font-semibold text-[#111625] dark:text-white">
                  {userFullName}
                </p>
                <p className="text-[10px] text-[#8E95A5] truncate">
                  {userEmail}
                </p>
              </div>
              {userId && (
                <Link
                  href={`/members/${encodeURIComponent(userId)}`}
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#111625] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <UserRound className="w-4 h-4" />
                  My Profile
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#E54335] hover:bg-[#FEECEB]/60 dark:hover:bg-rose-950/30 transition text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
