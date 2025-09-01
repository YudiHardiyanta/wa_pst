-- CreateTable
CREATE TABLE `ticket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telepon` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `chat_pertama` VARCHAR(191) NOT NULL,
    `ticket_hash` VARCHAR(191) NOT NULL,
    `is_selesai` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_hash` VARCHAR(191) NOT NULL,
    `telepon` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `chat` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
