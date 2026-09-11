fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&["get_mode", "toggle_lock", "toggle_overlay", "set_passthrough"]),
    ),
  )
  .expect("failed to run tauri-build");
}
