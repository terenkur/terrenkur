"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SettingsModalProps {
  coeff: number;
  zeroWeight: number;
  acceptVotes: boolean;
  allowEdit: boolean;
  onClose: () => void;
  onSave: (
    coeff: number,
    zeroWeight: number,
    acceptVotes: boolean,
    allowEdit: boolean
  ) => void;
}

export default function SettingsModal({
  coeff,
  zeroWeight,
  acceptVotes,
  allowEdit,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [value, setValue] = useState(coeff);
  const [zero, setZero] = useState(zeroWeight);
  const [accept, setAccept] = useState(acceptVotes);
  const [edit, setEdit] = useState(allowEdit);
  const { t } = useTranslation();

  useEffect(() => {
    setValue(coeff);
    setZero(zeroWeight);
    setAccept(acceptVotes);
    setEdit(allowEdit);
  }, [coeff, zeroWeight, acceptVotes, allowEdit]);

  const handleSave = () => {
    onSave(value, zero, accept, edit);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background text-foreground p-4 rounded space-y-4 shadow-lg">
        <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('settings.voiceCoefficient')}</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            className="border p-1 w-24 text-foreground"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('settings.zeroVoteWeight')}</label>
          <input
            type="number"
            value={zero}
            onChange={(e) => setZero(parseFloat(e.target.value))}
            className="border p-1 w-24 text-foreground"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('settings.acceptVotes')}</label>
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">{t('settings.allowEdit')}</label>
          <input
            type="checkbox"
            checked={edit}
            onChange={(e) => setEdit(e.target.checked)}
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={onClose}>
            {t('settings.cancel')}
          </Button>
          <Button variant="default" onClick={handleSave}>
            {t('settings.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
