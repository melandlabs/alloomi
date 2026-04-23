"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { type AvatarConfiguration, type SvgPath, Tab } from "./types";
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
    <div className="grid grid-cols-5 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onUpdate(configKey, item.id)}
          className={`
            aspect-square rounded-lg border flex items-center justify-center transition-all duration-200
            ${
              currentId === item.id
                ? "bg-primary/10 border-primary text-primary shadow-md scale-105"
                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }
          `}
          title={item.label}
          type="button"
        >
          <svg viewBox="0 0 100 100" className="w-8 h-8">
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
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HEAD);

  /**
   * Update config
   */
  const updateConfig = (key: keyof AvatarConfiguration, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const setColorPreset = (presetId: string) => {
    onConfigChange({
      ...config,
      colorPresetId: presetId,
      customTextureUrl: null,
    });
  };

  return (
    <div
      className={cn(
        "w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-6 p-4",
        className,
      )}
    >
      {/* Left: avatar preview */}
      <div className="flex-shrink-0 flex flex-col items-center gap-4 md:w-1/3">
        <div className="relative w-full flex items-center justify-center">
          <AvatarDisplayFramed
            config={config}
            className="w-[120px] sm:w-[200px] md:w-[200px]"
            enableInteractions={true}
            defaultBottomRight
          />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {t("agentAvatar.previewHint")}
        </p>
      </div>

      {/* Right: edit panel */}
      <div className="flex-1 bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        {/* Tab navigation */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setActiveTab(Tab.HEAD)}
            className={`flex-1 py-3 text-sm font-semibold uppercase transition-colors
              ${
                activeTab === Tab.HEAD
                  ? "text-primary bg-primary/5 border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }
            `}
            type="button"
          >
            {t("agentAvatar.tabs.head")}
          </button>
          <button
            onClick={() => setActiveTab(Tab.FACE)}
            className={`flex-1 py-3 text-sm font-semibold uppercase transition-colors
              ${
                activeTab === Tab.FACE
                  ? "text-primary bg-primary/5 border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }
            `}
            type="button"
          >
            {t("agentAvatar.tabs.face")}
          </button>
        </div>

        {/* Content area */}
        <div className="max-h-[50vh] overflow-y-auto p-6 space-y-6">
          {/* HEAD tab */}
          {activeTab === Tab.HEAD && (
            <div className="space-y-6">
              {/* Silhouette presets */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.shapePresets", "Silhouette")}
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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

              {/* Border toggle */}
              <div className="flex items-center justify-between bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">
                    {t("agentAvatar.showBorder")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("agentAvatar.showBorderDesc")}
                  </span>
                </div>
                <button
                  onClick={() => updateConfig("showBorder", !config.showBorder)}
                  className={`
                    w-12 h-7 rounded-full transition-colors duration-200 ease-in-out relative
                    ${config.showBorder ? "bg-primary" : "bg-muted"}
                  `}
                  type="button"
                >
                  <span
                    className={`
                    absolute top-1 left-1 bg-background w-5 h-5 rounded-full shadow-sm transition-transform duration-200 ease-in-out
                    ${config.showBorder ? "translate-x-5" : "translate-x-0"}
                  `}
                  />
                </button>
              </div>

              {/* Color presets */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("agentAvatar.colorPresets")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setColorPreset(preset.id)}
                      className={`
                        relative overflow-hidden h-16 rounded-xl border-2 transition-all
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
                      <span
                        className={`absolute inset-0 flex items-center justify-center font-medium text-sm z-10 pointer-events-none ${
                          preset.editorFlatFill
                            ? "text-primary-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {t(preset.labelKey, { defaultValue: preset.label })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FACE tab */}
          {activeTab === Tab.FACE && (
            <div className="space-y-6">
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
          )}
        </div>
      </div>
    </div>
  );
}
