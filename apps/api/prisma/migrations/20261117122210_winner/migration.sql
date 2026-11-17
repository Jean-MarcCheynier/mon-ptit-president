-- The winner's prediction (docs/adr/0003-le-vainqueur-se-joue-a-cotes-fixes.md): a choice among
-- fixed favorites, "autre candidat" being the favorite without a politician.

-- AlterTable
ALTER TABLE "ballots" ADD COLUMN     "favorite_id" UUID;

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "elected_politician_id" UUID;

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "politician_id" UUID,
    "odds" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_election_id_politician_id_key" ON "favorites"("election_id", "politician_id");

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_elected_politician_id_fkey" FOREIGN KEY ("elected_politician_id") REFERENCES "politicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_favorite_id_fkey" FOREIGN KEY ("favorite_id") REFERENCES "favorites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one "autre candidat" per election (NULLs are distinct in the unique index above).
CREATE UNIQUE INDEX "favorites_one_other" ON "favorites"("election_id") WHERE "politician_id" IS NULL;

-- Not expressible in schema.prisma, hence raw SQL.
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_odds_positive" CHECK ("odds" > 0);

-- The choice belongs to the winner's phase only, and a validated winner's prediction has one.
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_favorite_winner_only" CHECK (
  CASE WHEN "phase" = 'WINNER'
    THEN "status" = 'DRAFT' OR "favorite_id" IS NOT NULL
    ELSE "favorite_id" IS NULL
  END
);

-- Reads: the latest validated winner's prediction of each user, like "round_scores".
-- politician_id is null for "autre candidat".
CREATE VIEW "winner_choices" AS
SELECT b."id" AS "ballot_id", b."user_id", b."election_id", b."validated_at",
       f."id" AS "favorite_id", f."politician_id", f."odds"
FROM (
  SELECT DISTINCT ON ("user_id", "election_id")
         "id", "user_id", "election_id", "validated_at", "favorite_id"
  FROM "ballots"
  WHERE "phase" = 'WINNER' AND "status" = 'VALIDATED'
  ORDER BY "user_id", "election_id", "validated_at" DESC
) b
JOIN "favorites" f ON f."id" = b."favorite_id";
