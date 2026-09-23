'use client';

import type { CallIncomingEvent, CallSummary, CallUpdatedEvent } from '@morphcall/contracts';
import { REALTIME_EVENTS } from '@morphcall/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { env } from './env';
import { callKeys } from './call-queries';
import { supabaseBrowser } from './supabase/client';

interface RealtimeState {
  connected: boolean;
  /** The call currently ringing this user, if any. */
  incoming: CallSummary | null;
  dismissIncoming: () => void;
}

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  incoming: null,
  dismissIncoming: () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

const HEARTBEAT_MS = 25_000;

/** Keeps one socket per signed-in session: incoming calls, call updates and presence. */
export function RealtimeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [incoming, setIncoming] = useState<CallSummary | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let socket: Socket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      socket = io(env.apiUrl, {
        auth: { token },
        transports: ['websocket'],
        withCredentials: false,
      });
      socketRef.current = socket;

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.on(REALTIME_EVENTS.callIncoming, (event: CallIncomingEvent) => {
        setIncoming(event.call);
      });

      socket.on(REALTIME_EVENTS.callUpdated, (event: CallUpdatedEvent) => {
        // The ringing dialog closes as soon as the call is no longer ringing.
        setIncoming((current) =>
          current && current.id === event.callId && event.status !== 'ringing' ? null : current,
        );
        void qc.invalidateQueries({ queryKey: callKeys.history() });
        qc.setQueryData<CallSummary>(callKeys.detail(event.callId), (old) =>
          old
            ? {
                ...old,
                status: event.status,
                endReason: event.endReason,
                durationSeconds: event.durationSeconds,
              }
            : old,
        );
      });

      heartbeat = setInterval(() => socket?.emit(REALTIME_EVENTS.presenceHeartbeat), HEARTBEAT_MS);
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, qc]);

  const value = useMemo<RealtimeState>(
    () => ({ connected, incoming, dismissIncoming: () => setIncoming(null) }),
    [connected, incoming],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
