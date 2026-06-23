import { readdir } from "fs/promises";
import path from "path";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Colour, Orientation } from "@atbs/maths";

import { Image } from "./Image.js";

const ImageDirectories = [
    "./data/terrain",
    "./data/units",
    "./data/items",
    "./data/icons",
    "./data/furniture"
];

const compoundIdRegex =
    /^([a-z0-9-]+)\[([0246])\]_([a-z0-9-]+)\[([0246])\]_([a-z0-9-]+)\[([0246])\].terrain/;

export function isCompoundId(id: string) {
    return compoundIdRegex.test(id);
}

export function decodeCompoundId(id: string) {
    const match = id.match(compoundIdRegex);
    if (!match) {
        throw new Error(`Invalid compound id: ${id}`);
    }

    return {
        background: {
            id: match[1],
            orientation: parseInt(match[2], 10) as Orientation
        },
        blend: {
            id: match[3],
            orientation: parseInt(match[4], 10) as Orientation
        },
        foreground: {
            id: match[5],
            orientation: parseInt(match[6], 10) as Orientation
        }
    };
}

interface ImageDetails {
    id: string;
    image: Image;
    directoryPath: string;
}

export class ImageManager {
    static Singleton = new ImageManager();

    private readonly _idToDetails: Record<string, ImageDetails> = {};

    private constructor() {
        /* Please use ImageManager.Singleton */
    }

    async loadImages(directories = ImageDirectories) {
        for (const directory of directories) {
            await this.loadImagesFromDirectory(directory);
        }
    }

    async loadImagesFromDirectory(directory: string): Promise<void> {
        const directoryContents = await readdir(directory);
        const filenames = directoryContents.filter(
            (filename) => path.parse(filename).ext.toLowerCase() === ".png"
        );
        console.info(filenames);

        for (const filename of filenames) {
            const fullPath = path.join(directory, filename);

            await this.loadImage(fullPath);
        }
    }

    async loadImage(fullPath: string): Promise<void> {
        const { name: id, ext: extension, dir: directoryPath } = path.parse(fullPath);
        if (extension.toLowerCase() !== ".png") {
            throw new Error(`Unsupported image file type: ${extension}`);
        }
        if (this.exists(id)) {
            throw new Error(
                `Image with id: ${id}, already exists at '${this.getImageDetails(id).directoryPath}`
            );
        }

        const image = await Image.Load(fullPath);

        this.addImage(id, directoryPath, image);

        console.info(`Loaded Image: ${id}`);
    }

    getImageDetails(id: string): ImageDetails {
        return this._idToDetails[id];
    }

    findImage(id: string): Image | undefined {
        return this.getImageDetails(id)?.image;
    }

    getImage(id: string): Image {
        const imageDetails = this.getImageDetails(id);
        if (!imageDetails) {
            throw new Error(`Image with id: ${id}, does not exist`);
        }
        return imageDetails.image;
    }

    exists(id: string): boolean {
        return !!this.findImage(id);
    }

    addImage(id: string, directoryPath: string, image: Image): void {
        if (this.exists(id)) {
            throw new Error(
                `Image with id: ${id}, already exists at '${this.getImageDetails(id).directoryPath}`
            );
        }

        const imageEntry: ImageDetails = {
            id,
            directoryPath,
            image
        };

        this._idToDetails[id] = imageEntry;
    }

    removeImage(id: string): void {
        delete this._idToDetails[id];
    }

    async generateBlendedImage(imageId: string) {
        const cacheDirectory = "./public/cache/images/";
        const {
            background: { id: imageId1, orientation: orientation1 },
            blend: { id: blendImageId, orientation: blendOrientation },
            foreground: { id: imageId2, orientation: orientation2 }
        } = decodeCompoundId(imageId);

        // Don't bother creating blends with the same image.
        if (imageId1 === imageId2) {
            return;
        }

        console.info({
            imageId1,
            orientation1,
            blendImageId,
            blendOrientation,
            imageId2,
            orientation2
        });

        const { image: image1 } = this.getImageDetails(imageId1);
        const { image: image2 } = this.getImageDetails(imageId2);
        const { image: blendImage } = this.getImageDetails(blendImageId);
        const outputImage = await Image.Load("./public/terrain/blank.png");

        const { width, height } = outputImage;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const image1Colour = image1.getColour({ x, y }, orientation1);
                const image2Colour = image2.getColour({ x, y }, orientation2);
                const blendColour = blendImage.getColour({ x, y }, blendOrientation);

                const colour = Colour.Blend(image1Colour, image2Colour, blendColour.a);

                outputImage.setColour({ x, y }, 0, colour);
            }
        }

        const fullPath = `${cacheDirectory}${imageId}.png`;
        await outputImage.save(fullPath);

        this.addImage(imageId, cacheDirectory, outputImage);
    }

    async sendImage(res: Response, id: string) {
        let imageEntry = this.getImageDetails(id);
        if (!imageEntry) {
            if (isCompoundId(id)) {
                await this.generateBlendedImage(id);
            }

            imageEntry = this.getImageDetails(id);
            if (!imageEntry) {
                res.sendStatus(StatusCodes.NOT_FOUND);
                return;
            }
        }

        res.sendFile(`${imageEntry.id}.png`, {
            root: imageEntry.directoryPath,
            dotfiles: "deny",
            headers: {
                "x-timestamp": Date.now(), // TODO: Get this from the file???
                "x-sent": true
            }
        });
    }

    private static readonly _singleton = new ImageManager();
    static GetSingleton(): ImageManager {
        return ImageManager._singleton;
    }
}
