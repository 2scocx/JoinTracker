import React, { useState } from 'react';

export default function InfoButton({ explanation, label = 'Info', className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={"relative inline-block align-middle " + className}>
      <button
        type="button"
        aria-label={label}
        className="ml-2 w-5 h-5 rounded-full bg-blue-100 text-blue-600 border border-blue-300 flex items-center justify-center text-xs font-bold hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        onClick={() => setOpen(o => !o)}
        tabIndex={0}
      >
        i
      </button>
      {open && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded shadow-lg text-xs text-gray-800 dark:text-gray-100" style={{minWidth:200}}>
          <div className="mb-1 font-semibold text-blue-600">{label}</div>
          <div>{explanation}</div>
          <button className="mt-2 text-xs text-blue-500 underline" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </span>
  );
}
