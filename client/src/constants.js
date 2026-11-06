export const STATUSES = ['wishlist', 'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted'];

const LABELS = { oa: 'OA' };
export const label = (s) => LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

// Stages that still need something from you or the company.
export const ACTIVE = ['applied', 'oa', 'interview'];
