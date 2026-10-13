// Check and measurement log shared by the E2E drivers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const RELEASE_LOG = join(process.env.LOCALAPPDATA ?? '', 'com.canvie.app', 'logs', 'Canvie.log')

export class Report {
  constructor(evidenceDir) {
    this.evidenceDir = evidenceDir
    this.results = []
    this.measurements = {}
    mkdirSync(evidenceDir, { recursive: true })
    this.logOffset = existsSync(RELEASE_LOG) ? readFileSync(RELEASE_LOG, 'utf8').length : 0
  }

  check(name, pass, detail = '') {
    this.results.push({ name, pass: Boolean(pass), detail })
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
  }

  measure(name, value) {
    this.measurements[name] = value
    console.log(`INFO  ${name}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
  }

  file(name) {
    return join(this.evidenceDir, name)
  }

  // Release log lines written since the run started. A shorter file means the
  // log plugin rotated it during the run.
  newLogLines() {
    if (!existsSync(RELEASE_LOG)) return []
    const content = readFileSync(RELEASE_LOG, 'utf8')
    return (content.length >= this.logOffset ? content.slice(this.logOffset) : content).split(/\r?\n/).filter(Boolean)
  }

  checkLog(launches) {
    const lines = this.newLogLines()
    const startups = lines.filter((line) => line.includes('Canvie startup')).length
    this.check('release log records one startup per launch', startups === launches, `startups=${startups} launches=${launches}`)
    this.check('release log has no error lines', !lines.some((line) => /\[ERROR\]|panicked/.test(line)))
    return lines
  }

  finish(extra = {}) {
    writeFileSync(this.file('report.json'), JSON.stringify({ ...extra, results: this.results, measurements: this.measurements }, null, 2))
    const failed = this.results.filter((result) => !result.pass)
    console.log(`\n${this.results.length - failed.length}/${this.results.length} checks passed. Evidence: ${this.evidenceDir}`)
    return failed.length === 0 ? 0 : 1
  }
}
