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
      FindWindowW, GetAncestor, GetWindowLongPtrW, SetLayeredWindowAttributes, SetParent, SetWindowLongPtrW, SetWindowPos, GA_PARENT,
      GWL_STYLE, HWND_TOP, LWA_ALPHA, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_SHOWWINDOW, WS_CHILD, WS_POPUP,
    },
  },
};

fn find_progman() -> Result<HWND, String> {
  unsafe { FindWindowW(w!("Progman"), None) }.map_err(|error| format!("Progman not found: {error}"))
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

/// True when the window's parent is the current Progman.
pub fn is_embedded(window: HWND) -> bool {
  let Ok(progman) = find_progman() else {
    return false;
  };
  unsafe { GetAncestor(window, GA_PARENT) == progman }
}
