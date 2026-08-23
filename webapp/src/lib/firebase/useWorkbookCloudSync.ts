import type { User } from 'firebase/auth';
import { onValue, ref, set } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { db, firebaseReady } from './client';

const PUSH_DEBOUNCE_MS = 900;

/** The only shape this hook actually touches — `workbook` and `setWorkbook`
 * — deliberately smaller than the full stock-exchange `WorkbookStoreState`
 * (which also has addTransaction/addTransfer/etc. this hook never calls).
 * Any store built from any factory (`createWorkbookStore`,
 * `createEntryStore`, ...) satisfies this structurally, so non-stock
 * modules (Cash, Personal Loans, ...) can reuse this same sync hook instead
 * of a second copy of the pull/push/safety logic. */
export interface MinimalWorkbookStore<TWorkbook> {
  workbook: TWorkbook;
  setWorkbook: (wb: TWorkbook, opts?: { skipPersist?: boolean }) => void;
}

/** Generic per-module Firebase sync, factored out so every module (QSE,
 * PSX, Cash, ...) shares one implementation instead of N copies of the
 * same pull/push/safety logic.
 *
 * SAFETY: this must never write to the cloud based on an *assumption* that
 * it's empty. An earlier version treated a null first snapshot as "no cloud
 * data yet" and auto-uploaded local (possibly empty/default) data over it —
 * that destroyed a real portfolio. Now: if the cloud looks empty, this only
 * reports that fact (`cloudEmpty`) and waits for the user to explicitly
 * confirm via `uploadLocalToCloud()`. The debounced local->cloud push is
 * also held back (`initialSnapshotReceived`) until we've actually seen what
 * the cloud contains at least once, so no local change can race ahead of
 * the initial pull and overwrite real data before it's even been read. */
export function useWorkbookCloudSync<TWorkbook>(
  cloudPathSuffix: string,
  useStore: UseBoundStore<StoreApi<MinimalWorkbookStore<TWorkbook>>>,
  user: User | null,
  createEmpty: () => TWorkbook,
) {
  const [status, setStatus] = useState('Not signed in');
  const [cloudEmpty, setCloudEmpty] = useState(false);
  const applyingRemote = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshotReceived = useRef(false);

  const cloudPath = (uid: string) => `users/${uid}/${cloudPathSuffix}`;

  useEffect(() => {
    initialSnapshotReceived.current = false;
    if (!firebaseReady || !db) {
      setStatus('Cloud sync unavailable — Firebase failed to load');
      return;
    }
    if (!user) {
      setStatus('Not signed in');
      return;
    }
    setStatus('Syncing…');
    const workbookRef = ref(db, cloudPath(user.uid));

    const unsubscribe = onValue(
      workbookRef,
      (snap) => {
        const remote = snap.val() as (TWorkbook & { _updated?: string }) | null;
        if (remote) {
          applyingRemote.current = true;
          const { _updated, ...workbook } = remote;
          // Merge onto a fresh default shape instead of trusting the cloud
          // document to have every field — older data (written before a
          // field like `watchlist` existed) coming back without it crashed
          // every page's ticker-datalist useMemo on `.forEach` of
          // `undefined`. Same defensive pattern as loadFromLocalStorage()
          // and the JSON-import flow; the cloud sync path was the one
          // place still skipping it.
          useStore.getState().setWorkbook({ ...createEmpty(), ...workbook } as TWorkbook);
          applyingRemote.current = false;
          setCloudEmpty(false);
          setStatus(`Synced${_updated ? ' · ' + new Date(_updated).toLocaleString() : ''}`);
        } else {
          // No data found at this path. Do NOT write anything — just
          // surface it and let the user explicitly decide what to do.
          setCloudEmpty(true);
          setStatus('No cloud data found for this account yet');
        }
        initialSnapshotReceived.current = true;
      },
      (err) => {
        console.warn(`Firebase ${cloudPathSuffix} listener error`, err);
        setStatus('Sync error — check console');
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Push local changes to the cloud, debounced, skipping echoes of a
  // just-applied remote update, and never before the initial pull has
  // actually completed (see safety note above).
  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsubscribe = useStore.subscribe((state) => {
      if (applyingRemote.current) return;
      if (!initialSnapshotReceived.current) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        set(ref(db!, cloudPath(user.uid)), { ...state.workbook, _updated: new Date().toISOString() }).catch((e) =>
          console.warn(`Failed to push ${cloudPathSuffix} to cloud`, e),
        );
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /** Explicit, user-initiated upload of the current local workbook to the
   * cloud. Only meant to be offered when `cloudEmpty` is true (confirmed no
   * data at this path) — the caller should still confirm with the user
   * before calling this, since it's a full overwrite. */
  const uploadLocalToCloud = async () => {
    if (!firebaseReady || !db || !user) throw new Error('Not signed in');
    const local = useStore.getState().workbook;
    await set(ref(db, cloudPath(user.uid)), { ...local, _updated: new Date().toISOString() });
    setCloudEmpty(false);
    setStatus('Synced (uploaded local data)');
  };

  return { status, cloudEmpty, uploadLocalToCloud };
}
