import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import shell from "highlight.js/lib/languages/shell";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("sh", shell);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);

export class MarkdownRenderer {
  private readonly markdown: MarkdownIt;

  public constructor(allowHtml: boolean) {
    this.markdown = new MarkdownIt({
      html: allowHtml,
      linkify: true,
      typographer: true,
      highlight: (source, language) => this.highlightCode(source, language)
    }).use(taskLists, { enabled: true });
  }

  public render(source: string): string {
    return this.markdown.render(source);
  }

  private highlightCode(source: string, language: string): string {
    if (language.length > 0 && hljs.getLanguage(language) !== undefined) {
      const highlighted = hljs.highlight(source, { language, ignoreIllegals: true }).value;
      return `<pre class="hljs"><code>${highlighted}</code></pre>`;
    }

    return `<pre class="hljs"><code>${this.markdown.utils.escapeHtml(source)}</code></pre>`;
  }
}
