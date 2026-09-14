import type { ReactNode } from "react";
import type { Json } from "@/types/database";

type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

/**
 * Render Tiptap JSON (dari class_materials.content_json) menjadi React node.
 * Mendukung: paragraph, heading (1-3), bulletList, orderedList, listItem,
 * blockquote, horizontalRule, hardBreak, dan marks: bold, italic, underline,
 * strike, code, link. Text align pada paragraph/heading juga didukung.
 */
export function renderTiptap(json: Json | null): ReactNode {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return renderNode(json as TiptapNode, 0);
}

/**
 * Cek apakah content_json benar-benar berisi node (bukan doc kosong).
 */
export function hasTiptapContent(json: Json | null): boolean {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const node = json as TiptapNode;
  return Array.isArray(node.content) && node.content.length > 0;
}

function renderNode(node: TiptapNode | null | undefined, key: number): ReactNode {
  if (!node) return null;

  switch (node.type) {
    case "doc":
      return <>{node.content?.map((c, i) => renderNode(c, i))}</>;

    case "paragraph": {
      const align = node.attrs?.textAlign as
        | "left"
        | "right"
        | "center"
        | "justify"
        | undefined;
      return (
        <p key={key} style={align ? { textAlign: align } : undefined}>
          {node.content?.map((c, i) => renderNode(c, i)) ?? null}
        </p>
      );
    }

    case "heading": {
      const rawLevel = (node.attrs?.level as number) || 1;
      const level = Math.min(Math.max(rawLevel, 1), 3);
      const align = node.attrs?.textAlign as
        | "left"
        | "right"
        | "center"
        | "justify"
        | undefined;
      const style = align ? { textAlign: align } : undefined;
      const children = node.content?.map((c, i) => renderNode(c, i)) ?? null;

      if (level === 1) return <h1 key={key} style={style}>{children}</h1>;
      if (level === 2) return <h2 key={key} style={style}>{children}</h2>;
      return <h3 key={key} style={style}>{children}</h3>;
    }

    case "bulletList":
      return <ul key={key}>{node.content?.map((c, i) => renderNode(c, i))}</ul>;

    case "orderedList":
      return <ol key={key}>{node.content?.map((c, i) => renderNode(c, i))}</ol>;

    case "listItem":
      return <li key={key}>{node.content?.map((c, i) => renderNode(c, i))}</li>;

    case "blockquote":
      return (
        <blockquote key={key}>
          {node.content?.map((c, i) => renderNode(c, i))}
        </blockquote>
      );

    case "horizontalRule":
      return <hr key={key} />;

    case "hardBreak":
      return <br key={key} />;

    case "text":
      return renderText(node, key);

    default:
      // Fallback: render children kalau ada
      if (node.content) {
        return <>{node.content.map((c, i) => renderNode(c, i))}</>;
      }
      return null;
  }
}

function renderText(node: TiptapNode, key: number): ReactNode {
  const text = node.text ?? "";
  const marks = node.marks ?? [];
  if (marks.length === 0) {
    return <span key={key}>{text}</span>;
  }

  let element: ReactNode = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        element = <strong>{element}</strong>;
        break;
      case "italic":
        element = <em>{element}</em>;
        break;
      case "underline":
        element = <u>{element}</u>;
        break;
      case "strike":
        element = <s>{element}</s>;
        break;
      case "code":
        element = (
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.9em]">
            {element}
          </code>
        );
        break;
      case "link": {
        const href = (mark.attrs?.href as string) || "#";
        element = (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 underline"
          >
            {element}
          </a>
        );
        break;
      }
      default:
        break;
    }
  }

  return <span key={key}>{element}</span>;
}