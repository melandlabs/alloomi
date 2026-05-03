// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

fn main() {
    if std::env::var("SKIP_RENDER_ENGINE_PREFLIGHT").ok().as_deref() != Some("true") {
        let profile = std::env::var("PROFILE").unwrap_or_default();
        if profile == "release" {
            let status = Command::new("node")
                .args(["../scripts/render-engine-preflight.mjs"])
                .status();
            match status {
                Ok(exit) if exit.success() => {}
                Ok(exit) => {
                    panic!(
                        "render engine preflight failed during release build (exit code {:?})",
                        exit.code()
                    );
                }
                Err(error) => {
                    panic!(
                        "render engine preflight could not start during release build: {}",
                        error
                    );
                }
            }
        }
    }

    tauri_build::build()
}
