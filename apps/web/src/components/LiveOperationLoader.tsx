import { lazy, Suspense } from 'react';
import type { CompiledDistribution, DiscoveredAllocation } from '@null-protocol/sdk';
import type { ConfirmedOperation } from '@null-protocol/client';
import type { PaymentNameSnapshot } from '@null-protocol/ens';
import { Modal } from './ui';

const LiveOperation = lazy(() => import('./LiveOperation').then(module => ({ default: module.LiveOperation })));
export type LiveOperationInput = { kind: 'withdraw'; treasury: boolean } | { kind: 'shield'; amountAtomic: bigint } | { kind: 'claim'; allocation: DiscoveredAllocation } | { kind: 'create_distribution'; compiled: CompiledDistribution; paymentNames: PaymentNameSnapshot[] };
export function LiveOperationLoader({ operation, onClose, onConfirmed }: { operation: LiveOperationInput | null; onClose: () => void; onConfirmed?: (result: ConfirmedOperation) => void }) {
  if (!operation) return null;
  return <Suspense fallback={<Modal title="Getting ready" open onClose={onClose}><p className="modal-copy" role="status">Opening your payment…</p></Modal>}><LiveOperation open onClose={onClose} operation={operation} onConfirmed={onConfirmed} /></Suspense>;
}
