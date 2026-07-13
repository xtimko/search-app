-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('verified', 'pending');

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "status" "ModelStatus" NOT NULL DEFAULT 'verified';
