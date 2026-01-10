-- DropForeignKey
ALTER TABLE "FileOplogs" DROP CONSTRAINT "FileOplogs_fileId_fkey";

-- AddForeignKey
ALTER TABLE "FileOplogs" ADD CONSTRAINT "FileOplogs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
