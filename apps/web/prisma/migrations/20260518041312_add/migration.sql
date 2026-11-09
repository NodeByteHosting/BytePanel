-- CreateTable
CREATE TABLE "agent_errors" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_errors_serverId_phase_idx" ON "agent_errors"("serverId", "phase");

-- CreateIndex
CREATE INDEX "agent_errors_agentId_idx" ON "agent_errors"("agentId");

-- CreateIndex
CREATE INDEX "agent_errors_recordedAt_idx" ON "agent_errors"("recordedAt");

-- AddForeignKey
ALTER TABLE "agent_errors" ADD CONSTRAINT "agent_errors_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_errors" ADD CONSTRAINT "agent_errors_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
