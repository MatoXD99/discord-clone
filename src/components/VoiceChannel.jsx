import { useCallback, useEffect, useRef, useState } from "react";

const VOICE_ROOM_ID = "living-room";

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
            urls: [
                "turn:discord.slovenitech.si:3478?transport=udp",
                "turn:discord.slovenitech.si:3478?transport=tcp"
            ],
            username: "voiceuser",
            credential: "strongpassword",
        },
    ],
};

// Connection state type: "idle" | "connecting" | "connected" | "failed"
// ICE state type: "new" | "checking" | "connected" | "completed" | "failed" | "disconnected"

export default function VoiceChannel({ socket, isLakeHouse }) {
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const [voiceUsers, setVoiceUsers] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState({}); // audio streams
    const [remoteScreenShares, setRemoteScreenShares] = useState({}); // video streams from screen share

    // Connection status tracking
    const [connectionStatus, setConnectionStatus] = useState("idle"); // idle | connecting | connected | failed
    const [iceStates, setIceStates] = useState({}); // { peerSocketId: state }
    const [rtcStates, setRtcStates] = useState({}); // { peerSocketId: state }

    // Screen sharing state
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenShareError, setScreenShareError] = useState(null);
    const [selectedScreenPeer, setSelectedScreenPeer] = useState(null); // which peer's screen to display
    const [peersWithScreenShare, setPeersWithScreenShare] = useState(new Set()); // track who's sharing

    // Mute/deafen state
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);

    const localStreamRef = useRef(null);
    const screenShareStreamRef = useRef(null);
    const screenShareSendersRef = useRef(new Map()); // { peerSocketId: RTCRtpSender }
    const peerConnectionsRef = useRef(new Map());

    const closePeerConnection = useCallback((peerSocketId) => {
        const existing = peerConnectionsRef.current.get(peerSocketId);
        if (!existing) return;

        existing.onicecandidate = null;
        existing.ontrack = null;
        existing.oniceconnectionstatechange = null;
        existing.onconnectionstatechange = null;
        existing.onicegatheringstatechange = null;
        existing.close();
        peerConnectionsRef.current.delete(peerSocketId);

        // Clean up screen share sender
        screenShareSendersRef.current.delete(peerSocketId);

        setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerSocketId];
            return next;
        });

        setRemoteScreenShares((prev) => {
            const next = { ...prev };
            delete next[peerSocketId];
            return next;
        });

        setPeersWithScreenShare((prev) => {
            const next = new Set(prev);
            next.delete(peerSocketId);
            return next;
        });

        // Clear state for this peer
        setIceStates((prev) => {
            const next = { ...prev };
            delete next[peerSocketId];
            return next;
        });
        setRtcStates((prev) => {
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

        // If screen sharing, add screen tracks to this connection
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach((track) => {
                const sender = peerConnection.addTrack(track, screenShareStreamRef.current);
                screenShareSendersRef.current.set(`${peerSocketId}_${track.id}`, sender);
            });
        }

        // Forward ICE candidates over Socket.IO signaling.
        peerConnection.onicecandidate = (event) => {
            if (!event.candidate) return;

            // send serializable candidate object
            const cand = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;

            socket.emit("webrtc_ice_candidate", {
                roomId: VOICE_ROOM_ID,
                targetSocketId: peerSocketId,
                candidate: cand,
            });
        };

        // Track ICE gathering state
        peerConnection.onicegatheringstatechange = () => {
            const state = peerConnection.iceGatheringState;
            console.log(`[${peerSocketId}] ICE gathering state:`, state);
        };

        // Track ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            console.log(`[${peerSocketId}] ICE connection state:`, state);
            setIceStates((prev) => ({ ...prev, [peerSocketId]: state }));
        };

        // Track RTC connection state
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log(`[${peerSocketId}] RTC connection state:`, state);
            setRtcStates((prev) => ({ ...prev, [peerSocketId]: state }));

            if (state === "connected") {
                // At least one peer is connected
                setConnectionStatus("connected");
            } else if (state === "failed") {
                closePeerConnection(peerSocketId);
            } else if (state === "disconnected" || state === "closed") {
                closePeerConnection(peerSocketId);
            }
        };

        // Attach incoming remote streams (both audio and video)
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (!remoteStream) return;

            // Distinguish between audio and video/screen share
            if (event.track.kind === "video") {
                setRemoteScreenShares((prev) => ({ ...prev, [peerSocketId]: remoteStream }));
                setPeersWithScreenShare((prev) => new Set([...prev, peerSocketId]));
            } else if (event.track.kind === "audio") {
                setRemoteStreams((prev) => ({ ...prev, [peerSocketId]: remoteStream }));
            }
        };

        peerConnectionsRef.current.set(peerSocketId, peerConnection);
        return peerConnection;
    }, [socket, closePeerConnection]);

    const handleJoin = useCallback(async () => {
        if (isJoined || isJoining) return;
        setIsJoining(true);
        setError(null);
        setConnectionStatus("connecting");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true
                }
            });
            localStreamRef.current = stream;

            // 🔥 Create a temporary PC to force ICE gathering
            const testPc = new RTCPeerConnection(rtcConfig);

            stream.getTracks().forEach(track =>
                testPc.addTrack(track, stream)
            );

            testPc.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log("ICE candidate:", e.candidate.type, e.candidate.candidate);
                }
            };

            const offer = await testPc.createOffer();
            await testPc.setLocalDescription(offer);

            console.log("Forced ICE gathering started");

            setIsJoined(true);
            socket.emit("join_voice_channel", { roomId: VOICE_ROOM_ID });

        } catch (joinError) {
            console.error("Failed to join voice channel:", joinError);
            setError("Microphone permission is required to join voice.");
            setConnectionStatus("failed");
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

        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
            screenShareStreamRef.current = null;
        }

        setRemoteStreams({});
        setRemoteScreenShares({});
        setVoiceUsers([]);
        setIsJoined(false);
        setError(null);
        setConnectionStatus("idle");
        setIceStates({});
        setRtcStates({});
        setIsScreenSharing(false);
        setScreenShareError(null);
        setSelectedScreenPeer(null);
        setPeersWithScreenShare(new Set());
        setIsMuted(false);
        setIsDeafened(false);
    }, [closePeerConnection, socket]);

    const handleShareScreen = useCallback(async () => {
        if (isScreenSharing) return;

        try {
            setScreenShareError(null);
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
            });

            screenShareStreamRef.current = displayStream;
            setIsScreenSharing(true);

            // Handle when user stops the screen share from the OS dialog
            displayStream.getTracks().forEach((track) => {
                track.onended = () => {
                    handleStopScreenShare();
                };
            });

            // Add screen share tracks to all existing peer connections and renegotiate
            const videoTracks = displayStream.getVideoTracks();
            if (videoTracks.length > 0) {
                for (const [peerSocketId, peerConnection] of peerConnectionsRef.current.entries()) {
                    try {
                        // Add tracks and store senders
                        videoTracks.forEach((track) => {
                            const sender = peerConnection.addTrack(track, displayStream);
                            screenShareSendersRef.current.set(`${peerSocketId}_${track.id}`, sender);
                        });

                        // Renegotiate: create a new offer
                        const offer = await peerConnection.createOffer();
                        await peerConnection.setLocalDescription(offer);

                        socket.emit("webrtc_offer", {
                            roomId: VOICE_ROOM_ID,
                            targetSocketId: peerSocketId,
                            sdp: offer,
                        });
                    } catch (err) {
                        console.error(`Failed to add screen to peer ${peerSocketId}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error("Screen share error:", err);
            if (err.name !== "NotAllowedError") {
                setScreenShareError("Failed to start screen sharing.");
            }
            setIsScreenSharing(false);
        }
    }, [isScreenSharing, socket]);

    const handleStopScreenShare = useCallback(async () => {
        if (!isScreenSharing || !screenShareStreamRef.current) return;

        // Stop all screen share tracks
        screenShareStreamRef.current.getTracks().forEach((track) => track.stop());

        const videoTrackIds = screenShareStreamRef.current
            .getVideoTracks()
            .map((track) => track.id);

        screenShareStreamRef.current = null;
        setIsScreenSharing(false);
        setScreenShareError(null);

        // Remove screen share senders from all peer connections and renegotiate
        for (const [peerSocketId, peerConnection] of peerConnectionsRef.current.entries()) {
            try {
                // Find and remove senders for screen tracks
                const senders = peerConnection.getSenders();
                const screenSenders = senders.filter((sender) =>
                    sender.track && sender.track.kind === "video" && videoTrackIds.includes(sender.track.id)
                );

                for (const sender of screenSenders) {
                    peerConnection.removeTrack(sender);
                    screenShareSendersRef.current.delete(`${peerSocketId}_${sender.track.id}`);
                }

                // Renegotiate: create a new offer
                if (screenSenders.length > 0) {
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);

                    socket.emit("webrtc_offer", {
                        roomId: VOICE_ROOM_ID,
                        targetSocketId: peerSocketId,
                        sdp: offer,
                    });
                }
            } catch (err) {
                console.error(`Failed to remove screen from peer ${peerSocketId}:`, err);
            }
        }
    }, [isScreenSharing, socket]);

    const handleToggleMute = useCallback(() => {
        if (!localStreamRef.current) return;

        const audioTracks = localStreamRef.current.getAudioTracks();
        audioTracks.forEach((track) => {
            track.enabled = !track.enabled;
        });

        setIsMuted(!isMuted);
    }, [isMuted]);

    const handleToggleDeafen = useCallback(() => {
        if (!localStreamRef.current) return;

        // Deafen means receive no audio (mute all remote audio)
        const audioElements = document.querySelectorAll("audio[autoplay]");
        audioElements.forEach((audio) => {
            audio.muted = !isDeafened;
        });

        setIsDeafened(!isDeafened);
    }, [isDeafened]);

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

            for (const peerSocketId of activePeerIds) {
                if (peerConnectionsRef.current.has(peerSocketId)) continue;

                if (socket.id > peerSocketId) continue;

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

            let peerConnection = peerConnectionsRef.current.get(sourceSocketId);

            // If we don't have a peer connection yet, create one (only possible if we have a local stream)
            if (!peerConnection) {
                if (!localStreamRef.current) return; // can't create connection without local media
                try {
                    peerConnection = createPeerConnection(sourceSocketId);
                } catch (err) {
                    console.warn("Unable to create peer connection for ICE candidate:", err);
                    return;
                }
            }

            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.warn("Failed to add remote ICE candidate:", err);
            }
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

    const getStatusColor = (status) => {
        switch (status) {
            case "connected":
                return "bg-green-500";
            case "connecting":
                return "bg-yellow-500";
            case "failed":
                return "bg-red-500";
            default:
                return "bg-slate-400";
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case "connected":
                return "✓ Connected";
            case "connecting":
                return "⟳ Connecting...";
            case "failed":
                return "✗ Failed";
            default:
                return "Idle";
        }
    };

    const getIceColor = (state) => {
        switch (state) {
            case "connected":
            case "completed":
                return "text-green-400";
            case "checking":
                return "text-yellow-400";
            case "disconnected":
                return "text-yellow-600";
            case "failed":
                return "text-red-400";
            default:
                return "text-slate-400";
        }
    };

    const getRtcColor = (state) => {
        switch (state) {
            case "connected":
                return "text-green-400";
            case "connecting":
                return "text-yellow-400";
            case "disconnected":
                return "text-yellow-600";
            case "failed":
                return "text-red-400";
            default:
                return "text-slate-400";
        }
    };

    return (
        <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Voice channels</div>
            <div className="bg-[#181c22] rounded-md p-3 space-y-2 flex flex-col h-96">
                <div className="text-slate-100 font-semibold">🎙 Living Room</div>

                {/* Connection Status Indicator */}
                {isJoined && (
                    <div className="bg-[#2a2e3e] rounded p-2 space-y-1">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionStatus)}`}></div>
                            <span className="text-xs text-slate-300">{getStatusText(connectionStatus)}</span>
                        </div>

                        {/* Per-peer detailed status */}
                        {Object.keys(iceStates).length > 0 && (
                            <div className="ml-3 space-y-0.5 text-xs">
                                {Object.entries(iceStates).map(([peerId, iceState]) => (
                                    <div key={peerId} className="flex items-center gap-2">
                                        <span className={`${getIceColor(iceState)} font-mono`}>ICE: {iceState}</span>
                                        <span className={`${getRtcColor(rtcStates[peerId] || "new")} font-mono`}>RTC: {rtcStates[peerId] || "new"}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Screen Share Display (only show when selected) */}
                    {selectedScreenPeer && remoteScreenShares[selectedScreenPeer] && (
                        <div className="flex-1 bg-black rounded mb-2 overflow-hidden">
                            <video
                                autoPlay
                                className="w-full h-full object-contain"
                                ref={(node) => {
                                    if (node && node.srcObject !== remoteScreenShares[selectedScreenPeer]) {
                                        node.srcObject = remoteScreenShares[selectedScreenPeer];
                                    }
                                }}
                            />
                        </div>
                    )}

                    {/* Connected Users as Blobs */}
                    <div className="overflow-y-auto">
                        {voiceUsers.length > 0 ? (
                            <div className="space-y-2">
                                {voiceUsers.map((voiceUser) => (
                                    <div
                                        key={voiceUser.socketId}
                                        className="flex items-center gap-2 bg-[#2a2e3e] rounded-lg px-3 py-2 hover:bg-[#35394a] transition cursor-pointer"
                                        onClick={() => {
                                            if (peersWithScreenShare.has(voiceUser.socketId)) {
                                                setSelectedScreenPeer(selectedScreenPeer === voiceUser.socketId ? null : voiceUser.socketId);
                                            }
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                            {voiceUser.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs text-slate-100 font-medium">{voiceUser.displayName}</div>
                                        </div>
                                        {peersWithScreenShare.has(voiceUser.socketId) && (
                                            <div className="text-xs bg-blue-600 rounded px-2 py-0.5" title="Sharing screen">
                                                📺
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 text-center py-4">No one in voice yet.</div>
                        )}
                    </div>
                </div>

                {error && <p className="text-xs text-rose-300">{error}</p>}
                {screenShareError && <p className="text-xs text-rose-300">{screenShareError}</p>}

                {/* Bottom Control Bar (Discord-style) */}
                {isJoined && (
                    <div className="flex gap-2 items-center justify-between border-t border-[#2a2e3e] pt-2">
                        <div className="flex gap-1">
                            <button
                                onClick={handleToggleMute}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${isMuted ? "bg-red-600 hover:bg-red-700" : "bg-slate-700 hover:bg-slate-600"
                                    }`}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? "🔇" : "🎤"}
                            </button>
                            <button
                                onClick={handleToggleDeafen}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${isDeafened ? "bg-red-600 hover:bg-red-700" : "bg-slate-700 hover:bg-slate-600"
                                    }`}
                                title={isDeafened ? "Undeafen" : "Deafen"}
                            >
                                {isDeafened ? "🔕" : "🔊"}
                            </button>
                            <button
                                onClick={handleShareScreen}
                                disabled={isScreenSharing}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${isScreenSharing ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"
                                    } disabled:opacity-50`}
                                title={isScreenSharing ? "Already sharing" : "Share screen"}
                            >
                                📺
                            </button>
                            {isScreenSharing && (
                                <button
                                    onClick={handleStopScreenShare}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-red-600 hover:bg-red-700 transition"
                                    title="Stop sharing"
                                >
                                    ⏹️
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleLeave}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-red-600 hover:bg-red-700 transition"
                            title="Leave voice"
                        >
                            📞
                        </button>
                    </div>
                )}

                {/* Join Button when not in voice */}
                {!isJoined && (
                    <button
                        onClick={handleJoin}
                        disabled={isJoining}
                        className="w-full text-xs px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-50 transition"
                    >
                        {isJoining ? "Joining..." : "Join Voice"}
                    </button>
                )}

                {/* Remote Audio Streams (hidden element) */}
                {Object.entries(remoteStreams).map(([peerSocketId, stream]) => (
                    <audio
                        key={`audio_${peerSocketId}`}
                        autoPlay
                        muted={isDeafened}
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
