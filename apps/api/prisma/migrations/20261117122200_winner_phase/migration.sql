-- The winner's phase (docs/adr/0003). Alone in its migration: a new enum value can't be used in
-- the transaction that adds it.

-- AlterEnum
ALTER TYPE "BallotPhase" ADD VALUE 'WINNER' BEFORE 'FIRST_ROUND';
