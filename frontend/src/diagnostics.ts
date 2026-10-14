import { invoke, isTauri } from '@tauri-apps/api/core'

// Fixed codes, so the release log never receives canvas content.
export type FrontendIssue = 'save_failed' | 'document_recovered' | 'saving_blocked'

// Copies a failure to the release log; the console keeps the details. A
// failed report only warns, because logging must never get in the way of saving.
export function reportIssue(issue: FrontendIssue): void {
  if (!isTauri()) return
  invoke('report_frontend_issue', { issue }).catch((error: unknown) => console.warn('Canvie: report_frontend_issue failed', error))
}
