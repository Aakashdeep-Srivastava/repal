-- Phase 1: store the Vault setup-token id while the buyer approves, so the
-- callback can exchange it for a durable payment (vault) token.
ALTER TABLE "Mandate" ADD COLUMN "vaultSetupTokenId" TEXT;
