import { statusResponseSchema } from "@atbs/shared-data";
import { getStatus } from "./status.handler.js";

function createMockResponse() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        json(payload: unknown) {
            this.body = payload;
            return this;
        }
    };
    return res;
}

describe("getStatus", () => {
    it("returns a valid status payload", () => {
        const res = createMockResponse();

        getStatus({} as never, res as never, () => undefined);

        expect(statusResponseSchema.parse(res.body)).toEqual({
            status: "ok",
            message: expect.stringContaining("Server is running")
        });
    });
});
