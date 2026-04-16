use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn send_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    let notification = app_handle.notification();

    // Check and request permission if needed
    let permission_state = notification
        .permission_state()
        .map_err(|e| e.to_string())?;

    if permission_state != tauri_plugin_notification::PermissionState::Granted {
        notification
            .request_permission()
            .map_err(|e| e.to_string())?;
    }

    notification
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())
}
