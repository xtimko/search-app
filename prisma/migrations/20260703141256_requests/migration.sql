-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('active', 'closed');

-- CreateTable
CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "size" TEXT,
    "maxPrice" INTEGER,
    "city" TEXT,
    "comment" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestResponse" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Request_status_createdAt_idx" ON "Request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Request_buyerId_idx" ON "Request"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestResponse_requestId_listingId_key" ON "RequestResponse"("requestId", "listingId");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
