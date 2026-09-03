import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertAllowedEvidenceUpload,
  EvidenceValidationError,
} from "@/src/domain/evidence/validation";

export interface DocumentRecord {
  id: string;
  caseId: string;
  userId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  storagePath: string;
  sha256: string;
  source: string;
  createdAt: string;
}

export async function uploadCaseDocument(params: {
  client: SupabaseClient;
  userId: string;
  caseId: string;
  file: File;
  source?: string;
}): Promise<DocumentRecord> {
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const contentType = params.file.type || "application/octet-stream";

  try {
    assertAllowedEvidenceUpload({
      contentType,
      byteSize: bytes.byteLength,
      filename: params.file.name,
    });
  } catch (error) {
    if (error instanceof EvidenceValidationError) {
      throw error;
    }
    throw error;
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `${params.userId}/${params.caseId}/${sha256}-${params.file.name}`;

  const { error: uploadError } = await params.client.storage
    .from("evidence")
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await params.client
    .from("documents")
    .insert({
      case_id: params.caseId,
      user_id: params.userId,
      filename: params.file.name,
      content_type: contentType,
      byte_size: bytes.byteLength,
      storage_path: storagePath,
      sha256,
      source: params.source ?? "upload",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await params.client
        .from("documents")
        .select("*")
        .eq("case_id", params.caseId)
        .eq("sha256", sha256)
        .single();

      if (existingError || !existing) {
        throw new Error(existingError?.message ?? "Duplicate evidence conflict");
      }

      return mapDocument(existing);
    }

    throw new Error(error.message);
  }

  return mapDocument(data);
}

export async function listCaseDocuments(params: {
  client: SupabaseClient;
  userId: string;
  caseId: string;
}): Promise<DocumentRecord[]> {
  const { data, error } = await params.client
    .from("documents")
    .select("*")
    .eq("case_id", params.caseId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapDocument);
}

function mapDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    userId: String(row.user_id),
    filename: String(row.filename),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size),
    storagePath: String(row.storage_path),
    sha256: String(row.sha256),
    source: String(row.source),
    createdAt: String(row.created_at),
  };
}
