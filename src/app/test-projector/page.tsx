import { ProjectorScreen } from "../dashboard/games/[gameId]/projector/projector-screen";
import type { RawQuestion } from "@/lib/game-engine/types";

export const metadata = {
  title: "Test Visual & F12 Projector Screen",
};

const MOCK_QUESTIONS: RawQuestion[] = [
  {
    id: "q-1",
    position: 0,
    question_text: "مَا هَذَا؟ (Apa ini?) — كِتَابٌ (Buku)",
    difficulty: "easy",
    correct_option_key: "A",
    explanation: "كِتَابٌ artinya adalah Buku dalam bahasa Arab.",
    options: [
      { id: "opt-1", option_key: "A", option_text: "Buku (كِتَابٌ)" },
      { id: "opt-2", option_key: "B", option_text: "Pena (قَلَمٌ)" },
      { id: "opt-3", option_key: "C", option_text: "Meja (مَكْتَبٌ)" },
      { id: "opt-4", option_key: "D", option_text: "Kursi (كُرْسِيٌّ)" },
    ],
  },
  {
    id: "q-2",
    position: 1,
    question_text: "أَيْنَ تَدْرُسُ؟ (Di mana kamu belajar?)",
    difficulty: "medium",
    correct_option_key: "B",
    explanation: "فِي الْمَدْرَسَةِ artinya di sekolah.",
    options: [
      { id: "opt-5", option_key: "A", option_text: "فِي الْبَيْتِ (Di Rumah)" },
      { id: "opt-6", option_key: "B", option_text: "فِي الْمَدْرَسَةِ (Di Sekolah)" },
      { id: "opt-7", option_key: "C", option_text: "فِي السُّوْقِ (Di Pasar)" },
      { id: "opt-8", option_key: "D", option_text: "فِي الْمَسْجِدِ (Di Masjid)" },
    ],
  },
];

// Mock 30 students matching Kelas Mangkoso
const MOCK_MANGKOSO_STUDENTS = [
  "Ahmad Yusuf", "Fatimah Azzahra", "Muhammad Ali", "Siti Aisyah", "Umar bin Khattab",
  "Khadijah", "Hamzah", "Bilal bin Rabah", "Zainab", "Utsman bin Affan",
  "Ali bin Abi Thalib", "Ruqayyah", "Ummu Kultsum", "Hasan", "Husain",
  "Abdullah", "Ibrahim", "Tariq", "Zaid", "Usamah",
  "Khalid", "Amr", "Sa'ad", "Sa'id", "Thalhah",
  "Zubair", "Abdurrahman", "Abu Ubaidah", "Salman", "Mu'adz"
].map((name, i) => ({
  id: `std-${i + 1}`,
  name,
  class_id: "cls-mangkoso",
  class_name: "Kelas Mangkoso",
}));

const MOCK_CLASSES = [
  { id: "cls-mangkoso", name: "Kelas Mangkoso (30 Siswa)", subject: "Bahasa Arab" },
  { id: "cls-b", name: "Kelas 7B", subject: "Bahasa Arab" },
];

export default function TestProjectorPage() {
  return (
    <ProjectorScreen
      gameId="test-game-123"
      gameName="Latihan Bahasa Arab Interaktif (Proyektor Kelas)"
      initialGameType="penalty"
      questions={MOCK_QUESTIONS}
      allStudents={MOCK_MANGKOSO_STUDENTS}
      teacherClasses={MOCK_CLASSES}
      defaultClassId="cls-mangkoso"
    />
  );
}
