"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

type MaterialEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function MaterialEditor({
  value,
  onChange,
  placeholder = "اكتب محتوى المادة هنا...",
}: MaterialEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
        placeholder,
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
        dir: "rtl",
      },
    },
    immediatelyRender: false,
  });

  // Sinkronisasi kalau value dari luar berubah (mis. saat edit materi lama)
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
        جاري تحميل المحرر...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-300 bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
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

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 p-2"
      dir="rtl"
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        label="B"
        title="غامق"
        className="font-bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        label="I"
        title="مائل"
        className="italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        label="U"
        title="تحته خط"
        className="underline"
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        isActive={editor.isActive("heading", { level: 1 })}
        label="H1"
        title="عنوان 1"
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        isActive={editor.isActive("heading", { level: 2 })}
        label="H2"
        title="عنوان 2"
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        isActive={editor.isActive("heading", { level: 3 })}
        label="H3"
        title="عنوان 3"
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        label="• قائمة"
        title="قائمة نقطية"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        label="1. قائمة"
        title="قائمة رقمية"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        label="❝"
        title="اقتباس"
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        label="⬅"
        title="محاذاة يمين"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        label="⬌"
        title="توسيط"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        label="➡"
        title="محاذاة يسار"
      />

      <div className="mx-1 h-6 w-px bg-neutral-300" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="―"
        title="خط فاصل"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        label="↶"
        title="تراجع"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        label="↷"
        title="إعادة"
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