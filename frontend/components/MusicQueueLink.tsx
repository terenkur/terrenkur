"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function MusicQueueLink() {
  const { t } = useTranslation();

  return <Link href="/music-queue">{t("musicQueueTitle")}</Link>;
}
