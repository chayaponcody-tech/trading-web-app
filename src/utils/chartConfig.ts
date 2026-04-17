import { ColorType } from 'lightweight-charts';

/**
 * Shared lightweight-charts config used by all candle charts in the app.
 * Import this instead of duplicating config across pages.
 */
export const CANDLE_CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#848e9c',
  },
  grid: {
    vertLines: { color: '#2b313f' },
    horzLines: { color: '#2b313f' },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 12,
    barSpacing: 8,
    fixLeftEdge: false,
    fixRightEdge: false,
    timeFormatter: (time: number) =>
      new Date(time * 1000).toLocaleString('th-TH', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok',
      }),
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: false,
  },
  handleScale: {
    mouseWheel: true,
    pinch: true,
    axisPressedMouseMove: true,
  },
  rightPriceScale: { autoScale: true },
  autoSize: true,
} as const;

export const CANDLESTICK_SERIES_OPTIONS = {
  upColor: '#0ecb81',
  downColor: '#f6465d',
  borderVisible: false,
  wickUpColor: '#0ecb81',
  wickDownColor: '#f6465d',
} as const;
