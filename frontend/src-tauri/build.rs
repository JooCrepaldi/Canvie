fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&["get_mode", "toggle_lock", "toggle_overlay", "toggle_draw"]),
    ),
  )
  .expect("failed to run tauri-build");
}
