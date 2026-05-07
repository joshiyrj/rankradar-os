const buckets = new Map();

export function rateLimit(req, limitPerMinute) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
  const minute = Math.floor(Date.now() / 60000);
  const key = `${ip}:${minute}`;
  const count = buckets.get(key) || 0;
  buckets.set(key, count + 1);
  if (count + 1 > limitPerMinute) {
    return false;
  }
  if (buckets.size > 5000) {
    for (const k of buckets.keys()) {
      if (!k.endsWith(`:${minute}`)) buckets.delete(k);
    }
  }
  return true;
}
