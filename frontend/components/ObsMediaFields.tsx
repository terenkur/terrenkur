"use client";

import { useTranslation } from "react-i18next";

interface MediaValues {
  id?: number;
  gif: string;
  sound: string;
}

interface Props {
  values: MediaValues;
  onChange: (vals: MediaValues) => void;
  onRemove?: () => void;
}

export default function ObsMediaFields({ values, onChange, onRemove }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 border p-2 rounded">
      <div>
        <label className="block">
          {t("gifUrl")}
          <input
            type="url"
            className="border p-1 w-full text-foreground"
            value={values.gif}
            onChange={(e) => onChange({ ...values, gif: e.target.value })}
          />
        </label>
      </div>
      <div>
        <label className="block">
          {t("soundUrl")}
          <input
            type="url"
            className="border p-1 w-full text-foreground"
            value={values.sound}
            onChange={(e) => onChange({ ...values, sound: e.target.value })}
          />
        </label>
      </div>
      {onRemove && (
        <button
          type="button"
          className="px-2 py-1 bg-red-600 text-white rounded"
          onClick={onRemove}
        >
          {t("remove")}
        </button>
      )}
    </div>
  );
}

