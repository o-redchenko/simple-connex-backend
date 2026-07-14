import { Prisma } from "@prisma/client";

export type PrismaToFront<T> = {
  [K in keyof T]: T[K] extends Prisma.Decimal | Prisma.Decimal | null
    ? number
    : T[K] extends Prisma.Decimal | null
      ? number | null
      : T[K];
};
