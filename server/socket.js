import "dotenv/config";
import { verifyToken } from "./auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({});

const channels = [
    { id: "general", name: "general" },
    { id: "random", name: "random" },
    { id: "announcements", name: "announcements" },
    { id: "help", name: "help" },
];
const userChannels = new Map();

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

async function initializeChannels() {
    for (const channel of channels) {
        await prisma.channel.upsert({
            where: { name: channel.name },
            update: {},
            create: { name: channel.name },
        });
    }
    console.log("✅ Channels initialized in database");
}

export async function setupSocketHandlers(io) {
    await initializeChannels();

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = verifyToken(token);
            socket.userId = decoded.id;
            socket.username = decoded.username;
            next();
        } catch {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        const connectedUser = await prisma.user.findUnique({ where: { id: socket.userId } });
        if (!connectedUser) {
            socket.disconnect();
            return;
        }

        socket.profile = {
            id: connectedUser.id,
            username: connectedUser.username,
            displayName: connectedUser.displayName || connectedUser.username,
            avatarUrl: connectedUser.avatarUrl,
        };

        socket.on("join_channel", async (channelName) => {
            const previousChannel = Array.from(socket.rooms).find(
                (room) => room !== socket.id && channels.some(c => c.name === room)
            );
            if (previousChannel) {
                socket.leave(previousChannel);
            }

            const channel = channels.find(c => c.name === channelName);
            if (!channel) return;

            socket.join(channelName);
            userChannels.set(socket.id, socket.profile.displayName);

            try {
                const dbChannel = await prisma.channel.findUnique({
                    where: { name: channelName },
                    include: {
                        messages: {
                            include: { user: true },
                            orderBy: { timestamp: "asc" },
                            take: 100,
                        },
                    },
                });

                if (dbChannel) {
                    socket.emit("message_history", dbChannel.messages.map(toMessagePayload));
                }
            } catch (error) {
                console.error("Error loading message history:", error);
            }

            io.to(channelName).emit("receive_message", {
                type: "system",
                username: "System",
                text: `${socket.profile.displayName} joined the channel`,
                timestamp: new Date(),
            });
        });

        socket.on("send_message", async (data) => {
            const currentChannel = Array.from(socket.rooms).find(
                (room) => room !== socket.id && channels.some(c => c.name === room)
            );

            if (!currentChannel) {
                socket.emit("error", "Not in a channel");
                return;
            }

            try {
                const channel = await prisma.channel.findUnique({
                    where: { name: currentChannel },
                });

                if (!channel) return;

                const savedMessage = await prisma.message.create({
                    data: {
                        type: data.type || "text",
                        text: data.text,
                        fileUrl: data.fileUrl,
                        userId: socket.userId,
                        channelId: channel.id,
                    },
                    include: { user: true },
                });

                io.to(currentChannel).emit("receive_message", toMessagePayload(savedMessage));
            } catch (error) {
                console.error("Error saving message:", error);
                socket.emit("error", "Failed to save message");
            }
        });

        socket.on("disconnect", () => {
            const username = userChannels.get(socket.id);
            userChannels.delete(socket.id);

            channels.forEach((channel) => {
                if (socket.rooms.has(channel.name)) {
                    io.to(channel.name).emit("receive_message", {
                        type: "system",
                        username: "System",
                        text: `${username} left the chat`,
                        timestamp: new Date(),
                    });
                }
            });
        });

        socket.on("error", (error) => {
            console.error(`❌ Socket error from ${socket.id}:`, error);
        });
    });
}

export function getChannels() {
    return channels.map(c => ({ id: c.id, name: `# ${c.name}` }));
}

export async function getChannelMessages(channelName) {
    const channel = await prisma.channel.findUnique({
        where: { name: channelName },
        include: {
            messages: {
                include: { user: true },
                orderBy: { timestamp: "desc" },
                take: 100,
            },
        },
    });

    if (!channel) return [];

    return channel.messages
        .reverse()
        .map(toMessagePayload);
}
