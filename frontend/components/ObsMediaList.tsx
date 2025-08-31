"use client";

import { useTranslation } from "react-i18next";
import ObsMediaFields from "./ObsMediaFields";

export interface MediaItem {
  id?: number;
  gif: string;
  sound: string;
}

interface Props {
  type: string;
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  onRemove?: (id: number) => void;
}

export default function ObsMediaList({ type, items, onChange, onRemove }: Props) {
  const { t } = useTranslation();

  const handleUpdate = (idx: number, vals: MediaItem) => {
    const next = [...items];
    next[idx] = vals;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...items, { gif: "", sound: "" }]);
  };

  const handleRemove = (idx: number) => {
    const next = [...items];
    const [removed] = next.splice(idx, 1);
    onChange(next);
    if (removed?.id && onRemove) onRemove(removed.id);
  };

  return (
    <details className="space-y-2" open>
      <summary className="cursor-pointer text-lg font-semibold">
        {t(`obs${type.charAt(0).toUpperCase()}${type.slice(1)}`)}
      </summary>
      {items.map((vals, idx) => (
        <ObsMediaFields
          key={vals.id ?? idx}
          prefix={type}
          values={vals}
          onChange={(v) => handleUpdate(idx, v)}
          onRemove={() => handleRemove(idx)}
        />
      ))}
      <button
        type="button"
        className="px-2 py-1 bg-purple-600 text-white rounded"
        onClick={handleAdd}
      >
        {t("addMedia")}
      </button>
    </details>
  );
}
