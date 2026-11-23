-- The first round's real scores and their publication, provisional then official (issue #27).

-- AlterTable
ALTER TABLE "election_candidates" ADD COLUMN     "first_round_score" INTEGER;

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "first_round_results_at" TIMESTAMP(3),
ADD COLUMN     "first_round_results_final" BOOLEAN NOT NULL DEFAULT false;

-- Hundredths of a point, 0 to 100 %.
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_first_round_score_range"
  CHECK ("first_round_score" BETWEEN 0 AND 10000);
