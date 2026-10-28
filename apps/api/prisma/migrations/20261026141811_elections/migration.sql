-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('POTENTIAL', 'DECLARED', 'QUALIFIED', 'NOT_QUALIFIED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "elections" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_round_at" TIMESTAMP(3) NOT NULL,
    "second_round_at" TIMESTAMP(3) NOT NULL,
    "predictions_lock_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicians" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photo_url" TEXT,
    "photo_credit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_candidates" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "politician_id" UUID NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'POTENTIAL',
    "party_label" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "election_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "elections_slug_key" ON "elections"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "politicians_slug_key" ON "politicians"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "election_candidates_election_id_politician_id_key" ON "election_candidates"("election_id", "politician_id");

-- AddForeignKey
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
