/*
  Warnings:

  - You are about to drop the `FsNode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FsOpLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FsSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FsNode" DROP CONSTRAINT "FsNode_parentId_fkey";

-- DropForeignKey
ALTER TABLE "FsNode" DROP CONSTRAINT "FsNode_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "FsOpLog" DROP CONSTRAINT "FsOpLog_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "FsSnapshot" DROP CONSTRAINT "FsSnapshot_nodeId_fkey";

-- DropTable
DROP TABLE "FsNode";

-- DropTable
DROP TABLE "FsOpLog";

-- DropTable
DROP TABLE "FsSnapshot";

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FsType" NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileSnapShot" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileSnapShot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileOpLog" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "serverSeq" INTEGER NOT NULL,
    "op" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileOpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_workspaceId_parentId_name_key" ON "File"("workspaceId", "parentId", "name");

-- CreateIndex
CREATE INDEX "FileSnapShot_nodeId_version_idx" ON "FileSnapShot"("nodeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FileOpLog_nodeId_serverSeq_key" ON "FileOpLog"("nodeId", "serverSeq");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileSnapShot" ADD CONSTRAINT "FileSnapShot_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileOpLog" ADD CONSTRAINT "FileOpLog_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
