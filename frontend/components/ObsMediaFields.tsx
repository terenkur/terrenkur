"use client";

import { useTranslation } from "react-i18next";

interface MediaValues {
  gif: string;
  sound: string;
  text: string;
}

interface Props {
  prefix: string;
  values: MediaValues;
  onChange: (vals: MediaValues) => void;
}

export default function ObsMediaFields({ prefix, values, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div>
        <label className="block">{t(`${prefix}Gif`)}</label>
        <input
          type="url"
          className="border p-1 w-full text-foreground"
          value={values.gif}
          onChange={(e) => onChange({ ...values, gif: e.target.value })}
        />
      </div>
      <div>
        <label className="block">{t(`${prefix}Sound`)}</label>
        <input
          type="url"
          className="border p-1 w-full text-foreground"
          value={values.sound}
          onChange={(e) => onChange({ ...values, sound: e.target.value })}
        />
      </div>
      <div>
        <label className="block">{t(`${prefix}Text`)}</label>
        <input
          className="border p-1 w-full text-foreground"
          value={values.text}
          onChange={(e) => onChange({ ...values, text: e.target.value })}
        />
      </div>
    </div>
  );
}

