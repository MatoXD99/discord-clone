import { useCallback, useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";

const VOICE_ROOM_ID = "living-room";
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://live.discord.slovenitech.si";

// Speaking indicator styles
const speakingStyles = `
    @keyframes speakingPulse {
        0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
        }
        50% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
        }
    }
    .speaking-indicator {
        animation: speakingPulse 1.5s infinite;
    }
`;

// Connection state type: "idle" | "connecting" | "connected" | "failed"
// ICE state type: "new" | "checking" | "connected" | "completed" | "failed" | "disconnected"

// Sound effect utilities
const playSound = (type, enabled = true) => {
    if (!enabled) return;
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const frequencies = {
            join: 523.25,      // C5
            leave: 329.63,     // E4
            shareStart: 659.25, // E5
            shareStop: 392.00,  // G4
            mute: 440.00,       // A4
            deafen: 349.23,     // F4
        };

        const freq = frequencies[type] || 440;
        const duration = 0.2;
        const now = audioContext.currentTime;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.value = freq;
        osc.type = "sine";

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    } catch (err) {
        console.debug("Sound effect error:", err);
    }
};

export default function VoiceChannel({ socket, isLakeHouse }) {
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const [voiceUsers, setVoiceUsers] = useState([]);
    const [remoteScreenShares, setRemoteScreenShares] = useState({}); // participant sid -> video track

    // Connection status
    const [connectionStatus, setConnectionStatus] = useState("idle");

    // Mute/deafen state
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);

    // Screen sharing state
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenShareError, setScreenShareError] = useState(null);
    const [selectedScreenPeer, setSelectedScreenPeer] = useState(null);
    const [peersWithScreenShare, setPeersWithScreenShare] = useState(new Set());

    // Speaking indicator
    const [speakingUsers, setSpeakingUsers] = useState(new Set());

    // Sound effects enabled
    const [soundsEnabled, setSoundsEnabled] = useState(true);

    const roomRef = useRef(null);
    const participantsRef = useRef(new Map());

    const handleJoin = useCallback(async () => {
        if (isJoined || isJoining) return;
        setIsJoining(true);
        setError(null);
        setConnectionStatus("connecting");

        try {
            // Get LiveKit token from backend
            const tokenRes = await fetch(`/api/livekit/token?roomId=${VOICE_ROOM_ID}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                },
            });

            if (!tokenRes.ok) throw new Error("Failed to get LiveKit token");
            const { token } = await tokenRes.json();

            // Create and connect LiveKit room
            const room = new Room({
                audio: {
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true,
                },
                video: false,
            });

            await room.connect(LIVEKIT_URL, token);

            roomRef.current = room;

            // Enable audio for local participant
            await room.localParticipant.setMicrophoneEnabled(true);

            // Set up event listeners
            const handleParticipantConnected = (participant) => {
                console.log("Participant connected:", participant.name);
                participantsRef.current.set(participant.sid, participant);

                // Track speaking
                const handleSpeakingChanged = (speaking) => {
                    setSpeakingUsers((prev) => {
                        const next = new Set(prev);
                        if (speaking) {
                            next.add(participant.sid);
                        } else {
                            next.delete(participant.sid);
                        }
                        return next;
                    });
                };

                // Track screen share
                const handleTrackSubscribed = (track) => {
                    if (track.kind === "video") {
                        setRemoteScreenShares((prev) => ({
                            ...prev,
                            [participant.sid]: track,
                        }));
                        setPeersWithScreenShare((prev) => new Set([...prev, participant.sid]));
                    }
                };

                const handleTrackUnsubscribed = (track) => {
                    if (track.kind === "video") {
                        setRemoteScreenShares((prev) => {
                            const next = { ...prev };
                            delete next[participant.sid];
                            return next;
                        });
                        setPeersWithScreenShare((prev) => {
                            const next = new Set(prev);
                            next.delete(participant.sid);
                            return next;
                        });
                    }
                };

                participant.on("trackSubscribed", handleTrackSubscribed);
                participant.on("trackUnsubscribed", handleTrackUnsubscribed);
                participant.on("speakingChanged", handleSpeakingChanged);

                // Update voice users list
                updateVoiceUsers(room);
            };

            const handleParticipantDisconnected = (participant) => {
                console.log("Participant disconnected:", participant.name);
                participantsRef.current.delete(participant.sid);
                setSpeakingUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(participant.sid);
                    return next;
                });
                setRemoteScreenShares((prev) => {
                    const next = { ...prev };
                    delete next[participant.sid];
                    return next;
                });
                setPeersWithScreenShare((prev) => {
                    const next = new Set(prev);
                    next.delete(participant.sid);
                    return next;
                });
                updateVoiceUsers(room);
            };

            room.on("participantConnected", handleParticipantConnected);
            room.on("participantDisconnected", handleParticipantDisconnected);

            // Subscribe to existing participants
            room.participants.forEach(handleParticipantConnected);

            setIsJoined(true);
            setConnectionStatus("connected");
            playSound("join", soundsEnabled);
            updateVoiceUsers(room);

        } catch (joinError) {
            console.error("Failed to join voice channel:", joinError);
            setError("Failed to join voice channel: " + joinError.message);
            setConnectionStatus("failed");
        } finally {
            setIsJoining(false);
        }
    }, [isJoined, isJoining, soundsEnabled]);


    const handleLeave = useCallback(async () => {
        playSound("leave", soundsEnabled);

        if (roomRef.current) {
            await roomRef.current.disconnect();
            roomRef.current = null;
        }

        participantsRef.current.clear();
        setRemoteScreenShares({});
        setPeersWithScreenShare(new Set());
        setVoiceUsers([]);
        setIsJoined(false);
        setError(null);
        setConnectionStatus("idle");
        setSpeakingUsers(new Set());
        setIsScreenSharing(false);
        setScreenShareError(null);
        setSelectedScreenPeer(null);
        setIsMuted(false);
        setIsDeafened(false);
    }, [soundsEnabled]);

    const handleShareScreen = useCallback(async () => {
        if (isScreenSharing || !roomRef.current) return;

        try {
            setScreenShareError(null);
            await roomRef.current.localParticipant.setScreenShareEnabled(true);
            playSound("shareStart", soundsEnabled);
            setIsScreenSharing(true);
        } catch (err) {
            console.error("Screen share error:", err);
            setScreenShareError("Failed to start screen sharing");
        }
    }, [isScreenSharing, soundsEnabled]);

    const handleStopScreenShare = useCallback(async () => {
        if (!isScreenSharing || !roomRef.current) return;

        try {
            await roomRef.current.localParticipant.setScreenShareEnabled(false);
            playSound("shareStop", soundsEnabled);
            setIsScreenSharing(false);
            setScreenShareError(null);
        } catch (err) {
            console.error("Error stopping screen share:", err);
            setScreenShareError("Failed to stop screen sharing");
        }
    }, [isScreenSharing, soundsEnabled]);

    const handleToggleMute = useCallback(async () => {
        if (!roomRef.current) return;

        const newMutedState = !isMuted;
        await roomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState);
        playSound("mute", soundsEnabled);
        setIsMuted(newMutedState);
    }, [isMuted, soundsEnabled]);

    const handleToggleDeafen = useCallback(() => {
        const audioElements = document.querySelectorAll("audio");
        const newDeafenState = !isDeafened;
        audioElements.forEach((audio) => {
            audio.muted = newDeafenState;
        });

        playSound("deafen", soundsEnabled);
        setIsDeafened(newDeafenState);
    }, [isDeafened, soundsEnabled]);

    const updateVoiceUsers = (room) => {
        const users = [
            {
                socketId: room.localParticipant.identity,
                displayName: room.localParticipant.name || room.localParticipant.identity,
                isLocal: true,
            },
            ...Array.from(room.participants.values()).map((p) => ({
                socketId: p.identity,
                displayName: p.name || p.identity,
                isLocal: false,
            })),
        ];
        setVoiceUsers(users);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
        };
    }, []);

    // Inject speaking indicator animations
    useEffect(() => {
        const styleEl = document.createElement("style");
        styleEl.textContent = speakingStyles;
        document.head.appendChild(styleEl);
        return () => styleEl.remove();
    }, []);

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
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Screen Share Display (only show when selected) */}
                    {selectedScreenPeer && remoteScreenShares[selectedScreenPeer] && (
                        <div className="flex-1 bg-black rounded mb-2 overflow-hidden">
                            <video
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain"
                                ref={(node) => {
                                    if (node && remoteScreenShares[selectedScreenPeer]) {
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
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold ${speakingUsers.has(voiceUser.socketId) ? "speaking-indicator" : ""
                                            }`}>
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
            </div>
        </div>
    );
}
