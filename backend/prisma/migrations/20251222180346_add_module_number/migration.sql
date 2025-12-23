-- AlterTable
ALTER TABLE `questions` ADD COLUMN `module_number` INTEGER NULL;

-- CreateIndex
CREATE INDEX `questions_module_number_idx` ON `questions`(`module_number`);
