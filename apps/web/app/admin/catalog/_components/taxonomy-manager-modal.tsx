"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Badge } from "@/components/admin/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Plus, Trash2, Edit2, Layers, Tag, Check, Save, FolderPlus, Sparkles, ChevronUp, ChevronDown, ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

export interface SubCategoryItem {
  id: string;
  name: string;
}

export interface CategoryItem {
  id: string;
  platformId: string;
  name: string;
  icon?: string;
  subcategories: SubCategoryItem[];
}

export interface PlatformItem {
  id: string;
  name: string;
  icon?: string;
}

export interface TaxonomyData {
  platforms?: PlatformItem[];
  categories: CategoryItem[];
}

export const DEFAULT_PLATFORMS: PlatformItem[] = [
  { id: "instagram", name: "Instagram", icon: "/landing/icons/instagram.png" },
  { id: "facebook", name: "Facebook", icon: "/landing/icons/facebook.png" },
  { id: "youtube", name: "YouTube", icon: "/landing/icons/youtube.png" },
  { id: "telegram", name: "Telegram", icon: "/landing/icons/telegram.png" },
  { id: "tiktok", name: "TikTok", icon: "/landing/icons/tiktok.png" },
  { id: "x", name: "Twitter / X", icon: "/landing/icons/x.png" },
  { id: "whatsapp", name: "WhatsApp", icon: "/landing/icons/whatsapp.png" },
  { id: "threads", name: "Threads", icon: "/landing/icons/threads.png" },
];

export const PRESET_ICONS = [
  { id: "followers", label: "Followers / Users" },
  { id: "likes", label: "Likes / Heart" },
  { id: "views", label: "Views / Eye" },
  { id: "comments", label: "Comments / Chat" },
  { id: "shares", label: "Shares / Arrow" },
  { id: "saves", label: "Saves / Bookmark" },
  { id: "votes", label: "Poll Votes" },
  { id: "reactions", label: "Emoji Reactions" },
  { id: "bot_start", label: "Bot Start" },
];

export const INITIAL_DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: "followers",
    platformId: "instagram",
    name: "Followers",
    icon: "followers",
    subcategories: [
      { id: "profile", name: "Profile / Account" },
      { id: "channel", name: "Broadcast Channel" },
    ],
  },
  {
    id: "likes",
    platformId: "instagram",
    name: "Likes & Reactions",
    icon: "likes",
    subcategories: [
      { id: "posts", name: "Posts" },
      { id: "reels", name: "Reels" },
      { id: "story", name: "Story" },
      { id: "comment_likes", name: "Comment Likes" },
    ],
  },
  {
    id: "views",
    platformId: "instagram",
    name: "Views",
    icon: "views",
    subcategories: [
      { id: "reels", name: "Reels / Video" },
      { id: "story", name: "Story Views" },
      { id: "posts", name: "Posts / Reach" },
    ],
  },
  {
    id: "comments",
    platformId: "instagram",
    name: "Comments",
    icon: "comments",
    subcategories: [
      { id: "custom", name: "Custom Comments" },
      { id: "random", name: "Random Comments" },
    ],
  },
  {
    id: "saves",
    platformId: "instagram",
    name: "Saves & Bookmarks",
    icon: "save",
    subcategories: [
      { id: "post", name: "Post Saves" },
    ],
  },
  {
    id: "repost",
    platformId: "instagram",
    name: "Repost",
    icon: "shares",
    subcategories: [
      { id: "post", name: "Post / Reel Repost" },
    ],
  },
  {
    id: "shares",
    platformId: "instagram",
    name: "Shares",
    icon: "shares",
    subcategories: [
      { id: "post", name: "Post Shares" },
    ],
  },
  {
    id: "followers",
    platformId: "facebook",
    name: "Followers",
    icon: "followers",
    subcategories: [
      { id: "page", name: "Page Followers" },
      { id: "profile", name: "Profile Followers" },
    ],
  },
  {
    id: "likes",
    platformId: "facebook",
    name: "Post Likes & Reactions",
    icon: "likes",
    subcategories: [
      { id: "post", name: "Post Likes" },
      { id: "page_likes", name: "Page Likes" },
    ],
  },
  {
    id: "followers",
    platformId: "telegram",
    name: "Channel & Group Members",
    icon: "followers",
    subcategories: [
      { id: "channel", name: "Public Channel Members" },
      { id: "group", name: "Private Group Members" },
      { id: "premium", name: "Telegram Premium Members" },
    ],
  },
  {
    id: "bot_start",
    platformId: "telegram",
    name: "Bot Start",
    icon: "bot_start",
    subcategories: [
      { id: "basic", name: "Basic Bot Start" },
      { id: "custom", name: "Custom Ref Bot Start" },
    ],
  },
  {
    id: "views",
    platformId: "telegram",
    name: "Post Views",
    icon: "views",
    subcategories: [
      { id: "post", name: "Single Post Views" },
      { id: "future", name: "Auto Future Posts Views" },
    ],
  },
  {
    id: "subscribers",
    platformId: "youtube",
    name: "Subscribers",
    icon: "followers",
    subcategories: [{ id: "channel", name: "Channel Subscribers" }],
  },
  {
    id: "views",
    platformId: "youtube",
    name: "Video Views",
    icon: "views",
    subcategories: [
      { id: "video", name: "Video Views" },
      { id: "shorts", name: "Shorts Views" },
      { id: "live", name: "Live Stream" },
    ],
  },
  {
    id: "likes",
    platformId: "youtube",
    name: "Likes",
    icon: "likes",
    subcategories: [
      { id: "video", name: "Video Likes" },
      { id: "shorts", name: "Shorts Likes" },
    ],
  },
  {
    id: "members",
    platformId: "telegram",
    name: "Members",
    icon: "followers",
    subcategories: [
      { id: "channel", name: "Channel Members" },
      { id: "group", name: "Group Members" },
    ],
  },
  {
    id: "followers",
    platformId: "tiktok",
    name: "Followers",
    icon: "followers",
    subcategories: [{ id: "profile", name: "Profile Followers" }],
  },
  {
    id: "likes",
    platformId: "tiktok",
    name: "Likes",
    icon: "likes",
    subcategories: [{ id: "video", name: "Video Likes" }],
  },
  {
    id: "views",
    platformId: "tiktok",
    name: "Views",
    icon: "views",
    subcategories: [{ id: "video", name: "Video Views" }],
  },
];

