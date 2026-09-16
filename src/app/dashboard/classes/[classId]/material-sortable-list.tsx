"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { materialAction, reorderMaterials } from "./material-actions";

type Material = {
  id: string;
  title: string;
  is_published: boolean;
  position: number;
  created_at: string;
  has_youtube: boolean;
  has_image: boolean;
  has_pdf: boolean;
};

export function MaterialSortableList({
  materials: initial,
  classId,
}: {
  materials: Material[];
  classId: string;
}) {
  const [materials, setMaterials] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = materials.findIndex((m) => m.id === active.id);
    const newIndex = materials.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(materials, oldIndex, newIndex);
    setMaterials(reordered);
    setSaving(true);
    setSavedMsg(null);

    try {
      const res = await reorderMaterials(
        classId,
        reordered.map((m) => m.id),
      );
      if (res.ok) {
        setSavedMsg("✓ تم حفظ الترتيب");
        window.setTimeout(() => setSavedMsg(null), 2500);
      } else {
        setSavedMsg(`⚠️ ${res.message}`);
        setMaterials(initial);
      }
    } catch {
      setSavedMsg("⚠️ تعذر الاتصال");
      setMaterials(initial);
    } finally {
      setSaving(false);
    }
  }

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <div className="text-4xl">📖</div>
        <p className="mt-3 font-bold text-neutral-700">
          لا توجد مواد دراسية بعد
        </p>
        <Link
          href={`/dashboard/classes/${classId}?add_material=1`}
          className="mt-4 inline-flex rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
        >
          إضافة أول مادة
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {saving || savedMsg ? (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
            saving
              ? "border-blue-200 bg-blue-50 text-blue-800"
              : savedMsg?.startsWith("✓")
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {saving ? "💾 جاري حفظ الترتيب..." : savedMsg}
        </div>
      ) : null}

      <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        💡 اسحب البطاقة من أيقونة ⋮⋮ لإعادة ترتيب المواد.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <SortableContext
          items={materials.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {materials.map((material, index) => (
              <SortableItem
                key={material.id}
                material={material}
                index={index}
                classId={classId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableItem({
  material,
  index,
  classId,
}: {
  material: Material;
  index: number;
  classId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: material.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${
        isDragging ? "border-violet-400 shadow-lg" : "border-neutral-200"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
          title="اسحب لإعادة الترتيب"
          aria-label="اسحب لإعادة الترتيب"
        >
          ⋮⋮
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
          {index + 1}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-bold text-neutral-900">
              {material.title}
            </div>
            {material.is_published ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                منشورة
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                مسودة
              </span>
            )}
            {material.has_youtube ? (
              <span
                className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700"
                title="يحتوي فيديو يوتيوب"
              >
                🎬
              </span>
            ) : null}
            {material.has_image ? (
              <span
                className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700"
                title="يحتوي صورة"
              >
                🖼️
              </span>
            ) : null}
            {material.has_pdf ? (
              <span
                className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700"
                title="يحتوي PDF"
              >
                📄
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {new Date(material.created_at).toISOString().slice(0, 10)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dashboard/classes/${classId}/preview/${material.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
          title="معاينة كطالب"
        >
          👁️ معاينة
        </Link>

        <Link
          href={`/dashboard/classes/${classId}?edit_material=${material.id}`}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-bold hover:bg-neutral-50"
        >
          تعديل
        </Link>

        <form action={materialAction}>
          <input type="hidden" name="action" value="toggle_publish" />
          <input type="hidden" name="material_id" value={material.id} />
          <input type="hidden" name="class_id" value={classId} />
          <input
            type="hidden"
            name="current_published"
            value={material.is_published ? "true" : "false"}
          />
          <button
            type="submit"
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              material.is_published
                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {material.is_published ? "إلغاء النشر" : "نشر"}
          </button>
        </form>

        <form action={materialAction}>
          <input type="hidden" name="action" value="delete" />
          <input type="hidden" name="material_id" value={material.id} />
          <input type="hidden" name="class_id" value={classId} />
          <button
            type="submit"
            onClick={(e) => {
              if (!window.confirm(`حذف "${material.title}"؟`)) {
                e.preventDefault();
              }
            }}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            حذف
          </button>
        </form>
      </div>
    </div>
  );
}