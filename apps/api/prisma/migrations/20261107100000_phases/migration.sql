-- Phases of the game (docs/adr/0002-une-table-de-pronostics-pour-toutes-les-phases.md).

-- CreateEnum
CREATE TYPE "BallotPhase" AS ENUM ('QUALIFIERS', 'FIRST_ROUND', 'SECOND_ROUND');

-- Every existing ballot is a qualifiers' one. The default only backfills them: code always sets it.
ALTER TABLE "ballots" ADD COLUMN "phase" "BallotPhase" NOT NULL DEFAULT 'QUALIFIERS';
ALTER TABLE "ballots" ALTER COLUMN "phase" DROP DEFAULT;

-- One draft per user, election and phase.
DROP INDEX "ballots_one_draft_per_user";
CREATE UNIQUE INDEX "ballots_one_draft_per_user" ON "ballots"("user_id", "election_id", "phase") WHERE "status" = 'DRAFT';

-- CreateIndex
CREATE INDEX "ballots_election_id_phase_status_idx" ON "ballots"("election_id", "phase", "status");

-- The old float scores were never written: refuse to drop them if they hold anything.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ballot_entries"
    WHERE "score_first_round" IS NOT NULL OR "score_second_round" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ballot_entries holds scores: migrate them before dropping the columns';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "ballot_entries" ALTER COLUMN "is_candidate" DROP NOT NULL,
  DROP COLUMN "score_first_round",
  DROP COLUMN "score_second_round",
  ADD COLUMN "score" INTEGER;

-- Exactly one value per entry; a score is in tenths of a point, between 0 and 100 %.
-- Not expressible in schema.prisma, hence raw SQL.
ALTER TABLE "ballot_entries"
  ADD CONSTRAINT "ballot_entries_one_value" CHECK (("is_candidate" IS NULL) <> ("score" IS NULL)),
  ADD CONSTRAINT "ballot_entries_score_range" CHECK ("score" BETWEEN 0 AND 1000);

-- AlterTable
ALTER TABLE "elections" ADD COLUMN "first_round_closes_at" TIMESTAMP(3);

-- Reads: one view per kind of prediction, over the latest validated ballot of each user, with
-- typed, non-null columns. A filter on election_id is pushed down below DISTINCT ON.
CREATE VIEW "qualifier_decisions" AS
SELECT b."id" AS "ballot_id", b."user_id", b."election_id", b."validated_at",
       e."politician_id", e."is_candidate"
FROM (
  SELECT DISTINCT ON ("user_id", "election_id") "id", "user_id", "election_id", "validated_at"
  FROM "ballots"
  WHERE "phase" = 'QUALIFIERS' AND "status" = 'VALIDATED'
  ORDER BY "user_id", "election_id", "validated_at" DESC
) b
JOIN "ballot_entries" e ON e."ballot_id" = b."id"
WHERE e."is_candidate" IS NOT NULL;

CREATE VIEW "round_scores" AS
SELECT b."id" AS "ballot_id", b."user_id", b."election_id", b."phase", b."validated_at",
       e."politician_id", e."score"
FROM (
  SELECT DISTINCT ON ("user_id", "election_id", "phase")
         "id", "user_id", "election_id", "phase", "validated_at"
  FROM "ballots"
  WHERE "phase" IN ('FIRST_ROUND', 'SECOND_ROUND') AND "status" = 'VALIDATED'
  ORDER BY "user_id", "election_id", "phase", "validated_at" DESC
) b
JOIN "ballot_entries" e ON e."ballot_id" = b."id"
WHERE e."score" IS NOT NULL;
