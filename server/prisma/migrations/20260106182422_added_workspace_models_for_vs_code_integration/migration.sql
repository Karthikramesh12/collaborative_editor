/*
  Warnings:

  - You are about to drop the column `version` on the `FileOplogs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileId,serverSeq]` on the table `FileOplogs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serverSeq` to the `FileOplogs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "FileOplogs_fileId_version_idx";

-- AlterTable
ALTER TABLE "FileOplogs" DROP COLUMN "version",
ADD COLUMN     "serverSeq" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FileOplogs_fileId_serverSeq_key" ON "FileOplogs"("fileId", "serverSeq");
