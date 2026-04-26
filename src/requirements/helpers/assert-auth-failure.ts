import { assertEquals, assertExists } from "@std/assert";

export async function assertAuthFailure(
  token: string,
  expectedStatus: number,
  expectedCode: string,
  baseUrl = "http://localhost:8000",
): Promise<void> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, expectedStatus);
  assertExists(response.headers.get("WWW-Authenticate"));

  const body = await response.json();
  assertEquals(body.ok, false);
  assertEquals(body.code, expectedCode);
}
