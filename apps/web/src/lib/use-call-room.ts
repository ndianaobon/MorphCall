'use client';

import {
  ConnectionQuality,
  ConnectionState,
  type LocalVideoTrack,
  type RemoteParticipant,
  type RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MediaPermission = 'unknown' | 'granted' | 'denied' | 'unavailable' | 'insecure';

/**
 * Browsers only expose camera and microphone in a secure context: HTTPS, or localhost.
 * Over plain HTTP on a LAN address (a phone opening http://192.168.x.x:3000) there is no
 * media at all — so detect it and say so rather than failing silently.
 */
export function mediaAvailable() {
  if (typeof window === 'undefined') return true;
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export interface CallRoomState {
  connectionState: ConnectionState;
  peerPresent: boolean;
  peerVideo: RemoteTrack | null;
  peerAudio: RemoteTrack | null;
  peerCameraOn: boolean;
  peerMicOn: boolean;
  peerSharingScreen: boolean;
  /** True once the other person joined and then left — the call is over. */
  peerLeft: boolean;
  /** Our own camera track, so the picture-in-picture tile can attach it. */
  localVideo: LocalVideoTrack | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  quality: ConnectionQuality;
  permission: MediaPermission;
  /** The browser is blocking audio playback until the user interacts. */
  audioBlocked: boolean;
  devices: { cameras: DeviceOption[]; microphones: DeviceOption[]; speakers: DeviceOption[] };
  activeDevices: { camera?: string; microphone?: string; speaker?: string };
  error: string | null;
}

const initialState: CallRoomState = {
  connectionState: ConnectionState.Disconnected,
  peerPresent: false,
  peerVideo: null,
  peerAudio: null,
  peerCameraOn: false,
  peerMicOn: false,
  peerSharingScreen: false,
  peerLeft: false,
  localVideo: null,
  micEnabled: false,
  cameraEnabled: false,
  screenSharing: false,
  quality: ConnectionQuality.Unknown,
  permission: 'unknown',
  audioBlocked: false,
  devices: { cameras: [], microphones: [], speakers: [] },
  activeDevices: {},
  error: null,
};

/**
 * Owns the LiveKit room for one call: connect, publish, follow the peer, and clean up.
 * Every LiveKit event is folded into `state`, so the UI stays declarative.
 */
export function useCallRoom() {
  const [state, setState] = useState<CallRoomState>(initialState);
  const patch = useCallback((p: Partial<CallRoomState>) => setState((s) => ({ ...s, ...p })), []);
  /** Guards against React's double-invoked effects in development connecting twice. */
  const connectingRef = useRef(false);
  /** Remembers that the peer was here, so we can tell "not yet joined" from "hung up". */
  const peerSeenRef = useRef(false);

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

  const readDevices = useCallback(async () => {
    try {
      const [cameras, microphones, speakers] = await Promise.all([
        Room.getLocalDevices('videoinput'),
        Room.getLocalDevices('audioinput'),
        Room.getLocalDevices('audiooutput'),
      ]);
      const toOptions = (list: MediaDeviceInfo[], fallback: string) =>
        list
          .filter((d) => d.deviceId)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
      patch({
        devices: {
          cameras: toOptions(cameras, 'Camera'),
          microphones: toOptions(microphones, 'Microphone'),
          speakers: toOptions(speakers, 'Speaker'),
        },
        activeDevices: {
          camera: room.getActiveDevice('videoinput'),
          microphone: room.getActiveDevice('audioinput'),
          speaker: room.getActiveDevice('audiooutput'),
        },
      });
    } catch {
      // Device labels need permission; we retry after the user grants it.
    }
  }, [room, patch]);

  useEffect(() => {
    const readPeer = () => {
      const peer = [...room.remoteParticipants.values()][0] as RemoteParticipant | undefined;
      const camera = peer?.getTrackPublication(Track.Source.Camera);
      const screen = peer?.getTrackPublication(Track.Source.ScreenShare);
      const audio = peer?.getTrackPublication(Track.Source.Microphone);
      const sharing = Boolean(screen?.isSubscribed && screen.track);
      if (peer) peerSeenRef.current = true;
      patch({
        peerPresent: Boolean(peer),
        peerLeft: peerSeenRef.current && !peer,
        // A shared screen takes over the main stage while it lasts.
        peerVideo: ((sharing ? screen?.track : camera?.track) ?? null) as RemoteTrack | null,
        peerAudio: (audio?.track ?? null) as RemoteTrack | null,
        peerCameraOn: sharing || Boolean(camera?.isSubscribed && camera.track && !camera.isMuted),
        peerMicOn: Boolean(audio?.isSubscribed && !audio.isMuted),
        peerSharingScreen: sharing,
      });
    };

    const readLocal = () => {
      const local = room.localParticipant;
      patch({
        micEnabled: local.isMicrophoneEnabled,
        cameraEnabled: local.isCameraEnabled,
        screenSharing: local.isScreenShareEnabled,
        localVideo: local.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
      });
    };

    room
      .on(RoomEvent.ConnectionStateChanged, (connectionState) => patch({ connectionState }))
      .on(RoomEvent.ParticipantConnected, readPeer)
      .on(RoomEvent.ParticipantDisconnected, readPeer)
      .on(RoomEvent.TrackSubscribed, readPeer)
      .on(RoomEvent.TrackUnsubscribed, readPeer)
      .on(RoomEvent.TrackMuted, () => {
        readPeer();
        readLocal();
      })
      .on(RoomEvent.TrackUnmuted, () => {
        readPeer();
        readLocal();
      })
      .on(RoomEvent.LocalTrackPublished, readLocal)
      .on(RoomEvent.LocalTrackUnpublished, readLocal)
      .on(RoomEvent.AudioPlaybackStatusChanged, () =>
        patch({ audioBlocked: !room.canPlaybackAudio }),
      )
      .on(RoomEvent.MediaDevicesChanged, () => void readDevices())
      .on(RoomEvent.ActiveDeviceChanged, () => void readDevices())
      .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant === room.localParticipant) patch({ quality });
      })
      .on(RoomEvent.Disconnected, () =>
        patch({ ...initialState, connectionState: ConnectionState.Disconnected }),
      );

    return () => {
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [room, patch, readDevices]);

  const connect = useCallback(
    async (url: string, token: string) => {
      if (connectingRef.current || room.state !== ConnectionState.Disconnected) return;
      connectingRef.current = true;
      try {
        patch({ error: null });
        await room.connect(url, token);

        if (!mediaAvailable()) {
          patch({ permission: 'insecure' });
        } else {
          try {
            await room.localParticipant.enableCameraAndMicrophone();
            patch({ permission: 'granted' });
          } catch (err) {
            const name = (err as DOMException)?.name;
            // Joining without devices still works: you can see and hear the other person.
            patch({
              permission:
                name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable',
            });
          }
        }

        // Browsers block autoplay until the page has been interacted with.
        try {
          await room.startAudio();
        } catch {
          patch({ audioBlocked: true });
        }
        patch({ audioBlocked: !room.canPlaybackAudio });
        await readDevices();
      } catch (err) {
        patch({ error: (err as Error).message || 'Could not connect to the call.' });
      } finally {
        connectingRef.current = false;
      }
    },
    [room, patch, readDevices],
  );

  const disconnect = useCallback(async () => {
    await room.disconnect();
  }, [room]);

  /** Turns a device failure into a sentence someone can act on. */
  const deviceError = useCallback((err: unknown, kind: 'microphone' | 'camera') => {
    if (!mediaAvailable()) {
      return `Your browser blocks the ${kind} on an insecure connection. Open MorphCall over HTTPS or on localhost.`;
    }
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return `${kind === 'camera' ? 'Camera' : 'Microphone'} access is blocked. Allow it from your browser’s address bar, then try again.`;
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return `No ${kind} found on this device.`;
    }
    if (name === 'NotReadableError') {
      return `Another app is using your ${kind}. Close it and try again.`;
    }
    return `Could not switch your ${kind}.`;
  }, []);

  const toggleMic = useCallback(async () => {
    const next = !room.localParticipant.isMicrophoneEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
    } catch (err) {
      // Re-read the real state: a failed toggle must not leave the button lying.
      patch({ micEnabled: room.localParticipant.isMicrophoneEnabled });
      throw new Error(deviceError(err, 'microphone'));
    }
    patch({ micEnabled: room.localParticipant.isMicrophoneEnabled });
  }, [room, patch, deviceError]);

  const toggleCamera = useCallback(async () => {
    const next = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
    } catch (err) {
      patch({ cameraEnabled: room.localParticipant.isCameraEnabled });
      throw new Error(deviceError(err, 'camera'));
    }
    patch({
      cameraEnabled: room.localParticipant.isCameraEnabled,
      localVideo:
        room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
    });
  }, [room, patch, deviceError]);

  const toggleScreenShare = useCallback(async () => {
    const next = !room.localParticipant.isScreenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(next, { audio: true });
      patch({ screenSharing: room.localParticipant.isScreenShareEnabled });
    } catch (err) {
      // Dismissing the picker is normal; anything else is worth saying out loud.
      if ((err as DOMException)?.name !== 'NotAllowedError') {
        throw new Error('Screen sharing isn’t available in this browser.');
      }
    }
  }, [room, patch]);

  const switchDevice = useCallback(
    async (kind: MediaDeviceKind, deviceId: string) => {
      await room.switchActiveDevice(kind, deviceId);
      await readDevices();
    },
    [room, readDevices],
  );

  const enableAudio = useCallback(async () => {
    await room.startAudio();
    patch({ audioBlocked: !room.canPlaybackAudio });
  }, [room, patch]);

  return {
    ...state,
    room,
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    switchDevice,
    enableAudio,
  };
}
