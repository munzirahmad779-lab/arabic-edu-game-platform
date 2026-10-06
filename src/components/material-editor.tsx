"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

type MaterialEditorDict = {
  placeholder: string;
  loading: string;
  bold: string;
  italic: string;
  underline: string;
  h1: string;
  h2: string;
  h3: string;
  bullet: string;
  bullet_title: string;
  numbered: string;
  numbered_title: string;
  quote: string;
  quote_title: string;
  align_right: string;
  align_right_title: string;
  align_center: string;
  align_center_title: string;
  align_left: string;
  align_left_title: string;
  hr: string;
  hr_title: string;
  undo: string;
  undo_title: string;
  redo: string;
  redo_title: string;
};

type MaterialEditorProps = {
  value: string;
  onChange: (value: string) => void;
  me: MaterialEditorDict;
  isRtl?: boolean;
};

const EDITOR_CSS = `
  .material-editor-content .ProseMirror ul {
    list-style-type: disc;
    padding-inline-start: 1.75rem;
    margin: 0.5rem 0;
  }
  .material-editor-content .ProseMirror ul ul {
    list-style-type: circle;
  }
  .material-editor-content .ProseMirror ul ul ul {
    list-style-type: square;
  }
  .material-editor-content .ProseMirror ol {
    list-style-type: decimal;
    padding-inline-start: 1.75rem;
    margin: 0.5rem 0;
  }
  .material-editor-content .ProseMirror li {
    margin: 0.25rem 0;
  }
  .material-editor-content .ProseMirror li > p {
    margin: 0;
  }
  .material-editor-content .ProseMirror blockquote {
    border-inline-start: 3px solid #d4d4d4;
    padding-inline-start: 0.75rem;
    margin: 0.5rem 0;
    color: #525252;
  }
  .material-editor-content .ProseMirror h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0.75rem 0 0.5rem;
  }
  .material-editor-content .ProseMirror h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0.75rem 0 0.5rem;
  }
  .material-editor-content .ProseMirror h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0.75rem 0 0.5rem;
  }
  .material-editor-content .ProseMirror hr {
    border: none;
    border-top: 1px solid #e5e5e5;
    margin: 1rem 0;
  }
  .material-editor-content .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #a3a3a3;
    float: right;
    height: 0;
    pointer-events: none;
  }
`;

export default function MaterialEditor({
  value,
  onChange,
  me,
  isRtl = false,
}: MaterialEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-violet-600 underline",
        },
      }),
      Placeholder.configure({
        placeholder: me.placeholder,
      }),
    ],
    content: value ? safeParse(value) : "",
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
        dir: isRtl ? "rtl" : "ltr",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (value && value !== current) {
      const parsed = safeParse(value);
      if (parsed) {
        editor.commands.setContent(parsed, { emitUpdate: false });
      }
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
        {me.loading}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-300 bg-white">
      <style dangerouslySetInnerHTML={{ __html: EDITOR_CSS }} />
      <Toolbar editor={editor} me={me} isRtl={isRtl} />
      <div className="material-editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function safeParse(value: string): object | string {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function Toolbar({
  editor,
  me,
  isRtl,
}: {
  editor: Editor;
  me: MaterialEditorDict;
  isRtl: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 p-2"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        label="B"
        title={me.bold}
        className="font-bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        label="I"
        title={me.italic}
        className="italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        label="U"
        title={me.underline}
        className="underline"
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        isActive={editor.isActive("heading", { level: 1 })}
        label="H1"
        title={me.h1}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        isActive={editor.isActive("heading", { level: 2 })}
        label="H2"
        title={me.h2}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        isActive={editor.isActive("heading", { level: 3 })}
        label="H3"
        title={me.h3}
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        label={me.bullet}
        title={me.bullet_title}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        label={me.numbered}
        title={me.numbered_title}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        label={me.quote}
        title={me.quote_title}
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        label={me.align_right}
        title={me.align_right_title}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        label={me.align_center}
        title={me.align_center_title}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        label={me.align_left}
        title={me.align_left_title}
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label={me.hr}
        title={me.hr_title}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        label={me.undo}
        title={me.undo_title}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        label={me.redo}
        title={me.redo_title}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  isActive,
  label,
  title,
  className = "",
}: {
  onClick: () => void;
  isActive?: boolean;
  label: string;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm transition ${
        isActive
          ? "bg-violet-600 text-white"
          : "bg-white text-neutral-700 hover:bg-neutral-100"
      } ${className}`}
    >
      {label}
    </button>
  );
}