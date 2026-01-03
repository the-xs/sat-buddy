/*
  Warnings:

  - You are about to drop the column `category` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `file_id` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `module_number` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `test_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `correct_count` on the `test_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `score_percentage` on the `test_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `total_questions` on the `test_sessions` table. All the data in the column will be lost.
  - You are about to drop the `uploaded_files` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `module_id` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question_number` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question_type` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `test_id` to the `test_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `questions` DROP FOREIGN KEY `questions_file_id_fkey`;

-- DropIndex
DROP INDEX `questions_category_idx` ON `questions`;

-- DropIndex
DROP INDEX `questions_module_number_idx` ON `questions`;

-- AlterTable
ALTER TABLE `questions` DROP COLUMN `category`,
    DROP COLUMN `file_id`,
    DROP COLUMN `module_number`,
    ADD COLUMN `difficulty` VARCHAR(191) NULL,
    ADD COLUMN `figure_caption` TEXT NULL,
    ADD COLUMN `figure_url` VARCHAR(191) NULL,
    ADD COLUMN `has_figure` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `module_id` INTEGER NOT NULL,
    ADD COLUMN `question_number` INTEGER NOT NULL,
    ADD COLUMN `question_type` VARCHAR(191) NOT NULL,
    ADD COLUMN `topic` VARCHAR(191) NULL,
    MODIFY `option_a` TEXT NULL,
    MODIFY `option_b` TEXT NULL,
    MODIFY `option_c` TEXT NULL,
    MODIFY `option_d` TEXT NULL,
    MODIFY `correct_answer` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `test_results` ADD COLUMN `time_spent` INTEGER NULL,
    MODIFY `user_answer` TEXT NULL;

-- AlterTable
ALTER TABLE `test_sessions` DROP COLUMN `category`,
    DROP COLUMN `correct_count`,
    DROP COLUMN `score_percentage`,
    DROP COLUMN `total_questions`,
    ADD COLUMN `include_math_module1` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `include_math_module2` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `include_rw_module1` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `include_rw_module2` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `math_score` INTEGER NULL,
    ADD COLUMN `rw_score` INTEGER NULL,
    ADD COLUMN `test_id` INTEGER NOT NULL,
    ADD COLUMN `total_score` INTEGER NULL,
    MODIFY `completed_at` DATETIME(3) NULL;

-- DropTable
DROP TABLE `uploaded_files`;

-- CreateTable
CREATE TABLE `sat_tests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `pdf_filename` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `test_id` INTEGER NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `module_number` INTEGER NOT NULL,
    `time_limit` INTEGER NULL,

    INDEX `modules_test_id_idx`(`test_id`),
    UNIQUE INDEX `modules_test_id_section_module_number_key`(`test_id`, `section`, `module_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `questions_module_id_idx` ON `questions`(`module_id`);

-- CreateIndex
CREATE INDEX `questions_question_type_idx` ON `questions`(`question_type`);

-- CreateIndex
CREATE INDEX `test_sessions_test_id_idx` ON `test_sessions`(`test_id`);

-- AddForeignKey
ALTER TABLE `modules` ADD CONSTRAINT `modules_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `sat_tests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_sessions` ADD CONSTRAINT `test_sessions_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `sat_tests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `test_results` RENAME INDEX `test_results_question_id_fkey` TO `test_results_question_id_idx`;
