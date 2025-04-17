'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'phoenix';
import VideoPlayer from '@/components/VideoPlayer';

export default function HostPage() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // 1. 카메라/마이크 스트림 가져오기
    const initLocalStream = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      // 2. Phoenix Socket 연결
      const socket = new Socket('ws://localhost:4000/socket');
      socket.connect();
      socketRef.current = socket;

      // 3. signaling:lobby 채널 join
      const channel = socket.channel('signaling:lobby', {});
      channelRef.current = channel;

      channel.join()
        .receive('ok', () => {
          console.log('[Host] Joined signaling channel');
          channel.push('join_host', { id: 'host-abc' });
        })
        .receive('error', (reason: any) => {
          console.error('[Host] Failed to join signaling channel:', reason);
        });

      // 4. 시청자가 join_viewer 하면 처리
      channel.on('viewer_joined', async (payload: any) => {
        const viewerId = payload.id;
        console.log(`[Host] Viewer joined: ${viewerId}`);

        const pc = new RTCPeerConnection();
        peerConnectionsRef.current[viewerId] = pc;

        // local media track 연결
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // ICE 후보 생성 시 전송
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.push('ice_candidate', {
              candidate: e.candidate,
              from: 'host-abc',
              target: viewerId
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        channel.push('offer', {
          offer,
          target: viewerId,
          from: 'host-abc'
        });
      });

      // 5. 시청자로부터 answer 받기
      channel.on('answer', async (payload: any) => {
        const viewerId = payload.from;
        const pc = peerConnectionsRef.current[viewerId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          console.log(`[Host] Received answer from ${viewerId}`);
        }
      });

      // 6. ICE candidate 받기
      channel.on('ice_candidate', async (payload: any) => {
        const pc = peerConnectionsRef.current[payload.from];
        if (pc && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          console.log(`[Host] Added ICE candidate from ${payload.from}`);
        }
      });
    };

    initLocalStream();

    // 정리
    return () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      channelRef.current?.leave();
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">🎥 Host</h1>
      {localStream ? (
        <VideoPlayer stream={localStream} />
      ) : (
        <p>로컬 스트림을 불러오는 중...</p>
      )}
    </main>
  );
}
