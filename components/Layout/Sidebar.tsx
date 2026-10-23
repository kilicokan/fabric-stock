"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  BarChart3,
  Car,
  ChevronLeft,
  ChevronRight,
  Cog,
  LogIn,
  LogOut,
  MessageSquare,
  Package,
  Pin,
  Search,
  Settings,
  Shirt,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  Scissors,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useTabs } from "../TabContext";

type MenuChild = {
  name: string;
  path: string;
};

type MenuItem = {
  name: string;
  path?: string;
  icon?: string;
  children?: MenuChild[];
};

type SearchPageResult = {
  name: string;
  path: string;
  parentName?: string;
};

type SearchResult = {
  kind: "page" | "data";
  name: string;
  path: string;
  parentName?: string;
  type?: string;
  description?: string;
  id?: number | string;
};

const menuItems: MenuItem[] = [
  { name: "Gork", path: "/", icon: "Sparkles" },
  { name: "Kumas Girisi", path: "/fabric-entry", icon: "LogIn" },
  { name: "Kumas Cikisi", path: "/fabric-exit", icon: "LogOut" },
  {
    name: "Satis",
    icon: "BarChart3",
    children: [
      { name: "Satis Siparisleri", path: "/customer-orders/list" },
      { name: "Satis Faturalari", path: "/sales/invoices" },
      { name: "Satis Irsaliyeleri", path: "/sales/dispatch-notes" },
    ],
  },
  {
    name: "Satin Alma",
    icon: "ShoppingCart",
    children: [
      { name: "Kumas Siparisleri", path: "/fabrics/orders" },
      { name: "Kumas ve Aksesuar Faturalari", path: "/purchases/invoices" },
      { name: "Kumas ve Aksesuar Irsaliyeleri", path: "/purchases/dispatch-notes" },
    ],
  },
  {
    name: "Raporlar",
    path: "/reports",
    icon: "BarChart3",
    children: [
      { name: "Kumas Hareket Raporu", path: "/reports" },
      { name: "Mevcut Stok", path: "/reports/stock" },
    ],
  },
  {
    name: "Kullanici Yonetimi",
    icon: "Users",
    children: [
      { name: "Kullanici Listesi", path: "/user-management" },
      { name: "Yeni Kullanici Ekle", path: "/user-management?tab=add" },
    ],
  },
  {
    name: "Musteriler",
    icon: "UserCheck",
    children: [
      { name: "Musteri Ekle", path: "/customers" },
      { name: "Musteri Listesi", path: "/customers/list" },
    ],
  },
  {
    name: "Musteri Siparisleri",
    icon: "ShoppingCart",
    children: [
      { name: "Siparis Ekle", path: "/customer-orders/add" },
      { name: "Siparis Listesi", path: "/customer-orders/list" },
    ],
  },
  {
    name: "Tedarikciler",
    icon: "Truck",
    children: [
      { name: "Tedarikci Ekle", path: "/suppliers" },
      { name: "Tedarikci Duzenle", path: "/suppliers/edit" },
    ],
  },
  {
    name: "Kumaslar",
    icon: "Shirt",
    children: [
      { name: "Kumas Listesi", path: "/fabrics" },
      { name: "Kumas Ekle", path: "/fabrics/add" },
      { name: "Kumas Tedarik", path: "/fabrics/supply" },
      { name: "Kesim Raporu", path: "/fabrics/planning" },
      { name: "Kumas Planlama (Yeni)", path: "/fabrics/planning-new" },
      { name: "Kumas Siparisleri", path: "/fabrics/orders" },
      { name: "Kesim Emirleri", path: "/fabrics/cutting-orders" },
      { name: "Kumas Irsaliyeleri", path: "/fabrics/invoices-slips?type=irsaliyeler" },
      { name: "Kumaş Faturalari", path: "/fabrics/invoices-slips?type=faturalar" },
      { name: "Hatalı Kumaş Stokları", path: "/fabrics/defective-stock" },
    ],
  },
  {
    name: "Aksesuarlar",
    icon: "Shirt",
    children: [
      { name: "Aksesuar Listesi", path: "/accessories" },
      { name: "Aksesuar Ekle", path: "/accessories/add" },
      { name: "Aksesuar Tedarik", path: "/accessories/supply" },
      { name: "Aksesuar Planlama (Yeni)", path: "/accessories/planning-new" },
      { name: "Aksesuar Siparisleri", path: "/accessories/orders" },
      { name: "Aksesuar Irsaliyeleri", path: "/accessories/invoices-slips?type=irsaliyeler" },
      { name: "Aksesuar Faturalari", path: "/accessories/invoices-slips?type=faturalar" },
    ],
  },
  { name: "Urunler", path: "/products", icon: "Package" },
  {
    name: "Dış Kaynak Üretim",
    icon: "Cog",
    children: [
      { name: "Dış Kaynak Üretim Gosterge Paneli", path: "/fason/dashboard" },
      { name: "Dış Kaynak Üretim Atolye Yonetimi", path: "/fason/workshops" },
      { name: "Is Emri Olustur", path: "/fason/create-work-order" },
      { name: "Kesim Onerileri", path: "/fason/cutting-suggestions" },
      { name: "Dış Kaynak Üretim Is Emri Yonetimi", path: "/fason/trackers" },
      { name: "Dış Kaynak Üretim Raporlari", path: "/fason/reports" },
    ],
  },
  {
    name: "Kesimhane",
    icon: "Scissors",
    children: [
      { name: "Kesim Onerileri", path: "/fason/cutting-suggestions" },
      { name: "Kesimhane Ekrani", path: "/fason/cutting-workshop" },
      { name: "Kumas Donusum Raporu", path: "/reports/cutting-fabric-conversion" },
      { name: "Mevcut Stok Raporu", path: "/reports/stock" },
    ],
  },
  { name: "Mesajlar", path: "/messages", icon: "MessageSquare" },
  {
    name: "Arac Yonetimi",
    icon: "Car",
    children: [
      { name: "Araclar", path: "/vehicles" },
      { name: "Yeni Arac Ekle", path: "/vehicles/add" },
    ],
  },
  {
    name: "Ayarlar",
    icon: "Settings",
    children: [
      { name: "Parametreler", path: "/settings/parameters" },
      { name: "Lisans Durumu", path: "/license" },
      { name: "Depo Yonetimi", path: "/settings/warehouses" },
      { name: "Renk Kartlari", path: "/settings/color-cards" },
      { name: "Kesim Masalari", path: "/settings/cutting-tables" },
      { name: "Malzeme Turu Yonetimi", path: "/settings/material-types" },
      { name: "Grup Kartlari Yonetimi", path: "/settings/group-cards" },
      { name: "Vergi Oranlari Yonetimi", path: "/settings/tax-rates" },
      { name: "Tarti Entegrasyonu", path: "/settings/scale-integration" },
    ],
  },
];

