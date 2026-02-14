import "dotenv/config";
import { verifyToken } from "./auth.js";
import { registerVoiceHandlers } from "./voice.js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || "";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const capabilities = {
    server: typeof prisma.server !== "undefined",
    friendship: typeof prisma.friendship !== "undefined",
    dmConversation: typeof prisma.dMConversation !== "undefined",
    dmParticipant: typeof prisma.dMParticipant !== "undefined",
    directMessage: typeof prisma.directMessage !== "undefined",
};

const defaultServers = [
    { name: "Lake House", channels: ["general", "random", "announcements", "help"] },
    { name: "Test Server", channels: ["general"] },
];

const toUserSummary = (user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl,
});

const toMessagePayload = (msg) => ({
    id: msg.id,
    type: msg.type,
    userId: msg.user.id,
    username: msg.user.username,
    displayName: msg.user.displayName || msg.user.username,
    avatarUrl: msg.user.avatarUrl,
    text: msg.text,
    fileUrl: msg.fileUrl,
    timestamp: msg.timestamp,
});

const toDMMessagePayload = (msg) => ({ ...toMessagePayload(msg), conversationId: msg.conversationId });
const channelRoom = (serverId, channelId) => `channel:${serverId}:${channelId}`;
const dmRoom = (conversationId) => `dm:${conversationId}`;

async function initializeServersAndChannels() {
    if (!capabilities.server) {
        console.warn("⚠️ Prisma client missing Server model; using legacy single-server compatibility mode");
        return;
    }

    for (const serverConfig of defaultServers) {
        const server = await prisma.server.upsert({
            where: { name: serverConfig.name },
            update: {},
            create: { name: serverConfig.name },
        });

        for (const channelName of serverConfig.channels) {
            await prisma.channel.upsert({
                where: { serverId_name: { serverId: server.id, name: channelName } },
                update: {},
                create: { name: channelName, serverId: server.id },
            });
        }
    }

    console.log("✅ Servers/channels initialized in database");
}

const getLegacyServersPayload = async () => {
    const channels = await prisma.channel.findMany({ orderBy: { createdAt: "asc" } });
    return [{
        id: 1,
        name: "Lake House",
        channels: channels.map((channel) => ({ id: channel.id, name: channel.name })),
    }];
};

const getServersPayload = async () => {
    if (!capabilities.server) return getLegacyServersPayload();

    const servers = await prisma.server.findMany({
        include: { channels: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
    });

    return servers.map((server) => ({
        id: server.id,
        name: server.name,
        channels: server.channels.map((channel) => ({ id: channel.id, name: channel.name })),
    }));
};

const getFriendshipsForUser = async (userId) => {
    if (!capabilities.friendship) return { friends: [], pendingIncoming: [], pendingOutgoing: [] };

    const relationships = await prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: { requester: true, addressee: true },
        orderBy: { updatedAt: "desc" },
    });

    const friends = [];
    const pendingIncoming = [];
    const pendingOutgoing = [];

    for (const row of relationships) {
        const isRequester = row.requesterId === userId;
        const other = isRequester ? row.addressee : row.requester;
        const entry = { id: row.id, user: toUserSummary(other), status: row.status };

        if (row.status === "accepted") friends.push(entry);
        else if (row.status === "pending" && isRequester) pendingOutgoing.push(entry);
        else if (row.status === "pending") pendingIncoming.push(entry);
    }

    return { friends, pendingIncoming, pendingOutgoing };
};

const getOrCreateDmConversation = async (userAId, userBId) => {
    if (!capabilities.dmConversation) return null;

    const existing = await prisma.dMConversation.findFirst({
        where: { participants: { every: { userId: { in: [userAId, userBId] } } } },
        include: { participants: { include: { user: true } } },
    });

    if (existing && existing.participants.length === 2) return existing;

    return prisma.dMConversation.create({
        data: { participants: { create: [{ userId: userAId }, { userId: userBId }] } },
        include: { participants: { include: { user: true } } },
    });
};

