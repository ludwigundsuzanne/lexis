import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ className: 'i', viewBox: '0 0 24 24', 'aria-hidden': true, ...p });

export const IconBook = (p: P) => (
  <svg {...base(p)}><path d="M12 6.5C9.5 4.5 6 4.5 3 5.5V19c3-1 6.5-1 9 1 2.5-2 6-2 9-1V5.5c-3-1-6.5-1-9 1ZM12 6.5V20" /></svg>
);
export const IconLexicon = (p: P) => (
  <svg {...base(p)}><path d="M5 3h11l3 3v15H5Z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
);
export const IconProgress = (p: P) => (
  <svg {...base(p)}><path d="M3 20h18" /><path d="M5 16l5-5 4 3 6-7" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="M4 12.5 9.5 18 20 6" /></svg>
);
export const IconWarn = (p: P) => (
  <svg {...base(p)}><path d="M12 3 22 20H2Z" /><path d="M12 10v4M12 16.5v1" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}><path d="M15 5 8 12l7 7" /></svg>
);
export const IconQuill = (p: P) => (
  <svg {...base(p)}><path d="M20 3C12 5 7 11 6 19" /><path d="M20 3c0 8-5 12-11 12" /><path d="M4 21l2-2" /></svg>
);
