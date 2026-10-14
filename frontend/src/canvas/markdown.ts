import MarkdownIt from 'markdown-it'

// Raw HTML stays off so user text never becomes markup, and images stay off
// so a note never loads a remote file. Enter breaks the line, as people
// expect in a quick note. See decisions/0007.
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: true }).disable('image')

export function renderMarkdown(text: string): string {
  return markdown.render(text)
}
