const COLORS = {
    green: '#64eb84',
    red: '#e73437',
    yellow: '#f0de0f',
    purple: '#a63edd',
    blue: '#1c69d5',
    lightGreen: '#009640',
    pink: '#ffdcfd'
};

// SVG viewBox is 595.28 x 841.89
const DOT_POSITIONS = [
    // Green left column 1 (8 dots)
    {x: 42.91, y: 485.05, color: 'green'},
    {x: 42.91, y: 419.22, color: 'green'},
    {x: 42.91, y: 353.39, color: 'green'},
    {x: 42.91, y: 287.56, color: 'green'},
    // Green left column 2 (4 more dots)
    {x: 114.21, y: 485.05, color: 'green'},
    {x: 114.21, y: 419.22, color: 'green'},
    {x: 114.21, y: 353.39, color: 'green'},
    {x: 114.21, y: 287.56, color: 'green'},
    // Red center columns (12 dots)
    {x: 248.36, y: 495.00, color: 'red'},
    {x: 248.36, y: 429.17, color: 'red'},
    {x: 248.36, y: 363.34, color: 'red'},
    {x: 248.36, y: 297.51, color: 'red'},
    {x: 319.65, y: 495.00, color: 'red'},
    {x: 319.65, y: 429.17, color: 'red'},
    {x: 319.65, y: 363.34, color: 'red'},
    {x: 319.65, y: 297.51, color: 'red'},
    {x: 390.95, y: 495.00, color: 'red'},
    {x: 390.95, y: 429.17, color: 'red'},
    {x: 390.95, y: 363.34, color: 'red'},
    {x: 390.95, y: 297.51, color: 'red'},
    // Yellow right column (4 dots)
    {x: 545.33, y: 479.64, color: 'yellow'},
    {x: 545.33, y: 413.81, color: 'yellow'},
    {x: 545.33, y: 347.99, color: 'yellow'},
    {x: 545.33, y: 282.16, color: 'yellow'},
    // Blue and Purple bottom rows (12 dots)
    {x: 148.88, y: 646.25, color: 'blue'},
    {x: 214.71, y: 646.25, color: 'blue'},
    {x: 280.54, y: 646.25, color: 'blue'},
    {x: 346.37, y: 646.25, color: 'purple'},
    {x: 412.20, y: 646.25, color: 'purple'},
    {x: 478.03, y: 646.25, color: 'purple'},
    {x: 148.88, y: 578.28, color: 'blue'},
    {x: 214.71, y: 578.28, color: 'blue'},
    {x: 280.54, y: 578.28, color: 'blue'},
    {x: 346.37, y: 578.28, color: 'purple'},
    {x: 412.20, y: 578.28, color: 'purple'},
    {x: 478.03, y: 578.28, color: 'purple'},
    // Yellow bottom row (4 dots)
    {x: 188.10, y: 764.83, color: 'yellow'},
    {x: 253.93, y: 764.83, color: 'yellow'},
    {x: 319.76, y: 764.83, color: 'yellow'},
    {x: 385.59, y: 764.83, color: 'yellow'},
    // Pink and Light Green top rows (12 dots)
    {x: 142.70, y: 191.40, color: 'pink'},
    {x: 208.53, y: 191.40, color: 'pink'},
    {x: 274.36, y: 191.40, color: 'pink'},
    {x: 340.19, y: 191.40, color: 'lightGreen'},
    {x: 406.02, y: 191.40, color: 'lightGreen'},
    {x: 471.85, y: 191.40, color: 'lightGreen'},
    {x: 142.70, y: 123.43, color: 'pink'},
    {x: 208.53, y: 123.43, color: 'pink'},
    {x: 274.36, y: 123.43, color: 'pink'},
    {x: 340.19, y: 123.43, color: 'lightGreen'},
    {x: 406.02, y: 123.43, color: 'lightGreen'},
    {x: 471.85, y: 123.43, color: 'lightGreen'}
];

const SVG_WIDTH = 595.28;
const SVG_HEIGHT = 841.89;
const DOT_RADIUS = 27.93; // Original SVG dot radius

const canvas = document.getElementById('dotPatternCanvas');
const ctx = canvas.getContext('2d');

function isDarkMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function setBlendMode() {
    if (isDarkMode()) {
        canvas.style.mixBlendMode = 'difference';
    } else {
        canvas.style.mixBlendMode = 'multiply';
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = 9999;
    setBlendMode();
}

function getRandomDotsFromColor(color, count) {
    const dotsOfColor = DOT_POSITIONS.filter(dot => dot.color === color);
    const shuffled = [...dotsOfColor].sort(() => 0.5 - Math