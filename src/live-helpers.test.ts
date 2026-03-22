import { describe, expect, it } from "vitest";
import { findMessageId, resolveChannelList } from "./harness/live/provider-utils.js";

describe("live helper utilities", () => {
  it("extracts nested message ids from provider payloads", () => {
    expect(findMessageId({ result: { message_id: 123 } })).toBe("123");
    expect(findMessageId({ ts: "1710000.000100", message: { id: "abc" } })).toBe("abc");
  });

  it("returns the supported live channel list", () => {
    expect(resolveChannelList()).toEqual(["discord", "telegram", "slack", "mattermost"]);
  });
});