const menuKeyFromName = (menuName: string): string =>
  menuName.toLowerCase().replace(/\s/g, "");

const stripQueryFromPath = (path: string): string => path.split("?")[0];

const normalizeForSearch = (value: string): string =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .trim();

const shortlistItemKey = (item: Pick<SearchPageResult, "path" | "name">): string =>
  `${item.path}::${item.name}`;

const isSearchPageResult = (value: unknown): value is SearchPageResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parsed = value as Partial<SearchPageResult>;
  return (
    typeof parsed.name === "string" &&
    typeof parsed.path === "string" &&
    (typeof parsed.parentName === "string" || typeof parsed.parentName === "undefined")
  );
};

const iconMap = {
  LogIn,
  LogOut,
  BarChart3,
  Users,
  UserCheck,
  ShoppingCart,
  Truck,
  Shirt,
  Package,
  Cog,
  MessageSquare,
  Car,
  Settings,
  Sparkles,
  Scissors,
};

const pathMap: Record<string, () => Promise<{ default: ComponentType }>> = {
  "/": () => import("../../pages/home"),
  "/fabric-entry": () => import("../../pages/fabric-entry"),
  "/fabric-exit": () => import("../../pages/fabric-exit"),
  "/finance": () => import("../../pages/finance/index"),
  "/sales/invoices": () => import("../../pages/sales/invoices"),
  "/sales/dispatch-notes": () => import("../../pages/sales/dispatch-notes"),
  "/sales/document-form": () => import("../../pages/sales/document-form"),
  "/purchases/invoices": () => import("../../pages/purchases/invoices"),
  "/purchases/dispatch-notes": () => import("../../pages/purchases/dispatch-notes"),
  "/reports": () => import("../../pages/reports/index"),
  "/reports/usage": () => import("../../pages/reports/index"),
  "/reports/stock": () => import("../../pages/reports/stock"),
  "/user-management": () => import("../../pages/user-management"),
  "/user-management?tab=add": () => import("../../pages/user-management"),
  "/customers": () => import("../../pages/customers/index"),
  "/customers/list": () => import("../../pages/customers/list"),
  "/customer-orders/add": () => import("../../pages/customer-orders/add"),
  "/customer-orders/list": () => import("../../pages/customer-orders/list"),
  "/suppliers": () => import("../../pages/suppliers/index"),
  "/suppliers/edit": () => import("../../pages/suppliers/edit"),
  "/fabrics": () => import("../../pages/fabrics/index"),
  "/fabrics/add": () => import("../../pages/fabrics/add"),
  "/fabrics/supply": () => import("../../pages/fabrics/supply"),
  "/fabrics/planning": () => import("../../pages/fabrics/planning"),
  "/fabrics/planning-new": () => import("../../pages/fabrics/planning-new"),
  "/fabrics/orders": () => import("../../pages/fabrics/orders"),
  "/fabrics/cutting-orders": () => import("../../pages/fabrics/cutting-orders"),
  "/fabrics/invoices-slips": () => import("../../pages/fabrics/invoices-slips"),
  "/fabrics/defective-stock": () => import("../../pages/fabrics/defective-stock"),
  "/accessories": () => import("../../pages/accessories/index"),
  "/accessories/add": () => import("../../pages/accessories/add"),
  "/accessories/supply": () => import("../../pages/accessories/supply"),
  "/accessories/planning": () => import("../../pages/accessories/planning"),
  "/accessories/planning-new": () => import("../../pages/accessories/planning-new"),
  "/accessories/orders": () => import("../../pages/accessories/orders"),
  "/accessories/cutting-orders": () => import("../../pages/accessories/cutting-orders"),
  "/accessories/invoices-slips": () => import("../../pages/accessories/invoices-slips"),
  "/products": () => import("../../pages/products/index"),
  "/fason/dashboard": () => import("../../pages/fason/dashboard"),
  "/fason/workshops": () => import("../../pages/fason/workshops"),
  "/stock": () => import("../../pages/stock"),
  "/fason": () => import("../../pages/fason"),
  "/fason/create-work-order": () => import("../../pages/fason/create-work-order"),
  "/fason/cutting-suggestions": () => import("../../pages/fason/cutting-suggestions"),
  "/fason/trackers": () => import("../../pages/fason/trackers"),
  "/fason/reports": () => import("../../pages/fason/reports"),
  "/messages": () => import("../../pages/messages"),
  "/kesimhane": () => import("../../pages/kesimhane"),
  "/vehicles": () => import("../../pages/vehicles/index"),
  "/vehicles/add": () => import("../../pages/vehicles/add"),
  "/settings/warehouses": () => import("../../pages/settings/warehouses"),
  "/settings/color-cards": () => import("../../pages/settings/color-cards"),
  "/settings/cutting-tables": () => import("../../pages/settings/cutting-tables"),
  "/settings/material-types": () => import("../../pages/settings/material-types"),
  "/settings/group-cards": () => import("../../pages/settings/group-cards"),
  "/settings/tax-rates": () => import("../../pages/settings/tax-rates"),
  "/settings/scale-integration": () => import("../../pages/settings/scale-integration"),
  "/settings/parameters": () => import("../../pages/settings/parameters"),
  "/license": () => import("../../pages/license"),
};

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMyMenuOpen, setIsMyMenuOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [shortlistItems, setShortlistItems] = useState<SearchPageResult[]>([]);
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const { addTab } = useTabs();
  const shortlistStorageKey = useMemo(() => {
    if (!user?.id) {
      return null;
    }
    return `sidebar-shortlist:user-${user.id}`;
  }, [user?.id]);
  const shortlistKeys = useMemo(() => new Set(shortlistItems.map((item) => shortlistItemKey(item))), [shortlistItems]);

  const searchablePages = useMemo<SearchPageResult[]>(() => {
    const flatPages: SearchPageResult[] = [];

    menuItems.forEach((item) => {
      if (item.path) {
        flatPages.push({
          name: item.name,
          path: item.path,
        });
      }

      if (item.children) {
        item.children.forEach((child) => {
          flatPages.push({
            name: child.name,
            path: child.path,
            parentName: item.name,
          });
        });
      }
    });

    const unique = new Map<string, SearchPageResult>();
    flatPages.forEach((page) => {
      const pageKey = `${page.path}::${page.name}`;
      if (!unique.has(pageKey)) {
        unique.set(pageKey, page);
      }
    });

    return Array.from(unique.values());
  }, []);

  const filteredSearchResults = useMemo(() => {
    const normalizedQuery = normalizeForSearch(searchQuery);
    if (!normalizedQuery) {
      return [];
    }

    return searchablePages
      .filter((page) =>
        normalizeForSearch(`${page.name} ${page.parentName ?? ""} ${page.path}`).includes(normalizedQuery)
      )
      .slice(0, 8);
  }, [searchQuery, searchablePages]);

  useEffect(() => {
    setOpenMenus({
      satis: pathname.startsWith("/sales"),
      satinalma: pathname.startsWith("/purchases") || pathname === "/fabrics/orders",
      customers: pathname.startsWith("/customers"),
      fabrics: pathname.startsWith("/fabrics"),
      accessories: pathname.startsWith("/accessories"),
      users: pathname.startsWith("/user-management"),
      raporlar: pathname.startsWith("/reports"),
      fason: pathname.startsWith("/fason"),
      aracyonetimi: pathname.startsWith("/vehicles"),
      ayarlar: pathname.startsWith("/settings") || pathname.startsWith("/license"),
    });
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setShowSearchResults(false);
    setDataResults([]);
  }, [pathname]);

  useEffect(() => {
    if (!shortlistStorageKey) {
      setShortlistItems([]);
      return;
    }

    try {
      const rawValue = localStorage.getItem(shortlistStorageKey);
      if (!rawValue) {
        setShortlistItems([]);
        return;
      }

      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        setShortlistItems([]);
        return;
      }

      const sanitized = parsed.filter(isSearchPageResult);
      setShortlistItems(sanitized);
    } catch (error) {
      console.error("Shortlist okunamadi:", error);
      setShortlistItems([]);
    }
  }, [shortlistStorageKey]);

  useEffect(() => {
    if (!shortlistStorageKey) {
      return;
    }

    localStorage.setItem(shortlistStorageKey, JSON.stringify(shortlistItems));
  }, [shortlistItems, shortlistStorageKey]);

  const toggleMenu = (menuName: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  const toggleShortlistItem = (page: SearchPageResult): void => {
    const targetKey = shortlistItemKey(page);

    setShortlistItems((prev) => {
      const exists = prev.some((item) => shortlistItemKey(item) === targetKey);
      if (exists) {
        return prev.filter((item) => shortlistItemKey(item) !== targetKey);
      }

      return [...prev, page];
    });
  };

  const linkClasses = (active: boolean): string =>
    `text-left px-4 py-2 rounded-md text-secondary-700 dark:text-secondary-300 transition-all duration-300 flex items-center gap-2 mb-1 ${
      active
        ? "bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-200 font-semibold"
        : "hover:bg-secondary-100 dark:hover:bg-secondary-800"
    }`;

  const isActive = (path: string): boolean => {
    const pathWithoutQuery = stripQueryFromPath(path);

    return (
      pathname === pathWithoutQuery ||
      (pathWithoutQuery.includes("customers") && pathname === "/customers") ||
      (pathWithoutQuery.includes("fabrics/invoices-slips") && pathname === "/fabrics/invoices-slips") ||
      (pathWithoutQuery.includes("accessories/invoices-slips") && pathname === "/accessories/invoices-slips") ||
      (pathWithoutQuery.includes("sales") && pathname.startsWith("/sales")) ||
      (pathWithoutQuery.includes("purchases") && pathname.startsWith("/purchases")) ||
      (pathWithoutQuery.includes("user-management") && pathname.startsWith("/user-management")) ||
      (pathWithoutQuery.includes("reports") && pathname.startsWith("/reports"))
    );
  };

  const getComponentForPath = async (path: string): Promise<ComponentType | null> => {
    try {
      const importFn = pathMap[path] || pathMap[stripQueryFromPath(path)];
      if (importFn) {
        const loadedModule = await importFn();
        return loadedModule.default;
      }

      function MissingPage() {
        return (
          <div style={{ padding: "20px", fontSize: "18px", color: "#666" }}>
            Sayfa: {path}
            <br />
            <small style={{ color: "#999" }}>Bu sayfa henuz olusturulmamis</small>
          </div>
        );
      }

      return MissingPage;
    } catch (error) {
      console.error("Error loading component for path:", path, error);
      function LoadErrorPage() {
        return <div>Hata: Sayfa yuklenemedi ({path})</div>;
      }
      return LoadErrorPage;
    }
  };

  const handleMenuClick = async (path: string, title: string) => {
    try {
      const component = await getComponentForPath(path);
      if (component) {
        addTab({
          title,
          path,
          component,
          closable: true,
        });
      }
    } catch (error) {
      console.error("Error loading component for path:", path, error);
    }
  };

  const openPageFromSearch = async (page: SearchPageResult) => {
    if (page.parentName) {
      const parentMenuKey = menuKeyFromName(page.parentName);
      setOpenMenus((prev) => ({
        ...prev,
        [parentMenuKey]: true,
      }));
    }

    await handleMenuClick(page.path, page.name);
    setSearchQuery("");
    setShowSearchResults(false);
    setDataResults([]);
  };

  const handleDataResultClick = async (result: SearchResult) => {
    await handleMenuClick(result.path, result.name);
    setSearchQuery("");
    setShowSearchResults(false);
    setDataResults([]);
  };

  return (
    <div className="flex h-screen shrink-0">
      <aside
        className={`${
          isCollapsed ? "w-16" : "w-64"
        } bg-white dark:bg-secondary-900 text-secondary-900 dark:text-secondary-50 transition-all duration-300 h-screen flex flex-col gap-2 sticky top-0 overflow-y-auto border-r border-secondary-200 dark:border-secondary-700 p-4`}
      >
        <div className="flex justify-between items-center mb-4">
          {!isCollapsed && (
            <Link href="/" className="block">
              <Image
                src="/miraapp-logo.jpg"
                alt="MiraApp Logo"
                width={210}
                height={100}
                className="h-[100px] w-[210px] cursor-pointer object-cover"
                unoptimized
              />
            </Link>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md transition-colors duration-200 hover:bg-secondary-100 dark:hover:bg-secondary-800 text-secondary-700 dark:text-secondary-300"
              aria-label={isCollapsed ? "Menuyu ac" : "Menuyu kapat"}
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div ref={searchBoxRef} className="relative mb-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400 dark:text-secondary-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchQuery(value);
                  setShowSearchResults(true);

                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }

                  if (value.trim().length > 0) {
                    setIsSearching(true);
                    searchTimeoutRef.current = setTimeout(async () => {
                      try {
                        const res = await fetch(`/api/global-search?q=${encodeURIComponent(value.trim())}`);
                        const data = await res.json();
                        setDataResults(Array.isArray(data.results) ? data.results : []);
                      } catch {
                        setDataResults([]);
                      } finally {
                        setIsSearching(false);
                      }
                    }, 300);
                  } else {
                    setDataResults([]);
                  }
                }}
                onFocus={() => setShowSearchResults(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const pageResults = filteredSearchResults.map((r) => ({ ...r, kind: "page" as const }));
                    const allResults = [...pageResults, ...dataResults];
                    if (allResults.length > 0) {
                      const first = allResults[0];
                      if (first.kind === "page") {
                        void openPageFromSearch(first);
                      } else {
                        handleDataResultClick(first);
                      }
                    }
                  }
                }}
                placeholder="Sayfa ara (ornek: tedarikci)"
                className="w-full rounded-md border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-950 pl-9 pr-3 py-2 text-sm text-secondary-800 dark:text-secondary-100 placeholder:text-secondary-400 dark:placeholder:text-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-700"
              />
            </div>

            {showSearchResults && searchQuery.trim().length > 0 && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-secondary-200 bg-white shadow-lg dark:border-secondary-700 dark:bg-secondary-900">
                {filteredSearchResults.length === 0 && dataResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-secondary-500 dark:text-secondary-400">Sonuc bulunamadi.</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto py-1">
                    {filteredSearchResults.map((result) => (
                      <button
                        key={`${result.path}-${result.name}`}
                        onClick={() => void openPageFromSearch(result)}
                        className="w-full px-3 py-2 text-left transition-colors hover:bg-secondary-100 dark:hover:bg-secondary-800"
                      >
                        <div className="text-sm text-secondary-900 dark:text-secondary-100">{result.name}</div>
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">
                          {result.parentName ? `${result.parentName} - ${result.path}` : result.path}
                        </div>
                      </button>
                    ))}
                    {dataResults.length > 0 && filteredSearchResults.length > 0 && (
                      <div className="my-1 border-t border-secondary-200 dark:border-secondary-700" />
                    )}
                    {dataResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => void handleDataResultClick(result)}
                        className="w-full px-3 py-2 text-left transition-colors hover:bg-secondary-100 dark:hover:bg-secondary-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                            {result.type}
                          </span>
                          <span className="text-sm text-secondary-900 dark:text-secondary-100">{result.name}</span>
                        </div>
                        {result.description && (
                          <div className="mt-0.5 text-xs text-secondary-500 dark:text-secondary-400">{result.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {isSearching && (
                  <div className="border-t border-secondary-200 dark:border-secondary-700 px-3 py-2 text-xs text-secondary-500 dark:text-secondary-400">
                    Araniyor...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {user?.stockAccess && !isCollapsed && (
          <div className="mb-2">
            <button
              onClick={() => setIsMyMenuOpen((prev) => !prev)}
              className={`w-full ${linkClasses(isMyMenuOpen)} !mb-0`}
            >
              <Pin size={16} />
              <span className="flex-1">My Menu</span>
              <span className="text-xs text-secondary-500 dark:text-secondary-400">{shortlistItems.length}</span>
              <ChevronRight size={14} className={`transition-transform duration-200 ${isMyMenuOpen ? "rotate-90" : ""}`} />
            </button>

            {isMyMenuOpen && (
              <div className="ml-4 mt-1 space-y-1">
                {shortlistItems.length === 0 ? (
                  <div className="rounded-md border border-dashed border-secondary-300 dark:border-secondary-700 px-2 py-2 text-xs text-secondary-500 dark:text-secondary-400">
                    Pin ile eklediginde burada gorunecek.
                  </div>
                ) : (
                  shortlistItems.map((item) => (
                    <div key={shortlistItemKey(item)} className="flex items-center gap-1">
                      <button
                        onClick={() => void openPageFromSearch(item)}
                        className={`flex-1 ${linkClasses(isActive(item.path))} !mb-0`}
                      >
                        <span className="text-xs">-</span>
                        <span className="truncate">{item.name}</span>
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleShortlistItem(item);
                        }}
                        className="h-8 w-8 shrink-0 rounded-md border border-primary-500 bg-primary-500 text-white transition-colors hover:opacity-90"
                        aria-label={`${item.name} pinned`}
                        title="My Menu'den cikar"
                      >
                        <Pin size={13} className="mx-auto" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {user?.stockAccess &&
          menuItems.map((item) => {
            if (item.children) {
              const menuKey = menuKeyFromName(item.name);
              const isOpen = openMenus[menuKey];
              const IconComponent = item.icon ? iconMap[item.icon as keyof typeof iconMap] : null;

              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleMenu(menuKey)}
                    className={`w-full ${linkClasses(isActive(item.path ?? "") || isOpen)}`}
                  >
                    {isCollapsed ? (
                      IconComponent ? <IconComponent size={20} /> : null
                    ) : (
                      <>
                        {IconComponent && <IconComponent size={18} />}
                        <span className="flex-1">{item.name}</span>
                        <ChevronRight
                          size={14}
                          className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                        />
                      </>
                    )}
                  </button>
                  {isOpen && !isCollapsed && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const shortlistPage: SearchPageResult = {
                          name: child.name,
                          path: child.path,
                          parentName: item.name,
                        };
                        const childShortlisted = shortlistKeys.has(shortlistItemKey(shortlistPage));

                        return (
                          <div key={child.path} className="flex items-center gap-1">
                            <button
                              onClick={() => void handleMenuClick(child.path, child.name)}
                              className={`flex-1 ${linkClasses(isActive(child.path))} !mb-0`}
                            >
                              <span className="text-xs">-</span>
                              <span>{child.name}</span>
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleShortlistItem(shortlistPage);
                              }}
                              className={`h-8 w-8 shrink-0 rounded-md border transition-colors ${
                                childShortlisted
                                  ? "border-primary-500 bg-primary-500 text-white"
                                  : "border-secondary-300 text-secondary-500 hover:bg-secondary-100 dark:border-secondary-600 dark:text-secondary-300 dark:hover:bg-secondary-800"
                              }`}
                              aria-label={`${child.name} pin islemi`}
                              title={childShortlisted ? "My Menu'den cikar" : "My Menu'ye ekle"}
                            >
                              <Pin size={13} className="mx-auto" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const IconComponent = item.icon ? iconMap[item.icon as keyof typeof iconMap] : null;

            if (isCollapsed) {
              return (
                <button
                  key={item.path}
                  onClick={() => item.path && void handleMenuClick(item.path, item.name)}
                  className={`w-full ${linkClasses(isActive(item.path || ""))}`}
                >
                  {IconComponent ? <IconComponent size={20} /> : null}
                </button>
              );
            }

            const shortlistPage: SearchPageResult = {
              name: item.name,
              path: item.path || "",
            };
            const isItemShortlisted = shortlistKeys.has(shortlistItemKey(shortlistPage));

            return (
              <div key={item.path} className="flex items-center gap-1">
                <button
                  onClick={() => item.path && void handleMenuClick(item.path, item.name)}
                  className={`flex-1 ${linkClasses(isActive(item.path || ""))} !mb-0`}
                >
                  <>
                    {IconComponent && <IconComponent size={18} />}
                    <span className="flex-1">{item.name}</span>
                  </>
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!item.path) {
                      return;
                    }
                    toggleShortlistItem(shortlistPage);
                  }}
                  className={`h-8 w-8 shrink-0 rounded-md border transition-colors ${
                    isItemShortlisted
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-secondary-300 text-secondary-500 hover:bg-secondary-100 dark:border-secondary-600 dark:text-secondary-300 dark:hover:bg-secondary-800"
                  }`}
                  aria-label={`${item.name} pin islemi`}
                  title={isItemShortlisted ? "My Menu'den cikar" : "My Menu'ye ekle"}
                >
                  <Pin size={13} className="mx-auto" />
                </button>
              </div>
            );
          })}
      </aside>
    </div>
  );
}
