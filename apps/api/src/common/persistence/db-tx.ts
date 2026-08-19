import type { Prisma } from '../../generated/prisma/client';

/**
 * The transaction handle used across application/infrastructure layers.
 *
 * D-032: a single type alias is the ONLY coupling the application layer has
 * to Prisma — a compile-time import, zero runtime dependency. Repository
 * ports are declared against this alias; the concrete client stays in
 * infrastructure. If the ORM is ever swapped, this file is the blast radius.
 */
export type DbTx = Prisma.TransactionClient;