export function TaxonomyManagerModal({
  isOpen,
  onClose,
  catalogServices = [],
  onTaxonomyUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  catalogServices?: any[];
  onTaxonomyUpdated?: (taxonomy: TaxonomyData) => void;
}) {
  const [platforms, setPlatforms] = React.useState<PlatformItem[]>(DEFAULT_PLATFORMS);
  const [selectedPlatform, setSelectedPlatform] = React.useState("instagram");
  const [categories, setCategories] = React.useState<CategoryItem[]>(INITIAL_DEFAULT_CATEGORIES);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Drag & Drop States
  const [draggedPlatformIdx, setDraggedPlatformIdx] = React.useState<number | null>(null);
  const [dragOverPlatformIdx, setDragOverPlatformIdx] = React.useState<number | null>(null);

  const [draggedCatId, setDraggedCatId] = React.useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = React.useState<string | null>(null);

  const [draggedSubCat, setDraggedSubCat] = React.useState<{ catId: string; subId: string } | null>(null);
  const [dragOverSubId, setDragOverSubId] = React.useState<string | null>(null);

  // New Category state
  const [newCatName, setNewCatName] = React.useState("");
  const [newCatIcon, setNewCatIcon] = React.useState("followers");

  // New Sub-Category state per category
  const [newSubCatNames, setNewSubCatNames] = React.useState<Record<string, string>>({});

  // Fetch saved taxonomy on load
  React.useEffect(() => {
    if (isOpen) {
      apiClient.get("/admin/settings")
        .then((res: any) => {
          const raw = res?.catalog_taxonomy;
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.platforms && Array.isArray(parsed.platforms) && parsed.platforms.length > 0) {
                setPlatforms(parsed.platforms);
              }
              if (parsed?.categories && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
                setCategories(parsed.categories);
              }
            } catch (e) {}
          }
        })
        .catch((err) => {
          console.warn("Using default taxonomy setup", err);
        });
    }
  }, [isOpen]);

  // Compute bound service counts per category & sub-category
  const serviceCounts = React.useMemo(() => {
    const catMap: Record<string, number> = {};
    const subCatMap: Record<string, number> = {};

    if (Array.isArray(catalogServices)) {
      catalogServices.forEach((svc) => {
        const plat = String(svc.platform || "").toLowerCase();
        const cat = String(svc.category || svc.type || "").toLowerCase();
        const sub = String(svc.variant || svc.variantName || "").toLowerCase();

        if (plat && cat) {
          const catKey = `${plat}:${cat}`;
          catMap[catKey] = (catMap[catKey] || 0) + 1;

          if (sub) {
            const subKey = `${plat}:${cat}:${sub}`;
            subCatMap[subKey] = (subCatMap[subKey] || 0) + 1;
          }
        }
      });
    }

    return { catMap, subCatMap };
  }, [catalogServices]);

  const platformCategories = React.useMemo(() => {
    return categories.filter((c) => c.platformId === selectedPlatform);
  }, [categories, selectedPlatform]);

  // Platform Drag Handlers
  const handlePlatformDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedPlatformIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlatformDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedPlatformIdx === null || draggedPlatformIdx === idx) return;
    setDragOverPlatformIdx(idx);
  };

  const handlePlatformDrop = (dropIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedPlatformIdx === null || draggedPlatformIdx === dropIdx) {
      setDraggedPlatformIdx(null);
      setDragOverPlatformIdx(null);
      return;
    }
    const newPlatforms = [...platforms];
    const [moved] = newPlatforms.splice(draggedPlatformIdx, 1);
    newPlatforms.splice(dropIdx, 0, moved);
    setPlatforms(newPlatforms);
    setHasChanges(true);
    setDraggedPlatformIdx(null);
    setDragOverPlatformIdx(null);
  };

  // Category Drag Handlers
  const handleCatDragStart = (catId: string, e: React.DragEvent) => {
    setDraggedCatId(catId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCatDragOver = (catId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCatId || draggedCatId === catId) return;
    setDragOverCatId(catId);
  };

  const handleCatDrop = (dropCatId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCatId || draggedCatId === dropCatId) {
      setDraggedCatId(null);
      setDragOverCatId(null);
      return;
    }

    const platformCats = categories.filter((c) => c.platformId === selectedPlatform);
    const fromIdx = platformCats.findIndex((c) => c.id === draggedCatId);
    const toIdx = platformCats.findIndex((c) => c.id === dropCatId);
    if (fromIdx === -1 || toIdx === -1) return;

    const targetCat = platformCats[toIdx];
    const absFrom = categories.findIndex((c) => c.platformId === selectedPlatform && c.id === draggedCatId);
    const absTo = categories.findIndex((c) => c.platformId === selectedPlatform && c.id === targetCat.id);

    const newCategories = [...categories];
    const [moved] = newCategories.splice(absFrom, 1);
    newCategories.splice(absTo, 0, moved);

    setCategories(newCategories);
    setHasChanges(true);
    setDraggedCatId(null);
    setDragOverCatId(null);
  };

  // SubCategory Drag Handlers
  const handleSubDragStart = (catId: string, subId: string, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedSubCat({ catId, subId });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleSubDragOver = (catId: string, subId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSubCat || draggedSubCat.catId !== catId || draggedSubCat.subId === subId) return;
    setDragOverSubId(subId);
  };

  const handleSubDrop = (catId: string, dropSubId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSubCat || draggedSubCat.catId !== catId || draggedSubCat.subId === dropSubId) {
      setDraggedSubCat(null);
      setDragOverSubId(null);
      return;
    }

    setCategories((prev) =>
      prev.map((c) => {
        if (c.platformId !== selectedPlatform || c.id !== catId) return c;
        const fromIdx = c.subcategories.findIndex((s) => s.id === draggedSubCat.subId);
        const toIdx = c.subcategories.findIndex((s) => s.id === dropSubId);
        if (fromIdx === -1 || toIdx === -1) return c;

        const newSubs = [...c.subcategories];
        const [moved] = newSubs.splice(fromIdx, 1);
        newSubs.splice(toIdx, 0, moved);

        return { ...c, subcategories: newSubs };
      })
    );

    setHasChanges(true);
    setDraggedSubCat(null);
    setDragOverSubId(null);
  };

  const handleMovePlatform = (index: number, direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= platforms.length) return;

    const newPlatforms = [...platforms];
    const temp = newPlatforms[index];
    newPlatforms[index] = newPlatforms[targetIndex];
    newPlatforms[targetIndex] = temp;

    setPlatforms(newPlatforms);
    setHasChanges(true);
  };

  const handleMoveCategory = (catId: string, direction: "up" | "down") => {
    const platformCats = categories.filter((c) => c.platformId === selectedPlatform);
    const index = platformCats.findIndex((c) => c.id === catId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= platformCats.length) return;

    const targetCat = platformCats[targetIndex];
    const absIdx1 = categories.findIndex((c) => c.platformId === selectedPlatform && c.id === catId);
    const absIdx2 = categories.findIndex((c) => c.platformId === selectedPlatform && c.id === targetCat.id);

    const newCategories = [...categories];
    const temp = newCategories[absIdx1];
    newCategories[absIdx1] = newCategories[absIdx2];
    newCategories[absIdx2] = temp;

    setCategories(newCategories);
    setHasChanges(true);
  };

  const handleMoveSubCategory = (catId: string, subId: string, direction: "left" | "right") => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.platformId !== selectedPlatform || c.id !== catId) return c;
        const subIndex = c.subcategories.findIndex((s) => s.id === subId);
        const targetIndex = direction === "left" ? subIndex - 1 : subIndex + 1;
        if (targetIndex < 0 || targetIndex >= c.subcategories.length) return c;

        const newSubs = [...c.subcategories];
        const temp = newSubs[subIndex];
        newSubs[subIndex] = newSubs[targetIndex];
        newSubs[targetIndex] = temp;

        return { ...c, subcategories: newSubs };
      })
    );
    setHasChanges(true);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) {
      toast.error("Please enter a category name.");
      return;
    }

    const id = newCatName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const newCat: CategoryItem = {
      id,
      platformId: selectedPlatform,
      name: newCatName.trim(),
      icon: newCatIcon,
      subcategories: [],
    };

    setCategories((prev) => [...prev, newCat]);
    setNewCatName("");
    setHasChanges(true);
    toast.success(`Category "${newCatName.trim()}" added!`);
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories((prev) => prev.filter((c) => !(c.platformId === selectedPlatform && c.id === catId)));
    setHasChanges(true);
    toast.info("Category removed.");
  };

  const handleAddSubCategory = (catId: string) => {
    const subName = (newSubCatNames[catId] || "").trim();
    if (!subName) {
      toast.error("Please enter a sub-category option name.");
      return;
    }

    const subId = subName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    setCategories((prev) =>
      prev.map((c) => {
        if (c.platformId === selectedPlatform && c.id === catId) {
          if (c.subcategories.some((s) => s.id === subId)) {
            toast.error("This option already exists in this category.");
            return c;
          }
          return {
            ...c,
            subcategories: [...c.subcategories, { id: subId, name: subName }],
          };
        }
        return c;
      })
    );

    setNewSubCatNames((prev) => ({ ...prev, [catId]: "" }));
    setHasChanges(true);
    toast.success(`Option "${subName}" added!`);
  };

  const handleDeleteSubCategory = (catId: string, subId: string) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.platformId === selectedPlatform && c.id === catId) {
          return {
            ...c,
            subcategories: c.subcategories.filter((s) => s.id !== subId),
          };
        }
        return c;
      })
    );
    setHasChanges(true);
    toast.info("Option removed.");
  };

  const handleSaveTaxonomy = async () => {
    setIsSaving(true);
    try {
      const taxonomyPayload: TaxonomyData = { platforms, categories };
      await apiClient.post("/admin/settings", {
        catalog_taxonomy: JSON.stringify(taxonomyPayload),
      });
      toast.success("Taxonomy & Category placement saved successfully!");
      setHasChanges(false);
      if (onTaxonomyUpdated) onTaxonomyUpdated(taxonomyPayload);
      onClose();
    } catch (err: any) {
      console.error("Failed to save taxonomy", err);
      toast.error(err.message || "Failed to save taxonomy settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl sm:w-[90vw] max-w-[95vw] w-[95vw] h-[85vh] flex flex-col font-['GM'] p-0 overflow-hidden bg-[#FAFAFA] border-0 rounded-2xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-gray-200 bg-white shrink-0">
          <DialogTitle className="text-lg font-['GPB'] text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Manage Categories & Sub-Categories
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 font-['GM']">
            Drag and drop or use the ⬆️ ⬇️ arrows to reorder platforms, categories, and sub-categories. The arrangement updates the customer app in real-time.
          </DialogDescription>
        </DialogHeader>

        {/* Workspace Body */}
        <div className="flex-1 flex flex-row overflow-hidden min-h-0">
          {/* Left Sidebar: Platforms */}
          <div className="w-68 bg-white border-r border-gray-200 p-3 space-y-1 overflow-y-auto shrink-0 select-none">
            <div className="text-[10px] font-['GB'] text-gray-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>Platforms (Drag to reorder)</span>
            </div>
            {platforms.map((p, idx) => {
              const isSelected = selectedPlatform === p.id;
              const catCount = categories.filter((c) => c.platformId === p.id).length;
              const isBeingDragged = draggedPlatformIdx === idx;
              const isOver = dragOverPlatformIdx === idx;

              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handlePlatformDragStart(idx, e)}
                  onDragOver={(e) => handlePlatformDragOver(idx, e)}
                  onDrop={(e) => handlePlatformDrop(idx, e)}
                  onDragEnd={() => { setDraggedPlatformIdx(null); setDragOverPlatformIdx(null); }}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all border text-left cursor-grab active:cursor-grabbing group",
                    isSelected
                      ? "bg-indigo-50 border-indigo-200 text-indigo-950 font-['GPB'] shadow-sm"
                      : "bg-gray-50/50 border-transparent hover:bg-gray-100 text-gray-700",
                    isBeingDragged && "opacity-30 scale-95 border-dashed border-indigo-400",
                    isOver && "border-t-2 border-t-indigo-600 bg-indigo-50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                    <img src={p.icon} alt={p.name} className="w-4 h-4 object-contain shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex items-center opacity-60 group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => handleMovePlatform(idx, "up", e)}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-white rounded"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === platforms.length - 1}
                        onClick={(e) => handleMovePlatform(idx, "down", e)}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-white rounded"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0 ml-0.5">
                      {catCount}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Content: Categories for selected platform */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-[#F9FAFB]">
            {/* Platform Header & Add Category Box */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
              <h3 className="text-xs font-['GPB'] text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                Add New Category for {platforms.find((p) => p.id === selectedPlatform)?.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6 space-y-1">
                  <Label className="text-[10px] text-gray-500 font-['GPB'] uppercase">Category Name</Label>
                  <Input
                    placeholder="e.g. Post Likes & Reactions"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1">
                  <Label className="text-[10px] text-gray-500 font-['GPB'] uppercase">Icon Preset</Label>
                  <Select value={newCatIcon} onValueChange={setNewCatIcon}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_ICONS.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={handleAddCategory} className="h-8 w-full text-xs font-['GPB'] bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Categories List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-['GPB'] text-gray-500 uppercase tracking-wider">
                  Active Categories ({platformCategories.length}) — Drag cards to rearrange
                </h4>
              </div>

              {platformCategories.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-gray-300 text-xs text-gray-400">
                  No categories defined for this platform yet. Add one above!
                </div>
              ) : (
                platformCategories.map((cat, catIdx) => {
                  const catBoundCount = serviceCounts.catMap[`${selectedPlatform}:${cat.id}`] || 0;
                  const isCatDragged = draggedCatId === cat.id;
                  const isCatOver = dragOverCatId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      draggable
                      onDragStart={(e) => handleCatDragStart(cat.id, e)}
                      onDragOver={(e) => handleCatDragOver(cat.id, e)}
                      onDrop={(e) => handleCatDrop(cat.id, e)}
                      onDragEnd={() => { setDraggedCatId(null); setDragOverCatId(null); }}
                      className={cn(
                        "bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3 transition-all",
                        isCatDragged && "opacity-30 scale-[0.99] border-dashed border-indigo-400",
                        isCatOver && "border-t-4 border-t-indigo-600 shadow-md bg-indigo-50/30"
                      )}
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <div className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-600 rounded hover:bg-gray-100" title="Drag to reorder category">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={catIdx === 0}
                                onClick={() => handleMoveCategory(cat.id, "up")}
                                className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-gray-100 rounded"
                                title="Move Category Up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={catIdx === platformCategories.length - 1}
                                onClick={() => handleMoveCategory(cat.id, "down")}
                                className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-gray-100 rounded"
                                title="Move Category Down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-['GPB'] text-xs uppercase">
                            {cat.icon ? cat.icon.substring(0, 2) : "cat"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-['GPB'] text-gray-900">{cat.name}</span>
                              <Badge className={cn("text-[10px] px-2 py-0.5 rounded-full font-['GPB'] border", catBoundCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200")}>
                                {catBoundCount} services bound
                              </Badge>
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">ID: {cat.id}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Category
                        </Button>
                      </div>

                      {/* Sub-Categories Section */}
                      <div className="space-y-2 pl-2">
                        <span className="text-[10px] font-['GB'] text-gray-400 uppercase tracking-wider block">
                          Sub-Categories / Options ({cat.subcategories.length}) — Drag chips to reorder
                        </span>

                        {/* List of subcategories */}
                        <div className="flex flex-wrap gap-2">
                          {cat.subcategories.map((sub, subIdx) => {
                            const subBoundCount = serviceCounts.subCatMap[`${selectedPlatform}:${cat.id}:${sub.id}`] || 0;
                            const isSubDragged = draggedSubCat?.catId === cat.id && draggedSubCat?.subId === sub.id;
                            const isSubOver = dragOverSubId === sub.id;

                            return (
                              <div
                                key={sub.id}
                                draggable
                                onDragStart={(e) => handleSubDragStart(cat.id, sub.id, e)}
                                onDragOver={(e) => handleSubDragOver(cat.id, sub.id, e)}
                                onDrop={(e) => handleSubDrop(cat.id, sub.id, e)}
                                onDragEnd={() => { setDraggedSubCat(null); setDragOverSubId(null); }}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-['GM'] text-gray-800 shadow-2xs cursor-grab active:cursor-grabbing transition-all select-none",
                                  isSubDragged && "opacity-30 scale-95 border-dashed border-indigo-400",
                                  isSubOver && "border-l-4 border-l-indigo-600 bg-indigo-50"
                                )}
                              >
                                <GripVertical className="w-3 h-3 text-gray-300 hover:text-gray-500" />
                                <button
                                  type="button"
                                  disabled={subIdx === 0}
                                  onClick={(e) => { e.stopPropagation(); handleMoveSubCategory(cat.id, sub.id, "left"); }}
                                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                                  title="Move Left"
                                >
                                  <ArrowLeft className="w-2.5 h-2.5" />
                                </button>
                                <span>{sub.name}</span>
                                <button
                                  type="button"
                                  disabled={subIdx === cat.subcategories.length - 1}
                                  onClick={(e) => { e.stopPropagation(); handleMoveSubCategory(cat.id, sub.id, "right"); }}
                                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                                  title="Move Right"
                                >
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                                <Badge variant="secondary" className="text-[9px] bg-white border border-gray-200 text-gray-600 px-1 py-0 ml-0.5">
                                  {subBoundCount}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteSubCategory(cat.id, sub.id); }}
                                  className="text-gray-400 hover:text-red-600 ml-1 transition-colors"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Inline Add Sub-category */}
                        <div className="flex items-center gap-2 pt-2">
                          <Input
                            placeholder="Add sub-category (e.g. Reels, Posts, Story)..."
                            value={newSubCatNames[cat.id] || ""}
                            onChange={(e) => setNewSubCatNames({ ...newSubCatNames, [cat.id]: e.target.value })}
                            className="h-7 text-xs max-w-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddSubCategory(cat.id);
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAddSubCategory(cat.id)}
                            className="h-7 text-xs bg-gray-900 hover:bg-gray-800 text-white font-['GPB'] px-3"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Option
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs">
            Cancel
          </Button>
          <Button
            disabled={!hasChanges || isSaving}
            onClick={handleSaveTaxonomy}
            className="h-9 text-xs font-['GPB'] bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {isSaving ? "Saving..." : "Save Placements & Hierarchy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
