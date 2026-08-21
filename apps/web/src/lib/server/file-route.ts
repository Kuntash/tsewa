import { handleApiRequest } from "@/lib/server/api-handlers";

export const readRoute = { GET: handleApiRequest };
export const writeRoute = { POST: handleApiRequest };
export const readWriteRoute = { GET: handleApiRequest, POST: handleApiRequest };
export const readWriteDeleteRoute = {
  GET: handleApiRequest,
  POST: handleApiRequest,
  DELETE: handleApiRequest,
};
export const patchRoute = { PATCH: handleApiRequest };
export const deleteRoute = { DELETE: handleApiRequest };
export const readPatchRoute = { GET: handleApiRequest, PATCH: handleApiRequest };
export const patchDeleteRoute = { PATCH: handleApiRequest, DELETE: handleApiRequest };
export const readPutRoute = { GET: handleApiRequest, PUT: handleApiRequest };
