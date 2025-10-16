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
        <div className="fixed inset-0 isolate" style={{ zIndex: 999999 }}>
          <div 
            className="absolute inset-0 bg-black" 
            style={{ opacity: 0.7 }}
            onClick={() => setOpen(false)} 
          />
          <div 
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 p-4 border-2 border-blue-400 dark:border-blue-500 rounded-lg shadow-2xl text-sm text-gray-800 dark:text-gray-100" 
            style={{
              minWidth: 250,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflow: 'auto',
              background: '#fff',
              color: '#222',
              ...(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? { background: '#1f2937', color: '#fff' } : {})
            }}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="font-semibold text-blue-600 dark:text-blue-400">{label}</div>
            </div>
            <div className="leading-relaxed mb-4">{explanation}</div>
            <div className="sticky bottom-0 pt-2 bg-white dark:bg-gray-800 text-right">
              <button 
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-md" 
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
