"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * Cangkang formulir buat/ubah permainan.
 *
 * Tombol simpan harus nonaktif selama belum ada soal yang dipilih:
 * selama ini formulir bisa dikirim kosong dan guru hanya menerima
 * spanduk galat mentah sesudahnya. QuestionsPicker melaporkan jumlah
 * soal terpilih lewat konteks ini setiap kali pilihan berubah, dan
 * cangkang menonaktifkan tombol beserta alasan yang terlihat jelas.
 */

type SelectedCountReporter = {
  reportSelectedCount: (count: number) => void;
};

const SelectedCountContext = createContext<SelectedCountReporter | null>(
  null,
);

export function useSelectedCountReporter(): SelectedCountReporter | null {
  return useContext(SelectedCountContext);
}

export function GameFormShell({
  action,
  submitLabel,
  initialSelectedCount = 0,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  initialSelectedCount?: number;
  children: ReactNode;
}) {
  const [selectedCount, setSelectedCount] = useState(initialSelectedCount);
  const noQuestions = selectedCount === 0;

  return (
    <SelectedCountContext.Provider
      value={{ reportSelectedCount: setSelectedCount }}
    >
      <form action={action} className="mt-6 space-y-6">
        {children}

        <div>
          <button
            type="submit"
            disabled={noQuestions}
            className="w-full rounded-full bg-terracotta-500 px-5 py-3 text-sm font-black text-white transition hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
          >
            {submitLabel}
          </button>
          {noQuestions ? (
            <p className="mt-2 text-center text-xs font-bold text-rose-600">
              ⚠️ Pilih minimal 1 soal dari bank soal di atas untuk
              mengaktifkan tombol ini. Permainan tanpa soal tidak dapat
              disimpan.
            </p>
          ) : null}
        </div>
      </form>
    </SelectedCountContext.Provider>
  );
}
