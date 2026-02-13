import "dotenv/config";
import { verifyToken } from "./auth.js";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({});

// Channel definitions
const channels = [
    { id: "general", name: "general" },
    { id: "random", name: "random" },
    { id: "announcements", name: "announcements" },
    { id: "help", name: "help" },
];
const userChannels = new Map(); // socket.id -> username

// Initialize channels in database on startup
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

// Setup Socket.IO event handlers
export async function setupSocketHandlers(io) {
    // Initialize channels
    await initializeChannels();

    // Middleware to verify JWT on connection
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        console.log("🔍 Socket auth attempt, token present:", !!token);

        if (!token) {
            console.error("❌ No token provided");
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = verifyToken(token);
            socket.userId = decoded.id;
            socket.username = decoded.username;
            console.log(`✅ Socket authenticated: ${socket.username} (${socket.id})`);
            next();
        } catch (error) {
            console.error("❌ Token verification failed:", error.message);
            next(new Error("Authentication error: Invalid token"));
        }
    });

    // Handle new connections
    io.on("connection", (socket) => {
        console.log(`✅ User connected: ${socket.username} (${socket.id})`);

        // Handle user joining a channel
        socket.on("join_channel", async (channelName) => {
            // Leave previous channel
            const previousChannel = Array.from(socket.rooms).find(
                (room) => room !== socket.id && channels.some(c => c.name === room)
            );
            if (previousChannel) {
                socket.leave(previousChannel);
            }

            // Join new channel
            const channel = channels.find(c => c.name === channelName);
            if (channel) {
                socket.join(channelName);
                userChannels.set(socket.id, socket.username);

                // Load and send message history from database
                try {
                    const dbChannel = await prisma.channel.findUnique({
                        where: { name: channelName },
                        include: {
                            messages: {
                                include: { user: true },
                                orderBy: { timestamp: "asc" },
                                take: 100, // Last 100 messages
                            },
                        },
                    });

                    if (dbChannel) {
                        const messageHistory = dbChannel.messages.map(msg => ({
                            type: msg.type,
                            username: msg.user.username,
                            text: msg.text,
                            fileUrl: msg.fileUrl,
                            timestamp: msg.timestamp,
                        }));
                        socket.emit("message_history", messageHistory);
                    }
                } catch (error) {
                    console.error("Error loading message history:", error);
                }

                // Notify others that user joined
                io.to(channelName).emit("receive_message", {
                    type: "system",
                    username: "System",
                    text: `${socket.username} joined the channel`,
                    timestamp: new Date(),
                });

                console.log(`📝 ${socket.username} joined #${channelName}`);
            }
        });

        // Handle incoming messages
        socket.on("send_message", async (data) => {
            // Find which channel the user is in
            const currentChannel = Array.from(socket.rooms).find(
                (room) => room !== socket.id && channels.some(c => c.name === room)
            );

            if (!currentChannel) {
                socket.emit("error", "Not in a channel");
                return;
            }

            try {
                // Get channel and user from database
                const channel = await prisma.channel.findUnique({
                    where: { name: currentChannel },
                });

                if (!channel) return;

                // Save message to database
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

                // Create broadcast object
                const message = {
                    type: savedMessage.type,
                    username: socket.username,
                    text: savedMessage.text,
                    fileUrl: savedMessage.fileUrl,
                    timestamp: savedMessage.timestamp,
                };

                // Broadcast to channel
                io.to(currentChannel).emit("receive_message", message);

                console.log(
                    `📨 Message in #${currentChannel} from ${socket.username}: ${data.text || "(image)"}`
                );
            } catch (error) {
                console.error("Error saving message:", error);
                socket.emit("error", "Failed to save message");
            }
        });

        // Handle user disconnection
        socket.on("disconnect", () => {
            const username = userChannels.get(socket.id);
            userChannels.delete(socket.id);

            // Find which channel the user was in and notify
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

            console.log(`❌ User disconnected: ${socket.id} (${username})`);
        });

        // Handle errors
        socket.on("error", (error) => {
            console.error(`❌ Socket error from ${socket.id}:`, error);
        });
    });
}

// Get list of channels
export function getChannels() {
    return channels.map(c => ({ id: c.id, name: `# ${c.name}` }));
}

// Get messages for a channel
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
        .map(msg => ({
            type: msg.type,
            username: msg.user.username,
            text: msg.text,
            fileUrl: msg.fileUrl,
            timestamp: msg.timestamp,
        }));
}
