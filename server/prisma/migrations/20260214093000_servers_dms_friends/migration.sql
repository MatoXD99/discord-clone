-- CreateTable
CREATE TABLE "Server" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- Seed default servers
INSERT INTO "Server" ("name") VALUES ('Lake House'), ('Test Server') ON CONFLICT ("name") DO NOTHING;

-- Add serverId to Channel
ALTER TABLE "Channel" ADD COLUMN "serverId" INTEGER;

-- Assign existing channels to Lake House
UPDATE "Channel"
SET "serverId" = (SELECT "id" FROM "Server" WHERE "name" = 'Lake House' LIMIT 1)
WHERE "serverId" IS NULL;

ALTER TABLE "Channel" ALTER COLUMN "serverId" SET NOT NULL;

-- Drop old unique and create scoped unique
DROP INDEX IF EXISTS "Channel_name_key";
CREATE UNIQUE INDEX "Channel_serverId_name_key" ON "Channel"("serverId", "name");
CREATE INDEX "Channel_serverId_idx" ON "Channel"("serverId");

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create friendship table
CREATE TABLE "Friendship" (
    "id" SERIAL NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "addresseeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX "Friendship_requesterId_idx" ON "Friendship"("requesterId");
CREATE INDEX "Friendship_addresseeId_idx" ON "Friendship"("addresseeId");

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create DM tables
CREATE TABLE "DMConversation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DMConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DMParticipant" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "DMParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DMParticipant_conversationId_userId_key" ON "DMParticipant"("conversationId", "userId");
CREATE INDEX "DMParticipant_userId_idx" ON "DMParticipant"("userId");

ALTER TABLE "DMParticipant" ADD CONSTRAINT "DMParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DMConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DMParticipant" ADD CONSTRAINT "DMParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DirectMessage" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "fileUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DirectMessage_conversationId_idx" ON "DirectMessage"("conversationId");
CREATE INDEX "DirectMessage_userId_idx" ON "DirectMessage"("userId");
CREATE INDEX "DirectMessage_timestamp_idx" ON "DirectMessage"("timestamp");

ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DMConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure Test Server has a default channel
INSERT INTO "Channel" ("name", "serverId")
SELECT 'general', s."id" FROM "Server" s
WHERE s."name" = 'Test Server'
  AND NOT EXISTS (
      SELECT 1 FROM "Channel" c WHERE c."serverId" = s."id" AND c."name" = 'general'
  );
