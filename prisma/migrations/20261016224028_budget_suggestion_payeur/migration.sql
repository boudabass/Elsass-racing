-- AlterTable
ALTER TABLE "budget_suggestion" ADD COLUMN     "payer_id" UUID;

-- AddForeignKey
ALTER TABLE "budget_suggestion" ADD CONSTRAINT "budget_suggestion_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "budget_payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
