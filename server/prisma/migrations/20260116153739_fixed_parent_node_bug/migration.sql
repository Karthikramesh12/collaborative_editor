-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_parentId_fkey";

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
