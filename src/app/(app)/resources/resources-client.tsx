"use client";

import React, { useState, useTransition } from "react";
import {
  ExternalLink,
  Plus,
  Search,
  Copy,
  Check,
  MoreHorizontal,
  Edit2,
  Trash2,
  Globe,
  Share2,
  Folder,
  Palette,
  Bookmark,
  Pin,
  X,
  Sparkles,
} from "lucide-react";
import {
  ClubResource,
  ResourceCategory,
  RESOURCE_CATEGORIES,
} from "@/features/resources/types";
import {
  createResourceAction,
  updateResourceAction,
  deleteResourceAction,
} from "@/features/resources/actions";
import { notifyToast } from "@/components/shared/toast-viewport";

interface ResourcesClientProps {
  initialResources: ClubResource[];
}

const CATEGORY_ICONS: Record<
  ResourceCategory,
  React.ComponentType<{ className?: string }>
> = {
  SOCIAL_MEDIA: Share2,
  DISTRICT_PORTAL: Globe,
  DRIVE_DOCUMENTS: Folder,
  DESIGN_BRAND: Palette,
  COMMUNITY_TOOL: Bookmark,
  OTHER: ExternalLink,
};

const CATEGORY_COLORS: Record<
  ResourceCategory,
  { bg: string; text: string; border: string }
> = {
  SOCIAL_MEDIA: {
    bg: "bg-[#E2EBFF]",
    text: "text-[#2563EB]",
    border: "border-[#2563EB]/20",
  },
  DISTRICT_PORTAL: {
    bg: "bg-[#F4EDFE]",
    text: "text-[#8244E8]",
    border: "border-[#8244E8]/20",
  },
  DRIVE_DOCUMENTS: {
    bg: "bg-[#E7F8F0]",
    text: "text-[#17A863]",
    border: "border-[#17A863]/20",
  },
  DESIGN_BRAND: {
    bg: "bg-[#FFF3E4]",
    text: "text-[#D97706]",
    border: "border-[#D97706]/20",
  },
  COMMUNITY_TOOL: {
    bg: "bg-[#FFEED8]",
    text: "text-[#C06109]",
    border: "border-[#C06109]/20",
  },
  OTHER: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  },
};

