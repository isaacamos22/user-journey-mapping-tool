import { requireSessionUser } from "@/lib/auth/sessionUser";
import { assertNotGuest } from "@/lib/auth/guestAuth";
import { prisma } from "@/lib/db";
import { parseCsvImport, parseJsonImport } from "@/lib/import/extractors/csvJson";
import { parseBufferByFileName } from "@/lib/import/extractors/parseBufferByFileName";
import {
  fetchFigmaFile,
  fileKeyFromFigJamUrl,
  parseFigJamDocument,
} from "@/lib/import/figma/parseFigJamNodes";
import type { ImportDraft } from "@/lib/import/types";
import { enrichImportDraft } from "@/lib/import/enrichImportDraft";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  assertNotGuest(user);

  const contentType = req.headers.get("content-type") || "";
  let draft: ImportDraft | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    if (body.figmaUrl) {
      const key = fileKeyFromFigJamUrl(body.figmaUrl);
      const token =
        body.token ||
        process.env.FIGMA_PERSONAL_ACCESS_TOKEN ||
        (
          await prisma.userPreference.findUnique({
            where: { userId: user.id },
          })
        )?.figmaPat;
      if (!key || !token) {
        return Response.json({ error: "Figma URL and token required" }, { status: 400 });
      }
      const file = await fetchFigmaFile(key, token);
      draft = parseFigJamDocument(file);
    } else if (body.json) {
      draft = parseJsonImport(body.json);
    } else if (body.draft) {
      draft = body.draft as ImportDraft;
    }
  } else if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return Response.json({ error: "No file" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    draft = await parseBufferByFileName(buf, file.name);
    if (!draft) {
      return Response.json(
        {
          error: `Could not parse ${file.name}. Supported: csv, json, xlsx, xls, docx, pdf, html, md, txt, zip (including files inside).`,
        },
        { status: 400 }
      );
    }
  } else if (contentType.includes("text/")) {
    const text = await req.text();
    draft = text.trim().startsWith("{") ? parseJsonImport(text) : parseCsvImport(text);
  }

  if (!draft) return Response.json({ error: "Could not parse input" }, { status: 400 });

  const { draft: enriched, enrichment } = await enrichImportDraft(draft);
  draft = enriched;

  const job = await prisma.importJob.create({
    data: {
      status: "REVIEW",
      sourceType: "upload",
      draftJson: JSON.stringify(draft),
    },
  });

  return Response.json({ jobId: job.id, draft, enrichment });
}