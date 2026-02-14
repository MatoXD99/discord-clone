import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { AccessToken } from "livekit-server-sdk";
import { register, login, verifyToken, serializeUser } from "./auth.js";
import { setupSocketHandlers, getServersWithChannels } from "./socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL || "";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();
app.set("trust proxy", true);
const httpServer = createServer(app);

app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

const imagesDir = path.join(__dirname, "images");
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}


const resolvePublicBaseUrl = (req) => {
    const explicit = process.env.PUBLIC_API_BASE_URL?.trim();
    if (explicit) {
        return explicit.replace(/\/+$/, "");
    }

    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || req.protocol || "http";
    const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
    return `${protocol}://${host}`;
};

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"), false);
        }
    },
});

app.use("/images", express.static(imagesDir));

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
});

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: "Missing auth token" });
    }

    try {
        const decoded = verifyToken(token);
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ error: error.message || "Invalid token" });
    }
};

const sanitizeProfileUpdate = ({ displayName, email }) => {
    const cleanDisplayName = typeof displayName === "string" ? displayName.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    return {
        displayName: cleanDisplayName,
        email: cleanEmail,
    };
};

app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res
                .status(400)
                .json({ error: "Username and password required" });
        }

        const user = await register(username, password);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res
                .status(400)
                .json({ error: "Username and password required" });
        }

        const { token, user } = await login(username, password);
        res.json({ token, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get("/api/me", requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: serializeUser(user) });
});

app.put("/api/me", requireAuth, async (req, res) => {
    const { displayName, email } = sanitizeProfileUpdate(req.body || {});

    if (!displayName) {
        return res.status(400).json({ error: "Display name is required" });
    }

    if (displayName.length > 40) {
        return res.status(400).json({ error: "Display name must be 40 characters or fewer" });
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    try {
        const user = await prisma.user.update({
            where: { id: req.userId },
            data: {
                displayName,
                email: email || null,
            },
        });

        res.json({ user: serializeUser(user) });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(400).json({ error: "Email is already in use" });
        }
        res.status(400).json({ error: error.message || "Failed to update profile" });
    }
});

app.post("/api/me/avatar", requireAuth, upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.webp`;
        const filepath = path.join(imagesDir, filename);

        await sharp(req.file.buffer)
            .resize(256, 256, { fit: "cover" })
            .withMetadata(false)
            .webp({ quality: 85 })
            .toFile(filepath);

        const avatarUrl = `${resolvePublicBaseUrl(req)}/images/${filename}`;

        const user = await prisma.user.update({
            where: { id: req.userId },
            data: { avatarUrl },
        });

        res.json({ user: serializeUser(user) });
    } catch (error) {
        console.error("Avatar upload error:", error);
        res.status(500).json({ error: "Failed to upload avatar" });
    }
});

app.get("/api/servers", requireAuth, async (req, res) => {
    const servers = await getServersWithChannels();
    res.json({ servers });
});

app.get("/api/users", requireAuth, async (req, res) => {
    const users = await prisma.user.findMany({
        where: { id: { not: req.userId } },
        orderBy: { username: "asc" },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    res.json({
        users: users.map((u) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName || u.username,
            avatarUrl: u.avatarUrl,
        })),
    });
});

app.get("/api/livekit/token", requireAuth, async (req, res) => {
    try {
        const { roomId } = req.query;

        if (!roomId) {
            return res.status(400).json({ error: "roomId is required" });
        }

        if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
            return res.status(500).json({ error: "LiveKit credentials not configured" });
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: req.userId,
                name: user.displayName || user.username,
            }
        );

        at.addGrant({ roomJoin: true, room: `voice-${roomId}`, canPublish: true, canPublishData: true });

        res.json({ token: at.toJwt() });
    } catch (error) {
        console.error("LiveKit token error:", error);
        res.status(500).json({ error: "Failed to generate token" });
    }
});

app.get("/", (req, res) => {
    res.send("Cordor Socket.IO server is running");
});

app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.webp`;
        const filepath = path.join(imagesDir, filename);

        await sharp(req.file.buffer)
            .withMetadata(false)
            .webp({ quality: 85 })
            .toFile(filepath);

        const fileUrl = `${resolvePublicBaseUrl(req)}/images/${filename}`;
        res.json({ fileUrl });
    } catch (error) {
        console.error("Image processing error:", error);
        res.status(500).json({ error: "Failed to process image: " + error.message });
    }
});

setupSocketHandlers(io);

const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