const getDmListForUser = async (userId) => {
    if (!capabilities.dmConversation || !capabilities.directMessage) return [];

    const conversations = await prisma.dMConversation.findMany({
        where: { participants: { some: { userId } } },
        include: {
            participants: { include: { user: true } },
            messages: { include: { user: true }, orderBy: { timestamp: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
    });

    return conversations
        .map((conversation) => {
            const other = conversation.participants.find((p) => p.userId !== userId)?.user;
            return {
                id: conversation.id,
                user: other ? toUserSummary(other) : null,
                lastMessage: conversation.messages[0] ? toDMMessagePayload(conversation.messages[0]) : null,
            };
        })
        .filter((conv) => conv.user);
};

export async function setupSocketHandlers(io) {
    await initializeServersAndChannels();

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication error: No token provided"));

        try {
            const decoded = verifyToken(token);
            socket.userId = decoded.id;
            next();
        } catch {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        const connectedUser = await prisma.user.findUnique({ where: { id: socket.userId } });
        if (!connectedUser) return socket.disconnect();

        socket.profile = toUserSummary(connectedUser);
        socket.currentChannel = null;
        socket.data.voiceRoom = null;
        socket.join(`user:${socket.userId}`);

        socket.emit("dm_list", await getDmListForUser(socket.userId));
        socket.emit("friends_state", await getFriendshipsForUser(socket.userId));

        socket.on("join_channel", async (input) => {
            if (socket.currentChannel) socket.leave(socket.currentChannel);

            const payload = typeof input === "object" && input !== null ? input : { channelId: input };
            const channelId = Number(payload.channelId);
            const serverId = Number(payload.serverId || 1);
            if (!channelId) return;

            const channelWhere = capabilities.server ? { id: channelId, serverId } : { id: channelId };
            const channel = await prisma.channel.findFirst({
                where: channelWhere,
                include: { messages: { include: { user: true }, orderBy: { timestamp: "asc" }, take: 100 } },
            });

            if (!channel) return;

            const room = channelRoom(serverId, channelId);
            socket.currentChannel = room;
            socket.join(room);
            socket.emit("message_history", channel.messages.map(toMessagePayload));
        });

        socket.on("join_dm", async (conversationId) => {
            if (!capabilities.dmParticipant || !capabilities.directMessage) return;
            const participant = await prisma.dMParticipant.findFirst({ where: { conversationId, userId: socket.userId } });
            if (!participant) return;

            socket.join(dmRoom(conversationId));
            const messages = await prisma.directMessage.findMany({
                where: { conversationId }, include: { user: true }, orderBy: { timestamp: "asc" }, take: 100,
            });
            socket.emit("dm_history", { conversationId, messages: messages.map(toDMMessagePayload) });
        });

        socket.on("send_message", async (data) => {
            if (!socket.currentChannel) return socket.emit("error", "Not in a channel");

            const [, serverIdString, channelIdString] = socket.currentChannel.split(":");
            const channelId = Number(channelIdString);
            const serverId = Number(serverIdString);
            const channelWhere = capabilities.server ? { id: channelId, serverId } : { id: channelId };

            const channel = await prisma.channel.findFirst({ where: channelWhere });
            if (!channel) return;

            const savedMessage = await prisma.message.create({
                data: { type: data.type || "text", text: data.text, fileUrl: data.fileUrl, userId: socket.userId, channelId: channel.id },
                include: { user: true },
            });

            io.to(socket.currentChannel).emit("receive_message", toMessagePayload(savedMessage));
        });

        socket.on("send_dm", async (data) => {
            if (!capabilities.dmParticipant || !capabilities.directMessage || !capabilities.dmConversation) return;
            const { conversationId, text, fileUrl, type } = data || {};
            if (!conversationId) return;

            const participant = await prisma.dMParticipant.findFirst({ where: { conversationId, userId: socket.userId } });
            if (!participant) return;

            const saved = await prisma.directMessage.create({
                data: { conversationId, userId: socket.userId, text, fileUrl, type: type || "text" },
                include: { user: true },
            });

            await prisma.dMConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
            io.to(dmRoom(conversationId)).emit("receive_dm", toDMMessagePayload(saved));

            const participants = await prisma.dMParticipant.findMany({ where: { conversationId } });
            for (const p of participants) io.to(`user:${p.userId}`).emit("dm_list", await getDmListForUser(p.userId));
        });

        socket.on("start_dm", async (targetUserId) => {
            if (!capabilities.dmConversation) return;
            if (!targetUserId || targetUserId === socket.userId) return;

            const target = await prisma.user.findUnique({ where: { id: targetUserId } });
            if (!target) return;

            const conversation = await getOrCreateDmConversation(socket.userId, targetUserId);
            if (!conversation) return;
            socket.emit("dm_started", { id: conversation.id, user: toUserSummary(target) });
            socket.emit("dm_list", await getDmListForUser(socket.userId));
            io.to(`user:${targetUserId}`).emit("dm_list", await getDmListForUser(targetUserId));
        });

        socket.on("send_friend_request", async (targetUserId) => {
            if (!capabilities.friendship) return;
            if (!targetUserId || targetUserId === socket.userId) return;

            const [a, b] = socket.userId < targetUserId ? [socket.userId, targetUserId] : [targetUserId, socket.userId];
            const existing = await prisma.friendship.findFirst({
                where: { OR: [{ requesterId: a, addresseeId: b }, { requesterId: b, addresseeId: a }] },
            });

            if (!existing) {
                await prisma.friendship.create({ data: { requesterId: socket.userId, addresseeId: targetUserId, status: "pending" } });
            }

            socket.emit("friends_state", await getFriendshipsForUser(socket.userId));
            io.to(`user:${targetUserId}`).emit("friends_state", await getFriendshipsForUser(targetUserId));
        });

        socket.on("respond_friend_request", async ({ requestId, accept }) => {
            if (!capabilities.friendship) return;

            const friendship = await prisma.friendship.findUnique({ where: { id: requestId } });
            if (!friendship || friendship.addresseeId !== socket.userId) return;

            await prisma.friendship.update({ where: { id: requestId }, data: { status: accept ? "accepted" : "declined" } });
            socket.emit("friends_state", await getFriendshipsForUser(socket.userId));
            io.to(`user:${friendship.requesterId}`).emit("friends_state", await getFriendshipsForUser(friendship.requesterId));

            if (accept && capabilities.dmConversation) {
                await getOrCreateDmConversation(friendship.requesterId, friendship.addresseeId);
                io.to(`user:${socket.userId}`).emit("dm_list", await getDmListForUser(socket.userId));
                io.to(`user:${friendship.requesterId}`).emit("dm_list", await getDmListForUser(friendship.requesterId));
            }
        });

        registerVoiceHandlers(io, socket);
    });
}

export async function getServersWithChannels() {
    return getServersPayload();
}

export async function getChannelMessages(serverId, channelId) {
    const where = capabilities.server ? { id: channelId, serverId } : { id: channelId };
    const channel = await prisma.channel.findFirst({
        where,
        include: { messages: { include: { user: true }, orderBy: { timestamp: "asc" }, take: 100 } },
    });

    if (!channel) return [];
    return channel.messages.map(toMessagePayload);
}
