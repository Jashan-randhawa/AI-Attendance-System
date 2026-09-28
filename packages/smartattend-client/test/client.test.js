import test from "node:test";
import assert from "node:assert/strict";
import {
  SmartAttendClient,
  ApiError,
  createSmartAttendClient,
} from "../dist/index.js";

test("smartattend-client: URL construction and query parameter formatting", async () => {
  let capturedUrl = "";
  let capturedHeaders = {};

  const mockFetch = async (url, init) => {
    capturedUrl = url;
    capturedHeaders = init.headers;
    return new Response(JSON.stringify([{ id: "p1", name: "Alice" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const client = new SmartAttendClient({
    baseUrl: "http://localhost:8000/api",
    fetch: mockFetch,
  });

  const res = await client.persons.list({ search: "Alice", department: "IT", active_only: true });
  assert.equal(capturedUrl, "http://localhost:8000/api/api/persons/?search=Alice&department=IT&active_only=true");
  assert.equal(res[0].name, "Alice");
});

test("smartattend-client: Bearer token and API-key header propagation", async () => {
  let capturedHeaders = {};

  const mockFetch = async (url, init) => {
    capturedHeaders = init.headers;
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  // Test 1: Bearer token
  const clientWithToken = new SmartAttendClient({
    baseUrl: "http://localhost:8000",
    getAuthToken: () => "jwt_token_123",
    fetch: mockFetch,
  });

  await clientWithToken.dashboard.getMetrics();
  assert.equal(capturedHeaders["Authorization"], "Bearer jwt_token_123");

  // Test 2: API-key fallback
  const clientWithApiKey = new SmartAttendClient({
    baseUrl: "http://localhost:8000",
    apiKey: "secret_api_key",
    fetch: mockFetch,
  });

  await clientWithApiKey.dashboard.getMetrics();
  assert.equal(capturedHeaders["X-API-Key"], "secret_api_key");
});

test("smartattend-client: Error mapping into ApiError with status and message", async () => {
  const mockFetch = async () => {
    return new Response(JSON.stringify({ detail: "Person with this ID not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  const client = new SmartAttendClient({
    baseUrl: "http://localhost:8000",
    fetch: mockFetch,
  });

  await assert.rejects(
    async () => client.persons.get("missing_id"),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      assert.equal(err.message, "Person with this ID not found");
      return true;
    }
  );
});

test("smartattend-client: 204 No Content response handling", async () => {
  const mockFetch = async () => {
    return new Response(null, { status: 204 });
  };

  const client = new SmartAttendClient({
    baseUrl: "http://localhost:8000",
    fetch: mockFetch,
  });

  const res = await client.persons.delete("p_123");
  assert.equal(res, undefined);
});

test("smartattend-client: Form data multipart request does not set json header", async () => {
  let capturedHeaders = {};
  let capturedBody = null;

  const mockFetch = async (url, init) => {
    capturedHeaders = init.headers;
    capturedBody = init.body;
    return new Response(JSON.stringify({ id: "p_new", name: "Bob" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const client = new SmartAttendClient({
    baseUrl: "http://localhost:8000",
    fetch: mockFetch,
  });

  const dummyBlob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
  await client.persons.enroll({
    name: "Bob",
    department: "Sales",
    photos: [dummyBlob],
  });

  // When sending FormData, Content-Type should not be application/json
  assert.equal(capturedHeaders["Content-Type"], undefined);
  assert.ok(capturedBody);
});

test("smartattend-client: createSmartAttendClient factory function", () => {
  const client = createSmartAttendClient({ baseUrl: "https://api.example.com" });
  assert.ok(client instanceof SmartAttendClient);
});
