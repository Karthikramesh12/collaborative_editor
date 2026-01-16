/*
  Warnings:

  - You are about to drop the column `mountPath` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the `File` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FileOplogs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FileSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FsType" AS ENUM ('FILE', 'DIR');

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "FileOplogs" DROP CONSTRAINT "FileOplogs_fileId_fkey";

-- DropForeignKey
ALTER TABLE "FileSnapshot" DROP CONSTRAINT "FileSnapshot_fileId_fkey";

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "mountPath";

-- DropTable
DROP TABLE "File";

-- DropTable
DROP TABLE "FileOplogs";

-- DropTable
DROP TABLE "FileSnapshot";

-- CreateTable
CREATE TABLE "FsNode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FsType" NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FsNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FsSnapshot" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FsOpLog" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "serverSeq" INTEGER NOT NULL,
    "op" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FsOpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FsNode_workspaceId_parentId_name_key" ON "FsNode"("workspaceId", "parentId", "name");

-- CreateIndex
CREATE INDEX "FsSnapshot_nodeId_version_idx" ON "FsSnapshot"("nodeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FsOpLog_nodeId_serverSeq_key" ON "FsOpLog"("nodeId", "serverSeq");

-- AddForeignKey
ALTER TABLE "FsNode" ADD CONSTRAINT "FsNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FsNode" ADD CONSTRAINT "FsNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FsSnapshot" ADD CONSTRAINT "FsSnapshot_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FsNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FsOpLog" ADD CONSTRAINT "FsOpLog_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FsNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
