// mocks/navigator.mediaDevices.js

const mockMediaDevices = {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn(),
    getDisplayMedia: jest.fn(),
  };
  
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: mockMediaDevices,
    writable: true,
  });
  
  export default mockMediaDevices;