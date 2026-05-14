import React from 'react';

export default function Pagination({ page, totalPages, onPageChange, totalItems, limit }) {
  if (!totalPages || totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalItems);

  // Build page window: first, last, and up to 5 around current
  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    }
  }

  // Insert ellipsis markers
  const pageButtons = [];
  let prev = null;
  for (const p of pages) {
    if (prev !== null && p - prev > 1) {
      pageButtons.push({ type: 'ellipsis', key: `e${p}` });
    }
    pageButtons.push({ type: 'page', value: p, key: `p${p}` });
    prev = p;
  }

  return (
    <div className="pagination-wrapper">
      <div className="pagination-info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalItems}</strong>
      </div>
      <div className="pagination-controls">
        <button
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          &laquo; Prev
        </button>
        {pageButtons.map(btn =>
          btn.type === 'ellipsis'
            ? <span key={btn.key} className="pagination-ellipsis">&hellip;</span>
            : (
              <button
                key={btn.key}
                className={`btn btn-sm ${btn.value === page ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onPageChange(btn.value)}
                disabled={btn.value === page}
              >
                {btn.value}
              </button>
            )
        )}
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next &raquo;
        </button>
      </div>
    </div>
  );
}
