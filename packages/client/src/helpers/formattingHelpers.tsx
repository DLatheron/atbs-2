import { Misc } from "@atbs/maths";
import { ErrorType } from "@atbs/shared-data";

export interface LevelThreshold {
    threshold: number;
    text: string;
}

interface Attribute {
    value: number;
    max?: number;
}

export const ERROR_MESSAGES: Record<ErrorType, string> = {
    [ErrorType.enum.INSUFFICIENT_ACTION_POINTS]: "Insufficient Action Points",
    [ErrorType.enum.UNABLE_TO_MOVE_THERE]: "Cannot move there",
    [ErrorType.enum.INSUFFICIENT_AMMO]: "Insufficient Ammunition"
    // [ErrorType.enum.INSUFFICIENT_BUDGET]: "Insufficient budget"
};

export const CONSTITUTION_LEVELS: LevelThreshold[] = [
    { threshold: 80, text: "Superb" },
    { threshold: 70, text: "Excellent" },
    { threshold: 60, text: "Very Good" },
    { threshold: 50, text: "Good" },
    { threshold: 40, text: "Average" },
    { threshold: 30, text: "Ok" },
    { threshold: 20, text: "Feeble" },
    { threshold: 10, text: "Pathetic" },
    { threshold: 1, text: "Non-existent" },
    { threshold: 0, text: "Dead" }
];

export const STRENGTH_LEVELS: LevelThreshold[] = [
    { threshold: 80, text: "Herculean" },
    { threshold: 70, text: "Excellent" },
    { threshold: 60, text: "Very Good" },
    { threshold: 50, text: "Good" },
    { threshold: 40, text: "Average" },
    { threshold: 30, text: "Ok" },
    { threshold: 20, text: "Feeble" },
    { threshold: 10, text: "Terrible" },
    { threshold: 0, text: "Pathetic" }
];

export const FITNESS_LEVELS: LevelThreshold[] = [
    { threshold: 80, text: "Herculean" },
    { threshold: 70, text: "Excellent" },
    { threshold: 60, text: "Very Good" },
    { threshold: 50, text: "Good" },
    { threshold: 40, text: "Average" },
    { threshold: 30, text: "Ok" },
    { threshold: 20, text: "Feeble" },
    { threshold: 10, text: "Terrible" },
    { threshold: 0, text: "Pathetic" }
];

export const MORALE_LEVELS: LevelThreshold[] = [
    { threshold: 80, text: "Zealotous" },
    { threshold: 70, text: "Enthusiastic" },
    { threshold: 60, text: "High" },
    { threshold: 50, text: "Positive" },
    { threshold: 40, text: "Average" },
    { threshold: 30, text: "Ok" },
    { threshold: 20, text: "Poor" },
    { threshold: 10, text: "Scared" },
    { threshold: 0, text: "Petrified" }
];

export const STAMINA_LEVELS: LevelThreshold[] = [
    { threshold: 80, text: "Superb" },
    { threshold: 70, text: "Excellent" },
    { threshold: 60, text: "Very Good" },
    { threshold: 50, text: "Good" },
    { threshold: 40, text: "Average" },
    { threshold: 30, text: "Ok" },
    { threshold: 20, text: "Feeble" },
    { threshold: 10, text: "Terrible" },
    { threshold: 1, text: "Exhausted" },
    { threshold: 0, text: "Unconscious" }
];

export const SPEED_LEVELS: LevelThreshold[] = [
    { threshold: 100, text: "The Flash™️" },
    { threshold: 80, text: "Blindingly" },
    { threshold: 70, text: "Superb" },
    { threshold: 60, text: "Good" },
    { threshold: 50, text: "Average" },
    { threshold: 40, text: "Below average" },
    { threshold: 30, text: "Ok" },
    { threshold: 20, text: "Snail-like" },
    { threshold: 10, text: "Ponderous" },
    { threshold: 0, text: "Statuesque" }
];

// export const FIRE_MODE_LOOKUP: Record<string, string> = {
//     [FireMode.AIMED]: "Aimed",
//     [FireMode.SNAPSHOT]: "Snapshot",
//     [FireMode.THROW]: "Throw"
// };

export function levelToText(value: number, levels: LevelThreshold[]): string {
    value = Math.max(value, 0);

    const level = levels.find(({ threshold }) => value >= threshold);
    if (!level) {
        throw new Error(`Unable to find a level suitable for ${value}`);
    }
    return level.text;
}

export function getAttributeString({ value }: Attribute, levels: LevelThreshold[]) {
    return levelToText(value, levels);
}

export function getAttributeValue({ value, max }: Attribute) {
    return max !== undefined ? `${Math.round(value)}/${max.toString()}` : `${Math.round(value)}`;
}

export function renderDescription(description: string[]) {
    return Misc.CastToArray(description).map((line, index) => {
        return <p key={index}>{line}</p>;
    });
}

export function formatAccuracy(accuracy?: number) {
    return accuracy !== undefined ? `${accuracy}%` : "-";
}

export function formatActionPoints(actionPoints?: number, actionPointsPer?: number) {
    return actionPointsPer ? `${actionPoints}(${actionPointsPer})` : (actionPoints ?? "-");
}

export function formatWeight(weight: number) {
    if (weight < 1) {
        return `${Math.round(weight * 1000)}g`;
    } else if (weight < 5) {
        return `${weight.toFixed(2)}kg`;
    } else if (weight < 20) {
        return `${weight.toFixed(1)}kg`;
    } else {
        return `${weight.toFixed()}kg`;
    }
}

export function formatItemName({ quantity, name }: { quantity: number; name: string }) {
    return quantity > 1 ? `${quantity}x ${name}` : name;
}

// export function formatCost({ item, cost, batchSize = 1 }: { item: IBaseItem; cost: number; batchSize?: number }) {
//     function formatCurrency(cost: number) {
//         return `$${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
//     }

//     if (batchSize === 1) {
//         return <span className="store-item-component--cost--total">{formatCurrency(cost)}</span>;
//     }

//     const quantity = Math.min(batchSize, item.quantity);
//     const totalCost = cost * quantity;

//     return (
//         <>
//             <span className="store-item-component--cost--sub-total">
//                 {quantity}@{formatCurrency(cost)}=
//             </span>
//             <span> </span>
//             <span className="store-item-component--cost--total">{formatCurrency(totalCost)}</span>
//         </>
//     );
// }
