import { Modal } from '../../../components/Modal';
import { useQSEStockData } from '../hooks/useQSEStockData';
import { PositionDetail } from './PositionDetail';

export function PositionModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const { tickerNames } = useQSEStockData();
  return (
    <Modal title={`${ticker}${tickerNames[ticker] ? ' — ' + tickerNames[ticker] : ''}`} onClose={onClose}>
      <PositionDetail ticker={ticker} />
    </Modal>
  );
}
