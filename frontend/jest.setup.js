require('@testing-library/jest-dom');

// jsdom does not implement canvas APIs which leads to console errors when
// components attempt to use `canvas.getContext`. Mock the method here so tests
// that rely on it can run without noisy "Not implemented" warnings.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    strokeRect: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    strokeText: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    translate: jest.fn(),
    transform: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
  })),
});
