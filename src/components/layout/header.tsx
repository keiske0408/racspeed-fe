"use client";

import React, { useState, useEffect } from "react";
import { Bell, Menu, LogOut, Sun, Moon, Plus, Calendar, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export interface HeaderProps {
  userEmail?: string;
  userFullName?: string;
  onMobileMenuToggle?: () => void;
}

export function Header({ userEmail, userFullName = "Member", onMobileMenuToggle }: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

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

  return (
    <header className="h-16 border-b border-[#EDEDF2] dark:border-slate-800/80 bg-white dark:bg-[#0E121B] px-4 md:px-8 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Toggle mobile menu"
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
        {/* Date / Rotary Year Selector (Matching "Last 6 months ⌵" in reference) */}
        <button
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-[12.5px] font-semibold text-[#111625] dark:text-white bg-white dark:bg-[#161B26] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition shadow-xs cursor-pointer"
          aria-label="Filter period"
        >
          <Calendar className="w-3.5 h-3.5 text-[#8E95A5]" />
          <span>RY 2026-27</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5]" />
        </button>

        {/* Primary CTA (Matching "+ Create" button in reference) */}
        <button
          onClick={() => router.push("/tasks")}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-[12.5px] font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create</span>
        </button>

        <div className="h-5 w-px bg-[#EDEDF2] dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4 text-[#8E95A5]" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E54335]" />
        </button>

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
              <p className="text-xs font-semibold text-[#111625] dark:text-white leading-tight">{userFullName}</p>
              <p className="text-[11px] text-[#8E95A5] leading-tight truncate max-w-[120px]">{userEmail}</p>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover py-1.5 z-50">
              <div className="px-4 py-2 border-b border-[#EDEDF2] dark:border-slate-800 md:hidden">
                <p className="text-xs font-semibold text-[#111625] dark:text-white">{userFullName}</p>
                <p className="text-[10px] text-[#8E95A5] truncate">{userEmail}</p>
              </div>
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

