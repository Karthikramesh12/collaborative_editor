/*
  Warnings:

  - You are about to drop the column `serverSeq` on the `OperationLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OperationLog" DROP COLUMN "serverSeq";

-- CreateIndex
CREATE INDEX "OperationLog_documentId_version_idx" ON "OperationLog"("documentId", "version");
