-- AlterTable
ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "displayName" TEXT,
ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
