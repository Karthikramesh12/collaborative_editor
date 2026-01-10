-- DropForeignKey
ALTER TABLE "FileSnapshot" DROP CONSTRAINT "FileSnapshot_fileId_fkey";

-- AddForeignKey
ALTER TABLE "FileSnapshot" ADD CONSTRAINT "FileSnapshot_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
