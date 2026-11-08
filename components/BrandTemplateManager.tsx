"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import {
  BRAND_FONT_OPTIONS,
  DEFAULT_BRAND_KIT,
  isValidHexColor,
  loadBrandKit,
  saveBrandKit,
  type BrandKit,
  type BrandTemplate,
} from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

function createTemplateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `template-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function BrandTemplateManager({ userId }: { userId: string }) {
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [name, setName] = useState("");
  const [font, setFont] = useState(DEFAULT_BRAND_KIT.font);
  const [color, setColor] = useState(DEFAULT_BRAND_KIT.color);
  const [introText, setIntroText] = useState("");
  const [outroText, setOutroText] = useState("");

  useEffect(() => {
    const saved = loadBrandKit(userId);
    setBrandKit(saved);
    setTemplates(saved.templates);
    setFont(saved.font);
    setColor(saved.color);
  }, [userId]);

  function handleSave() {
    const trimmedName = name.trim();
    const normalizedColor = color.trim().toUpperCase();

    if (!trimmedName) {
      toast.error("Name your template", {
        description: "Give it a name such as Podcast Launch.",
      });
      return;
    }
    if (!isValidHexColor(normalizedColor)) {
      toast.error("That template color is not valid", {
        description: "Enter a hex code such as #3B82F6.",
      });
      return;
    }

    const template: BrandTemplate = {
      id: createTemplateId(),
      name: trimmedName.slice(0, 40),
      font,
      color: normalizedColor,
      introText: introText.trim().slice(0, 80),
      outroText: outroText.trim().slice(0, 80),
    };
    const nextTemplates = [...templates, template];
    const latest = loadBrandKit(userId);

    saveBrandKit(userId, { ...latest, templates: nextTemplates });
    setBrandKit({ ...latest, templates: nextTemplates });
    setTemplates(nextTemplates);
    setName("");
    setIntroText("");
    setOutroText("");
    toast.success("Template saved", { description: template.name });
  }

  function handleDelete(id: string) {
    const nextTemplates = templates.filter((template) => template.id !== id);
    const latest = loadBrandKit(userId);
    saveBrandKit(userId, { ...latest, templates: nextTemplates });
    setBrandKit({ ...latest, templates: nextTemplates });
    setTemplates(nextTemplates);
    toast.success("Template removed");
  }

  return (
    <section className="flex flex-col gap-6 rounded-3 border border-border-gray bg-white p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
          <LayoutTemplate className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-[24px] font-bold leading-[1.25]">Templates</h2>
          <p className="mt-1 text-[14px] text-soft-black/60">
            Save reusable looks with intro and outro text for your clips.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold text-soft-black">
            Template name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Podcast Launch"
            maxLength={40}
            autoComplete="off"
            className={cn(
              "w-full rounded-lg border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40",
              "duration-200 focus:border-brand-blue",
              focusRing
            )}
          />
        </label>

        <CustomSelect
          label="Font"
          value={font}
          onValueChange={setFont}
          options={BRAND_FONT_OPTIONS}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold text-soft-black">
            Accent color
          </span>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2 border border-border-gray"
              style={{
                backgroundColor: isValidHexColor(color) ? color : "#E5E7EB",
              }}
            >
              <Palette className="h-5 w-5 text-white drop-shadow" />
            </span>
            <input
              type="text"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder="#3B82F6"
              maxLength={7}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "w-full rounded-lg border border-border-gray bg-white px-4 py-3 text-[16px] font-semibold uppercase text-soft-black placeholder:text-soft-black/40",
                "duration-200 focus:border-brand-blue",
                focusRing
              )}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold text-soft-black">
            Intro text
          </span>
          <input
            type="text"
            value={introText}
            onChange={(event) => setIntroText(event.target.value)}
            placeholder="Watch till the end!"
            maxLength={80}
            autoComplete="off"
            className={cn(
              "w-full rounded-lg border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40",
              "duration-200 focus:border-brand-blue",
              focusRing
            )}
          />
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-[14px] font-semibold text-soft-black">
            Outro text
          </span>
          <input
            type="text"
            value={outroText}
            onChange={(event) => setOutroText(event.target.value)}
            placeholder="Follow for more"
            maxLength={80}
            autoComplete="off"
            className={cn(
              "w-full rounded-lg border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40",
              "duration-200 focus:border-brand-blue",
              focusRing
            )}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
            focusRing
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Save template
        </button>
      </div>

      {templates.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-start justify-between gap-3 rounded-2 border border-border-gray bg-warm-white p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-3 w-3 rounded-full border border-border-gray"
                    style={{ backgroundColor: template.color }}
                  />
                  <p className="truncate text-[16px] font-semibold text-soft-black">
                    {template.name}
                  </p>
                </div>
                <p className="mt-1 text-[12px] text-soft-black/60">
                  {template.font} · {template.color}
                </p>
                {template.introText && (
                  <p className="mt-2 truncate text-[12px] text-soft-black/60">
                    Intro: {template.introText}
                  </p>
                )}
                {template.outroText && (
                  <p className="truncate text-[12px] text-soft-black/60">
                    Outro: {template.outroText}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(template.id)}
                aria-label={`Delete ${template.name} template`}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-soft-black/50 duration-200 hover:bg-white hover:text-red-600",
                  focusRing
                )}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2 border border-dashed border-border-gray bg-warm-white px-4 py-5 text-[14px] text-soft-black/60">
          No templates saved yet. Build one above and select it from the
          dashboard before generating clips.
        </p>
      )}
    </section>
  );
}
