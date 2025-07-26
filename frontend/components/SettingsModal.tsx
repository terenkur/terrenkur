"use client";

import { useState, useEffect } from "react";

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
      <div className="bg-white dark:bg-gray-800 p-4 rounded space-y-4 shadow-lg">
        <h2 className="text-xl font-semibold">Settings</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm">Voice coefficient:</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            className="border p-1 w-24 text-black"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">Zero vote weight:</label>
          <input
            type="number"
            value={zero}
            onChange={(e) => setZero(parseFloat(e.target.value))}
            className="border p-1 w-24 text-black"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">Accept votes:</label>
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm">Allow edit:</label>
          <input
            type="checkbox"
            checked={edit}
            onChange={(e) => setEdit(e.target.checked)}
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button className="px-2 py-1 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-2 py-1 bg-purple-600 text-white rounded"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
