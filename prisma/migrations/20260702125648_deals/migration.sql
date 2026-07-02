-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('open', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('text', 'offer', 'system');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('active', 'accepted', 'declined', 'superseded');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "reserved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'text',
ADD COLUMN     "offerPrice" INTEGER,
ADD COLUMN     "offerStatus" "OfferStatus";

-- CreateTable
CREATE TABLE "Deal" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'open',
    "buyerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sellerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_buyerId_idx" ON "Deal"("buyerId");

-- CreateIndex
CREATE INDEX "Deal_sellerId_idx" ON "Deal"("sellerId");

-- CreateIndex
CREATE INDEX "Deal_listingId_status_idx" ON "Deal"("listingId", "status");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
