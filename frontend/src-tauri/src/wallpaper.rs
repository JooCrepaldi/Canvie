//! Windows boundary for the canvas window placement.
//!
//! Wall keeps the window as a child of Progman over the primary monitor,
//! above the desktop icons and below normal windows and the taskbar. The
//! functions here know nothing about the canvas contents.

use std::mem::size_of;

use windows::{
  core::w,
  Win32::{
    Foundation::{COLORREF, HWND, POINT, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, ScreenToClient, MONITORINFO, MONITOR_DEFAULTTOPRIMARY},
    UI::WindowsAndMessaging::{
      FindWindowExW, FindWindowW, GetAncestor, GetWindowLongPtrW, IsWindow, SetForegroundWindow, SetLayeredWindowAttributes, SetParent, SetWindowLongPtrW,
      SetWindowPos, GA_PARENT, GWL_STYLE, HWND_TOP, HWND_TOPMOST, LWA_ALPHA, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_SHOWWINDOW,
      WS_CHILD, WS_POPUP,
    },
  },
};

fn find_progman() -> Result<HWND, String> {
  unsafe { FindWindowW(w!("Progman"), None) }.map_err(|error| format!("Progman not found: {error}"))
}

/// How far Explorer has come in building the desktop.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Desktop {
  Missing,
  WithoutIcons,
  Ready,
}

/// Explorer creates Progman first and its icon layer, SHELLDLL_DefView, a
/// moment later. A window embedded before the icon layer exists ends up
/// under it. Some wallpaper apps move the icon layer out of Progman, so a
/// caller may stop waiting for it.
pub fn desktop() -> Desktop {
  let Ok(progman) = find_progman() else {
    return Desktop::Missing;
  };
  match unsafe { FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), None) } {
    Ok(_) => Desktop::Ready,
    Err(_) => Desktop::WithoutIcons,
  }
}

/// Full rectangle of the primary monitor in physical screen pixels.
pub fn primary_monitor() -> Result<RECT, String> {
  unsafe {
    let monitor = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
    let mut info = MONITORINFO {
      cbSize: size_of::<MONITORINFO>() as u32,
      ..Default::default()
    };
    if GetMonitorInfoW(monitor, &mut info).as_bool() {
      Ok(info.rcMonitor)
    } else {
      Err("primary monitor info unavailable".into())
    }
  }
}

fn set_child_style(window: HWND, child: bool) {
  unsafe {
    let style = GetWindowLongPtrW(window, GWL_STYLE) as u32;
    let next = if child {
      (style & !WS_POPUP.0) | WS_CHILD.0
    } else {
      (style & !WS_CHILD.0) | WS_POPUP.0
    };
    SetWindowLongPtrW(window, GWL_STYLE, next as isize);
  }
}

/// Reparents the window into Progman, covers the primary monitor, and puts it
/// first among Progman's children so it sits above the icon layer.
pub fn embed(window: HWND) -> Result<(), String> {
  let progman = find_progman()?;
  let monitor = primary_monitor()?;
  // SetParent expects WS_CHILD before a top-level window gets a parent.
  set_child_style(window, true);
  unsafe {
    // tao adds WS_EX_LAYERED for click-through but never sets the layer
    // attributes, and a layered window without them is not drawn.
    SetLayeredWindowAttributes(window, COLORREF(0), 255, LWA_ALPHA).map_err(|error| format!("layer attributes failed: {error}"))?;
    SetParent(window, Some(progman)).map_err(|error| format!("SetParent to Progman failed: {error}"))?;
    let mut origin = POINT {
      x: monitor.left,
      y: monitor.top,
    };
    let _ = ScreenToClient(progman, &mut origin);
    SetWindowPos(
      window,
      Some(HWND_TOP),
      origin.x,
      origin.y,
      monitor.right - monitor.left,
      monitor.bottom - monitor.top,
      SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
    )
    .map_err(|error| format!("SetWindowPos in Progman failed: {error}"))
  }
}

/// Makes the window top-level again, so tao applies the Edit flags to a
/// top-level window. The caller brings it to front after those tao calls.
pub fn detach(window: HWND) -> Result<(), String> {
  unsafe {
    SetParent(window, None).map_err(|error| format!("SetParent to the desktop failed: {error}"))?;
  }
  // Without a parent, WS_CHILD has to go and WS_POPUP comes back.
  set_child_style(window, false);
  Ok(())
}

/// Covers the primary monitor above every window and takes the foreground.
/// Runs after the tao calls of Edit, which rewrite the window styles.
pub fn bring_to_front(window: HWND) -> Result<(), String> {
  let monitor = primary_monitor()?;
  unsafe {
    SetWindowPos(
      window,
      Some(HWND_TOPMOST),
      monitor.left,
      monitor.top,
      monitor.right - monitor.left,
      monitor.bottom - monitor.top,
      SWP_SHOWWINDOW | SWP_FRAMECHANGED,
    )
    .map_err(|error| format!("SetWindowPos for Edit failed: {error}"))?;
    if !SetForegroundWindow(window).as_bool() {
      log::warn!("Edit window did not get the foreground");
    }
  }
  Ok(())
}

/// False once Windows destroyed the window. When Explorer crashes, Windows
/// destroys the child of Progman without sending it WM_DESTROY, so tao and
/// Tauri keep a window whose handle is dead.
pub fn is_alive(window: HWND) -> bool {
  unsafe { IsWindow(Some(window)) }.as_bool()
}

/// True when the window's parent is the current Progman.
pub fn is_embedded(window: HWND) -> bool {
  let Ok(progman) = find_progman() else {
    return false;
  };
  unsafe { GetAncestor(window, GA_PARENT) == progman }
}
