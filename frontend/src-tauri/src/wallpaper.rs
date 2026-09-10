//! Embed the canvas window into the desktop wallpaper layer.
//!
//! On this Windows 11 shell there is no spare fullscreen WorkerW: Progman
//! itself is the bottom-most fullscreen surface and hosts SHELLDLL_DefView
//! (the icons) directly. So the canvas becomes a child of Progman, ordered
//! right behind SHELLDLL_DefView: it paints where the wallpaper is, behind
//! icons, taskbar and normal windows. Same family as Wallpaper Engine/Lively,
//! adapted to this shell layout.
//!
//! MVP-0 scope: primary monitor only. If Explorer restarts, the embedding is
//! lost until the next mode change or app restart.

use windows::{
  core::{w, BOOL},
  Win32::{
    Foundation::{HWND, LPARAM},
    UI::WindowsAndMessaging::*,
  },
};

unsafe extern "system" fn collect_top_level(hwnd: HWND, lparam: LPARAM) -> BOOL {
  let out = &mut *(lparam.0 as *mut Vec<HWND>);
  out.push(hwnd);
  BOOL(1)
}

fn top_level_windows() -> Vec<HWND> {
  let mut out: Vec<HWND> = Vec::new();
  unsafe {
    let _ = EnumWindows(
      Some(collect_top_level),
      LPARAM(&mut out as *mut Vec<HWND> as isize),
    );
  }
  out
}

fn class_name(hwnd: HWND) -> String {
  let mut buf = [0u16; 256];
  unsafe {
    let len = GetClassNameW(hwnd, &mut buf);
    if len > 0 {
      String::from_utf16_lossy(&buf[..len as usize])
    } else {
      String::new()
    }
  }
}

fn find_progman() -> Option<HWND> {
  top_level_windows()
    .into_iter()
    .find(|hwnd| class_name(*hwnd) == "Progman")
}

fn find_icon_layer(progman: HWND) -> Option<HWND> {
  unsafe { FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), None).ok() }
}

fn set_child_style(hwnd: HWND, child: bool) {
  unsafe {
    let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
    let new_style = if child {
      (style & !WS_POPUP.0) | WS_CHILD.0
    } else {
      (style & !WS_CHILD.0) | WS_POPUP.0
    };
    SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);
  }
}

fn fullscreen_primary(hwnd: HWND) -> bool {
  unsafe {
    let w = GetSystemMetrics(SM_CXSCREEN);
    let h = GetSystemMetrics(SM_CYSCREEN);
    SetWindowPos(
      hwnd,
      None,
      0,
      0,
      w,
      h,
      SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
    )
    .is_ok()
  }
}

/// Parent the canvas into Progman, ordered right behind the icon layer, and
/// size it to the primary monitor. Returns false on failure (caller keeps
/// fullscreen-overlay mode).
pub fn embed(canvas: HWND) -> bool {
  unsafe {
    let Some(progman) = find_progman() else {
      return false;
    };
    let Some(defview) = find_icon_layer(progman) else {
      return false;
    };
    set_child_style(canvas, true);
    if SetParent(canvas, Some(progman)).is_err() {
      return false;
    }
    let w = GetSystemMetrics(SM_CXSCREEN);
    let h = GetSystemMetrics(SM_CYSCREEN);
    SetWindowPos(
      canvas,
      Some(defview),
      0,
      0,
      w,
      h,
      SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
    )
    .is_ok()
  }
}

/// Raise the canvas above the icon layer (still a child of Progman, still
/// below taskbar and normal windows) so it receives mouse input for drawing.
pub fn raise(canvas: HWND) -> bool {
  unsafe {
    SetWindowPos(
      canvas,
      Some(HWND_TOP),
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    )
    .is_ok()
  }
}

/// Lower the canvas back behind the icon layer (resting wallpaper state).
pub fn lower(canvas: HWND) -> bool {
  unsafe {
    let Some(progman) = find_progman() else {
      return false;
    };
    let Some(defview) = find_icon_layer(progman) else {
      return false;
    };
    SetWindowPos(
      canvas,
      Some(defview),
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    )
    .is_ok()
  }
}

/// Detach the canvas back to a normal top-level window (for Overlay Mode).
pub fn detach(canvas: HWND) -> bool {
  unsafe {
    set_child_style(canvas, false);
    if SetParent(canvas, None).is_err() {
      return false;
    }
    fullscreen_primary(canvas)
  }
}
