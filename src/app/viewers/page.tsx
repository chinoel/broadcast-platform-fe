"use client";
import VideoPlayer from "@/components/VideoPlayer";
import { Socket } from "phoenix";
import { useEffect, useRef, useState } from "react";

export default function Page() {

    // 원격 스트링 상태값
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    // WebRTC 피어 연결 상태값
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    // WebSocket 객체 상태값
    const socketRef = useRef<Socket | null>(null);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        // 1. Phoenix Websocket 연결 생성
        const socket = new Socket('ws://localhost:4000/socket')
        socket.connect();
        socketRef.current = socket;

        // 2. 채널 연결
        const channel = socket.channel('signaling:lobby', {});
        channelRef.current = channel;

        // 3. 채널 연결 - 시청자 join
        channel.join()
            .receive('ok', () => console.log("Join signaling channel"))
            .receive('error', (reason: any) => console.error('Failed'))

        // 4. 시청자가 서버로 join 요청
        channel.push('join_viewer', {id: 'viewer-123'});

        // 5. 시그널링 서버로부터 메시지 수신
        channel.on('offer', async (data: any) => {
            const pc = new RTCPeerConnection();
            peerConnectionRef.current = pc;

            pc.ontrack = (event) => {
                console.log("Received remote Stream")
                setRemoteStream(event.streams[0]);
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    channel.push('ice_candidate', {
                        candidate: e.candidate,
                        from: 'viewer-123',
                        target: data.target
                    });
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            channel.push('answer', {
                answer,
                from: 'viewer-123',
            });
        })

        channel.on('ice_candidate', async (data: any) => {
            const candidate = new RTCIceCandidate(data.candidate);
            await peerConnectionRef.current?.addIceCandidate(candidate);
        });

        // 6. 컴포넌트가 언마운트될 때 WebSocket 연결 종료
        return () => {
            channel.leave();
            socket.disconnect();
        };
    }, []);

    return (
        <main className="p-4">
            <h1>Viewer</h1>
            {remoteStream && (
                <VideoPlayer stream={remoteStream}/>
            )}
        </main>
    )
}