"use client";

import { useState, useEffect } from "react";

interface SettingsModalProps {
  coeff: number;
  onClose: () => void;
  onSave: (value: number) => void;
}

export default function SettingsModal({ coeff, onClose, onSave }: SettingsModalProps) {
  const [value, setValue] = useState(coeff);

  useEffect(() => {
    setValue(coeff);
  }, [coeff]);

  const handleSave = () => {
    onSave(value);
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
