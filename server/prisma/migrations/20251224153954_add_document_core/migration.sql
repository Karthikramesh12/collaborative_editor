/*
  Warnings:

  - You are about to drop the `DocumentChange` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentChange" DROP CONSTRAINT "DocumentChange_documentId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentChange" DROP CONSTRAINT "DocumentChange_userId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentSnapshot" DROP CONSTRAINT "DocumentSnapshot_documentId_fkey";

-- AlterTable
ALTER TABLE "Editor" ADD COLUMN     "invitedBy" TEXT;

-- DropTable
DROP TABLE "DocumentChange";

-- DropTable
DROP TABLE "DocumentSnapshot";
