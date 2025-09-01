-- AlterTable
ALTER TABLE `conversations` ADD COLUMN `nama_anonim` VARCHAR(191) NULL,
    ADD COLUMN `telepon_anonim` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ticket` ADD COLUMN `nama_anonim` VARCHAR(191) NULL,
    ADD COLUMN `telepon_anonim` VARCHAR(191) NULL;
