fn main() {
  // Declaring the app commands makes each one need an explicit permission
  // in capabilities/, instead of being open to every window.
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["get_placement", "enter_edit", "pin_to_wall"])))
    .expect("failed to run tauri-build");
}
