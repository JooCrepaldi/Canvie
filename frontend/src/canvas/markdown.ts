import MarkdownIt from 'markdown-it'

// Raw HTML stays off so user text never becomes markup, and images stay off
// so a note never loads a remote file. See decisions/0007.
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).disable('image')

export function renderMarkdown(text: string): string {
  return markdown.render(text)
}
