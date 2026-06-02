import type { Request, Response } from "express";

export type GetImageRequest = Request<{ id: string }>;

export const getImage = async (req: GetImageRequest, res: Response) => {
    const { id } = req.params;
    await req.app.locals.imageManager.sendImage(res, id);
};
