'use client';

import {
  ConnectionQuality,
  ConnectionState,
  LocalParticipant,
  type RemoteParticipant,
  type RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MediaPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

export interface CallRoomState {
  room: Room | null;
  connectionState: ConnectionState;
  /** True once the other person is in the room and publishing. */
  peerPresent: boolean;
  peerVideo: RemoteTrack | null;
  peerAudio: RemoteTrack | null;
  peerCameraOn: boolean;
  peerMicOn: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  quality: ConnectionQuality;
  permission: MediaPermission;
  error: string | null;
}

const initialState: CallRoomState = {
  room: null,
  connectionState: ConnectionState.Disconnected,
  peerPresent: false,
  peerVideo: null,
  peerAudio: null,
  peerCameraOn: false,
  peerMicOn: false,
  micEnabled: true,
  cameraEnabled: true,
  screenSharing: false,
  quality: ConnectionQuality.Unknown,
  permission: 'unknown',
  error: null,
};

/**
 * Owns the LiveKit room for one call: connect, publish, track the peer, and clean up.
 * The UI stays declarative; every LiveKit event is folded into `state`.
 */
export function useCallRoom() {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<CallRoomState>(initialState);
  const patch = useCallback((p: Partial<CallRoomState>) => setState((s) => ({ ...s, ...p })), []);

  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
        publishDefaults: { videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] },
      }),
    [],
  );

  useEffect(() => {
    roomRef.current = room;

    const readPeer = () => {
      const peer = [...room.remoteParticipants.values()][0] as RemoteParticipant | undefined;
      const video = peer?.getTrackPublication(Track.Source.Camera);
      const screen = peer?.getTrackPublication(Track.Source.ScreenShare);
      const audio = peer?.getTrackPublication(Track.Source.Microphone);
      patch({
        peerPresent: Boolean(peer),
        peerVideo: (screen?.track ?? video?.track ?? null) as RemoteTrack | null,
        peerAudio: (audio?.track ?? null) as RemoteTrack | null,
        peerCameraOn:
          Boolean(video?.isSubscribed && !video.isMuted) || Boolean(screen?.isSubscribed),
        peerMicOn: Boolean(audio?.isSubscribed && !audio.isMuted),
      });
    };

    const onLocalChange = () => {
      const local: LocalParticipant = room.localParticipant;
      patch({
        micEnabled: local.isMicrophoneEnabled,
        cameraEnabled: local.isCameraEnabled,
        screenSharing: local.isScreenShareEnabled,
      });
    };

    room
      .on(RoomEvent.ConnectionStateChanged, (connectionState) => patch({ connectionState }))
      .on(RoomEvent.ParticipantConnected, readPeer)
      .on(RoomEvent.ParticipantDisconnected, readPeer)
      .on(RoomEvent.TrackSubscribed, readPeer)
      .on(RoomEvent.TrackUnsubscribed, readPeer)
      .on(RoomEvent.TrackMuted, readPeer)
      .on(RoomEvent.TrackUnmuted, readPeer)
      .on(RoomEvent.LocalTrackPublished, onLocalChange)
      .on(RoomEvent.LocalTrackUnpublished, onLocalChange)
      .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant === room.localParticipant) patch({ quality });
      });

    return () => {
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [room, patch]);

  const connect = useCallback(
    async (url: string, token: string) => {
      try {
        patch({ error: null });
        await room.connect(url, token);
        patch({ room });
        try {
          await room.localParticipant.enableCameraAndMicrophone();
          patch({ permission: 'granted', micEnabled: true, cameraEnabled: true });
        } catch (err) {
          const name = (err as DOMException)?.name;
          // Joining without devices is still useful: you can hear and see the other person.
          patch({
            permission:
              name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable',
            micEnabled: false,
            cameraEnabled: false,
          });
        }
      } catch (err) {
        patch({ error: (err as Error).message || 'Could not connect to the call.' });
      }
    },
    [room, patch],
  );

  const disconnect = useCallback(async () => {
    await room.disconnect();
  }, [room]);

  const toggleMic = useCallback(async () => {
    const next = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    patch({ micEnabled: next });
  }, [room, patch]);

  const toggleCamera = useCallback(async () => {
    const next = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    patch({ cameraEnabled: next });
  }, [room, patch]);

  const toggleScreenShare = useCallback(async () => {
    const next = !room.localParticipant.isScreenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      patch({ screenSharing: next });
    } catch {
      // User dismissed the picker — nothing to do.
    }
  }, [room, patch]);

  return { ...state, room, connect, disconnect, toggleMic, toggleCamera, toggleScreenShare };
}

/** Local camera preview before joining (pre-join screen). */
export function useLocalPreview(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [permission, setPermission] = useState<MediaPermission>('unknown');

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setPermission('granted');
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: DOMException) => {
        setPermission(
          err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'denied' : 'unavailable',
        );
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return { videoRef, permission };
}
