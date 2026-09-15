-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "edges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "nodes" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "source" TEXT,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]';
