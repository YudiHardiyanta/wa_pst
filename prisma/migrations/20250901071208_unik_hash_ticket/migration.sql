/*
  Warnings:

  - A unique constraint covering the columns `[ticket_hash]` on the table `ticket` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `ticket_ticket_hash_key` ON `ticket`(`ticket_hash`);
