type CopyInstruction = {
  contentType: string;
  expectedByteSize: number;
  expectedSha256: string;
  sourceKey: string;
  targetKey: string;
};

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID();
    try {
      const url = new URL(request.url);
      if (request.method !== "POST" || url.pathname !== "/copy")
        return new Response(null, { status: 404 });
      if (!(await hasValidToken(request, env.RELAY_TOKEN)))
        return new Response(null, { status: 401 });
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (!Number.isFinite(contentLength) || contentLength > 32_768) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
      const instruction = parseInstruction(await request.json());
      if (!instruction) return Response.json({ error: "Invalid request" }, { status: 400 });

      const source = await env.SOURCE_FILES.get(instruction.sourceKey);
      if (!source) return Response.json({ error: "Source object not found" }, { status: 404 });
      if (source.size !== instruction.expectedByteSize) {
        return Response.json({ error: "Source size mismatch" }, { status: 409 });
      }

      const copied = await env.TARGET_FILES.put(instruction.targetKey, source.body, {
        httpMetadata: { ...source.httpMetadata, contentType: instruction.contentType },
        sha256: hexToBytes(instruction.expectedSha256),
      });
      if (copied.size !== instruction.expectedByteSize) {
        return Response.json({ error: "Target size mismatch" }, { status: 502 });
      }

      console.log(JSON.stringify({ event: "r2_copy_completed", requestId, bytes: copied.size }));
      return Response.json({ byteSize: copied.size, sha256: instruction.expectedSha256 });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "r2_copy_failed",
          requestId,
          error: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      return Response.json({ error: "Copy failed", requestId }, { status: 502 });
    }
  },
} satisfies ExportedHandler<Env>;

async function hasValidToken(request: Request, expected: string): Promise<boolean> {
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

function parseInstruction(value: unknown): CopyInstruction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<Record<keyof CopyInstruction, unknown>>;
  if (
    typeof candidate.sourceKey !== "string" ||
    candidate.sourceKey.length < 1 ||
    candidate.sourceKey.length > 1_024 ||
    typeof candidate.targetKey !== "string" ||
    candidate.targetKey.length < 1 ||
    candidate.targetKey.length > 1_024 ||
    typeof candidate.contentType !== "string" ||
    candidate.contentType.length < 1 ||
    candidate.contentType.length > 255 ||
    typeof candidate.expectedByteSize !== "number" ||
    !Number.isSafeInteger(candidate.expectedByteSize) ||
    candidate.expectedByteSize < 0 ||
    typeof candidate.expectedSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.expectedSha256)
  )
    return null;
  return candidate as CopyInstruction;
}

function hexToBytes(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}
