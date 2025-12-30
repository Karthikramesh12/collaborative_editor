-- CreateTable
CREATE TABLE "Add_document_snapshot_and_operation_log" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Add_document_snapshot_and_operation_log_pkey" PRIMARY KEY ("id")
);
