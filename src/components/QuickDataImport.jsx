import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function QuickDataImport({ onImport, onCancel }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [days, setDays] = useState('');
  const [jointsPerDay, setJointsPerDay] = useState('');
  const [weight, setWeight] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [kind, setKind] = useState('nug');

  const handleImport = () => {
    const endDate = new Date();
    const entries = [];
    
    // Generate entries for each day
    for (let i = 0; i < days; i++) {
      // For each joint per day
      for (let j = 0; j < jointsPerDay; j++) {
        const date = new Date();
        date.setDate(endDate.getDate() - i);
        date.setHours(Math.floor(Math.random() * 24));
        date.setMinutes(Math.floor(Math.random() * 60));
        
        entries.push({
          id: uuidv4(),
          createdAt: date.toISOString(),
          weight,
          price: +(weight * pricePerGram), // ensure it's a number
          kind,
          note: 'Imported historical data'
        });
      }
    }
    // Set the last entry's timestamp to now
    if (entries.length > 0) {
      entries[0].createdAt = new Date().toISOString();
    }
    
    onImport(entries);
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full px-3 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Quick Data Import
      </button>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-700">
      <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3">
        Import Historical Data
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1">
            Past Days
          </label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full border border-purple-200 dark:border-purple-700 rounded px-2 py-1 text-sm"
            min="1"
            max="90"
          />
        </div>
        
        <div>
          <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1">
            Joints per Day
          </label>
          <input
            type="number"
            value={jointsPerDay}
            onChange={(e) => setJointsPerDay(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full border border-purple-200 dark:border-purple-700 rounded px-2 py-1 text-sm"
            min="1"
            max="20"
          />
        </div>

        <div>
          <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1">
            Weight Each (g)
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            className="w-full border border-purple-200 dark:border-purple-700 rounded px-2 py-1 text-sm"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1">
            Price per Gram
          </label>
          <input
            type="number"
            value={pricePerGram}
            onChange={(e) => setPricePerGram(parseFloat(e.target.value) || 0)}
            className="w-full border border-purple-200 dark:border-purple-700 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1">
          Kind
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-full border border-purple-200 dark:border-purple-700 rounded px-2 py-1 text-sm"
        >
          <option value="nug">Herb</option>
          <option value="hash">Hash</option>
          <option value="wax">Wax</option>
        </select>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={() => setIsExpanded(false)}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          className="px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded"
        >
          Import Data
        </button>
      </div>

      <div className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-2">
        This will add {days * jointsPerDay} entries spread over the last {days} days.
        You can remove imported data later using the "Clear Imported Data" option.
      </div>
    </div>
  );
}