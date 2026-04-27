// Copyright 2026 Alloomi Team. All rights reserved.
//
// Use of this source code is governed by a license that can be
// found in the LICENSE file in the root of this source tree.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstalledRenderEngine {
    pub version: String,
    pub installed_at: String,
    pub install_dir: String,
    pub soffice_path: String,
    pub pdftoppm_path: String,
    pub python_path: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct RenderEngineStatus {
    pub available: bool,
    pub install_dir: String,
    pub installed: Option<InstalledRenderEngine>,
    pub reason: String,
    pub error_message: Option<String>,
}

fn get_install_root() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            return PathBuf::from(userprofile)
                .join(".alloomi")
                .join("render-engines")
                .join("office");
        }

        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata)
                .join("Alloomi")
                .join("render-engines")
                .join("office");
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".alloomi")
            .join("render-engines")
            .join("office");
    }

    PathBuf::from(".alloomi")
        .join("render-engines")
        .join("office")
}

fn get_install_record_path() -> PathBuf {
    get_install_root().join("installed.json")
}

fn current_platform_target() -> String {
    let os = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "win32"
    } else {
        "linux"
    };

    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };

    format!("{}-{}", os, arch)
}

fn get_resource_dir() -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let current_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current dir for resources: {}", e))?;
        let candidates = [current_dir.join("src-tauri"), current_dir.clone()];

        for candidate in candidates {
            if candidate.join("resources").exists() {
                return Ok(candidate);
            }
        }

        return Err(format!(
            "Failed to locate Tauri resource dir from {}",
            current_dir.display()
        ));
    }

    #[cfg(not(debug_assertions))]
    {
        let resource_dir = std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));

        let resource_dir = if resource_dir.ends_with("MacOS") {
            resource_dir
                .parent()
                .map(|p| p.join("Resources"))
                .unwrap_or(resource_dir)
        } else {
            resource_dir
        };

        return Ok(resource_dir);
    }
}

fn get_packaged_engine_root() -> Result<PathBuf, String> {
    let resource_dir = get_resource_dir()?;
    Ok(resource_dir
        .join("resources")
        .join("render-engine")
        .join(current_platform_target()))
}

fn read_installed_record() -> Result<InstalledRenderEngine, String> {
    let record_path = get_install_record_path();
    let raw = fs::read_to_string(&record_path).map_err(|e| {
        format!(
            "Failed to read install record {}: {}",
            record_path.display(),
            e
        )
    })?;
    serde_json::from_str::<InstalledRenderEngine>(&raw)
        .map_err(|e| format!("Failed to parse install record: {}", e))
}

fn remove_install_record_if_invalid() {
    let path = get_install_record_path();
    let _ = fs::remove_file(path);
}

fn get_python_path(install_dir: &Path) -> Option<String> {
    let bundled = install_dir.join("python").join("bin").join("python3");
    if bundled.exists() {
        return Some(bundled.to_string_lossy().to_string());
    }

    if Command::new("python3")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some("python3".to_string());
    }

    None
}

fn build_installed_record(
    version: &str,
    install_dir: &Path,
) -> Result<InstalledRenderEngine, String> {
    #[cfg(target_os = "macos")]
    let soffice_path = install_dir
        .join("LibreOffice.app")
        .join("Contents")
        .join("MacOS")
        .join("soffice");

    #[cfg(target_os = "windows")]
    let soffice_path = install_dir
        .join("LibreOffice")
        .join("program")
        .join("soffice.exe");

    #[cfg(target_os = "linux")]
    let soffice_path = install_dir
        .join("libreoffice")
        .join("program")
        .join("soffice");

    #[cfg(target_os = "macos")]
    let pdftoppm_path = install_dir.join("poppler").join("bin").join("pdftoppm");

    #[cfg(target_os = "windows")]
    let pdftoppm_path = install_dir
        .join("poppler")
        .join("Library")
        .join("bin")
        .join("pdftoppm.exe");

    #[cfg(target_os = "linux")]
    let pdftoppm_path = install_dir.join("poppler").join("bin").join("pdftoppm");

    if !soffice_path.exists() {
        return Err(format!(
            "Missing soffice binary at {}",
            soffice_path.display()
        ));
    }
    if !pdftoppm_path.exists() {
        return Err(format!(
            "Missing pdftoppm binary at {}",
            pdftoppm_path.display()
        ));
    }

    Ok(InstalledRenderEngine {
        version: version.to_string(),
        installed_at: "bundled".to_string(),
        install_dir: install_dir.to_string_lossy().to_string(),
        soffice_path: soffice_path.to_string_lossy().to_string(),
        pdftoppm_path: pdftoppm_path.to_string_lossy().to_string(),
        python_path: get_python_path(install_dir),
    })
}

fn read_packaged_engine_record() -> Result<InstalledRenderEngine, String> {
    let install_dir = get_packaged_engine_root()?;
    build_installed_record("bundled", &install_dir)
}

fn find_in_path(binary: &str) -> Option<String> {
    Command::new("which")
        .arg(binary)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn check_path_based_engine() -> Option<InstalledRenderEngine> {
    let soffice_path = find_in_path("soffice")?;
    let pdftoppm_path = find_in_path("pdftoppm")?;

    let python_path = if Command::new("python3")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        Some("python3".to_string())
    } else {
        None
    };

    Some(InstalledRenderEngine {
        version: "system".to_string(),
        installed_at: "path".to_string(),
        install_dir: "system".to_string(),
        soffice_path,
        pdftoppm_path,
        python_path,
    })
}

#[tauri::command]
pub fn get_render_engine_status() -> RenderEngineStatus {
    if let Ok(record) = read_packaged_engine_record() {
        return RenderEngineStatus {
            available: true,
            install_dir: record.install_dir.clone(),
            installed: Some(record),
            reason: "available".to_string(),
            error_message: None,
        };
    }

    let install_dir = get_install_root().to_string_lossy().to_string();
    if let Ok(record) = read_installed_record() {
        return RenderEngineStatus {
            available: true,
            install_dir,
            installed: Some(record),
            reason: "available".to_string(),
            error_message: None,
        };
    }

    if let Some(record) = check_path_based_engine() {
        return RenderEngineStatus {
            available: true,
            install_dir: record.install_dir.clone(),
            installed: Some(record),
            reason: "available".to_string(),
            error_message: None,
        };
    }

    remove_install_record_if_invalid();
    RenderEngineStatus {
        available: false,
        install_dir,
        installed: None,
        reason: "not_installed".to_string(),
        error_message: None,
    }
}
