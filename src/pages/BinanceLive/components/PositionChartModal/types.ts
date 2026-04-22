import { API } from '../../types';

export interface ChartProps {
  symbol: string;
  interval: string;
  entryPrice: number;
  entryTime: string | number;
  type: string;
  reason: string;
  strategy: string;
  gridUpper?: number;
  gridLower?: number;
  tp?: number;
  sl?: number;
  onClose: () => void;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
