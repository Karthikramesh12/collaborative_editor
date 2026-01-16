/*
  Warnings:

  - You are about to drop the column `nodeId` on the `FileOpLog` table. All the data in the column will be lost.
  - You are about to drop the column `nodeId` on the `FileSnapShot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileId,serverSeq]` on the table `FileOpLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fileId` to the `FileOpLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileId` to the `FileSnapShot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FileOpLog" DROP CONSTRAINT "FileOpLog_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "FileSnapShot" DROP CONSTRAINT "FileSnapShot_nodeId_fkey";

-- DropIndex
DROP INDEX "FileOpLog_nodeId_serverSeq_key";

-- DropIndex
DROP INDEX "FileSnapShot_nodeId_version_idx";

-- AlterTable
ALTER TABLE "FileOpLog" DROP COLUMN "nodeId",
ADD COLUMN     "fileId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FileSnapShot" DROP COLUMN "nodeId",
ADD COLUMN     "fileId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FileOpLog_fileId_serverSeq_key" ON "FileOpLog"("fileId", "serverSeq");

-- CreateIndex
CREATE INDEX "FileSnapShot_fileId_version_idx" ON "FileSnapShot"("fileId", "version");

-- AddForeignKey
ALTER TABLE "FileSnapShot" ADD CONSTRAINT "FileSnapShot_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileOpLog" ADD CONSTRAINT "FileOpLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
