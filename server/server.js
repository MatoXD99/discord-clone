import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { register, login, verifyToken } from "./auth.js";
import { setupSocketHandlers, getChannels } from "./socket.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Trust reverse proxy headers (required when app runs behind Nginx/Traefik/etc.)
app.set("trust proxy", 1);

// Middleware
app.use(express.json());

// Add CORS headers middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Create images directory if it doesn't exist
const imagesDir = path.join(__dirname, "images");
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// Configure multer for file uploads (memory storage for processing)
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

// Serve static files from images directory
app.use("/images", express.static(imagesDir));

// Initialize Socket.IO with CORS configuration
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"], // Support both WS and polling
});

// ============ Auth Routes ============

// Register endpoint
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

// Login endpoint
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

// Get channels list
app.get("/api/channels", (req, res) => {
    res.json(getChannels());
});

// Health check
app.get("/", (req, res) => {
    res.send("Cordor Socket.IO server is running");
});

// File upload endpoint with metadata stripping
app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        // Generate filename with timestamp and random bytes
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.webp`;
        const filepath = path.join(imagesDir, filename);

        // Process image with Sharp to strip all metadata and convert to webp
        await sharp(req.file.buffer)
            .withMetadata(false) // Strip all EXIF and metadata
            .webp({ quality: 85 })
            .toFile(filepath);

        const host = req.get("host");
        const protocol = req.protocol;
        const fileUrl = `${protocol}://${host}/images/${filename}`;
        res.json({ fileUrl });
    } catch (error) {
        console.error("Image processing error:", error);
        res.status(500).json({ error: "Failed to process image: " + error.message });
    }
});

// ============ Setup Socket.IO ============
setupSocketHandlers(io);

// ============ Start Server ============
const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
