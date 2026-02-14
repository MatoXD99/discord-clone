const DEFAULT_VOICE_CHANNEL = "living-room";

const toVoiceRoom = (roomId = DEFAULT_VOICE_CHANNEL) => `voice:${roomId}`;

const getVoiceParticipants = (io, roomName) => {
    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room) return [];

    return [...room]
        .map((socketId) => {
            const peerSocket = io.sockets.sockets.get(socketId);
            if (!peerSocket?.profile) return null;

            return {
                socketId,
                userId: peerSocket.userId,
                displayName: peerSocket.profile.displayName,
            };
        })
        .filter(Boolean);
};

const emitVoiceRoster = (io, roomName, eventName = "join_voice_channel") => {
    io.to(roomName).emit(eventName, {
        roomId: roomName.replace(/^voice:/, ""),
        users: getVoiceParticipants(io, roomName),
    });
};

const relaySignalingEvent = (io, socket, eventName, payload) => {
    const voiceRoom = socket.data.voiceRoom;
    if (!voiceRoom || !payload?.targetSocketId) return;

    const room = io.sockets.adapter.rooms.get(voiceRoom);
    if (!room?.has(socket.id) || !room.has(payload.targetSocketId)) return;

    // Relay signaling to everyone in room (sender included); clients filter by targetSocketId.
    io.to(voiceRoom).emit(eventName, {
        roomId: voiceRoom.replace(/^voice:/, ""),
        sourceSocketId: socket.id,
        targetSocketId: payload.targetSocketId,
        ...(payload.sdp ? { sdp: payload.sdp } : {}),
        ...(payload.candidate ? { candidate: payload.candidate } : {}),
    });
};

export const registerVoiceHandlers = (io, socket) => {
    socket.on("join_voice_channel", (payload) => {
        const roomId = typeof payload?.roomId === "string" && payload.roomId.trim()
            ? payload.roomId.trim()
            : DEFAULT_VOICE_CHANNEL;

        const roomName = toVoiceRoom(roomId);
        const previousRoom = socket.data.voiceRoom;

        if (previousRoom && previousRoom !== roomName) {
            socket.leave(previousRoom);
            emitVoiceRoster(io, previousRoom, "leave_voice_channel");
        }

        socket.join(roomName);
        socket.data.voiceRoom = roomName;
        emitVoiceRoster(io, roomName, "join_voice_channel");
    });

    socket.on("leave_voice_channel", (payload) => {
        const roomName = socket.data.voiceRoom
            || toVoiceRoom(typeof payload?.roomId === "string" ? payload.roomId : DEFAULT_VOICE_CHANNEL);

        socket.leave(roomName);
        socket.data.voiceRoom = null;
        emitVoiceRoster(io, roomName, "leave_voice_channel");
    });

    socket.on("webrtc_offer", (payload) => relaySignalingEvent(io, socket, "webrtc_offer", payload));
    socket.on("webrtc_answer", (payload) => relaySignalingEvent(io, socket, "webrtc_answer", payload));
    socket.on("webrtc_ice_candidate", (payload) => relaySignalingEvent(io, socket, "webrtc_ice_candidate", payload));

    socket.on("disconnecting", () => {
        const roomName = socket.data.voiceRoom;
        if (!roomName) return;

        setTimeout(() => {
            emitVoiceRoster(io, roomName, "leave_voice_channel");
        }, 0);
    });
};
