import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n/server";
import { TOPIC_DATA_REGISTRY } from "./practice-data";
import { PracticePlayer } from "./practice-player";

export async function generateMetadata({
  params,
}: {
  params: { topicId: string };
}) {
  const topic = TOPIC_DATA_REGISTRY[params.topicId];
  if (!topic) return { title: "Latihan Mandiri - Magguru" };
  return {
    title: `${topic.title} (${topic.titleAr}) - Latihan Mandiri Magguru`,
    description: topic.desc,
  };
}

export default async function TopicPracticePage({
  params,
}: {
  params: { topicId: string };
}) {
  const topic = TOPIC_DATA_REGISTRY[params.topicId];
  if (!topic) {
    notFound();
  }

  const locale = await getLocale();
  const isRtl = locale === "ar";

  return <PracticePlayer topic={topic} isRtl={isRtl} />;
}
