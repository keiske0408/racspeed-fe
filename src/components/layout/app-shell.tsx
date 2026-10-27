"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { X } from "lucide-react";

export interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userFullName?: string;
  roleLabel?: string;
  allowedPages?: string[];
}

export function AppShell({
  children,
  userEmail,
  userFullName,
  roleLabel,
  allowedPages,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("racspeed_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {
      // LocalStorage not available
    }
  }, []);

  function toggleSidebarCollapse() {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("racspeed_sidebar_collapsed", String(next));
      } catch {
        // LocalStorage not available
      }
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB] dark:bg-[#0A0D14]">
      {/* Desktop Sidebar */}
      <Sidebar
        className="hidden md:flex"
        userFullName={userFullName}
        userEmail={userEmail}
        roleLabel={roleLabel}
        allowedPages={allowedPages}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-white dark:bg-[#0E121B] h-full flex flex-col z-10 elevation-popover">
            <div className="absolute top-4 right-4 z-20">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close mobile navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar
              className="w-full flex-1 border-r-0"
              onNavigate={() => setMobileMenuOpen(false)}
              onToggleCollapse={() => setMobileMenuOpen(false)}
              userFullName={userFullName}
              userEmail={userEmail}
              roleLabel={roleLabel}
              allowedPages={allowedPages}
              collapsed={false}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          userEmail={userEmail}
          userFullName={userFullName}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          onToggleSidebar={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setMobileMenuOpen((prev) => !prev);
            } else {
              toggleSidebarCollapse();
            }
          }}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
