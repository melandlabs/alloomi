"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AvatarConfiguration, SvgPath } from "./types";
import { EYES, EYEBROWS, NOSES, MOUTHS, COLOR_PRESETS } from "./constants";
import { AVATAR_SHAPE_PRESETS } from "./shape-presets";
import { AvatarShapePathInHundred } from "./shape-path-utils";
import { AvatarDisplayFramed } from "./avatar-display-framed";
import { cn } from "@/lib/utils";

/**
 * Avatar editor props interface
 */
interface AvatarEditorProps {
  /** Avatar config */
  config: AvatarConfiguration;
  /** Config update callback */
  onConfigChange: (config: AvatarConfiguration) => void;
  /** Close callback */
  onClose?: () => void;
  /** Additional CSS classes for the root element */
  className?: string;
}

/**
 * Feature grid component props interface
 */
interface FeatureGridProps {
  /** Feature items array */
  items: SvgPath[];
  /** Currently selected ID */
  currentId: string;
  /** Config key */
  configKey: keyof AvatarConfiguration;
  /** Update config callback */
  onUpdate: (key: keyof AvatarConfiguration, value: string) => void;
}

/**
 * Avatar editor panel tab type
 */
type AvatarEditorTab = "editor" | "upload";

/**
 * Feature grid component
 * Displays selectable facial feature options
 */
function FeatureGrid({
  items,
  currentId,
  configKey,
  onUpdate,
}: FeatureGridProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onUpdate(configKey, item.id)}
          className={`
            aspect-square rounded-lg border flex items-center justify-center transition-all duration-200 p-1.5
            ${
              currentId === item.id
                ? "bg-primary/10 border-primary text-primary shadow-md scale-105"
                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }
          `}
          title={item.label}
          type="button"
        >
          <svg viewBox="0 0 100 100" className="h-full w-full max-h-9 max-w-9">
            <path
              d={item.path}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

/**
 * Agent Avatar editor component
 * Provides visual editing interface for avatar configuration
 */
