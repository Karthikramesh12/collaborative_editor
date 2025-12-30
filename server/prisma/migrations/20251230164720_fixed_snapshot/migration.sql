/*
  Warnings:

  - You are about to drop the column `version` on the `DocumentSnapShot` table. All the data in the column will be lost.
  - Added the required column `serverSeq` to the `DocumentSnapShot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentSnapShot" DROP COLUMN "version",
ADD COLUMN     "serverSeq" INTEGER NOT NULL;
