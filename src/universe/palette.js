export const COLORS = {
    ink: [0.92, 0.96, 1.0],
    cyan: [0.46, 0.84, 1.0],
    blue: [0.30, 0.56, 0.95],
    violet: [0.58, 0.45, 1.0],
    amber: [0.95, 0.70, 0.34],
    moss: [0.58, 0.70, 0.38],
    rose: [0.80, 0.36, 0.48],
    slate: [0.48, 0.58, 0.70],
};

export const FORMATION_PALETTES = [
    [COLORS.cyan, COLORS.violet, COLORS.slate, COLORS.amber],
    [COLORS.cyan, COLORS.blue, COLORS.violet, COLORS.amber],
    [COLORS.slate, COLORS.moss, COLORS.violet, COLORS.amber],
    [COLORS.amber, COLORS.moss, COLORS.violet, COLORS.slate],
    [COLORS.ink, COLORS.cyan, COLORS.violet, COLORS.amber, COLORS.rose],
    [COLORS.cyan, COLORS.violet, COLORS.rose, COLORS.slate],
    [COLORS.moss, COLORS.amber, COLORS.ink, COLORS.blue],
    [COLORS.ink, COLORS.slate, COLORS.cyan, COLORS.amber],
];
