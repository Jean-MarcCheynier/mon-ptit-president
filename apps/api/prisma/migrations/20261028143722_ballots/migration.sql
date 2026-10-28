-- CreateEnum
CREATE TYPE "BallotStatus" AS ENUM ('DRAFT', 'VALIDATED');

-- CreateTable
CREATE TABLE "ballots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "status" "BallotStatus" NOT NULL DEFAULT 'DRAFT',
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballot_entries" (
    "id" UUID NOT NULL,
    "ballot_id" UUID NOT NULL,
    "politician_id" UUID NOT NULL,
    "is_candidate" BOOLEAN NOT NULL,
    "score_first_round" DOUBLE PRECISION,
    "score_second_round" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ballot_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ballots_user_id_election_id_idx" ON "ballots"("user_id", "election_id");

-- CreateIndex
CREATE UNIQUE INDEX "ballot_entries_ballot_id_politician_id_key" ON "ballot_entries"("ballot_id", "politician_id");

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballot_entries" ADD CONSTRAINT "ballot_entries_ballot_id_fkey" FOREIGN KEY ("ballot_id") REFERENCES "ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballot_entries" ADD CONSTRAINT "ballot_entries_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one draft per user and election, even under concurrent requests.
-- Not expressible in schema.prisma, hence raw SQL.
CREATE UNIQUE INDEX "ballots_one_draft_per_user" ON "ballots"("user_id", "election_id") WHERE "status" = 'DRAFT';
