import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createFamilies, createUser, type Families, type TestUser } from "./helpers/fixtures";

// The private `avatars` bucket through the Storage API with real JWTs:
// files live at `<family_id>/<file>`, and only that family's adults can read
// or write them. A and B share F1; C is in F2. Made-up bytes only.

const BUCKET = "avatars";
const ONE_MIB = 1024 * 1024;
// The 8-byte PNG signature; the bucket checks the declared type, not the content.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let a: TestUser;
let b: TestUser;
let c: TestUser;
let families: Families;
let avatarPath: string;
const uploadedByA: string[] = [];

beforeAll(async () => {
  a = await createUser("alex");
  b = await createUser("sam");
  c = await createUser("jordan");
  families = createFamilies({ a: a.id, b: b.id, c: c.id });
  avatarPath = `${families.f1}/avatar.png`;
});

afterAll(async () => {
  if (a && uploadedByA.length > 0) {
    await a.client.storage.from(BUCKET).remove(uploadedByA);
  }
  const users = [a, b, c].filter(Boolean).map((user) => user.id);
  cleanup({ families: families ? [families.f1, families.f2] : [], users });
});

describe("avatars storage", () => {
  it("lets A upload under F1/", async () => {
    const { error } = await a.client.storage
      .from(BUCKET)
      .upload(avatarPath, PNG_BYTES, { contentType: "image/png" });
    expect(error).toBeNull();
    uploadedByA.push(avatarPath);
  });

  it("lets B, an adult of F1, download it", async () => {
    const { data, error } = await b.client.storage.from(BUCKET).download(avatarPath);
    expect(error).toBeNull();
    expect(data?.size).toBe(PNG_BYTES.length);
  });

  it("does not let C, from another family, download it", async () => {
    const { data, error } = await c.client.storage.from(BUCKET).download(avatarPath);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("does not let C upload under F1/", async () => {
    const { error } = await c.client.storage
      .from(BUCKET)
      .upload(`${families.f1}/from-c.png`, PNG_BYTES, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("refuses a file type the bucket does not allow", async () => {
    const { error } = await a.client.storage
      .from(BUCKET)
      .upload(`${families.f1}/animated.gif`, PNG_BYTES, { contentType: "image/gif" });
    expect(error).not.toBeNull();
  });

  it("refuses a file over 1 MiB", async () => {
    const tooBig = new Uint8Array(ONE_MIB + 1);
    const { error } = await a.client.storage
      .from(BUCKET)
      .upload(`${families.f1}/too-big.png`, tooBig, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });
});
