-- Documents 5.4 : une seule échéance active par document propre et par team. Un index unique partiel : pas de nouvelle
-- colonne, pas de nouvelle table. Les échéances reçues (voiture, equipe) ne sont jamais recopiées (brief 5.4, §1).
CREATE UNIQUE INDEX "documents_deadline_document_actif_key" ON "documents_deadline"("team_id", "source_table", "source_id") WHERE "deleted_at" IS NULL AND "resolved_at" IS NULL;
