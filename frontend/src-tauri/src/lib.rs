use tauri::{AppHandle, Manager};

fn focus_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    if let Err(error) = window.show() {
      log::warn!("second instance show failed: {error}");
    }
    if let Err(error) = window.unminimize() {
      log::warn!("second instance unminimize failed: {error}");
    }
    if let Err(error) = window.set_focus() {
      log::warn!("second instance focus failed: {error}");
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      focus_main_window(app);
      log::info!("second instance blocked and existing window focused");
    }))
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .setup(|app| {
      log::info!("Canvie startup");
      if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
          log::warn!("main window show failed: {error}");
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Canvie");
}
