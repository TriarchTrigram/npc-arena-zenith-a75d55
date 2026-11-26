import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseVideoLink, VideoEmbed } from "~stencil/ui/video/embed";
import { cn } from "~/lib/utils";

const remarkPlugins = [remarkGfm];

const components: Components = {
  // A paragraph that is only a pasted video link plays in the page instead of linking out.
  p({ node, children, ...props }) {
    const only = node?.children.length === 1 ? node.children[0] : undefined;
    const href = only?.type === "element" && only.tagName === "a" ? String(only.properties.href ?? "") : "";
    const link = href ? parseVideoLink(href) : null;
    if (link && !link.maybeFile) return <VideoEmbed url={href} className="not-prose my-4" />;
    return <p {...props}>{children}</p>;
  },
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
