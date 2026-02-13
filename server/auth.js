import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({});
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export function serializeUser(user) {
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
    };
}

// Register a new user
export async function register(username, password) {
    const existingUser = await prisma.user.findUnique({
        where: { username },
    });

    if (existingUser) {
        throw new Error("Username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            username,
            password: hashedPassword,
            displayName: username,
        },
    });

    return serializeUser(user);
}

// Login user and return JWT
export async function login(username, password) {
    const user = await prisma.user.findUnique({
        where: { username },
    });

    if (!user) {
        throw new Error("User not found");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        throw new Error("Invalid password");
    }

    const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "24h" }
    );

    return { token, user: serializeUser(user) };
}

// Verify JWT token
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        throw new Error("Invalid token");
    }
}

// Get user by ID
export async function getUserById(id) {
    return prisma.user.findUnique({
        where: { id },
    });
}
