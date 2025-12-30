/*
  Warnings:

  - You are about to drop the column `serverSeq` on the `DocumentSnapShot` table. All the data in the column will be lost.
  - Added the required column `version` to the `DocumentSnapShot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentSnapShot" DROP COLUMN "serverSeq",
ADD COLUMN     "version" INTEGER NOT NULL;
