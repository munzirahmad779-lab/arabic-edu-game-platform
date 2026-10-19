"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DEFAULT_STANDALONE_QUESTIONS,
  type StandaloneQuestion,
} from "@/modules/souq-fishing/standalone/data/default-questions";
import { TEAM_LANE_OFFSETS } from "@/modules/souq-fishing/standalone/engine";
import type {
  StandaloneRoomState,
  TeamColor,
} from "@/modules/souq-fishing/standalone/types";

const STORAGE_KEY = "souq_fishing_standalone_questions_v1";

export default function SouqFishingTeacherPanel() {
  const [activeTab, setActiveTab] = useState<"questions" | "rooms" | "monitor">("rooms");

  // --- TAB 1: BANK SOAL MANDIRI ---
  const [questions, setQuestions] = useState<StandaloneQuestion[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }
    }
    return DEFAULT_STANDALONE_QUESTIONS;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<StandaloneQuestion>>({
    category: "arab",
    question_text: "",
    difficulty: "medium",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "A",
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");

  // Save questions to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
    }
  }, [questions]);

  // --- TAB 2: ROOM MANAGEMENT ---
  const [roomCode, setRoomCode] = useState("SOUQ01");
  const [gameMode, setGameMode] = useState<"proyektor_4team" | "proyektor_individu" | "siswa_mandiri">("proyektor_4team");
  const [createdRooms, setCreatedRooms] = useState<string[]>(["SOUQ01"]);

  // --- TAB 3: LIVE MONITORING ---
  const [monitoredRoom, setMonitoredRoom] = useState<StandaloneRoomState | null>(null);

  const fetchMonitoredRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/souq-fishing/session?roomCode=${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          setMonitoredRoom(data.room);
        }
      }
    } catch {
      // ignore
    }
  }, [roomCode]);

  useEffect(() => {
    if (activeTab === "monitor") {
      fetchMonitoredRoom();
      const interval = setInterval(fetchMonitoredRoom, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchMonitoredRoom]);

  // Question Form Submit
  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim() || !formData.option_a?.trim()) return;

    if (editingId) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingId
            ? ({
                ...q,
                ...formData,
              } as StandaloneQuestion)
            : q
        )
      );
      setEditingId(null);
    } else {
      const newQ: StandaloneQuestion = {
        id: `q-${Date.now()}`,
        category: formData.category || "arab",
        question_text: formData.question_text.trim(),
        difficulty: formData.difficulty || "medium",
        option_a: formData.option_a.trim(),
        option_b: formData.option_b?.trim() || "",
        option_c: formData.option_c?.trim() || "",
        option_d: formData.option_d?.trim() || "",
        correct_option: formData.correct_option || "A",
      };
      setQuestions((prev) => [newQ, ...prev]);
    }

    setFormData({
      category: "arab",
      question_text: "",
      difficulty: "medium",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_option: "A",
    });
  };

  const handleEditClick = (q: StandaloneQuestion) => {
    setEditingId(q.id);
    setFormData(q);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteClick = (id: string) => {
    if (confirm("Hapus soal ini?")) {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    }
  };

  const handleResetDefaultQuestions = () => {
    if (confirm("Muat ulang 20 soal bawaan paket lengkap (Arab, Lontara, Pesantren)?")) {
      setQuestions(DEFAULT_STANDALONE_QUESTIONS);
    }
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuestions((prev) => [...parsed, ...prev]);
        setShowImportModal(false);
        setImportJsonText("");
        alert(`Berhasil mengimpor ${parsed.length} soal!`);
      } else {
        alert("Format JSON harus berupa array objek soal.");
      }
    } catch {
      alert("Format JSON tidak valid. Pastikan tanda kurung siku dan koma benar.");
    }
  };

  // Create Room
  const handleCreateRoom = async () => {
    const code = roomCode.trim().toUpperCase() || "SOUQ01";
    // Sync current questions to API
    await fetch("/api/souq-fishing/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_QUESTIONS",
        roomCode: code,
        payload: { questions },
      }),
    });

    if (!createdRooms.includes(code)) {
      setCreatedRooms((prev) => [...prev, code]);
    }
    setActiveTab("rooms");
  };

  // Helper unlock gate
  const handleTeacherUnlock = async (team: TeamColor) => {
    await fetch("/api/souq-fishing/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TEACHER_UNLOCK",
        roomCode,
        payload: { team },
      }),
    });
    fetchMonitoredRoom();
  };

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto bg-slate-950 text-white flex flex-col select-none">
      {/* Top Navbar Panel */}
      <header className="bg-slate-900 border-b border-amber-400/50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-teal-600 flex items-center justify-center text-xl shadow-lg border border-white/20">
            🎣
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-tight">
                Panel Kendali Souq & Dermaga Pancing
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-400/40">
                MODUL MANDIRI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Kelola Soal Mandiri • Buka Proyektor Fullscreen • Pantau Siswa Real-Time
            </p>
          </div>
        </div>

        {/* 3 Main Tab Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === "rooms"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🎮</span>
            <span>Buat Room & Sesi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === "questions"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>📝</span>
            <span>Bank Soal Mandiri ({questions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monitor")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === "monitor"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>📊</span>
            <span>Live Monitor Guru</span>
          </button>
        </div>

        {/* Back to Magguru Games Dashboard */}
        <Link
          href="/dashboard/games"
          className="text-xs font-bold text-slate-400 hover:text-amber-300 transition flex items-center gap-1.5"
        >
          <span>✕</span>
          <span>Kembali ke Dashboard Magguru</span>
        </Link>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* TAB 2: BUAT ROOM & KENDALI SESI */}
        {/* ========================================================================= */}
        {activeTab === "rooms" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider">
                  Siap Dimainkan di Kelas
                </span>
                <h2 className="text-2xl font-black text-white">
                  Mulai Petualangan 4 Tim di Layar Proyektor!
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Buka layar proyektor di papan tulis/smartboard kelas, lalu bagikan kode room kepada santri/siswa agar mereka bisa menghubungkan HP sebagai joystick nirkabel.
                </p>
              </div>

              {/* Form Input Room Code */}
              <div className="w-full md:w-auto bg-slate-950/80 p-5 rounded-2xl border border-white/10 space-y-3">
                <label className="block text-xs font-bold text-slate-300">
                  Kode Room (4-6 Karakter):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="w-36 px-3.5 py-2.5 rounded-xl bg-slate-900 border-2 border-amber-400 text-center font-mono font-black text-lg text-amber-300 tracking-widest outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition active:scale-95"
                  >
                    Set Room
                  </button>
                </div>
              </div>
            </div>

            {/* Pilihan Mode Permainan */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                Pilih Mode Permainan:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    id: "proyektor_4team",
                    icon: "📽️",
                    title: "Mode Proyektor 4 Tim",
                    desc: "Siswa bergabung ke Tim Merah, Biru, Kuning, atau Hijau. Layar proyektor menampilkan peta 2D dan 4 meja tim dengan Active Tilt.",
                  },
                  {
                    id: "proyektor_individu",
                    icon: "👤",
                    title: "Mode Proyektor Individu",
                    desc: "Setiap siswa memiliki skor masing-masing yang ditampilkan di papan klasemen proyektor.",
                  },
                  {
                    id: "siswa_mandiri",
                    icon: "📱",
                    title: "Mode Siswa Mandiri",
                    desc: "Siswa bermain langsung di HP masing-masing dengan kecepatan sendiri (self-paced) untuk latihan mandiri.",
                  },
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setGameMode(m.id as typeof gameMode)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                      gameMode === m.id
                        ? "bg-amber-500/10 border-amber-400 shadow-lg scale-[1.01]"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-2xl mb-2">{m.icon}</div>
                    <div className="text-sm font-black text-white">{m.title}</div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Aksi Luncurkan Game (2 Tombol Raksasa) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tombol 1: Buka Proyektor Fullscreen */}
              <a
                href={`/souq-fishing/projector/${roomCode}`}
                target="_blank"
                rel="noreferrer"
                className="p-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-2 border-emerald-300 text-white shadow-2xl flex items-center justify-between group transition active:scale-98"
              >
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-emerald-200">
                    Layar Utama Kelas
                  </div>
                  <div className="text-xl font-black flex items-center gap-2">
                    <span>🖥️ Buka Layar Proyektor Fullscreen</span>
                  </div>
                  <p className="text-xs text-emerald-100/80">
                    Rute: /souq-fishing/projector/{roomCode} (Buka di jendela baru untuk proyektor)
                  </p>
                </div>
                <span className="text-3xl group-hover:translate-x-1 transition">➔</span>
              </a>

              {/* Tombol 2: Buka Kontroler HP Siswa */}
              <a
                href={`/souq-fishing/play/${roomCode}`}
                target="_blank"
                rel="noreferrer"
                className="p-6 rounded-3xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 border-2 border-yellow-300 text-slate-950 shadow-2xl flex items-center justify-between group transition active:scale-98"
              >
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-950 opacity-80">
                    Remote Joystick Siswa
                  </div>
                  <div className="text-xl font-black flex items-center gap-2">
                    <span>📱 Buka Kontroler HP Siswa</span>
                  </div>
                  <p className="text-xs text-slate-950/80">
                    Rute: /souq-fishing/play/{roomCode} (Bagikan ke HP santri)
                  </p>
                </div>
                <span className="text-3xl group-hover:translate-x-1 transition">➔</span>
              </a>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: KELOLA BANK SOAL MANDIRI */}
        {/* ========================================================================= */}
        {activeTab === "questions" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Header Bank Soal */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-5 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>📝 Bank Soal Mandiri Souq & Fishing</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                    {questions.length} Soal Tersedia
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Mendukung Bahasa Indonesia, Bahasa Arab berharakat, dan Aksara Bugis Lontara.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaultQuestions}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-amber-400/30 transition"
                >
                  Muat Ulang Paket 20 Soal Bawaan
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-slate-950 shadow-md transition"
                >
                  Import JSON / Teks
                </button>
              </div>
            </div>

            {/* Form Tambah / Edit Soal */}
            <form
              onSubmit={handleSaveQuestion}
              className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                  {editingId ? "✏️ Edit Soal" : "➕ Tambah Soal Pilihan Ganda Baru"}
                </h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({
                        category: "arab",
                        question_text: "",
                        difficulty: "medium",
                        option_a: "",
                        option_b: "",
                        option_c: "",
                        option_d: "",
                        correct_option: "A",
                      });
                    }}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Kategori Soal:
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as StandaloneQuestion["category"] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                  >
                    <option value="arab">Bahasa Arab & Mufradat (سُوقٌ)</option>
                    <option value="lontara">Aksara Bugis Lontara (ᨅᨒᨙ)</option>
                    <option value="pesantren">Fiqih Muamalah & Pesantren</option>
                    <option value="umum">Pengetahuan Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tingkat Kesulitan:
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as StandaloneQuestion["difficulty"] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                  >
                    <option value="easy">Mudah (Easy)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="hard">Tinggi (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Kunci Jawaban Benar:
                  </label>
                  <select
                    value={formData.correct_option}
                    onChange={(e) => setFormData({ ...formData, correct_option: e.target.value as "A" | "B" | "C" | "D" })}
                    className="w-full px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm"
                  >
                    <option value="A">Pilihan A</option>
                    <option value="B">Pilihan B</option>
                    <option value="C">Pilihan C</option>
                    <option value="D">Pilihan D</option>
                  </select>
                </div>
              </div>

              {/* Teks Pertanyaan */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Teks Pertanyaan (Mendukung Arab berharakat & Aksara Lontara):
                </label>
                <textarea
                  required
                  rows={2}
                  dir="auto"
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  placeholder="Contoh: Apa arti dari mufradat « سُوقٌ » atau aksara « ᨅᨒᨙ »?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
                />
              </div>

              {/* 4 Pilihan Jawaban */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(["A", "B", "C", "D"] as const).map((opt) => {
                  const fieldKey =
                    opt === "A" ? "option_a" : opt === "B" ? "option_b" : opt === "C" ? "option_c" : "option_d";

                  return (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-slate-800 text-amber-300 font-black text-xs flex items-center justify-center shrink-0">
                        {opt}
                      </span>
                      <input
                        type="text"
                        required
                        dir="auto"
                        value={formData[fieldKey] || ""}
                        onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
                        placeholder={`Teks Pilihan ${opt}`}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-amber-400 outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition active:scale-95"
                >
                  {editingId ? "Simpan Perubahan Soal" : "Tambahkan Soal ke Bank Soal"}
                </button>
              </div>
            </form>

            {/* Daftar Soal Mandiri */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
                Daftar Soal Aktif ({questions.length})
              </h3>
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase font-black">
                          {q.category}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold">
                          Kunci: {q.correct_option}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white" dir="auto">
                        {q.question_text}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-400 pt-1">
                        <div>A: {q.option_a}</div>
                        <div>B: {q.option_b}</div>
                        <div>C: {q.option_c}</div>
                        <div>D: {q.option_d}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditClick(q)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(q.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-xs font-bold text-rose-300"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LIVE MONITORING GURU */}
        {/* ========================================================================= */}
        {activeTab === "monitor" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Top 4 Team Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["MERAH", "BIRU", "KUNING", "HIJAU"] as const).map((col) => {
                const tm = monitoredRoom?.teams[col];
                const lane = TEAM_LANE_OFFSETS[col];

                return (
                  <div
                    key={col}
                    className="p-4 rounded-2xl bg-slate-900 border-2 border-slate-800 space-y-3 shadow-xl relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white uppercase tracking-wider"
                        style={{ backgroundColor: lane.colorHex }}
                      >
                        {lane.label}
                      </span>
                      <span className="font-mono text-sm font-black text-amber-300">
                        ⭐ {tm?.points || 0}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-slate-400">
                        Lokasi: <strong className="text-white">{tm?.location || "START"}</strong>
                      </div>
                      <div className="text-slate-400">
                        Status: <strong className="text-emerald-400">{tm?.status || "IDLE"}</strong>
                      </div>
                      <div className="text-slate-400">
                        Pin Gembok: <strong className="text-amber-300">{tm?.pinsUnlocked || 0}/4</strong>
                      </div>
                      <div className="text-slate-400">
                        Tangkapan Ikan: <strong className="text-sky-300">{tm?.fishCatches?.length || 0} Ikan</strong>
                      </div>
                    </div>

                    {/* Tombol Bantu Buka Gerbang */}
                    <button
                      type="button"
                      onClick={() => handleTeacherUnlock(col)}
                      className="w-full py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 text-[11px] font-black transition"
                    >
                      🔓 Bantu Buka Pin Gerbang
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Students Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider">
                  Daftar Santri / Siswa Aktif Terhubung ({monitoredRoom?.students?.length || 0})
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Room: {roomCode} • Auto-refresh 1000ms
                </span>
              </div>

              {monitoredRoom?.students && monitoredRoom.students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Nama Siswa</th>
                        <th className="p-3">Tim</th>
                        <th className="p-3">Karakter</th>
                        <th className="p-3">Soal Terjawab</th>
                        <th className="p-3">Akurasi</th>
                        <th className="p-3">Aksi Guru</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {monitoredRoom.students.map((st, idx) => {
                        const acc =
                          st.totalQAnswered > 0
                            ? Math.round((st.correctCount / st.totalQAnswered) * 100)
                            : 0;
                        return (
                          <tr key={st.id || idx} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono text-slate-500">#{idx + 1}</td>
                            <td className="p-3 font-bold text-white">{st.name}</td>
                            <td className="p-3">
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                                style={{ backgroundColor: TEAM_LANE_OFFSETS[st.team]?.colorHex }}
                              >
                                {st.team}
                              </span>
                            </td>
                            <td className="p-3 text-slate-300">{st.character}</td>
                            <td className="p-3 font-mono text-amber-300">
                              {st.correctCount} / {st.totalQAnswered}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{acc}%</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => handleTeacherUnlock(st.team)}
                                className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold"
                              >
                                Bantu Gerbang
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Belum ada siswa yang bergabung di room ini. Bagikan link kontroler{" "}
                  <strong className="text-amber-300">/souq-fishing/play/{roomCode}</strong> ke siswa!
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Import JSON */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-black text-amber-300">Import Soal JSON</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Tutup
              </button>
            </div>
            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='[{"category":"arab","question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A"}]'
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-white outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs"
              >
                Simpan & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
