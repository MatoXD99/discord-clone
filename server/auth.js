import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({});
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Register a new user
export async function register(username, password) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { username },
    });

    if (existingUser) {
        throw new Error("Username already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
        data: {
            username,
            password: hashedPassword,
        },
    });

    return { id: user.id, username: user.username };
}

// Login user and return JWT
export async function login(username, password) {
    // Find user
    const user = await prisma.user.findUnique({
        where: { username },
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        throw new Error("Invalid password");
    }

    // Generate JWT
    const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "24h" }
    );

    return { token, user: { id: user.id, username: user.username } };
}

// Verify JWT token
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error("Invalid token");
    }
}

// Get user by ID
export async function getUserById(id) {
    return prisma.user.findUnique({
        where: { id },
    });
}