export function AvatarEditor({
  config,
  onConfigChange,
  onClose,
  className,
}: AvatarEditorProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AvatarEditorTab>("editor");

  /**
   * Update config
   */
  const updateConfig = (key: keyof AvatarConfiguration, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  /**
   * Set built-in color preset and clear custom image
   */
  const setColorPreset = (presetId: string) => {
    onConfigChange({
      ...config,
      colorPresetId: presetId,
      customTextureUrl: null,
    });
  };

  /**
   * Handle user image upload and convert file to data URL
   */
  const handleCustomImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onConfigChange({
          ...config,
          shapeId: "circle",
          showBorder: false,
          customTextureUrl: result,
        });
      }
    };
    reader.readAsDataURL(file);

    // Allow selecting the same file again
    event.currentTarget.value = "";
  };

  /**
   * Clear custom uploaded texture
   */
  const clearCustomImage = () => {
    onConfigChange({
      ...config,
      customTextureUrl: null,
    });
  };

  return (
    <div
      className={cn(
        "w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-6 p-0",
        className,
      )}
    >
      {/* Left: avatar preview */}
      <div className="flex-shrink-0 flex flex-col items-center gap-4 mt-12 md:w-1/3">
        <h3 className="w-full text-center text-sm font-semibold text-foreground">
          预览
        </h3>
        <div className="relative w-full flex items-center justify-center">
          <AvatarDisplayFramed
            config={config}
            className="w-[120px] sm:w-[200px] md:w-[200px]"
            enableInteractions={!config.customTextureUrl}
            staticMode={Boolean(config.customTextureUrl)}
            forceCenter={Boolean(config.customTextureUrl)}
            defaultBottomRight
          />
        </div>
      </div>

      {/* Right: edit panel */}
      <div className="flex-1 bg-white rounded-none overflow-hidden">
        {/* Tab navigation */}
        <div className="inline-flex w-fit items-center justify-center rounded-md text-muted-foreground h-auto bg-transparent p-0 gap-4">
          <button
            onClick={() => setActiveTab("editor")}
            className={`inline-flex w-fit whitespace-nowrap py-3 text-sm font-semibold uppercase transition-colors
              ${
                activeTab === "editor"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }
            `}
            type="button"
          >
            {t("agentAvatar.tabs.editor")}
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`inline-flex w-fit whitespace-nowrap py-3 text-sm font-semibold uppercase transition-colors
              ${
                activeTab === "upload"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }
            `}
            type="button"
          >
            {t("agentAvatar.tabs.upload")}
          </button>
        </div>

        {/* Content area */}
        <div className="max-h-[50vh] overflow-y-auto py-6 px-2 space-y-6">
          {activeTab === "editor" ? (
            <div className="space-y-6">
              {/* Silhouette presets */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.shapePresets", "Silhouette")}
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2 pb-2">
                  {AVATAR_SHAPE_PRESETS.map((item) => {
                    const active =
                      (config.shapeId ?? AVATAR_SHAPE_PRESETS[0].id) ===
                      item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={t(item.labelKey, { defaultValue: item.label })}
                        onClick={() => updateConfig("shapeId", item.id)}
                        className={`
                        aspect-square rounded-lg border flex items-center justify-center transition-all duration-200 p-1.5
                        ${
                          active
                            ? "bg-primary/10 border-primary text-primary shadow-md scale-105"
                            : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }
                      `}
                      >
                        <svg
                          viewBox="0 0 100 100"
                          className="h-full w-full max-h-9 max-w-9"
                          aria-hidden
                        >
                          <AvatarShapePathInHundred
                            shape={item}
                            fill="currentColor"
                            className="opacity-90"
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color presets */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("agentAvatar.colorPresets")}
                </h4>
                <div className="flex gap-3 overflow-x-auto pt-2 pb-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setColorPreset(preset.id)}
                      title={t(preset.labelKey, { defaultValue: preset.label })}
                      aria-label={t(preset.labelKey, {
                        defaultValue: preset.label,
                      })}
                      className={`
                      relative overflow-hidden w-12 h-12 shrink-0 rounded-md border-2 transition-all
                      ${
                        config.colorPresetId === preset.id &&
                        !config.customTextureUrl
                          ? "border-primary ring-2 ring-primary/20 ring-offset-2"
                          : "border-transparent hover:border-border"
                      }
                    `}
                      type="button"
                    >
                      {preset.editorFlatFill ? (
                        <div
                          className={`absolute inset-0 ${preset.mainColor} pointer-events-none`}
                        />
                      ) : (
                        <>
                          <div
                            className={`absolute inset-0 ${preset.mainColor} opacity-50 pointer-events-none`}
                          />
                          <div
                            className={`absolute top-0 right-0 w-10 h-10 rounded-full blur-md ${preset.gradientClasses[0].split(" ")[0]} pointer-events-none`}
                          />
                          <div
                            className={`absolute bottom-0 left-0 w-10 h-10 rounded-full blur-md ${preset.gradientClasses[1].split(" ")[0]} pointer-events-none`}
                          />
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.features.eyes")}
                </h4>
                <FeatureGrid
                  items={EYES}
                  currentId={config.eyesId}
                  configKey="eyesId"
                  onUpdate={updateConfig}
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.features.eyebrows")}
                </h4>
                <FeatureGrid
                  items={EYEBROWS}
                  currentId={config.eyebrowsId}
                  configKey="eyebrowsId"
                  onUpdate={updateConfig}
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.features.nose")}
                </h4>
                <FeatureGrid
                  items={NOSES}
                  currentId={config.noseId}
                  configKey="noseId"
                  onUpdate={updateConfig}
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.features.mouth")}
                </h4>
                <FeatureGrid
                  items={MOUTHS}
                  currentId={config.mouthId}
                  configKey="mouthId"
                  onUpdate={updateConfig}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {t("agentAvatar.upload.title")}
              </h4>

              <label
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                htmlFor="avatar-custom-upload"
              >
                <span className="text-sm font-medium text-foreground">
                  {t("agentAvatar.upload.cta")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("agentAvatar.upload.hint")}
                </span>
              </label>

              <input
                id="avatar-custom-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleCustomImageUpload}
              />

              {config.customTextureUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border border-border bg-background">
                    <img
                      src={config.customTextureUrl}
                      alt={t("agentAvatar.upload.previewAlt")}
                      className="w-full max-h-56 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomImage}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {t("agentAvatar.upload.clear")}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