export function ResourcesClient({ initialResources }: ResourcesClientProps) {
  const [resources, setResources] = useState<ClubResource[]>(initialResources);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ClubResource | null>(
    null,
  );
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCategory, setFormCategory] =
    useState<ResourceCategory>("SOCIAL_MEDIA");
  const [formDescription, setFormDescription] = useState("");
  const [formIsPinned, setFormIsPinned] = useState(false);

  function resetForm() {
    setFormTitle("");
    setFormUrl("");
    setFormCategory("SOCIAL_MEDIA");
    setFormDescription("");
    setFormIsPinned(false);
  }

  function openEditModal(resource: ClubResource) {
    setEditingResource(resource);
    setFormTitle(resource.title);
    setFormUrl(resource.url);
    setFormCategory(resource.category);
    setFormDescription(resource.description);
    setFormIsPinned(!!resource.isPinned);
    setActiveMenuId(null);
  }

  function handleCopy(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) return;

    const formData = new FormData();
    formData.set("title", formTitle);
    formData.set("url", formUrl);
    formData.set("category", formCategory);
    formData.set("description", formDescription);
    formData.set("isPinned", formIsPinned ? "true" : "false");

    startTransition(async () => {
      const res = await createResourceAction(formData);
      if (res.success && res.data) {
        setResources((prev) => [res.data!, ...prev]);
        setShowAddModal(false);
        resetForm();
        notifyToast({
          message: `Resource "${res.data.title}" saved successfully.`,
          kind: "success",
        });
      } else {
        notifyToast({
          title: "Resource not saved",
          message: res.error || "Failed to save resource.",
          kind: "error",
        });
      }
    });
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingResource) return;

    const formData = new FormData();
    formData.set("title", formTitle);
    formData.set("url", formUrl);
    formData.set("category", formCategory);
    formData.set("description", formDescription);
    formData.set("isPinned", formIsPinned ? "true" : "false");

    startTransition(async () => {
      const res = await updateResourceAction(editingResource.id, formData);
      if (res.success && res.data) {
        setResources((prev) =>
          prev.map((r) => (r.id === editingResource.id ? res.data! : r)),
        );
        setEditingResource(null);
        resetForm();
        notifyToast({
          message: "Resource updated successfully.",
          kind: "success",
        });
      } else {
        notifyToast({
          title: "Resource not updated",
          message: res.error || "Failed to update resource.",
          kind: "error",
        });
      }
    });
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    setActiveMenuId(null);

    startTransition(async () => {
      const res = await deleteResourceAction(id);
      if (res.success) {
        setResources((prev) => prev.filter((r) => r.id !== id));
        notifyToast({
          message: `Resource "${title}" deleted.`,
          kind: "success",
        });
      } else {
        notifyToast({
          title: "Resource not deleted",
          message: res.error || "Failed to delete resource.",
          kind: "error",
        });
      }
    });
  }

  // Filtered resources
  const filtered = resources
    .filter((r) => {
      if (selectedCategory !== "ALL" && r.category !== selectedCategory)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111625] dark:text-white">
            Resources & Links Hub
          </h1>
          <p className="mt-1 text-xs text-[#8E95A5]">
            Central directory for official club links, social media channels,
            Google Drive folders, and district tools
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Resource Link</span>
        </button>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-[#0D3594] text-white shadow-xs"
                : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
            }`}
          >
            All Resources ({resources.length})
          </button>
          {RESOURCE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                selectedCategory === cat.value
                  ? "bg-[#0D3594] text-white shadow-xs"
                  : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-[#8E95A5] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources, apps or links..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#111622] text-[#111625] dark:text-white placeholder-[#8E95A5] focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
          />
        </div>
      </div>

      {/* 3. Resources Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl p-12 text-center">
          <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#111625] dark:text-white">
            No resources found
          </h3>
          <p className="mt-1 text-xs text-[#8E95A5]">
            {searchQuery
              ? `No resources match your search "${searchQuery}".`
              : "Get started by adding your club's Facebook page, Google Drive folders, or portal links."}
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D3594] text-white text-xs font-semibold hover:bg-[#092569] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Resource</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const Icon = CATEGORY_ICONS[item.category] || ExternalLink;
            const colors =
              CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER;
            const categoryLabel =
              RESOURCE_CATEGORIES.find((c) => c.value === item.category)
                ?.label || item.category;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition relative group"
              >
                <div>
                  {/* Top Row: Category Pill + Pin + 3-Dot Options */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{categoryLabel}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      {item.isPinned && (
                        <span
                          className="p-1 rounded-md text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                          title="Pinned Resource"
                        >
                          <Pin className="w-3 h-3 fill-amber-500" />
                        </span>
                      )}

                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenuId(
                              activeMenuId === item.id ? null : item.id,
                            )
                          }
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeMenuId === item.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-xl elevation-popover py-1 z-20 min-w-[130px]">
                            <button
                              onClick={() => openEditModal(item)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.title)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E54335] hover:bg-[#FEECEB]/60 dark:hover:bg-rose-950/30 text-left transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-bold text-[#111625] dark:text-white leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-[#6B7280] dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {item.description ||
                      "No description provided for this resource."}
                  </p>
                </div>

                {/* Bottom URL Actions */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold shadow-xs transition"
                  >
                    <span>Open Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => handleCopy(item.id, item.url)}
                    className="p-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-[#17A863]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Add Resource Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-[#111625] dark:text-white">
                Add Resource Link
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Resource Name / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rotaract San Pedro East Facebook Page"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Website URL / Link *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., https://facebook.com/rotaractsanpedroeast"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as ResourceCategory)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                >
                  {RESOURCE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="What is this link used for? (e.g. Photo albums, announcements, project submissions)"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinResource"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                  className="rounded border-[#EDEDF2] text-[#0D3594] focus:ring-[#0D3594]"
                />
                <label
                  htmlFor="pinResource"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Pin this resource to the top of the hub
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Edit Resource Modal */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setEditingResource(null)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-[#111625] dark:text-white">
                Edit Resource Link
              </h2>
              <button
                onClick={() => setEditingResource(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Resource Name / Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Website URL / Link *
                </label>
                <input
                  type="text"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as ResourceCategory)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                >
                  {RESOURCE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinResourceEdit"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                  className="rounded border-[#EDEDF2] text-[#0D3594] focus:ring-[#0D3594]"
                />
                <label
                  htmlFor="pinResourceEdit"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Pin this resource to the top of the hub
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingResource(null)}
                  className="px-4 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Updating..." : "Update Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
