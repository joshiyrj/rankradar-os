import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPct(decimal) {
  if (decimal === null || decimal === undefined) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

export function rankBucket(organic_rank) {
  if (organic_rank === null || organic_rank === undefined) return 'not_ranking';
  if (organic_rank <= 3) return 'excellent';
  if (organic_rank <= 10) return 'strong';
  if (organic_rank <= 20) return 'near_top10';
  if (organic_rank <= 50) return 'weak';
  return 'poor';
}

export const RANK_BUCKET_LABELS = {
  excellent:   '1–3 (Excellent)',
  strong:      '4–10 (Top 10)',
  near_top10:  '11–20 (Near Top 10)',
  weak:        '21–50 (Weak)',
  poor:        '51+ (Poor)',
  not_ranking: 'Not Ranking',
};

export function formatRank(rank) {
  if (rank === null || rank === undefined) return 'NR';
  return `#${rank}`;
}

export function formatSV(sv) {
  if (sv === null || sv === undefined) return '—';
  if (sv >= 1_000_000) return `${(sv / 1_000_000).toFixed(1)}M`;
  if (sv >= 1_000) return `${(sv / 1_000).toFixed(1)}K`;
  return `${sv}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
