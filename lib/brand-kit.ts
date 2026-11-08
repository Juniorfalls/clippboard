export type BrandKit = {
  color: string;
  font: string;
  logo: string | null;
  layout: "single" | "split-screen";
};

export const DEFAULT_BRAND_KIT: BrandKit = {
  color: "#3B82F6",
  font: "Inter",
  logo: null,
  layout: "single",
};

export const BRAND_FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Outfit", label: "Outfit" },
  { value: "Satoshi", label: "Satoshi" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Space Grotesk", label: "Space Grotesk" },
];

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

export function isValidHexColor(value: string) {
  return HEX_PATTERN.test(value.trim());
}

function getStorageKey(userId: string) {
  return `clippboard:brand-kit:${userId}`;
}

export function loadBrandKit(userId: string): BrandKit {
  if (typeof window === "undefined") {
    return DEFAULT_BRAND_KIT;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return DEFAULT_BRAND_KIT;

    const parsed = JSON.parse(raw) as Partial<BrandKit>;
    return {
      color:
        typeof parsed.color === "string" && isValidHexColor(parsed.color)
          ? parsed.color
          : DEFAULT_BRAND_KIT.color,
      font:
        typeof parsed.font === "string" && parsed.font.trim()
          ? parsed.font
          : DEFAULT_BRAND_KIT.font,
      logo: typeof parsed.logo === "string" ? parsed.logo : null,
      layout:
        parsed.layout === "split-screen" ? "split-screen" : "single",
    };
  } catch {
    return DEFAULT_BRAND_KIT;
  }
}

export function saveBrandKit(userId: string, brandKit: BrandKit) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(brandKit));
}
