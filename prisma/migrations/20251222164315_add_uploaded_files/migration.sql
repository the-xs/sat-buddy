-- AlterTable
ALTER TABLE `questions` ADD COLUMN `file_id` INTEGER NULL,
    MODIFY `question_text` TEXT NOT NULL,
    MODIFY `option_a` TEXT NOT NULL,
    MODIFY `option_b` TEXT NOT NULL,
    MODIFY `option_c` TEXT NOT NULL,
    MODIFY `option_d` TEXT NOT NULL,
    MODIFY `explanation` TEXT NULL;

-- CreateTable
CREATE TABLE `uploaded_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `questions_file_id_idx` ON `questions`(`file_id`);

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
