import type { Request, Response } from "express";

export type GetImageRequest = Request<{ id: string }>;

export const getImage = async (req: GetImageRequest, res: Response) => {
    const { id } = req.params;
    console.info("Serving image", id);
    await req.app.locals.imageManager.sendImage(res, id);
};
