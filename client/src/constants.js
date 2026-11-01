export const STATUSES = ['wishlist', 'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted'];

export const LABELS = { oa: 'OA' };
export const label = (s) => LABELS[s] ?? s;
