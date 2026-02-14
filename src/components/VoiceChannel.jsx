import { useCallback, useEffect, useRef, useState } from "react";

const VOICE_ROOM_ID = "living-room";

const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VoiceChannel({ socket, isLakeHouse }) {
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const [voiceUsers, setVoiceUsers] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState({});

    const localStreamRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());

    const closePeerConnection = useCallback((peerSocketId) => {
        const existing = peerConnectionsRef.current.get(peerSocketId);
        if (!existing) return;

        existing.onicecandidate = null;
        existing.ontrack = null;
        existing.close();
        peerConnectionsRef.current.delete(peerSocketId);

        setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerSocketId];
            return next;
        });
    }, []);

    const createPeerConnection = useCallback((peerSocketId) => {
        const existing = peerConnectionsRef.current.get(peerSocketId);
        if (existing) return existing;

        const localStream = localStreamRef.current;
        if (!localStream) throw new Error("Local audio stream is required before creating peer connection");

        // Mesh topology: one RTCPeerConnection per remote user.
        const peerConnection = new RTCPeerConnection(rtcConfig);

        // Send the local microphone stream to this remote peer.
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

        // Forward ICE candidates over Socket.IO signaling.
        peerConnection.onicecandidate = (event) => {
            if (!event.candidate) return;

            socket.emit("webrtc_ice_candidate", {
                roomId: VOICE_ROOM_ID,
                targetSocketId: peerSocketId,
                candidate: event.candidate,
            });
        };

        // Attach incoming remote audio stream to rendered <audio> elements.
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (!remoteStream) return;
            setRemoteStreams((prev) => ({ ...prev, [peerSocketId]: remoteStream }));
        };

        peerConnectionsRef.current.set(peerSocketId, peerConnection);
        return peerConnection;
    }, [socket]);

    const handleJoin = useCallback(async () => {
        if (isJoined || isJoining) return;
        setIsJoining(true);
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            setIsJoined(true);

            socket.emit("join_voice_channel", { roomId: VOICE_ROOM_ID });
        } catch (joinError) {
            console.error("Failed to join voice channel:", joinError);
            setError("Microphone permission is required to join voice.");
        } finally {
            setIsJoining(false);
        }
    }, [isJoined, isJoining, socket]);

    const handleLeave = useCallback(() => {
        socket.emit("leave_voice_channel", { roomId: VOICE_ROOM_ID });

        peerConnectionsRef.current.forEach((_, peerSocketId) => closePeerConnection(peerSocketId));

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        setRemoteStreams({});
        setVoiceUsers([]);
        setIsJoined(false);
        setError(null);
    }, [closePeerConnection, socket]);

    useEffect(() => {
        const onVoiceUsersChanged = async ({ roomId, users }) => {
            if (roomId && roomId !== VOICE_ROOM_ID) return;

            const nextUsers = users || [];
            setVoiceUsers(nextUsers);

            if (!isJoined || !socket.id) return;

            const activePeerIds = new Set(nextUsers
                .map((peer) => peer.socketId)
                .filter((peerSocketId) => peerSocketId !== socket.id));

            peerConnectionsRef.current.forEach((_, peerSocketId) => {
                if (!activePeerIds.has(peerSocketId)) {
                    closePeerConnection(peerSocketId);
                }
            });

            // Joiner creates offers for peers that do not have a connection yet.
            for (const peerSocketId of activePeerIds) {
                if (peerConnectionsRef.current.has(peerSocketId)) continue;

                const peerConnection = createPeerConnection(peerSocketId);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                socket.emit("webrtc_offer", {
                    roomId: VOICE_ROOM_ID,
                    targetSocketId: peerSocketId,
                    sdp: offer,
                });
            }
        };

        const onOffer = async ({ sourceSocketId, targetSocketId, roomId, sdp }) => {
            if (!isJoined || roomId !== VOICE_ROOM_ID || targetSocketId !== socket.id || sourceSocketId === socket.id) return;

            const peerConnection = createPeerConnection(sourceSocketId);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit("webrtc_answer", {
                roomId: VOICE_ROOM_ID,
                targetSocketId: sourceSocketId,
                sdp: answer,
            });
        };

        const onAnswer = async ({ sourceSocketId, targetSocketId, roomId, sdp }) => {
            if (roomId !== VOICE_ROOM_ID || targetSocketId !== socket.id || sourceSocketId === socket.id) return;

            const peerConnection = peerConnectionsRef.current.get(sourceSocketId);
            if (!peerConnection) return;

            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        };

        const onIceCandidate = async ({ sourceSocketId, targetSocketId, roomId, candidate }) => {
            if (roomId !== VOICE_ROOM_ID || targetSocketId !== socket.id || sourceSocketId === socket.id) return;

            const peerConnection = peerConnectionsRef.current.get(sourceSocketId);
            if (!peerConnection) return;

            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        };

        socket.on("join_voice_channel", onVoiceUsersChanged);
        socket.on("leave_voice_channel", onVoiceUsersChanged);
        socket.on("webrtc_offer", onOffer);
        socket.on("webrtc_answer", onAnswer);
        socket.on("webrtc_ice_candidate", onIceCandidate);

        return () => {
            socket.off("join_voice_channel", onVoiceUsersChanged);
            socket.off("leave_voice_channel", onVoiceUsersChanged);
            socket.off("webrtc_offer", onOffer);
            socket.off("webrtc_answer", onAnswer);
            socket.off("webrtc_ice_candidate", onIceCandidate);
        };
    }, [closePeerConnection, createPeerConnection, isJoined, socket]);

    useEffect(() => () => {
        peerConnectionsRef.current.forEach((_, peerSocketId) => closePeerConnection(peerSocketId));

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
    }, [closePeerConnection]);

    if (!isLakeHouse) return null;

    return (
        <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Voice channels</div>
            <div className="bg-[#181c22] rounded-md p-3 space-y-2">
                <div className="text-slate-100">🎙 Living Room</div>
                <div className="flex gap-2">
                    <button onClick={handleJoin} disabled={isJoined || isJoining} className="text-xs px-2 py-1 bg-emerald-700 rounded disabled:opacity-50">Join Voice</button>
                    <button onClick={handleLeave} disabled={!isJoined} className="text-xs px-2 py-1 bg-rose-700 rounded disabled:opacity-50">Leave</button>
                </div>
                {error && <p className="text-xs text-rose-300">{error}</p>}
                <div className="text-xs text-slate-400">Connected users: {voiceUsers.length}</div>
                <ul className="text-xs text-slate-300 space-y-1">
                    {voiceUsers.map((voiceUser) => (
                        <li key={voiceUser.socketId}>{voiceUser.displayName}</li>
                    ))}
                    {voiceUsers.length === 0 && <li className="text-slate-500">No one in voice yet.</li>}
                </ul>
                {Object.entries(remoteStreams).map(([peerSocketId, stream]) => (
                    <audio
                        key={peerSocketId}
                        autoPlay
                        ref={(node) => {
                            if (node && node.srcObject !== stream) {
                                node.srcObject = stream;
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
