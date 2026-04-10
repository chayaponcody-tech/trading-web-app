/**
 * KlineFetcher.js
 * Fetch historical klines with automatic batch pagination.
 */

const BATCH_SIZE = 500;

/**
 * Fetch historical klines with automatic batch pagination.
 * @param {import('../../exchange-connector/src/BinanceAdapter.js').BinanceAdapter} exchange
 * @param {string} symbol
 * @param {string} interval
 * @param {object} options - { startDate, endDate, maxKlines = 1500 }
 * @returns {Promise<Array>} deduplicated klines array sorted by open time ascending
 */
export async function fetchKlines(exchange, symbol, interval, options = {}) {
  const { startDate, endDate, maxKlines = 1500 } = options;

  // No date range: fetch most recent 500 klines
  if (!startDate && !endDate) {
    const klines = await exchange._getPublic().fetchOHLCV(
      symbol.toUpperCase(),
      interval.toLowerCase(),
      undefined,
      BATCH_SIZE
    );
    return klines;
  }

  const startTs = new Date(startDate).getTime();
  const endTs = new Date(endDate).getTime();

  const klinesMap = new Map();
  let since = startTs;

  while (klinesMap.size < maxKlines) {
    const batch = await exchange._getPublic().fetchOHLCV(
      symbol.toUpperCase(),
      interval.toLowerCase(),
      since,
      BATCH_SIZE
    );

    if (!batch || batch.length === 0) break;

    for (const kline of batch) {
      klinesMap.set(kline[0], kline);
    }

    const lastOpenTime = batch[batch.length - 1][0];

    // Stop conditions
    if (lastOpenTime >= endTs) break;
    if (batch.length < BATCH_SIZE) break;
    if (klinesMap.size >= maxKlines) break;

    since = lastOpenTime + 1;
  }

  // Filter out klines after endDate and sort ascending
  const result = Array.from(klinesMap.values())
    .filter(k => k[0] <= endTs)
    .sort((a, b) => a[0] - b[0])
    .slice(0, maxKlines);

  return result;
}
