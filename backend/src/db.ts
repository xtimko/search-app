import { PrismaClient } from '@prisma/client'

// Единый экземпляр Prisma Client на весь бэкенд.
export const prisma = new PrismaClient()
